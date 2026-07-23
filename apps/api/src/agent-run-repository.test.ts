import { describe, expect, it, vi } from "vitest";

import { createAgentRunRepository } from "./agent-run-repository.js";

const existingRun = {
  id: "agent-run-1",
  owner_id: "owner-1",
  canvas_run_id: null,
  parent_agent_run_id: null,
  agent_definition_id: "definition-1",
  configuration_version_id: "configuration-old",
  knowledge_snapshot_id: "knowledge-old",
  role: "planner",
  scenario: "assistant-chat",
  status: "succeeded",
  input_snapshot: { runtimePolicy: { configurationVersionId: "configuration-old" } },
  output_snapshot: { content: "original result" },
  budget_snapshot: { maxTokens: 1000 },
  error: {},
};

describe("Agent Run repository idempotency", () => {
  it("reads the original immutable Run projection by owner and idempotency key", async () => {
    const query = vi.fn(async () => ({ rows: [existingRun] }));
    const repository = createAgentRunRepository({ getPostgresPool: async () => ({ query } as any) });

    await expect(repository.readRunByIdempotency({ ownerId: "owner-1", idempotencyKey: "request-1" })).resolves.toMatchObject({
      configurationVersionId: "configuration-old",
      knowledgeSnapshotId: "knowledge-old",
      outputSnapshot: { content: "original result" },
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("owner_id = $1 and idempotency_key = $2"), ["owner-1", "request-1"]);
  });

  it("replays an existing Run before validating the currently published configuration", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql === "begin" || sql === "commit") return { rows: [] };
      if (sql.includes("from xh_agent_runs where owner_id")) return { rows: [existingRun] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const client = { query, release: vi.fn() };
    const repository = createAgentRunRepository({ getPostgresPool: async () => ({ connect: vi.fn(async () => client) } as any) });

    await expect(repository.createRun({
      ownerId: "owner-1",
      agentKey: "assistant-planner",
      role: "planner",
      scenario: "assistant-chat",
      environment: "gray",
      idempotencyKey: "request-1",
      configurationVersionId: "configuration-new",
      knowledgeSnapshotId: "knowledge-new",
      inputSnapshot: {},
      budgetSnapshot: {},
    })).resolves.toMatchObject({ created: false, run: { configurationVersionId: "configuration-old", knowledgeSnapshotId: "knowledge-old" } });
    expect(query.mock.calls.some(([sql]) => String(sql).includes("from xh_agent_definitions"))).toBe(false);
  });
});
