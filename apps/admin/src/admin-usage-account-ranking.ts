import type { AdminUser, UsageUserRow } from "./admin-types";

export interface UsageAccountRankingRow {
  userId: string;
  email: string;
  total: number;
  ownerDeleted?: boolean;
}

export function buildUsageAccountRanking(
  usageUsers: UsageUserRow[],
  directoryUsers: AdminUser[],
  groupId = "",
): UsageAccountRankingRow[] {
  const rows = new Map<string, UsageAccountRankingRow>();

  for (const user of usageUsers) {
    rows.set(user.userId, {
      userId: user.userId,
      email: user.email,
      total: user.total,
      ownerDeleted: user.ownerDeleted,
    });
  }

  for (const user of directoryUsers) {
    if (groupId && user.groupId !== groupId) continue;
    const existing = rows.get(user.id);
    rows.set(user.id, {
      userId: user.id,
      email: user.email,
      total: existing?.total || 0,
      ownerDeleted: false,
    });
  }

  return [...rows.values()].sort(
    (a, b) => b.total - a.total || a.email.localeCompare(b.email, "zh-CN") || a.userId.localeCompare(b.userId),
  );
}
