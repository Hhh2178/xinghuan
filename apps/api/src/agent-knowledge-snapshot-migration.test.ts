import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Agent knowledge snapshot migration", () => {
  it("creates immutable snapshots and links every Agent Run to one snapshot", async () => {
    const sql = await readFile(new URL("../db/035_agent_knowledge_snapshots.sql", import.meta.url), "utf8");
    expect(sql).toMatch(/create table if not exists xh_agent_knowledge_snapshots/i);
    expect(sql).toMatch(/node_catalog_hash text not null/i);
    expect(sql).toMatch(/model_catalog_hash text not null/i);
    expect(sql).toMatch(/document_publications jsonb not null/i);
    expect(sql).toMatch(/workflow_template_refs jsonb not null/i);
    expect(sql).toMatch(/snapshot_hash text not null/i);
    expect(sql).toMatch(/raise exception 'AGENT_KNOWLEDGE_SNAPSHOT_IMMUTABLE'/i);
    expect(sql).toMatch(/alter table xh_agent_runs\s+add column if not exists knowledge_snapshot_id text/i);
  });
});
