import { describe, expect, it, vi } from "vitest";

import { createLlmRoutingRepository } from "./llm-routing-repository.js";

describe("LLM routing repository", () => {
  it("loads only enabled chat models from the published environment version", async () => {
    const query = vi.fn(async (sql: string, params: unknown[]) => {
      expect(sql).toContain("m.capability = 'chat'");
      expect(sql).toContain("pub.environment = $3");
      expect(params).toEqual(["planner", "assistant-chat", "gray"]);
      return { rows: [{
        pool_id: "pool-1", pool_version_id: "pool-v2", policy_snapshot: { failureThreshold: 3 }, entry_id: "entry-1",
        provider_id: "provider-1", model_id: "model-1", model_capability_snapshot: "chat", capability_tags_snapshot: ["text_chat"],
        model_input_capabilities_snapshot: { videoReference: true }, media_input_transports_snapshot: ["gemini_file"],
        priority: 1, weight: 2, estimated_cost: "0.010000", health_state: "healthy", p95_latency_ms: 150,
      }] };
    });
    const repository = createLlmRoutingRepository({ getPostgresPool: async () => ({ query } as any) });
    await expect(repository.readPublishedPool({ role: "planner", scenario: "assistant-chat", environment: "gray" })).resolves.toMatchObject({
      poolId: "pool-1", poolVersionId: "pool-v2", candidates: [{ entryId: "entry-1", capability: "chat", inputCapabilities: { videoReference: true }, mediaInputTransports: ["gemini_file"], estimatedCost: 0.01 }],
    });
  });

  it("writes an owner-scoped immutable routing decision snapshot", async () => {
    const query = vi.fn(async (sql: string) => {
      expect(sql).toContain("on conflict (owner_id, decision_key) do nothing");
      return { rows: [{ id: "decision-1" }] };
    });
    const repository = createLlmRoutingRepository({ getPostgresPool: async () => ({ query } as any), newId: () => "decision-1" });
    const candidate = { entryId: "entry-1", providerId: "provider-1", modelId: "model-1", capability: "chat", capabilityTags: ["text_chat"], priority: 1, weight: 1, state: "healthy" as const, estimatedCost: 0, p95LatencyMs: 0 };
    await expect(repository.recordDecision({
      ownerId: "owner-1", decisionKey: "run-1:planner", pool: { poolId: "pool-1", poolVersionId: "v1", policy: {}, candidates: [candidate] },
      decision: { role: "planner", scenario: "assistant-chat", selectedEntryId: "entry-1", orderedEntryIds: ["entry-1"], rejected: [], reason: "primary" },
    })).resolves.toBe("decision-1");
  });

  it("casts route-health counters before using them in an upsert", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("select state, consecutive_technical_failures")) return { rows: [] };
      if (sql.includes("insert into xh_llm_route_entry_health")) {
        expect(sql).toContain("$3::integer");
        expect(sql).toContain("$4::integer");
        expect(sql).toContain("$7::integer");
      }
      return { rows: [] };
    });
    const client = { query, release: vi.fn() };
    const repository = createLlmRoutingRepository({ getPostgresPool: async () => ({ connect: async () => client } as any) });

    await expect(repository.recordOutcome({ entryId: "entry-1", outcome: "success", latencyMs: 42, failureThreshold: 3 })).resolves.toBe("healthy");
  });

  it("projects an expired circuit as half-open using the published route policy", async () => {
    const query = vi.fn(async () => ({ rows: [{
      pool_id: "pool-1", pool_version_id: "pool-v1", policy_snapshot: { cooldownMs: 1_000 }, entry_id: "entry-probe",
      provider_id: "provider-1", model_id: "model-1", model_capability_snapshot: "chat", capability_tags_snapshot: ["checker"],
      model_input_capabilities_snapshot: {}, media_input_transports_snapshot: [], priority: 1, weight: 1,
      estimated_cost: "0", health_state: "circuit_open", circuit_opened_at: new Date(Date.now() - 5_000), p95_latency_ms: 100,
    }] }));
    const repository = createLlmRoutingRepository({ getPostgresPool: async () => ({ query } as any) });
    const result = await repository.readPublishedPool({ role: "checker", scenario: "review", environment: "gray" });
    expect(result?.candidates[0].state).toBe("half_open");
  });

  it("atomically claims and releases one half-open probe lease", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("insert into xh_llm_route_entry_probe_leases")) {
        expect(sql).toContain("on conflict (route_entry_id) do update");
        expect(sql).toContain("lease_expires_at < now()");
        return { rows: [{ route_entry_id: "entry-probe" }] };
      }
      if (sql.includes("delete from xh_llm_route_entry_probe_leases")) return { rows: [] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const repository = createLlmRoutingRepository({ getPostgresPool: async () => ({ query } as any) });

    await expect(repository.claimHalfOpenProbe({ entryId: "entry-probe", leaseOwner: "run-1", leaseMs: 60_000 })).resolves.toBe(true);
    await repository.releaseHalfOpenProbe({ entryId: "entry-probe", leaseOwner: "run-1" });
    expect(query).toHaveBeenCalledTimes(2);
  });
});
