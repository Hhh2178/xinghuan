import { describe, expect, it } from "vitest";

import { resolveCanvasRunArtifactProvenance } from "./canvas-run-artifact-provenance.js";

describe("Canvas Run artifact provenance", () => {
  it("reconstructs legacy provenance from the owner-scoped source task", () => {
    expect(resolveCanvasRunArtifactProvenance({
      artifact: {
        id: "artifact-1",
        ownerId: "owner-1",
        sourceTaskId: "task-1",
        sourceNodeId: "image-v3uy",
        providerId: "legacy-provider",
        modelId: "legacy-model",
        metadata: {},
      },
      sourceTask: {
        id: "task-1",
        ownerId: "owner-1",
        providerId: "provider-1",
        modelRecordId: "model-record-1",
        payload: {
          prompt: "resolved upstream prompt",
          sourceNodeId: "image-v3uy",
          canvasRunId: "run-1",
          canvasRunStepId: "step-image",
        },
      },
    })).toEqual({
      schemaVersion: 1,
      sourceTaskId: "task-1",
      sourceNodeId: "image-v3uy",
      canvasRunId: "run-1",
      canvasRunStepId: "step-image",
      providerId: "provider-1",
      modelRecordId: "model-record-1",
      resolvedPrompt: "resolved upstream prompt",
    });
  });

  it("does not use a source task from another owner", () => {
    expect(() => resolveCanvasRunArtifactProvenance({
      artifact: {
        id: "artifact-1",
        ownerId: "owner-1",
        sourceTaskId: "task-1",
        sourceNodeId: "image-1",
        providerId: "provider-1",
        modelId: "model-1",
        metadata: {},
      },
      sourceTask: {
        id: "task-1",
        ownerId: "owner-2",
        payload: { prompt: "must not leak" },
      },
    })).toThrow("SMART_CANDIDATE_PROVENANCE_OWNER_MISMATCH");
  });
});
