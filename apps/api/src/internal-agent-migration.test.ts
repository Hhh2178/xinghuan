import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("internal agent and LLM routing migration", () => {
  it("creates bounded agent definition, configuration, run, and action ledgers", async () => {
    const sql = await readFile(new URL("../db/027_internal_agent_llm_routing.sql", import.meta.url), "utf8");
    for (const table of ["xh_agent_definitions", "xh_agent_configuration_versions", "xh_agent_configuration_publications", "xh_agent_runs", "xh_agent_actions", "xh_agent_tool_policies"]) {
      expect(sql).toMatch(new RegExp(`create table if not exists ${table}`, "i"));
    }
    expect(sql).toMatch(/role text not null check \(role in \('planner'.*'image_understanding'.*'video_understanding'.*'checker'.*'recovery'.*'manager'/is);
    expect(sql).toMatch(/unique\s*\(owner_id, idempotency_key\)/i);
    expect(sql).toMatch(/unique\s*\(agent_run_id, sequence\)/i);
    expect(sql).toMatch(/environment text not null check \(environment in \('gray', 'production'\)\)/i);
  });

  it("separates immutable LLM pool versions, dynamic health, and decision snapshots", async () => {
    const sql = await readFile(new URL("../db/027_internal_agent_llm_routing.sql", import.meta.url), "utf8");
    for (const table of ["xh_llm_route_pools", "xh_llm_route_pool_versions", "xh_llm_route_entries", "xh_llm_route_entry_health", "xh_llm_route_decisions"]) {
      expect(sql).toMatch(new RegExp(`create table if not exists ${table}`, "i"));
    }
    expect(sql).toMatch(/model_capability_snapshot text not null check \(model_capability_snapshot = 'chat'\)/i);
    expect(sql).toMatch(/'healthy'.*'degraded'.*'rate_limited'.*'unavailable'.*'circuit_open'.*'half_open'.*'draining'.*'disabled'/is);
    expect(sql).toMatch(/quality_failure_count bigint not null default 0/i);
    expect(sql).toMatch(/candidate_snapshot jsonb not null/i);
    expect(sql).toMatch(/rejection_snapshot jsonb not null/i);
  });
});
