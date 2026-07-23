import { describe, expect, it, vi } from "vitest";

import { createAgentOrchestrator } from "./agent-orchestrator.js";

describe("agent orchestrator", () => {
  it("runs a bounded role and falls back across only the routed LLM candidates", async () => {
    const createSnapshot = vi.fn(async () => ({ id: "knowledge-snapshot-1" }));
    const createRun = vi.fn(async () => ({ created: true, run: { id: "agent-run-1", ownerId: "owner-1", status: "queued" } as any }));
    const transitionRun = vi.fn(async (input: any) => ({ id: "agent-run-1", ownerId: "owner-1", status: input.next }));
    const appendAction = vi.fn(async () => ({}));
    const recordDecision = vi.fn(async () => "decision");
    const recordOutcome = vi.fn(async () => undefined);
    const invokeModel = vi.fn(async (input: any) => {
      if (input.modelRecordId === "model-primary") throw new Error("429 rate limit");
      return { content: "structured answer", usage: { tokens: 42, apiKey: "must-not-persist" } };
    });
    const orchestrator = createAgentOrchestrator({
      runtimeConfigurations: runtimeConfiguration({
        promptTemplate: "Runtime prompt for {{scenario}}",
        llmPoolKey: "assistant-pool",
        knowledge: { collectionAllowlist: ["public-canvas"], audience: "public", topK: 3, tokenBudget: 900 },
        maxTokens: 777,
        timeoutMs: 45678,
      }),
      knowledgeSnapshots: { createSnapshot } as any,
      agentRuns: {
        createRun,
        transitionRun,
        appendAction,
      } as any,
      routing: {
        readPublishedPool: vi.fn(async () => ({
          poolId: "pool-1", poolVersionId: "v1", policy: { failureThreshold: 3 },
          candidates: [
            { entryId: "primary", providerId: "provider-1", modelId: "model-primary", capability: "chat", capabilityTags: ["text_chat"], priority: 1, weight: 1, state: "healthy", estimatedCost: 0.01, p95LatencyMs: 100 },
            { entryId: "backup", providerId: "provider-2", modelId: "model-backup", capability: "chat", capabilityTags: ["text_chat"], priority: 2, weight: 1, state: "healthy", estimatedCost: 0.02, p95LatencyMs: 200 },
          ],
        })),
        recordDecision,
        recordOutcome,
      } as any,
      invokeModel,
      now: (() => { let value = 100; return () => value += 10; })(),
    });

    const result = await orchestrator.runRole({
      task: { id: "task-1", ownerId: "owner-1", role: "planner", scenario: "assistant-chat", inputSchema: "assistant-chat/v1", outputSchema: "assistant-response/v1", toolAllowlist: [], maxTokens: 1000, timeoutMs: 30000 },
      agentKey: "assistant-planner", environment: "gray", idempotencyKey: "assistant-1", messages: [{ role: "user", content: "help" }], inputSnapshot: { message: "help" },
    });

    expect(result).toMatchObject({ mode: "agent", content: "structured answer", entryId: "backup", modelRecordId: "model-backup" });
    expect(createSnapshot).toHaveBeenCalledWith(expect.objectContaining({ ownerId: "owner-1", environment: "gray" }));
    expect(createSnapshot).toHaveBeenCalledWith(expect.objectContaining({ audience: "public", collectionAllowlist: ["public-canvas"] }));
    expect(createRun).toHaveBeenCalledWith(expect.objectContaining({ knowledgeSnapshotId: "knowledge-snapshot-1", configurationVersionId: "configuration-1" }));
    expect(createRun).toHaveBeenCalledWith(expect.objectContaining({
      inputSnapshot: expect.objectContaining({
        runtimePolicy: expect.objectContaining({ llmPoolKey: "assistant-pool", promptTemplate: "Runtime prompt for {{scenario}}", maxTokens: 777, timeoutMs: 45678 }),
      }),
      budgetSnapshot: { maxTokens: 777, timeoutMs: 45678, maximumEstimatedCost: undefined },
    }));
    expect(invokeModel).toHaveBeenCalledTimes(2);
    expect(recordDecision).toHaveBeenCalledTimes(2);
    expect(recordOutcome).toHaveBeenNthCalledWith(1, expect.objectContaining({ entryId: "primary", outcome: "rate_limited" }));
    expect(recordOutcome).toHaveBeenNthCalledWith(2, expect.objectContaining({ entryId: "backup", outcome: "success" }));
    expect(transitionRun).toHaveBeenLastCalledWith(expect.objectContaining({ next: "succeeded" }));
    expect(JSON.stringify(appendAction.mock.calls)).not.toContain("must-not-persist");
    expect(appendAction).toHaveBeenCalledWith(expect.objectContaining({ outputSnapshot: expect.objectContaining({ usage: { tokens: 42 } }) }));
    expect(invokeModel.mock.calls[0][0].messages[0]).toMatchObject({ role: "system", content: expect.stringContaining("Canvas Node Capability Catalog") });
    expect(invokeModel.mock.calls[0][0].messages[0].content).toContain("pick-from-set (从合集获取)");
    expect(JSON.stringify(invokeModel.mock.calls[0][0].messages)).toContain("Runtime prompt for assistant-chat");
    expect(invokeModel.mock.calls[0][0]).toMatchObject({ maxTokens: 777, timeoutMs: 45678 });
  });

  it("redacts provider credentials from failed action and run snapshots", async () => {
    const transitionRun = vi.fn(async (input: any) => ({ id: "agent-run-1", ownerId: "owner-1", status: input.next }));
    const appendAction = vi.fn(async () => ({}));
    const orchestrator = createAgentOrchestrator({
      runtimeConfigurations: runtimeConfiguration(),
      knowledgeSnapshots: { createSnapshot: vi.fn(async () => ({ id: "knowledge-snapshot-2" })) } as any,
      agentRuns: { createRun: vi.fn(async () => ({ created: true, run: { id: "agent-run-1", ownerId: "owner-1", status: "queued" } as any })), transitionRun, appendAction } as any,
      routing: {
        readPublishedPool: vi.fn(async () => ({ poolId: "pool-1", poolVersionId: "v1", policy: {}, candidates: [{ entryId: "only", providerId: "provider-1", modelId: "model-1", capability: "chat", capabilityTags: ["text_chat"], priority: 1, weight: 1, state: "healthy", estimatedCost: 0, p95LatencyMs: 1 }] })),
        recordDecision: vi.fn(async () => "decision"), recordOutcome: vi.fn(async () => undefined),
      } as any,
      invokeModel: vi.fn(async () => { throw new Error("upstream Bearer super-secret token=another-secret&status=500"); }),
    });
    await expect(orchestrator.runRole({
      task: { id: "task-1", ownerId: "owner-1", role: "planner", scenario: "assistant-chat", inputSchema: "assistant-chat/v1", outputSchema: "assistant-response/v1", toolAllowlist: [], maxTokens: 1000, timeoutMs: 30000 },
      agentKey: "assistant-planner", environment: "gray", idempotencyKey: "assistant-failed", messages: [{ role: "user", content: "help" }], inputSnapshot: {},
    })).rejects.toThrow(/\[redacted\]/);
    const snapshots = JSON.stringify({ actions: appendAction.mock.calls, runs: transitionRun.mock.calls });
    expect(snapshots).not.toContain("super-secret");
    expect(snapshots).not.toContain("another-secret");
  });

  it("holds and releases a half-open probe around exactly one model invocation", async () => {
    const claimHalfOpenProbe = vi.fn(async () => true);
    const releaseHalfOpenProbe = vi.fn(async () => undefined);
    const orchestrator = createAgentOrchestrator({
      runtimeConfigurations: runtimeConfiguration(),
      knowledgeSnapshots: { createSnapshot: vi.fn(async () => ({ id: "knowledge-snapshot-3" })) } as any,
      agentRuns: {
        createRun: vi.fn(async () => ({ created: true, run: { id: "agent-run-probe", ownerId: "owner-1", status: "queued" } as any })),
        transitionRun: vi.fn(async (input: any) => ({ id: "agent-run-probe", ownerId: "owner-1", status: input.next })),
        appendAction: vi.fn(async () => ({})),
      } as any,
      routing: {
        readPublishedPool: vi.fn(async () => ({ poolId: "pool-1", poolVersionId: "v1", policy: {}, candidates: [{ entryId: "probe", providerId: "provider-1", modelId: "model-1", capability: "chat", capabilityTags: ["text_chat"], priority: 1, weight: 1, state: "half_open", estimatedCost: 0, p95LatencyMs: 1 }] })),
        recordDecision: vi.fn(async () => "decision"), recordOutcome: vi.fn(async () => undefined), claimHalfOpenProbe, releaseHalfOpenProbe,
      } as any,
      invokeModel: vi.fn(async () => ({ content: "ok" })),
    });

    await expect(orchestrator.runRole({
      task: { id: "task-1", ownerId: "owner-1", role: "planner", scenario: "assistant-chat", inputSchema: "assistant-chat/v1", outputSchema: "assistant-response/v1", toolAllowlist: [], maxTokens: 1000, timeoutMs: 30_000 },
      agentKey: "assistant-planner", environment: "gray", idempotencyKey: "half-open", messages: [{ role: "user", content: "help" }], inputSnapshot: {},
    })).resolves.toMatchObject({ content: "ok", entryId: "probe" });
    expect(claimHalfOpenProbe).toHaveBeenCalledWith(expect.objectContaining({ entryId: "probe", leaseOwner: "agent-run-probe:route:0" }));
    expect(releaseHalfOpenProbe).toHaveBeenCalledWith({ entryId: "probe", leaseOwner: "agent-run-probe:route:0" });
  });

  it("filters platform-denied tools without letting platform allow policies expand the role allowlist", async () => {
    const createRun = vi.fn(async () => ({ created: true, run: { id: "agent-run-policy", ownerId: "owner-1", status: "queued" } as any }));
    const orchestrator = createAgentOrchestrator({
      runtimeConfigurations: {
        readPublishedConfiguration: vi.fn(async () => ({
          ...(await runtimeConfiguration({ toolAllowlist: ["canvas.read", "canvas.patch.propose"] }).readPublishedConfiguration()),
          platformToolPolicies: [
            { toolName: "canvas.read", effect: "deny" as const, constraints: { maximumCallsPerRun: 0 }, revision: 5 },
            { toolName: "artifact.evaluate", effect: "allow" as const, constraints: {}, revision: 2 },
          ],
        })),
      },
      knowledgeSnapshots: { createSnapshot: vi.fn(async () => ({ id: "knowledge-snapshot-policy" })) } as any,
      agentRuns: {
        createRun,
        transitionRun: vi.fn(async (input: any) => ({ id: "agent-run-policy", ownerId: "owner-1", status: input.next })),
        appendAction: vi.fn(async () => ({})),
      } as any,
      routing: {
        readPublishedPool: vi.fn(async () => ({ poolId: "pool-1", poolVersionId: "v1", policy: {}, candidates: [{ entryId: "only", providerId: "provider-1", modelId: "model-1", capability: "chat", capabilityTags: ["text_chat"], priority: 1, weight: 1, state: "healthy", estimatedCost: 0, p95LatencyMs: 1 }] })),
        recordDecision: vi.fn(async () => "decision"), recordOutcome: vi.fn(async () => undefined),
      } as any,
      invokeModel: vi.fn(async () => ({ content: "ok" })),
    });

    await orchestrator.runRole({
      task: { id: "task-policy", ownerId: "owner-1", role: "planner", scenario: "assistant-chat", inputSchema: "assistant-chat/v1", outputSchema: "assistant-response/v1", toolAllowlist: [], maxTokens: 1000, timeoutMs: 30_000 },
      agentKey: "assistant-planner", environment: "gray", idempotencyKey: "policy", messages: [{ role: "user", content: "help" }], inputSnapshot: {},
    });

    expect(createRun).toHaveBeenCalledWith(expect.objectContaining({
      inputSnapshot: expect.objectContaining({
        runtimePolicy: expect.objectContaining({
          toolAllowlist: ["canvas.patch.propose"],
          platformToolPolicies: expect.arrayContaining([expect.objectContaining({ toolName: "canvas.read", effect: "deny", revision: 5 })]),
        }),
      }),
    }));
  });

  it("replays the original Run before resolving a newly published configuration or Knowledge Snapshot", async () => {
    const readPublishedConfiguration = vi.fn();
    const createSnapshot = vi.fn();
    const orchestrator = createAgentOrchestrator({
      runtimeConfigurations: { readPublishedConfiguration } as any,
      knowledgeSnapshots: { createSnapshot } as any,
      agentRuns: {
        readRunByIdempotency: vi.fn(async () => ({
          id: "agent-run-original",
          ownerId: "owner-1",
          role: "planner",
          scenario: "assistant-chat",
          status: "succeeded",
          configurationVersionId: "configuration-old",
          knowledgeSnapshotId: "knowledge-old",
          outputSnapshot: { content: "original answer", entryId: "entry-old", providerId: "provider-old", modelRecordId: "model-old" },
        })),
      } as any,
      routing: {} as any,
      invokeModel: vi.fn(),
    });

    await expect(orchestrator.runRole({
      task: { id: "task-replay", ownerId: "owner-1", role: "planner", scenario: "assistant-chat", inputSchema: "assistant-chat/v1", outputSchema: "assistant-response/v1", toolAllowlist: [], maxTokens: 1000, timeoutMs: 30_000 },
      agentKey: "assistant-planner", environment: "gray", idempotencyKey: "same-request", messages: [{ role: "user", content: "help" }], inputSnapshot: {},
    })).resolves.toMatchObject({ agentRunId: "agent-run-original", content: "original answer", entryId: "entry-old" });
    expect(readPublishedConfiguration).not.toHaveBeenCalled();
    expect(createSnapshot).not.toHaveBeenCalled();
  });
});

function runtimeConfiguration(overrides: Record<string, unknown> = {}) {
  return {
    readPublishedConfiguration: vi.fn(async () => ({
      agentDefinitionId: "definition-1",
      configurationVersionId: "configuration-1",
      version: 1,
      configuration: {
        promptTemplate: "",
        roleDescription: "",
        llmPoolKey: "",
        knowledge: { collectionAllowlist: [], audience: "internal", topK: 8, tokenBudget: 4000 },
        toolAllowlist: [],
        maxTokens: 1000,
        timeoutMs: 30000,
        budget: { maximumEstimatedCost: null },
        approvalPolicy: { structuralChanges: "required", generationModelSwitch: "required" },
        automaticRecovery: { enabled: false, maxAttempts: 2 },
        qualityProfileKey: "",
        ...overrides,
      },
    })),
  } as any;
}
