import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("task cost ledger migration", () => {
  it("creates append-only pricing versions and idempotent task cost items", async () => {
    const sql = await readFile(new URL("../db/025_task_cost_ledger.sql", import.meta.url), "utf8");
    expect(sql).toMatch(/create table if not exists xh_model_pricing_versions/i);
    expect(sql).toMatch(/create table if not exists xh_task_cost_items/i);
    expect(sql).toMatch(/unique\s*\(task_id, cost_item_type\)/i);
    expect(sql).toMatch(/after insert or update of status, result/i);
    expect(sql).not.toMatch(/insert into xh_task_cost_items[\s\S]*select[\s\S]*from xh_tasks/i);
  });
});
