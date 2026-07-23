import { describe, expect, it, vi } from "vitest";

import { createAgentToolGateway } from "./agent-tool-gateway.js";

const task = {
  id: "task-1", ownerId: "owner-1", role: "planner" as const, scenario: "canvas-plan",
  inputSchema: "in/v1", outputSchema: "out/v1", toolAllowlist: ["canvas.read", "canvas.patch.propose"],
  maxTokens: 1000, timeoutMs: 30000,
};

describe("agent tool gateway", () => {
  it("executes only registered owner-scoped tools and records bounded audit summaries", async () => {
    const recordAction = vi.fn(async () => undefined);
    const execute = vi.fn(async (_payload, context) => ({ ownerId: context.ownerId, nodes: [1, 2] }));
    const gateway = createAgentToolGateway({ tools: [{ name: "canvas.read", approvalRequired: false, execute }], recordAction });

    await expect(gateway.invoke({
      task, tool: "canvas.read", payload: { canvasId: "canvas-1" },
      context: { ownerId: "owner-1", canvasRevisionMatches: true, budgetAvailable: true, approvalGranted: false },
    })).resolves.toMatchObject({ ownerId: "owner-1" });
    expect(execute).toHaveBeenCalledWith({ canvasId: "canvas-1" }, { ownerId: "owner-1", taskId: "task-1" });
    expect(recordAction).toHaveBeenLastCalledWith(expect.objectContaining({ status: "succeeded", result: { type: "object", keys: ["ownerId", "nodes"] } }));
    await expect(gateway.invoke({ task, tool: "shell", payload: {}, context: { ownerId: "owner-1", canvasRevisionMatches: true, budgetAvailable: true, approvalGranted: true } })).rejects.toThrow("AGENT_TOOL_NOT_REGISTERED:shell");
  });

  it("requires approval before a registered structural proposal tool runs", async () => {
    const execute = vi.fn(async () => ({}));
    const gateway = createAgentToolGateway({ tools: [{ name: "canvas.patch.propose", approvalRequired: true, execute }], recordAction: async () => undefined });
    await expect(gateway.invoke({
      task, tool: "canvas.patch.propose", payload: {},
      context: { ownerId: "owner-1", canvasRevisionMatches: true, budgetAvailable: true, approvalGranted: false },
    })).rejects.toThrow("AGENT_TOOL_APPROVAL_REQUIRED");
    expect(execute).not.toHaveBeenCalled();
  });

  it("enforces published per-Run limits and policy-controlled revision/budget requirements", async () => {
    const execute = vi.fn(async () => ({}));
    const gateway = createAgentToolGateway({ tools: [{ name: "canvas.read", approvalRequired: false, execute }], recordAction: async () => undefined });
    await expect(gateway.invoke({
      task, tool: "canvas.read", payload: {},
      context: { ownerId: "owner-1", canvasRevisionMatches: true, budgetAvailable: true, approvalGranted: false, toolCallCount: 1, policy: { maxCallsPerRun: 1 } },
    })).rejects.toThrow("AGENT_TOOL_CALL_LIMIT_EXCEEDED");
    await expect(gateway.invoke({
      task, tool: "canvas.read", payload: {},
      context: { ownerId: "owner-1", canvasRevisionMatches: false, budgetAvailable: false, approvalGranted: false, policy: { requireCanvasRevision: false, requireBudget: false } },
    })).resolves.toEqual({});
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
