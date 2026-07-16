import type { GroupPermissionDenyLists } from "../group-permission-policy.js";

export interface DefaultOpenMigrationRow {
  groupId: string;
  groupCreatedAt: number;
  policyUpdatedAt: number;
  deny: GroupPermissionDenyLists;
  migratedDenyRuleCount: number;
  otherDenyRuleCount: number;
}

export function planDefaultOpenMigration(
  rows: DefaultOpenMigrationRow[],
  options?: { principalId?: string },
) {
  const scoped = options?.principalId
    ? rows.filter((row) => row.groupId === options.principalId)
    : rows;
  const defaultClosed = scoped.filter((row) => isAllDenied(row.deny));
  const candidates = defaultClosed.filter((row) =>
    Math.abs(row.policyUpdatedAt - row.groupCreatedAt) <= 1_000 && row.otherDenyRuleCount === 0,
  );
  const blocked = defaultClosed.filter((row) => !candidates.includes(row));
  return {
    candidates,
    blocked,
    metrics: {
      scanned: scoped.length,
      candidates: candidates.length,
      blocked: blocked.length,
      migratedDenyRulesToDelete: candidates.reduce((sum, row) => sum + row.migratedDenyRuleCount, 0),
    },
  };
}

function isAllDenied(deny: GroupPermissionDenyLists) {
  return [
    deny.sharedResourceCategoryIds,
    deny.sharedResourceItemIds,
    deny.runningHubAppCatalogIds,
    deny.runningHubWorkflowCatalogIds,
    deny.nodeTypes,
  ].every((values) => values.length === 1 && values[0] === "*");
}
