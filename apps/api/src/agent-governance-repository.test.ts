import { describe, expect, it, vi } from "vitest";
import { createAgentGovernanceRepository } from "./agent-governance-repository.js";

function transactionalPool(query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>) {
  const client = { query: vi.fn(query), release: vi.fn() };
  return { pool: { connect: vi.fn(async () => client), query: vi.fn(query) } as any, client };
}

describe("agent governance repository", () => {
  it("rejects a route version unless every model is an enabled chat model on the selected provider", async () => {
    const { pool, client } = transactionalPool(async (sql) => {
      if (sql === "begin" || sql === "rollback") return { rows: [] };
      if (sql.includes("from xh_llm_route_pools")) return { rows: [{ id: "pool-1" }] };
      if (sql.includes("from xh_models")) return { rows: [] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const repository = createAgentGovernanceRepository({ getPostgresPool: async () => pool });
    await expect(repository.createLlmPoolVersion({
      actorId: "admin-1",
      poolId: "pool-1",
      value: { policy: {}, entries: [{ modelId: "image-model", providerId: "provider-1", capabilityTags: [], priority: 1, weight: 1, estimatedCost: 0 }] },
    })).rejects.toThrow("LLM_POOL_CHAT_MODEL_REQUIRED");
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("m.capability = 'chat'"), [["image-model"]]);
    expect(client.query).toHaveBeenCalledWith("rollback");
  });

  it("publishes an approved pool version by retiring the previous environment projection", async () => {
    const queries: string[] = [];
    const { pool } = transactionalPool(async (sql) => {
      queries.push(sql);
      if (sql.includes("select v.id")) return { rows: [{ id: "version-2", parent_id: "pool-1", status: "approved" }] };
      if (sql.includes("returning *")) return { rows: [{ id: "publication-2", environment: "gray", published_at: new Date("2026-07-22T00:00:00Z") }] };
      return { rows: [] };
    });
    const repository = createAgentGovernanceRepository({ getPostgresPool: async () => pool, newId: () => "publication-2" });
    await expect(repository.publishLlmPoolVersion({ actorId: "admin-1", versionId: "version-2", environment: "gray" })).resolves.toMatchObject({ id: "publication-2", environment: "gray" });
    expect(queries.some((sql) => sql.includes("set retired_at = now()"))).toBe(true);
    expect(queries.some((sql) => sql.includes("on conflict (pool_version_id, environment)"))).toBe(true);
  });

  it("freezes Gemini video input capability and transport into a route version", async () => {
    const inserts: Array<{ sql: string; params?: unknown[] }> = [];
    const { pool } = transactionalPool(async (sql, params) => {
      if (sql === "begin" || sql === "commit") return { rows: [] };
      if (sql.includes("from xh_llm_route_pools")) return { rows: [{ id: "pool-1" }] };
      if (sql.includes("from xh_models")) return { rows: [{ model_id: "gemini-model", provider_id: "provider-1", input_capabilities: { videoReference: true, imageReference: true }, protocol_override: null, provider_protocol: "gemini" }] };
      if (sql.includes("coalesce(max(version)")) return { rows: [{ next: 1 }] };
      if (sql.startsWith("insert into xh_llm_route_pool_versions") || sql.includes("insert into xh_llm_route_entries")) {
        inserts.push({ sql, params });
        return { rows: [] };
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const repository = createAgentGovernanceRepository({ getPostgresPool: async () => pool, newId: (prefix) => `${prefix}-1` });
    await repository.createLlmPoolVersion({ actorId: "admin-1", poolId: "pool-1", value: {
      policy: {}, entries: [{ modelId: "gemini-model", providerId: "provider-1", capabilityTags: ["video_understanding"], priority: 1, weight: 1, estimatedCost: 0 }],
    } });

    const entryInsert = inserts.find((item) => item.sql.includes("insert into xh_llm_route_entries"));
    expect(entryInsert?.sql).toContain("model_input_capabilities_snapshot");
    expect(entryInsert?.params).toContain(JSON.stringify({ videoReference: true, imageReference: true }));
    expect(entryInsert?.params).toContain(JSON.stringify(["gemini_file", "sampled_frames"]));
  });

  it("simulates against live health without writing a routing decision", async () => {
    const query = vi.fn(async () => ({ rows: [
      { id: "entry-a", provider_id: "provider-a", model_id: "model-a", model_capability_snapshot: "chat", capability_tags_snapshot: ["reasoning"], policy_snapshot: { cooldownMs: 60_000 }, priority: 1, weight: 1, estimated_cost: "0.01", state: "healthy", p95_latency_ms: 100 },
      { id: "entry-b", provider_id: "provider-b", model_id: "model-b", model_capability_snapshot: "chat", capability_tags_snapshot: [], policy_snapshot: { cooldownMs: 60_000 }, priority: 2, weight: 1, estimated_cost: "0.02", state: "healthy", p95_latency_ms: 50 },
    ] }));
    const repository = createAgentGovernanceRepository({ getPostgresPool: async () => ({ query } as any) });
    await expect(repository.simulateLlmRoute({ versionId: "version-1", role: "planner", scenario: "assistant-chat", requiredCapabilityTags: ["reasoning"], decisionKey: "preview-1" })).resolves.toMatchObject({ decision: { selectedEntryId: "entry-a", rejected: [{ entryId: "entry-b", reason: "missing_capability_tag" }] } });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("loads only approved public knowledge published to the requested environment", async () => {
    const query = vi.fn(async (sql: string, params: unknown[]) => {
      expect(sql).toContain("c.audience = 'public'");
      expect(sql).toContain("d.status = 'approved'");
      expect(sql).toContain("pub.environment = $2");
      expect(sql).toContain("pub.retired_at is null");
      expect(params).toEqual(["public-canvas", "gray", 20]);
      return { rows: [{ document_key: "node-image", title: "Image node", version: 3, body: "Connect image outputs to supported downstream inputs." }] };
    });
    const repository = createAgentGovernanceRepository({ getPostgresPool: async () => ({ query } as any) });
    await expect(repository.readPublishedKnowledgeContext({ collectionKey: "public-canvas", environment: "gray", limit: 20 })).resolves.toEqual([
      { documentKey: "node-image", title: "Image node", version: 3, body: "Connect image outputs to supported downstream inputs." },
    ]);
  });
});
