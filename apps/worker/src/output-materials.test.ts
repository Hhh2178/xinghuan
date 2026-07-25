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

  it("binds ordered artifact ids back to the corresponding batch children", async () => {
    const materialized = await materializeTaskOutputs({
      dataDir: "test-data",
      task: {
        id: "task-batch",
        ownerId: "owner-1",
        title: "batch",
        providerId: "provider-1",
        providerName: "Provider",
        modelRecordId: "model-record-1",
        providerModelId: "provider-model-1",
        modelDisplayName: "Model",
        payload: { prompt: "prompt", sourceNodeId: "image-1" },
      },
      result: {
        imageUrls: [
          "data:image/png;base64,aW1hZ2UtMQ==",
          "data:image/png;base64,aW1hZ2UtMg==",
        ],
        generationBatch: {
          total: 2,
          completed: 2,
          providerRequestCount: 2,
          children: [
            { batchIndex: 0, status: "succeeded", generationArtifactIds: [] },
            { batchIndex: 1, status: "succeeded", generationArtifactIds: [] },
          ],
        },
      },
    });

    expect(materialized.resultPatch.generationBatch).toMatchObject({
      children: [
        { batchIndex: 0, generationArtifactIds: [materialized.artifacts[0].id] },
        { batchIndex: 1, generationArtifactIds: [materialized.artifacts[1].id] },
      ],
    });
  });

  it("does not bind a later successful artifact to an earlier failed child", async () => {
    const successfulUrl = "data:image/png;base64,aW1hZ2UtMg==";
    const materialized = await materializeTaskOutputs({
      dataDir: "test-data",
      task: {
        id: "task-partial-batch",
        ownerId: "owner-1",
        title: "partial batch",
        providerId: "provider-1",
        providerName: "Provider",
        modelRecordId: "model-record-1",
        providerModelId: "provider-model-1",
        modelDisplayName: "Model",
        payload: { prompt: "prompt", sourceNodeId: "image-1" },
      },
      result: {
        imageUrls: [successfulUrl],
        generationBatch: {
          total: 2,
          completed: 1,
          providerRequestCount: 2,
          children: [
            { batchIndex: 0, status: "failed", error: "request failed", outputUrls: [] },
            { batchIndex: 1, status: "succeeded", outputUrls: [successfulUrl] },
          ],
        },
      },
    });

    expect(materialized.resultPatch.generationBatch).toMatchObject({
      children: [
        { batchIndex: 0, status: "failed", generationArtifactIds: [] },
        { batchIndex: 1, status: "succeeded", generationArtifactIds: [materialized.artifacts[0].id] },
      ],
    });
  });
});
