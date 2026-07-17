import type { AdminUser, AdminUserGroup, UsageGroupRow } from "./admin-types";

export interface UsageGroupRankingRow {
  groupId: string;
  groupName: string;
  total: number;
}

export function buildUsageGroupRanking(
  usageGroups: UsageGroupRow[],
  directoryGroups: AdminUserGroup[],
  directoryUsers: AdminUser[],
  selectedGroupId = "",
): UsageGroupRankingRow[] {
  const rows = new Map<string, UsageGroupRankingRow>();

  for (const group of usageGroups) {
    rows.set(group.groupId, {
      groupId: group.groupId,
      groupName: group.groupName,
      total: group.total,
    });
  }

  for (const group of directoryGroups) {
    if (selectedGroupId && group.id !== selectedGroupId) continue;
    const existing = rows.get(group.id);
    rows.set(group.id, {
      groupId: group.id,
      groupName: group.name,
      total: existing?.total || 0,
    });
  }

  if (!selectedGroupId && directoryUsers.some((user) => !user.groupId) && !rows.has("ungrouped")) {
    rows.set("ungrouped", {
      groupId: "ungrouped",
      groupName: "未分组",
      total: 0,
    });
  }

  return [...rows.values()].sort(
    (a, b) => b.total - a.total || a.groupName.localeCompare(b.groupName, "zh-CN") || a.groupId.localeCompare(b.groupId),
  );
}
