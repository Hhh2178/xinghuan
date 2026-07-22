import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("canvas run fair dispatch migration", () => {
  it("persists one owner cursor per dispatch scope", () => {
    const sql = readFileSync(new URL("../db/032_canvas_run_fair_dispatch.sql", import.meta.url), "utf8");
    expect(sql).toMatch(/create table if not exists xh_canvas_run_dispatch_cursors/i);
    expect(sql).toMatch(/scope text primary key/i);
    expect(sql).toMatch(/last_owner_id text not null/i);
  });
});
