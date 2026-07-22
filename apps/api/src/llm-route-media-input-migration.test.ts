import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("LLM route media input snapshot migration", () => {
  it("adds immutable model input capability and transport snapshots", () => {
    const sql = readFileSync(new URL("../db/031_llm_route_media_input_snapshots.sql", import.meta.url), "utf8");
    expect(sql).toMatch(/alter table xh_llm_route_entries/i);
    expect(sql).toMatch(/model_input_capabilities_snapshot jsonb not null default '\{\}'::jsonb/i);
    expect(sql).toMatch(/media_input_transports_snapshot jsonb not null default '\[\]'::jsonb/i);
  });
});
