import { describe, expect, it } from "vitest";
import * as AgentCore from "./index.js";

const plan = {
  canvasId: "canvas-1",
  ownerId: "owner-1",
  canvasRevision: 1,
  groups: [{ id: "stage", order: 0, mode: "parallel" as const, skipped: false, stepIds: ["step:A", "step:B", "step:C"] }],
  steps: [
    { id: "step:A", nodeId: "A", nodeType: "image", groupId: "stage", dependsOn: [], skipped: false, executionLayer: 0, configuration: { taskCapability: "image", executionPayload: { generationCount: 3 } } },
    { id: "step:B", nodeId: "B", nodeType: "image", groupId: "stage", dependsOn: [], skipped: false, executionLayer: 0, configuration: { taskCapability: "image", executionPayload: { generationCount: 3 } } },
    { id: "step:C", nodeId: "C", nodeType: "smart-candidate-selector", groupId: "stage", dependsOn: ["A", "B"], skipped: false, executionLayer: 1 },
  ],
  executionLayers: [
    { index: 0, stepIds: ["step:A", "step:B"] },
    { index: 1, stepIds: ["step:C"] },
  ],
};

describe("Canvas Run Agent analysis validation", () => {
  it("accepts bounded recommendations without changing deterministic layers", () => {
    const validate = (AgentCore as unknown as Record<string, unknown>).validateCanvasRunAgentAnalysis;
    expect(typeof validate).toBe("function");
    if (typeof validate !== "function") return;

    const result = validate({
      plan,
      maximumParallelism: 2,
      response: {
        summary: "A 与 B 可并发，C 等待两者完成。",
        concurrencyGroups: [{ stepIds: ["step:A", "step:B"], reason: "互不依赖" }],
        serialConstraints: [{ beforeStepId: "step:A", afterStepId: "step:C", reason: "候选汇聚" }],
        risks: ["上游任一分支失败会阻止汇聚"],
        recommendedMaximumParallelism: 2,
        estimatedRequestCount: 99,
      },
    });

    expect(result).toMatchObject({
      status: "completed",
      recommendedMaximumParallelism: 2,
      deterministicLayerCount: 2,
      estimatedRequestCount: 6,
    });
    expect(plan.executionLayers.map((layer) => layer.stepIds)).toEqual([["step:A", "step:B"], ["step:C"]]);
  });

  it.each([
    ["unknown step", { concurrencyGroups: [{ stepIds: ["step:A", "step:UNKNOWN"] }] }, "UNKNOWN_STEP"],
    ["dependency conflict", { concurrencyGroups: [{ stepIds: ["step:A", "step:C"] }] }, "DEPENDENCY_CONFLICT"],
    ["excessive parallelism", { recommendedMaximumParallelism: 8 }, "MAXIMUM_PARALLELISM_EXCEEDED"],
    ["malformed response", "not-an-object", "MALFORMED_RESPONSE"],
  ])("degrades deterministically for %s", (_label, response, expectedReason) => {
    const validate = (AgentCore as unknown as Record<string, unknown>).validateCanvasRunAgentAnalysis;
    expect(typeof validate).toBe("function");
    if (typeof validate !== "function") return;
    expect(validate({ plan, maximumParallelism: 2, response })).toMatchObject({
      status: "degraded",
      degradationReason: expectedReason,
      deterministicLayerCount: 2,
    });
  });
});
