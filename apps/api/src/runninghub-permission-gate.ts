import type { RhCatalogGroup, RhCatalogItem } from "@xinghuan/shared";
import { runningHubAppSubjectKey, runningHubGroupSubjectKey, runningHubWorkflowSubjectKey } from "./permissions/permission-subject-registrars.js";

export interface RunningHubPermissionDecision {
  allowed: boolean;
  reason?: string;
}

export async function decideRunningHubAccess(input: {
  item: Pick<RhCatalogItem, "catalogId" | "kind" | "providerId" | "groupId">;
  group?: Pick<RhCatalogGroup, "id" | "providerId" | "enabled">;
  action: "view" | "execute";
  decide: (subjectKey: string, action: "view" | "execute") => Promise<RunningHubPermissionDecision>;
  itemLegacyAllowed?: boolean;
  groupLegacyAllowed?: boolean;
}) {
  if (input.group?.enabled === false) {
    return { allowed: false, groupDecision: { allowed: false, reason: "group-disabled" }, itemDecision: { allowed: false, reason: "group-disabled" } };
  }
  let groupDecision: RunningHubPermissionDecision | undefined;
  if (input.item.groupId) groupDecision = input.groupLegacyAllowed === false
    ? { allowed: false, reason: "legacy-group-policy" }
    : await input.decide(runningHubGroupSubjectKey(input.item.providerId, input.item.groupId), input.action);
  if (groupDecision && !groupDecision.allowed) return { allowed: false, groupDecision, itemDecision: { allowed: false, reason: "group-denied" } };
  const itemDecision = input.itemLegacyAllowed === false
    ? { allowed: false, reason: "legacy-item-policy" }
    : await input.decide(
      input.item.kind === "app" ? runningHubAppSubjectKey(input.item.catalogId) : runningHubWorkflowSubjectKey(input.item.catalogId),
      input.action,
    );
  if (!groupDecision) return { allowed: itemDecision.allowed, itemDecision };
  return { allowed: groupDecision.allowed && itemDecision.allowed, groupDecision, itemDecision };
}
