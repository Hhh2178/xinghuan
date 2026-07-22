import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("agent governance migration", () => {
  it("creates environment controls and versioned knowledge authority", async () => {
    const sql = await readFile(new URL("../db/029_agent_governance.sql", import.meta.url), "utf8");
    for (const table of [
      "xh_agent_runtime_controls",
      "xh_agent_knowledge_collections",
      "xh_agent_knowledge_documents",
      "xh_agent_knowledge_publications",
    ]) expect(sql).toMatch(new RegExp(`create table if not exists ${table}`, "i"));
    expect(sql).toMatch(/environment text primary key check \(environment in \('gray', 'production'\)\)/i);
    expect(sql).toMatch(/audience text not null check \(audience in \('public', 'internal'\)\)/i);
    expect(sql).toMatch(/status text not null check \(status in \('draft', 'review', 'approved', 'retired'\)\)/i);
    expect(sql).toMatch(/revision integer not null default 1 check \(revision > 0\)/i);
  });

  it("upgrades deployed agent definitions with the description used by governance APIs", async () => {
    const sql = await readFile(new URL("../db/034_agent_definition_description.sql", import.meta.url), "utf8");
    expect(sql).toMatch(/alter table xh_agent_definitions\s+add column if not exists description text not null default ''/i);
  });

  it("keeps the definition insert compatible with the original Agent schema contract", async () => {
    const repository = await readFile(new URL("./agent-governance-repository.ts", import.meta.url), "utf8");
    expect(repository).toMatch(/input_schema, output_schema, tool_allowlist, description/i);
    expect(repository).toMatch(/function defaultAgentSchemas\(role: AgentRole\)/);
  });
});
