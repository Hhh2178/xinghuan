import { describe, expect, it } from "vitest";

import { buildUsageAccountRanking } from "./admin-usage-account-ranking";

const directoryUsers = [
  { id: "user-a", email: "a@example.test", groupId: "group-1" },
  { id: "user-b", email: "b@example.test", groupId: "group-1" },
  { id: "user-c", email: "c@example.test", groupId: "group-2" },
] as any;

describe("buildUsageAccountRanking", () => {
  it("shows every directory account, including zero-use accounts, sorted from highest use", () => {
    const rows = buildUsageAccountRanking([
      { userId: "user-b", email: "old-b@example.test", total: 12 },
      { userId: "deleted-user", email: "已删除账号", total: 4, ownerDeleted: true },
      { userId: "user-a", email: "a@example.test", total: 7 },
    ] as any, directoryUsers);

    expect(rows.map(({ userId, email, total }) => ({ userId, email, total }))).toEqual([
      { userId: "user-b", email: "b@example.test", total: 12 },
      { userId: "user-a", email: "a@example.test", total: 7 },
      { userId: "deleted-user", email: "已删除账号", total: 4 },
      { userId: "user-c", email: "c@example.test", total: 0 },
    ]);
  });

  it("only supplements zero-use accounts from the selected group", () => {
    const rows = buildUsageAccountRanking([
      { userId: "user-a", email: "a@example.test", total: 3, groupId: "group-1" },
    ] as any, directoryUsers, "group-1");

    expect(rows.map((row) => [row.userId, row.total])).toEqual([
      ["user-a", 3],
      ["user-b", 0],
    ]);
  });
});
