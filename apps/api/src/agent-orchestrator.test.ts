import { describe, expect, it, vi } from "vitest";

import { createAgentOrchestrator } from "./agent-orchestrator.js";

describe("agent orchestrator", () => {
  it("runs a bounded role and falls back across only the routed LLM candidates", async () => {
    const transitionRun = vi.fn(async (input: any) => ({ id: "agent-run-1", ownerId: "owner-1", status: input.next }));
    const appendAction = vi.fn(async () => ({}));
    const recordDecision = vi.fn(async () => "decision");
    const recordOutcome = vi.fn(async () => undefined);
    const invokeModel = vi.fn(async (input: any) => {
      if (input.modelRecordId === "model-primary") throw new Error("429 rate limit");
      return { content: "structured answer", usage: { tokens: 42, apiKey: "must-not-persist" } };
    });
    const orchestrator = createAgentOrchestrator({
      agentRuns: {
        createRun: vi.fn(async () => ({ created: true, run: { id: "agent-run-1", ownerId: "owner-1", status: "queued" } as any })),
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
    expect(invokeModel).toHaveBeenCalledTimes(2);
    expect(recordDecision).toHaveBeenCalledTimes(2);
    expect(recordOutcome).toHaveBeenNthCalledWith(1, expect.objectContaining({ entryId: "primary", outcome: "rate_limited" }));
    expect(recordOutcome).toHaveBeenNthCalledWith(2, expect.objectContaining({ entryId: "backup", outcome: "success" }));
    expect(transitionRun).toHaveBeenLastCalledWith(expect.objectContaining({ next: "succeeded" }));
    expect(JSON.stringify(appendAction.mock.calls)).not.toContain("must-not-persist");
    expect(appendAction).toHaveBeenCalledWith(expect.objectContaining({ outputSnapshot: expect.objectContaining({ usage: { tokens: 42 } }) }));
    expect(invokeModel.mock.calls[0][0].messages[0]).toMatchObject({ role: "system", content: expect.stringContaining("Canvas Node Capability Catalog") });
    expect(invokeModel.mock.calls[0][0].messages[0].content).toContain("pick-from-set (从合集获取)");
  });

  it("redacts provider credentials from failed action and run snapshots", async () => {
    const transitionRun = vi.fn(async (input: any) => ({ id: "agent-run-1", ownerId: "owner-1", status: input.next }));
    const appendAction = vi.fn(async () => ({}));
    const orchestrator = createAgentOrchestrator({
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
});
