import { describe, expect, it, vi } from "vitest";
import { createAgentGovernanceRepository } from "./agent-governance-repository.js";

function transactionalPool(query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>) {
  const client = { query: vi.fn(query), release: vi.fn() };
  return { pool: { connect: vi.fn(async () => client), query: vi.fn(query) } as any, client };
}

describe("agent governance repository", () => {
  it("bootstraps separate backend assistant and supervision planner definitions without overwriting versions", async () => {
    const inserts: Array<{ sql: string; params?: unknown[] }> = [];
    const definitionIds = new Map<string, string>();
    const { pool } = transactionalPool(async (sql, params) => {
      if (sql === "begin" || sql === "commit") return { rows: [] };
      if (sql.includes("insert into xh_llm_route_pools")) {
        inserts.push({ sql, params });
        return { rows: [{ id: `pool-${String(params?.[1])}` }] };
      }
      if (sql.includes("insert into xh_agent_definitions")) {
        const key = String(params?.[1]);
        definitionIds.set(key, `definition-${key}`);
        inserts.push({ sql, params });
        return { rows: [{ id: `definition-${key}` }] };
      }
      if (sql.includes("select id from xh_agent_definitions")) {
        return { rows: [{ id: definitionIds.get(String(params?.[0])) || `definition-${String(params?.[0])}` }] };
      }
      if (sql.includes("select id from xh_agent_configuration_versions")) return { rows: [] };
      if (sql.includes("insert into xh_agent_configuration_versions")) {
        inserts.push({ sql, params });
        return { rows: [] };
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const repository = createAgentGovernanceRepository({ getPostgresPool: async () => pool, newId: (prefix) => `${prefix}-1` });

    await repository.bootstrapDefaults("admin-1");

    expect(inserts.some((entry) => entry.sql.includes("xh_llm_route_pools") && entry.params?.includes("admin-assistant-diagnosis"))).toBe(true);
    expect(inserts.some((entry) => entry.sql.includes("xh_llm_route_pools") && entry.params?.includes("supervision-planning"))).toBe(true);
    expect(inserts.some((entry) => entry.sql.includes("xh_agent_definitions") && entry.params?.includes("admin-assistant-planner"))).toBe(true);
    expect(inserts.some((entry) => entry.sql.includes("xh_agent_definitions") && entry.params?.includes("supervision-planner"))).toBe(true);
    const backendConfiguration = inserts.find((entry) =>
      entry.sql.includes("xh_agent_configuration_versions") && String(entry.params?.[1]).includes("admin-assistant-planner"),
    );
    expect(JSON.parse(String(backendConfiguration?.params?.[2]))).toMatchObject({ llmPoolKey: "admin-assistant-diagnosis" });
  });

  it("rejects an Agent configuration that references an unregistered tool before writing", async () => {
    const getPostgresPool = vi.fn();
    const repository = createAgentGovernanceRepository({ getPostgresPool: getPostgresPool as any });
    await expect(repository.createAgentConfigurationVersion({
      actorId: "admin-1",
      agentDefinitionId: "definition-1",
      configuration: { toolAllowlist: ["shell.exec"] },
    })).rejects.toThrow("AGENT_CONFIGURATION_TOOL_UNKNOWN");
    expect(getPostgresPool).not.toHaveBeenCalled();
  });

  it("copies an immutable Agent configuration into a normalized new draft", async () => {
    const inserts: Array<{ sql: string; params?: unknown[] }> = [];
    const { pool } = transactionalPool(async (sql, params) => {
      if (sql === "begin" || sql === "commit") return { rows: [] };
      if (sql.includes("from xh_agent_configuration_versions cv")) return { rows: [{ agent_definition_id: "definition-1", configuration: { maxTokens: 5000, toolAllowlist: ["knowledge.node.get"] } }] };
      if (sql.includes("from xh_agent_definitions")) return { rows: [{ role: "planner" }] };
      if (sql.includes("coalesce(max(version)")) return { rows: [{ next: 4 }] };
      if (sql.includes("insert into xh_agent_configuration_versions")) {
        inserts.push({ sql, params });
        return { rows: [{ id: "configuration-4", version: 4, status: "draft", configuration: JSON.parse(String(params?.[3])) }] };
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const repository = createAgentGovernanceRepository({ getPostgresPool: async () => pool, newId: () => "configuration-4" });
    await expect(repository.cloneAgentConfigurationVersion({ actorId: "admin-1", sourceVersionId: "configuration-3" })).resolves.toMatchObject({ id: "configuration-4", version: 4, status: "draft" });
    expect(JSON.parse(String(inserts[0]?.params?.[3]))).toMatchObject({ maxTokens: 5000, timeoutMs: 120000, toolAllowlist: ["knowledge.node.get"], approvalPolicy: { structuralChanges: "required" } });
  });

  it("rejects a role configuration that references a missing or mismatched LLM Pool", async () => {
    const { pool, client } = transactionalPool(async (sql) => {
      if (sql === "begin" || sql === "rollback") return { rows: [] };
      if (sql.includes("from xh_agent_definitions")) return { rows: [{ id: "definition-1", role: "planner" }] };
      if (sql.includes("from xh_llm_route_pools")) return { rows: [] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const repository = createAgentGovernanceRepository({ getPostgresPool: async () => pool });
    await expect(repository.createAgentConfigurationVersion({
      actorId: "admin-1",
      agentDefinitionId: "definition-1",
      configuration: { llmPoolKey: "checker-default" },
    })).rejects.toThrow("AGENT_CONFIGURATION_LLM_POOL_INVALID");
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("role = $2"), ["checker-default", "planner"]);
    expect(client.query).toHaveBeenCalledWith("rollback");
  });

  it("rejects a knowledge collection whose audience does not match the role configuration", async () => {
    const { pool, client } = transactionalPool(async (sql) => {
      if (sql === "begin" || sql === "rollback") return { rows: [] };
      if (sql.includes("from xh_agent_definitions")) return { rows: [{ id: "definition-1", role: "planner" }] };
      if (sql.includes("from xh_agent_knowledge_collections")) return { rows: [] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const repository = createAgentGovernanceRepository({ getPostgresPool: async () => pool });
    await expect(repository.createAgentConfigurationVersion({
      actorId: "admin-1",
      agentDefinitionId: "definition-1",
      configuration: { knowledge: { audience: "public", collectionAllowlist: ["internal-ops"] } },
    })).rejects.toThrow("AGENT_CONFIGURATION_KNOWLEDGE_COLLECTION_INVALID");
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("audience = $2"), [["internal-ops"], "public"]);
    expect(client.query).toHaveBeenCalledWith("rollback");
  });

  it("rejects a role configuration that references a missing quality profile", async () => {
    const { pool, client } = transactionalPool(async (sql) => {
      if (sql === "begin" || sql === "rollback") return { rows: [] };
      if (sql.includes("from xh_agent_definitions")) return { rows: [{ id: "definition-1", role: "checker" }] };
      if (sql.includes("from xh_artifact_quality_profiles")) return { rows: [] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const repository = createAgentGovernanceRepository({ getPostgresPool: async () => pool });
    await expect(repository.createAgentConfigurationVersion({
      actorId: "admin-1",
      agentDefinitionId: "definition-1",
      configuration: { qualityProfileKey: "missing-profile" },
    })).rejects.toThrow("AGENT_CONFIGURATION_QUALITY_PROFILE_INVALID");
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("profile_key = $1"), ["missing-profile"]);
    expect(client.query).toHaveBeenCalledWith("rollback");
  });

  it.each([
    ["review", (repository: ReturnType<typeof createAgentGovernanceRepository>) => repository.transitionAgentConfigurationVersion({ actorId: "admin-1", versionId: "configuration-1", next: "review" })],
    ["publish", (repository: ReturnType<typeof createAgentGovernanceRepository>) => repository.publishAgentConfiguration({ actorId: "admin-1", versionId: "configuration-1", environment: "gray" })],
  ])("revalidates references before Agent configuration %s", async (_operation, run) => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("from xh_agent_configuration_versions cv")) {
        return { rows: [{ role: "planner", configuration: { llmPoolKey: "retired-pool" } }] };
      }
      if (sql.includes("from xh_llm_route_pools")) return { rows: [] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const repository = createAgentGovernanceRepository({ getPostgresPool: async () => ({ query } as any) });
    await expect(run(repository)).rejects.toThrow("AGENT_CONFIGURATION_LLM_POOL_INVALID");
    expect(query).toHaveBeenCalledTimes(2);
  });

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

  it("does not let Admin downgrade a code-required approval tool to allow", async () => {
    const getPostgresPool = vi.fn();
    const repository = createAgentGovernanceRepository({ getPostgresPool: getPostgresPool as any });
    await expect(repository.upsertToolPolicy({ actorId: "admin-1", subjectType: "platform", toolName: "canvas.patch.propose", effect: "allow", constraints: {} })).rejects.toThrow("AGENT_TOOL_APPROVAL_CANNOT_BE_BYPASSED");
    expect(getPostgresPool).not.toHaveBeenCalled();
  });

  it("rejects invalid tool policy subjects and effects before database access", async () => {
    const getPostgresPool = vi.fn();
    const repository = createAgentGovernanceRepository({ getPostgresPool: getPostgresPool as any });
    await expect(repository.upsertToolPolicy({ actorId: "admin-1", subjectType: "anonymous", toolName: "canvas.read", effect: "allow", constraints: {} })).rejects.toThrow("AGENT_TOOL_POLICY_SUBJECT_INVALID");
    await expect(repository.upsertToolPolicy({ actorId: "admin-1", subjectType: "platform", toolName: "canvas.read", effect: "audit_only", constraints: {} })).rejects.toThrow("AGENT_TOOL_POLICY_EFFECT_INVALID");
    expect(getPostgresPool).not.toHaveBeenCalled();
  });

  it("normalizes persisted tool policy constraints into the runtime contract", async () => {
    const inserts: unknown[][] = [];
    const { pool } = transactionalPool(async (sql, params) => {
      if (sql === "begin" || sql === "commit") return { rows: [] };
      if (sql.includes("select * from xh_agent_tool_policies")) return { rows: [] };
      if (sql.includes("insert into xh_agent_tool_policies")) {
        inserts.push(params || []);
        return { rows: [{ id: "policy-1" }] };
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const repository = createAgentGovernanceRepository({ getPostgresPool: async () => pool, newId: () => "policy-1" });
    await repository.upsertToolPolicy({ actorId: "admin-1", subjectType: "platform", toolName: "canvas.read", effect: "deny", constraints: { maxCallsPerRun: 50_000, requireCanvasRevision: "no", requireBudget: false, ignored: true } });
    expect(JSON.parse(String(inserts[0]?.[5]))).toEqual({ maxCallsPerRun: 1_000, requireCanvasRevision: true, requireBudget: false });
  });

  it("publishes an approved pool version by retiring the previous environment projection", async () => {
    const queries: string[] = [];
    const { pool } = transactionalPool(async (sql) => {
      queries.push(sql);
      if (sql.includes("select v.id")) return { rows: [{ id: "version-2", parent_id: "pool-1", status: "approved" }] };
      if (sql.includes("select p.enabled as pool_enabled")) return { rows: [{ pool_enabled: true, entry_id: "entry-1", entry_enabled: true, model_id: "model-1", model_enabled: true, capability: "chat", provider_id: "provider-1", provider_enabled: true }] };
      if (sql.includes("returning *")) return { rows: [{ id: "publication-2", environment: "gray", published_at: new Date("2026-07-22T00:00:00Z") }] };
      return { rows: [] };
    });
    const repository = createAgentGovernanceRepository({ getPostgresPool: async () => pool, newId: () => "publication-2" });
    await expect(repository.publishLlmPoolVersion({ actorId: "admin-1", versionId: "version-2", environment: "gray" })).resolves.toMatchObject({ id: "publication-2", environment: "gray" });
    expect(queries.some((sql) => sql.includes("set retired_at = now()"))).toBe(true);
    expect(queries.some((sql) => sql.includes("on conflict (pool_version_id, environment)"))).toBe(true);
  });

  it("revalidates stored route entries at publication time", async () => {
    const { pool, client } = transactionalPool(async (sql) => {
      if (sql === "begin" || sql === "rollback") return { rows: [] };
      if (sql.includes("select v.id")) return { rows: [{ id: "version-2", parent_id: "pool-1", status: "approved" }] };
      if (sql.includes("select p.enabled as pool_enabled")) return { rows: [{ pool_enabled: true, entry_id: "entry-1", entry_enabled: true, model_id: "video-generator", model_enabled: true, capability: "video", provider_id: "provider-1", provider_enabled: true }] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const repository = createAgentGovernanceRepository({ getPostgresPool: async () => pool });
    await expect(repository.publishLlmPoolVersion({ actorId: "admin-1", versionId: "version-2", environment: "gray" })).rejects.toThrow("LLM_POOL_CHAT_MODEL_REQUIRED");
    expect(client.query).toHaveBeenCalledWith("rollback");
  });

  it("revalidates stored route entries before approval", async () => {
    const { pool, client } = transactionalPool(async (sql: string) => {
      if (sql === "begin" || sql === "rollback") return { rows: [] };
      if (sql.includes("select status from xh_llm_route_pool_versions")) return { rows: [{ status: "review" }] };
      if (sql.includes("select p.enabled as pool_enabled")) return { rows: [{ pool_enabled: true, entry_id: "entry-1", entry_enabled: true, model_id: "image-generator", model_enabled: true, capability: "image", provider_id: "provider-1", provider_enabled: true }] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const repository = createAgentGovernanceRepository({ getPostgresPool: async () => pool });
    await expect(repository.transitionLlmPoolVersion({ actorId: "admin-1", versionId: "version-2", next: "approved" })).rejects.toThrow("LLM_POOL_CHAT_MODEL_REQUIRED");
    expect(client.query).toHaveBeenCalledWith("rollback");
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
