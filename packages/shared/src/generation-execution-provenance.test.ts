import { describe, expect, it } from "vitest";

import {
  buildGenerationExecutionProvenance,
  readGenerationExecutionProvenance,
} from "./generation-execution-provenance.js";

describe("generation execution provenance", () => {
  it("freezes only the bounded resolved execution facts", () => {
    expect(buildGenerationExecutionProvenance({
      sourceTaskId: " task-1 ",
      sourceNodeId: " image-v3uy ",
      canvasRunId: " run-1 ",
      canvasRunStepId: " step-image ",
      providerId: " provider-1 ",
      modelRecordId: " model-record-1 ",
      resolvedPrompt: "  来自上游文本的最终提示词  ",
    })).toEqual({
      schemaVersion: 1,
      sourceTaskId: "task-1",
      sourceNodeId: "image-v3uy",
      canvasRunId: "run-1",
      canvasRunStepId: "step-image",
      providerId: "provider-1",
      modelRecordId: "model-record-1",
      resolvedPrompt: "来自上游文本的最终提示词",
    });
  });

  it("reads only schema version 1 provenance records", () => {
    expect(readGenerationExecutionProvenance({
      schemaVersion: 1,
      sourceTaskId: "task-1",
      sourceNodeId: "image-1",
      providerId: "provider-1",
      modelRecordId: "model-1",
      resolvedPrompt: "prompt",
      apiKey: "must-not-be-projected",
    })).toEqual({
      schemaVersion: 1,
      sourceTaskId: "task-1",
      sourceNodeId: "image-1",
      providerId: "provider-1",
      modelRecordId: "model-1",
      resolvedPrompt: "prompt",
    });
    expect(readGenerationExecutionProvenance({ schemaVersion: 2 })).toBeNull();
  });
});
