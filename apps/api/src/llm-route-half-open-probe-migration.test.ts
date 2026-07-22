import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("LLM route half-open probe migration", () => {
  it("adds an expiring lease keyed by route entry", () => {
    const sql = readFileSync(new URL("../db/033_llm_route_half_open_probe_leases.sql", import.meta.url), "utf8");
    expect(sql).toMatch(/xh_llm_route_entry_probe_leases/);
    expect(sql).toMatch(/route_entry_id text primary key/);
    expect(sql).toMatch(/lease_owner text not null/);
    expect(sql).toMatch(/lease_expires_at timestamptz not null/);
  });
});
