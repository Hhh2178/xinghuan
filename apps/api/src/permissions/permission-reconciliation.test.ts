import { describe, expect, it } from "vitest";
import type { PermissionRule, PermissionSubject } from "@xinghuan/shared";
import { buildPermissionReconciliationPlan } from "./permission-reconciliation.js";

const subjects: PermissionSubject[] = [
  {
    subjectKey: "provider.model/*",
    domain: "provider",
    subjectType: "model-family",
    parentKeys: [],
    sourceId: "provider-model-family",
    exposureState: "restricted",
    displayName: "Models",
    metadata: { parent: true },
    revision: 1,
  },
  {
    subjectKey: "provider.model/model-a",
    domain: "provider",
    subjectType: "model",
    parentKeys: ["provider.model/*"],
    sourceId: "model-a",
    exposureState: "restricted",
    displayName: "Model A",
    metadata: {},
    revision: 1,
  },
  {
    subjectKey: "runninghub.app/app-a",
    domain: "runninghub",
    subjectType: "app",
    parentKeys: ["runninghub.app/*"],
    sourceId: "app-a",
    exposureState: "restricted",
    displayName: "App A",
    metadata: {},
    revision: 1,
  },
];

describe("permission reconciliation", () => {
  it("converts explicit legacy allow state without publishing parent families", () => {
    const plan = buildPermissionReconciliationPlan({
      subjects,
      rules: [],
      groupIds: ["group-a"],
      legacyPolicies: [
        { groupId: "group-a", deny: { runningHubAppCatalogIds: [], runningHubWorkflowCatalogIds: [], sharedResourceCategoryIds: [], sharedResourceItemIds: [], nodeTypes: [] } },
        { groupId: "ungrouped", deny: { runningHubAppCatalogIds: [], runningHubWorkflowCatalogIds: [], sharedResourceCategoryIds: [], sharedResourceItemIds: [], nodeTypes: [] } },
      ],
      missingPolicy: "deny",
    });

    expect(plan.subjectUpdates).toContainEqual(expect.objectContaining({ subjectKey: "provider.model/model-a", exposureState: "published" }));
    expect(plan.subjectUpdates).toContainEqual(expect.objectContaining({ subjectKey: "runninghub.app/app-a", exposureState: "published" }));
    expect(plan.subjectUpdates).not.toContainEqual(expect.objectContaining({ subjectKey: "provider.model/*", exposureState: "published" }));
    expect(plan.ruleUpserts).toContainEqual(expect.objectContaining({ principalId: "group-a", subjectKey: "provider.model/model-a", action: "view", effect: "allow" }));
    expect(plan.ruleUpserts).toContainEqual(expect.objectContaining({ principalId: "ungrouped", subjectKey: "runninghub.app/app-a", action: "execute", effect: "allow" }));
    expect(plan.unresolvedPrincipalIds).toEqual([]);
  });

  it("does not silently allow a named group with no legacy policy", () => {
    const plan = buildPermissionReconciliationPlan({
      subjects,
      rules: [],
      groupIds: ["group-a"],
      legacyPolicies: [],
      missingPolicy: "unresolved",
    });

    expect(plan.unresolvedPrincipalIds).toEqual(expect.arrayContaining(["group-a", "ungrouped"]));
    expect(plan.ruleUpserts).toEqual([]);
  });

  it("treats provider models as denied when a missing policy is explicitly resolved to deny", () => {
    const plan = buildPermissionReconciliationPlan({
      subjects,
      rules: [],
      groupIds: ["group-a"],
      legacyPolicies: [],
      missingPolicy: "deny",
    });

    expect(plan.ruleUpserts).toContainEqual(expect.objectContaining({
      principalId: "group-a",
      subjectKey: "provider.model/model-a",
      action: "view",
      effect: "deny",
    }));
  });

  it("preserves explicit legacy denies when registrar source IDs have prefixes", () => {
    const prefixedSubjects: PermissionSubject[] = [
      {
        subjectKey: "canvas.node/video",
        domain: "canvas",
        subjectType: "node",
        parentKeys: ["canvas.node/*"],
        sourceId: "node:video",
        exposureState: "restricted",
        displayName: "Video",
        metadata: {},
        revision: 1,
      },
      {
        subjectKey: "runninghub.app/provider:app:item-a",
        domain: "runninghub",
        subjectType: "app",
        parentKeys: ["runninghub.app/*"],
        sourceId: "app:provider:app:item-a",
        exposureState: "restricted",
        displayName: "App A",
        metadata: {},
        revision: 1,
      },
    ];
    const plan = buildPermissionReconciliationPlan({
      subjects: prefixedSubjects,
      rules: [],
      groupIds: ["group-a"],
      legacyPolicies: [{
        groupId: "group-a",
        deny: {
          runningHubAppCatalogIds: ["provider:app:item-a"],
          runningHubWorkflowCatalogIds: [],
          sharedResourceCategoryIds: [],
          sharedResourceItemIds: [],
          nodeTypes: ["video"],
        },
      }],
      missingPolicy: "deny",
    });

    expect(plan.ruleUpserts).toContainEqual(expect.objectContaining({
      principalId: "group-a",
      subjectKey: "canvas.node/video",
      effect: "deny",
    }));
    expect(plan.ruleUpserts).toContainEqual(expect.objectContaining({
      principalId: "group-a",
      subjectKey: "runninghub.app/provider:app:item-a",
      effect: "deny",
    }));
  });

  it("carries a denied resource category down to its item rules", () => {
    const resourceSubject: PermissionSubject = {
      subjectKey: "resource.item/item-a",
      domain: "resource",
      subjectType: "item",
      parentKeys: ["resource.category/category-a", "resource.category/*", "resource/*"],
      sourceId: "item:item-a",
      exposureState: "restricted",
      displayName: "Item A",
      metadata: {},
      revision: 1,
    };
    const plan = buildPermissionReconciliationPlan({
      subjects: [resourceSubject],
      rules: [],
      groupIds: ["group-a"],
      legacyPolicies: [{
        groupId: "group-a",
        deny: {
          runningHubAppCatalogIds: [],
          runningHubWorkflowCatalogIds: [],
          sharedResourceCategoryIds: ["category-a"],
          sharedResourceItemIds: [],
          nodeTypes: [],
        },
      }],
      missingPolicy: "deny",
    });

    expect(plan.ruleUpserts).toContainEqual(expect.objectContaining({
      principalId: "group-a",
      subjectKey: "resource.item/item-a",
      effect: "deny",
    }));
  });

  it("is idempotent after applying its own subject and rule changes", () => {
    const first = buildPermissionReconciliationPlan({
      subjects,
      rules: [],
      groupIds: [],
      legacyPolicies: [
        { groupId: "ungrouped", deny: { runningHubAppCatalogIds: [], runningHubWorkflowCatalogIds: [], sharedResourceCategoryIds: [], sharedResourceItemIds: [], nodeTypes: [] } },
      ],
      missingPolicy: "deny",
    });
    const nextSubjects = subjects.map((current) => first.subjectUpdates.find((item) => item.subjectKey === current.subjectKey) || current);
    const nextRules = [...first.ruleUpserts] as PermissionRule[];
    const second = buildPermissionReconciliationPlan({
      subjects: nextSubjects,
      rules: nextRules,
      groupIds: [],
      legacyPolicies: [
        { groupId: "ungrouped", deny: { runningHubAppCatalogIds: [], runningHubWorkflowCatalogIds: [], sharedResourceCategoryIds: [], sharedResourceItemIds: [], nodeTypes: [] } },
      ],
      missingPolicy: "deny",
    });

    expect(second.subjectUpdates).toEqual([]);
    expect(second.ruleUpserts).toEqual([]);
  });

  it("never overwrites an existing unified rule with legacy state", () => {
    const existingRule: PermissionRule = {
      id: "admin-rule",
      principalType: "group",
      principalId: "ungrouped",
      subjectKey: "provider.model/model-a",
      action: "view",
      effect: "deny",
      revision: 4,
    };
    const plan = buildPermissionReconciliationPlan({
      subjects,
      rules: [existingRule],
      groupIds: [],
      legacyPolicies: [
        { groupId: "ungrouped", deny: { runningHubAppCatalogIds: [], runningHubWorkflowCatalogIds: [], sharedResourceCategoryIds: [], sharedResourceItemIds: [], nodeTypes: [] } },
      ],
      missingPolicy: "deny",
    });

    expect(plan.ruleUpserts).not.toContainEqual(expect.objectContaining({
      principalId: "ungrouped",
      subjectKey: "provider.model/model-a",
      action: "view",
    }));
  });

  it("plans removal of rules that target retired subjects", () => {
    const retiredSubject = { ...subjects[1], exposureState: "retired" as const, revision: 3 };
    const retiredRule: PermissionRule = {
      id: "legacy-retired-rule",
      principalType: "group",
      principalId: "group-a",
      subjectKey: retiredSubject.subjectKey,
      action: "view",
      effect: "allow",
      revision: 2,
    };
    const plan = buildPermissionReconciliationPlan({
      subjects: [retiredSubject],
      rules: [retiredRule],
      groupIds: [],
      legacyPolicies: [{ groupId: "ungrouped", deny: { runningHubAppCatalogIds: [], runningHubWorkflowCatalogIds: [], sharedResourceCategoryIds: [], sharedResourceItemIds: [], nodeTypes: [] } }],
      missingPolicy: "deny",
    });

    expect(plan.ruleDeletes).toEqual([retiredRule]);
    expect(plan.metrics.ruleDeletes).toBe(1);
    expect(plan.ruleUpserts).toEqual([]);
  });
});
