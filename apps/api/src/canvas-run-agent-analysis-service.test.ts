import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import { createCanvasRunService } from "./canvas-run-service.js";
import * as CanvasRunServiceModule from "./canvas-run-service.js";

function workflowCanvas() {
  return {
    id: "canvas-analysis",
    ownerId: "owner-1",
    revision: 4,
    data: {
      nodes: [
        { id: "group", type: "groupBox", position: { x: 0, y: 0 }, data: { width: 900, height: 500, memberIds: ["A", "B", "C"] } },
        { id: "A", type: "image", position: { x: 40, y: 80 }, data: {} },
        { id: "B", type: "image", position: { x: 280, y: 80 }, data: {} },
        { id: "C", type: "smart-candidate-selector", position: { x: 540, y: 80 }, data: {} },
      ],
      edges: [{ id: "A-C", source: "A", target: "C" }, { id: "B-C", source: "B", target: "C" }],
      workflows: [{
        schemaVersion: 1,
        id: "workflow-analysis",
        name: "Agent analysis",
        revision: 2,
        memberNodeIds: ["group", "A", "B", "C"],
        variables: [],
        inputValues: {},
        bindings: [],
        stages: [{ id: "stage-main", name: "Main", sourceGroupNodeId: "group", order: 0, mode: "parallel", skipped: false }],
        region: { x: 0, y: 0, width: 1000, height: 600, color: "#2F6B5F" },
      }],
    },
  };
}

