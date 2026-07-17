import { describe, expect, it } from "vitest";

import { buildUsageGroupRanking } from "./admin-usage-group-ranking";

const directoryGroups = [
  { id: "group-a", name: "A 组" },
  { id: "group-b", name: "B 组" },
  { id: "group-c", name: "C 组" },
] as any;

const directoryUsers = [
  { id: "user-a", groupId: "group-a" },
  { id: "user-ungrouped" },
] as any;

describe("buildUsageGroupRanking", () => {
  it("shows every directory group and the ungrouped bucket, including zero-use rows", () => {
    const rows = buildUsageGroupRanking([
      { groupId: "group-b", groupName: "旧 B 组", total: 12 },
      { groupId: "group-a", groupName: "A 组", total: 7 },
      { groupId: "ungrouped", groupName: "未分组", total: 4 },
    ] as any, directoryGroups, directoryUsers);

    expect(rows.map(({ groupId, groupName, total }) => ({ groupId, groupName, total }))).toEqual([
      { groupId: "group-b", groupName: "B 组", total: 12 },
      { groupId: "group-a", groupName: "A 组", total: 7 },
      { groupId: "ungrouped", groupName: "未分组", total: 4 },
      { groupId: "group-c", groupName: "C 组", total: 0 },
    ]);
  });

  it("only supplements the selected group", () => {
    const rows = buildUsageGroupRanking([], directoryGroups, directoryUsers, "group-c");

    expect(rows).toEqual([{ groupId: "group-c", groupName: "C 组", total: 0 }]);
  });

  it("adds a zero-use ungrouped row when current accounts are ungrouped", () => {
    const rows = buildUsageGroupRanking([], [], directoryUsers);

    expect(rows).toEqual([{ groupId: "ungrouped", groupName: "未分组", total: 0 }]);
  });
});
