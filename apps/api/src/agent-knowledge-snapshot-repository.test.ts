import { describe, expect, it, vi } from "vitest";

import { createAgentKnowledgeSnapshotRepository } from "./agent-knowledge-snapshot-repository.js";

describe("Agent knowledge snapshot repository", () => {
  it("locks safe catalog projections and only approved publications in the requested boundary", async () => {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        calls.push({ sql, params });
        if (sql === "begin" || sql === "commit") return { rows: [] };
        if (sql.includes("from xh_models m")) return { rows: [{
          id: "model-1", model_id: "chat-model", display_name: "Chat", capability: "chat",
          provider_id: "provider-1", provider_name: "Provider", provider_protocol: "openai",
          model_enabled: true, provider_enabled: true, input_profile: "text", input_capabilities: { text: true },
          capability_tags: ["text_chat"], parameter_schema: "chat-v1", test_state: { state: "healthy" },
          model_updated_at: new Date("2026-07-23T00:00:00Z"), provider_updated_at: new Date("2026-07-22T00:00:00Z"),
          base_url: "must-not-query", api_key: "must-not-query",
        }] };
        if (sql.includes("from xh_agent_knowledge_collections c")) return { rows: [{
          publication_id: "pub-1", document_id: "doc-1", document_key: "node-image", version: 2,
          title: "Image node", body: "Published body", source_snapshot: {}, collection_key: "public-canvas",
          audience: "public", environment: "gray",
        }] };
        if (sql.includes("insert into xh_agent_knowledge_snapshots")) return { rows: [{ id: "snapshot-1" }] };
        throw new Error(`unexpected query: ${sql}`);
      }),
      release: vi.fn(),
    };
    const repository = createAgentKnowledgeSnapshotRepository({
      getPostgresPool: async () => ({ connect: async () => client } as any),
      newId: () => "snapshot-1",
    });

    const snapshot = await repository.createSnapshot({
      ownerId: "owner-1",
      environment: "gray",
      audience: "public",
      collectionAllowlist: ["public-canvas"],
      includePublishedDocuments: true,
    });

    expect(snapshot).toMatchObject({ id: "snapshot-1", environment: "gray", audience: "public" });
    expect(snapshot.documents).toEqual([expect.objectContaining({ publicationId: "pub-1", documentKey: "node-image" })]);
    const modelQuery = calls.find((call) => call.sql.includes("from xh_models m"));
    expect(modelQuery?.sql).not.toMatch(/base_url|api_key|advanced_config/i);
    const documentQuery = calls.find((call) => call.sql.includes("from xh_agent_knowledge_collections c"));
    expect(documentQuery?.sql).toContain("d.status = 'approved'");
    expect(documentQuery?.sql).toContain("pub.retired_at is null");
    expect(documentQuery?.params).toEqual(["gray", "public", ["public-canvas"]]);
    expect(JSON.stringify(calls.find((call) => call.sql.includes("insert into xh_agent_knowledge_snapshots"))?.params)).not.toContain("must-not-query");
  });
});
