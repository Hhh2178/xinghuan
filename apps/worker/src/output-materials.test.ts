import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(async () => undefined),
  readFile: vi.fn(async () => { throw Object.assign(new Error("missing"), { code: "ENOENT" }); }),
  rename: vi.fn(async () => undefined),
  stat: vi.fn(async () => ({ size: 1 })),
  writeFile: vi.fn(async () => undefined),
}));

import { materializeTaskOutputs } from "./output-materials.js";

describe("output material provenance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("freezes the resolved task prompt into every materialized artifact", async () => {
    const materialized = await materializeTaskOutputs({
      dataDir: "test-data",
      task: {
        id: "task-1",
        ownerId: "owner-1",
        title: "three candidates",
        providerId: "provider-1",
        providerName: "Provider",
        modelRecordId: "model-record-1",
        providerModelId: "provider-model-1",
        modelDisplayName: "Model",
        payload: {
          prompt: "来自上游文本的最终提示词",
          sourceNodeId: "image-v3uy",
          canvasRunId: "run-1",
          canvasRunStepId: "step-image",
        },
      },
      result: {
        imageUrls: ["data:image/png;base64,aW1hZ2UtMQ=="],
      },
    });

    expect(materialized.artifacts[0].metadata?.provenance).toEqual({
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
});