describe("Canvas Run Agent analysis service integration", () => {
  it("wires the published supervision planner into Canvas Run creation", () => {
    const source = readFileSync(new URL('./server.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/createCanvasRunAgentAnalysisService/);
    expect(source).toMatch(/agentKey: "supervision-planner"/);
    expect(source).toMatch(/scenario: "canvas-supervision-analysis"/);
    expect(source).toMatch(/analyzePlan: canvasRunAgentAnalysisService\.analyzePlan/);
  });

  it("invokes the bounded planner with a sanitized graph and validates its structured response", async () => {
    const createAnalysisService = (CanvasRunServiceModule as unknown as Record<string, unknown>).createCanvasRunAgentAnalysisService;
    expect(typeof createAnalysisService).toBe("function");
    if (typeof createAnalysisService !== "function") return;
    const runPlanner = vi.fn(async () => ({
      agentRunId: "agent-run-real",
      content: JSON.stringify({
        summary: "A 与 B 可并发。",
        concurrencyGroups: [{ stepIds: ["step:A", "step:B"], reason: "无依赖" }],
        serialConstraints: [],
        risks: [],
        recommendedMaximumParallelism: 2,
        estimatedRequestCount: 2,
      }),
    }));
    const service = createAnalysisService({ runPlanner }) as { analyzePlan: (input: Record<string, unknown>) => Promise<any> };
    const compiled = {
      canvasId: "canvas-1", ownerId: "owner-1", canvasRevision: 1,
      groups: [{ id: "stage", order: 0, mode: "parallel", skipped: false, stepIds: ["step:A", "step:B"] }],
      steps: [
        { id: "step:A", nodeId: "A", nodeType: "image", groupId: "stage", dependsOn: [], skipped: false, executionLayer: 0, configuration: { apiKey: "must-not-leak", executionPayload: { prompt: "private prompt" } } },
        { id: "step:B", nodeId: "B", nodeType: "image", groupId: "stage", dependsOn: [], skipped: false, executionLayer: 0 },
      ],
      executionLayers: [{ index: 0, stepIds: ["step:A", "step:B"] }],
    };

    const result = await service.analyzePlan({ ownerId: "owner-1", plan: compiled, maximumParallelism: 3 });

    expect(result).toMatchObject({ agentRunId: "agent-run-real", analysis: { status: "completed", recommendedMaximumParallelism: 2 } });
    const plannerInput = (runPlanner.mock.calls as unknown[][])[0]?.[0];
    expect(plannerInput).toMatchObject({ ownerId: "owner-1", maximumParallelism: 3 });
    expect(JSON.stringify(plannerInput)).not.toMatch(/must-not-leak|private prompt|apiKey/i);
    expect(JSON.stringify(plannerInput)).toMatch(/step:A|executionLayers/);
  });

  it("extracts the final fenced JSON object from a real planner response with reasoning text", async () => {
    const createAnalysisService = (CanvasRunServiceModule as unknown as Record<string, unknown>).createCanvasRunAgentAnalysisService;
    expect(typeof createAnalysisService).toBe("function");
    if (typeof createAnalysisService !== "function") return;
    const content = `<think>Inspect the deterministic graph first.</think>\nThe validated recommendation follows.\n\`\`\`json\n${JSON.stringify({
      summary: "A 与 B 可并发。",
      concurrencyGroups: [{ stepIds: ["step:A", "step:B"], reason: "同一执行层且无依赖" }],
      serialConstraints: [],
      risks: [],
      recommendedMaximumParallelism: 2,
      estimatedRequestCount: 6,
    })}\n\`\`\``;
    const service = createAnalysisService({ runPlanner: async () => ({ content, agentRunId: "agent-run-reasoned" }) }) as { analyzePlan: (input: Record<string, unknown>) => Promise<any> };
    const plan = {
      canvasId: "canvas-1", ownerId: "owner-1", canvasRevision: 1,
      groups: [{ id: "stage", order: 0, mode: "parallel", skipped: false, stepIds: ["step:A", "step:B"] }],
      steps: [
        { id: "step:A", nodeId: "A", nodeType: "image", groupId: "stage", dependsOn: [], skipped: false, executionLayer: 0 },
        { id: "step:B", nodeId: "B", nodeType: "image", groupId: "stage", dependsOn: [], skipped: false, executionLayer: 0 },
      ],
      executionLayers: [{ index: 0, stepIds: ["step:A", "step:B"] }],
    };

    await expect(service.analyzePlan({ ownerId: "owner-1", plan, maximumParallelism: 2 })).resolves.toMatchObject({
      agentRunId: "agent-run-reasoned",
      analysis: { status: "completed", recommendedMaximumParallelism: 2, estimatedRequestCount: 2 },
    });
  });

  it.each([
    ["malformed JSON", async () => ({ agentRunId: "agent-bad", content: "not-json" }), "MALFORMED_RESPONSE"],
    ["planner timeout", async () => { throw new Error("AGENT_ANALYSIS_TIMEOUT"); }, "AGENT_ANALYSIS_TIMEOUT"],
  ])("degrades without blocking for %s", async (_label, runPlanner, reason) => {
    const createAnalysisService = (CanvasRunServiceModule as unknown as Record<string, unknown>).createCanvasRunAgentAnalysisService;
    expect(typeof createAnalysisService).toBe("function");
    if (typeof createAnalysisService !== "function") return;
    const service = createAnalysisService({ runPlanner }) as { analyzePlan: (input: Record<string, unknown>) => Promise<any> };
    const compiled = {
      canvasId: "canvas-1", ownerId: "owner-1", canvasRevision: 1, groups: [],
      steps: [{ id: "step:A", nodeId: "A", nodeType: "image", groupId: null, dependsOn: [], skipped: false, executionLayer: 0 }],
      executionLayers: [{ index: 0, stepIds: ["step:A"] }],
    };
    await expect(service.analyzePlan({ ownerId: "owner-1", plan: compiled, maximumParallelism: 2 })).resolves.toMatchObject({
      analysis: { status: "degraded", degradationReason: reason },
    });
  });

  it("freezes validated analysis and the lower effective concurrency before repository creation", async () => {
    const createCanvasRun = vi.fn(async (input: any) => ({ created: true, run: { id: "run-analysis", ...input } }));
    const analyzePlan = vi.fn(async ({ plan }: any) => ({
      agentRunId: "agent-run-1",
      analysis: {
        version: "canvas-run-agent-analysis/v1",
        status: "completed",
        summary: "A 与 B 可并发，C 等待汇聚。",
        concurrencyGroups: [{ stepIds: ["step:A", "step:B"], reason: "互不依赖" }],
        serialConstraints: [],
        risks: [],
        recommendedMaximumParallelism: 2,
        estimatedRequestCount: 2,
        deterministicLayerCount: plan.executionLayers.length,
      },
    }));
    const repository = {
      readOwnedCanvasSnapshot: vi.fn(async () => workflowCanvas()),
      createCanvasRun,
      readOwnedRun: vi.fn(),
      applyCommand: vi.fn(),
    };
    const service = createCanvasRunService({
      repository: repository as any,
      isEnabled: () => true,
      usePostgresRepository: () => true,
      readSupervisionLimits: async () => ({ maximumStageConcurrency: 4 }),
      analyzePlan,
    } as any);

    await service.createRun({
      ownerId: "owner-1",
      canvasId: "canvas-analysis",
      workflowId: "workflow-analysis",
      idempotencyKey: "analysis-create",
      supervisionSettings: { stageConcurrency: 4 },
    });

    expect(analyzePlan).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: "owner-1",
      maximumParallelism: 4,
      plan: expect.objectContaining({ executionLayers: [{ index: 0, stepIds: ["step:A", "step:B"] }, { index: 1, stepIds: ["step:C"] }] }),
    }));
    expect(createCanvasRun.mock.calls[0][0]).toMatchObject({
      plan: { agentAnalysis: { status: "completed", recommendedMaximumParallelism: 2 }, agentRunId: "agent-run-1" },
      configurationSnapshot: {
        stageConcurrency: 4,
        effectiveConcurrency: 2,
        agentAnalysis: { status: "completed", recommendedMaximumParallelism: 2 },
        agentRunId: "agent-run-1",
      },
    });
  });
});
