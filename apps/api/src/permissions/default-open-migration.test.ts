import { describe, expect, it } from "vitest";

import { planDefaultOpenMigration, type DefaultOpenMigrationRow } from "./default-open-migration.js";

const allDenied = {
  sharedResourceCategoryIds: ["*"],
  sharedResourceItemIds: ["*"],
  runningHubAppCatalogIds: ["*"],
  runningHubWorkflowCatalogIds: ["*"],
  nodeTypes: ["*"],
};

function row(patch: Partial<DefaultOpenMigrationRow> = {}): DefaultOpenMigrationRow {
  return {
    groupId: "group-a",
    groupCreatedAt: 100_000,
    policyUpdatedAt: 100_000,
    deny: allDenied,
    migratedDenyRuleCount: 3,
    otherDenyRuleCount: 0,
    ...patch,
  };
}

describe("planDefaultOpenMigration", () => {
  it("accepts only creation-time default-closed policies without manual deny rules", () => {
    const plan = planDefaultOpenMigration([
      row(),
      row({ groupId: "manual-policy", policyUpdatedAt: 200_000 }),
      row({ groupId: "manual-rule", otherDenyRuleCount: 1 }),
    ]);

    expect(plan.candidates.map((item) => item.groupId)).toEqual(["group-a"]);
    expect(plan.blocked.map((item) => item.groupId)).toEqual(["manual-policy", "manual-rule"]);
    expect(plan.metrics.migratedDenyRulesToDelete).toBe(3);
  });

  it("ignores already-open and partially denied policies", () => {
    const plan = planDefaultOpenMigration([
      row({ groupId: "open", deny: { ...allDenied, nodeTypes: [] } }),
      row({ groupId: "partial", deny: { ...allDenied, nodeTypes: ["video"] } }),
    ]);

    expect(plan.metrics).toEqual({ scanned: 2, candidates: 0, blocked: 0, migratedDenyRulesToDelete: 0 });
  });

  it("can be restricted to a confirmed principal", () => {
    const plan = planDefaultOpenMigration([row(), row({ groupId: "group-b" })], { principalId: "group-b" });
    expect(plan.candidates.map((item) => item.groupId)).toEqual(["group-b"]);
    expect(plan.metrics.scanned).toBe(1);
  });
});
