import { describe, expect, it } from "vitest";

import { buildNodeExecutionProjection } from "./node-execution-projection.js";

describe("node execution projection", () => {
  it("projects safe ordered child state and materialized outputs", () => {
    expect(buildNodeExecutionProjection({
      authority: "workflow_run",
      runId: "run-1",
      runStepId: "step-1",
      nodeId: "image-v3uy",
      nodeType: "image",
      stepStatus: "running",
      taskId: "task-1",
      taskStatus: "running",
      taskResult: {
        generationBatch: { total: 3, completed: 2, children: [
          { batchIndex: 2, status: "running" },
          { batchIndex: 0, status: "succeeded", taskId: "provider-0", generationArtifactIds: ["artifact-0"] },
          { batchIndex: 1, status: "succeeded", taskId: "provider-1", generationArtifactIds: ["artifact-1"] },
        ] },
        generationArtifactIds: ["artifact-0", "artifact-1"],
        materializedImageUrls: ["/files/output/0.png", "/files/output/1.png"],
        remoteImageUrls: ["https://provider.invalid/private.png"],
      },
    })).toEqual({
      authority: "workflow_run",
      runId: "run-1",
      runStepId: "step-1",
      nodeId: "image-v3uy",
      nodeType: "image",
      status: "running",
      progress: "2/3",
      taskId: "task-1",
      taskRuns: [
        { batchIndex: 0, status: "success", taskId: "provider-0", generationArtifactIds: ["artifact-0"] },
        { batchIndex: 1, status: "success", taskId: "provider-1", generationArtifactIds: ["artifact-1"] },
        { batchIndex: 2, status: "running", generationArtifactIds: [] },
      ],
      outputs: {
        generationArtifactIds: ["artifact-0", "artifact-1"],
        imageUrls: ["/files/output/0.png", "/files/output/1.png"],
        videoUrls: [],
        audioUrls: [],
      },
    });
  });

  it("keeps an evaluating step running after its provider task succeeds", () => {
    expect(buildNodeExecutionProjection({
      authority: "workflow_run",
      nodeId: "selector-1",
      nodeType: "smart-candidate-selector",
      stepStatus: "evaluating",
      taskId: "task-1",
      taskStatus: "succeeded",
    }).status).toBe("running");
  });

  it("projects a queued step as running once its task has started", () => {
    expect(buildNodeExecutionProjection({
      authority: "workflow_run",
      nodeId: "image-1",
      nodeType: "image",
      stepStatus: "queued",
      taskId: "task-1",
      taskStatus: "running",
    }).status).toBe("running");
  });
});
