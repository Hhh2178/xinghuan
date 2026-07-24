import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../db/042_provider_model_channel_health.sql", import.meta.url), "utf8");

describe("channel health migration", () => {
  it("stores one constrained vote per owner and channel", () => {
    expect(sql).toMatch(/create table if not exists xh_channel_feedback/i);
    expect(sql).toMatch(/check\s*\(vote in \('up', 'down'\)\)/i);
    expect(sql).toMatch(/unique\s*\(owner_id, provider_id, model_id\)/i);
  });

  it("adds bounded settled and eligibility indexes", () => {
    expect(sql).toMatch(/where status in \('succeeded', 'failed'\)/i);
    expect(sql).toMatch(/owner_id, provider_id, model_id, created_at desc/i);
    expect(sql).toMatch(/provider_id, model_id, updated_at desc/i);
  });
});
