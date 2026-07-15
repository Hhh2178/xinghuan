import { createHash } from "node:crypto";
import type {
  PermissionRule,
  PermissionSubject,
} from "@xinghuan/shared";
import type {
  GroupPermissionDenyLists,
  GroupPermissionPolicy,
} from "../group-permission-policy.js";
import {
  isPermissionLeaf,
  requiredPermissionActions,
} from "./permission-subject-actions.js";

export type MissingLegacyPolicyMode = "allow" | "deny" | "unresolved";

export interface PermissionReconciliationPlan {
  subjectUpdates: PermissionSubject[];
  ruleUpserts: PermissionRule[];
  unresolvedPrincipalIds: string[];
  metrics: {
    subjectUpdates: number;
    ruleUpserts: number;
    unresolvedPrincipals: number;
  };
}

type LegacyPolicyInput = Pick<GroupPermissionPolicy, "groupId" | "deny">;
type EffectiveLegacyPolicy = LegacyPolicyInput & { allowProviderModels: boolean };

const EMPTY_DENY: GroupPermissionDenyLists = {
  sharedResourceCategoryIds: [],
  sharedResourceItemIds: [],
  runningHubAppCatalogIds: [],
  runningHubWorkflowCatalogIds: [],
  nodeTypes: [],
};

const DENY_ALL: GroupPermissionDenyLists = {
  sharedResourceCategoryIds: ["*"],
  sharedResourceItemIds: ["*"],
  runningHubAppCatalogIds: ["*"],
  runningHubWorkflowCatalogIds: ["*"],
  nodeTypes: ["*"],
};

export function buildPermissionReconciliationPlan(input: {
  subjects: PermissionSubject[];
  rules: PermissionRule[];
  groupIds: string[];
  legacyPolicies: LegacyPolicyInput[];
  missingPolicy: MissingLegacyPolicyMode;
}): PermissionReconciliationPlan {
  const principalIds = [...new Set([...input.groupIds.filter(Boolean), "ungrouped"] )];
  const policies = new Map(input.legacyPolicies.map((policy) => [policy.groupId, policy]));
  const unresolvedPrincipalIds: string[] = [];
  const effectivePolicies = new Map<string, EffectiveLegacyPolicy>();

  for (const principalId of principalIds) {
    const existing = policies.get(principalId);
    if (existing) {
      effectivePolicies.set(principalId, { ...existing, allowProviderModels: true });
      continue;
    }
    if (input.missingPolicy === "unresolved") {
      unresolvedPrincipalIds.push(principalId);
      continue;
    }
    effectivePolicies.set(principalId, {
      groupId: principalId,
      deny: input.missingPolicy === "allow" ? EMPTY_DENY : DENY_ALL,
      allowProviderModels: input.missingPolicy === "allow",
    });
  }

  const subjectUpdates: PermissionSubject[] = [];
  const ruleUpserts: PermissionRule[] = [];
  const existingRules = new Map(
    input.rules.map((rule) => [ruleIdentity(rule), rule]),
  );

  for (const subject of input.subjects) {
    if (!isPermissionLeaf(subject)) continue;
    const actions = requiredPermissionActions(subject);
    if (actions.length === 0) continue;
    let allowedForAnyPrincipal = false;

    for (const [principalId, policy] of effectivePolicies) {
      const effect = legacyAllowsSubject(policy, subject) ? "allow" : "deny";
      if (effect === "allow") allowedForAnyPrincipal = true;
      for (const action of actions) {
        const candidate: PermissionRule = {
          id: stableRuleId(principalId, subject.subjectKey, action),
          principalType: "group",
          principalId,
          subjectKey: subject.subjectKey,
          action,
          effect,
          revision: 1,
        };
        const current = existingRules.get(ruleIdentity(candidate));
        if (current) continue;
        ruleUpserts.push(candidate);
      }
    }

    if (
      allowedForAnyPrincipal &&
      subject.exposureState === "restricted"
    ) {
      subjectUpdates.push({
        ...subject,
        exposureState: "published",
        revision: subject.revision + 1,
      });
    }
  }

  return {
    subjectUpdates,
    ruleUpserts,
    unresolvedPrincipalIds,
    metrics: {
      subjectUpdates: subjectUpdates.length,
      ruleUpserts: ruleUpserts.length,
      unresolvedPrincipals: unresolvedPrincipalIds.length,
    },
  };
}

function legacyAllowsSubject(
  policy: EffectiveLegacyPolicy,
  subject: PermissionSubject,
) {
  const deny = policy.deny;
  const identifiers = legacySubjectIdentifiers(subject);
  if (subject.domain === "provider" && subject.subjectType === "model") return policy.allowProviderModels;
  if (subject.domain === "runninghub" && subject.subjectType === "app") {
    return !denies(deny.runningHubAppCatalogIds, identifiers);
  }
  if (subject.domain === "runninghub" && subject.subjectType === "workflow") {
    return !denies(deny.runningHubWorkflowCatalogIds, identifiers);
  }
  if (subject.domain === "canvas" && subject.subjectType === "node") {
    return !denies(deny.nodeTypes, identifiers);
  }
  if (subject.domain === "resource" && subject.subjectType === "category") {
    return !denies(deny.sharedResourceCategoryIds, identifiers);
  }
  if (subject.domain === "resource" && subject.subjectType === "item") {
    const categoryIdentifiers = subject.parentKeys
      .filter((parentKey) => parentKey.startsWith("resource.category/") && !parentKey.endsWith("/*"))
      .flatMap((parentKey) => [parentKey, parentKey.slice("resource.category/".length)]);
    return !denies(deny.sharedResourceItemIds, identifiers) &&
      !denies(deny.sharedResourceCategoryIds, categoryIdentifiers);
  }
  return false;
}

function legacySubjectIdentifiers(subject: PermissionSubject) {
  const subjectSuffix = subject.subjectKey.slice(subject.subjectKey.indexOf("/") + 1);
  const sourceSuffix = subject.sourceId.includes(":")
    ? subject.sourceId.slice(subject.sourceId.indexOf(":") + 1)
    : subject.sourceId;
  return [...new Set([subject.sourceId, sourceSuffix, subject.subjectKey, subjectSuffix].filter(Boolean))];
}

function denies(values: string[], identifiers: string[]) {
  return values.includes("*") || identifiers.some((identifier) => values.includes(identifier));
}

function ruleIdentity(
  rule: Pick<PermissionRule, "principalType" | "principalId" | "subjectKey" | "action">,
) {
  return [rule.principalType, rule.principalId, rule.subjectKey, rule.action].join("\u0000");
}

function stableRuleId(
  principalId: string,
  subjectKey: string,
  action: PermissionRule["action"],
) {
  return `perm-migrated-${createHash("sha256")
    .update([principalId, subjectKey, action].join("\u0000"))
    .digest("hex")
    .slice(0, 24)}`;
}
