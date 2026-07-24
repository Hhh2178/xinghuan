import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildTaskGenerationArtifactId } from "@xinghuan/shared";

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(async () => undefined),
  readFile: vi.fn(async () => { throw Object.assign(new Error("missing"), { code: "ENOENT" }); }),
  rename: vi.fn(async () => undefined),
  stat: vi.fn(async () => ({ size: 1 })),
  writeFile: vi.fn(async () => undefined),
}));

import { materializeTaskOutputs } from "./output-materials.js";
import { boundedGenerationCount, executeImageGenerationBatch } from "./worker-image-generation-batch.js";

describe("worker image generation batch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("bounds the server-owned generation count", () => {
    expect(boundedGenerationCount(undefined)).toBe(1);
    expect(boundedGenerationCount(0)).toBe(1);
    expect(boundedGenerationCount(2)).toBe(2);
    expect(boundedGenerationCount(99)).toBe(4);
  });

  it("materializes two stable artifact ids for generationCount=2", async () => {
    const execute = vi.fn(async (batchIndex: number) => ({
      adapter: "test-image",
      taskId: `upstream-${batchIndex + 1}`,
      imageUrls: [`data:image/png;base64,${Buffer.from(`image-${batchIndex + 1}`).toString("base64")}`],
      remoteImageUrls: [],
    }));
    const progress = vi.fn(async () => undefined);
    const result = await executeImageGenerationBatch({ generationCount: 2, execute, onProgress: progress });
    const materialized = await materializeTaskOutputs({
      dataDir: "test-data",
      task: {
        id: "task-two-candidates",
        ownerId: "owner-1",
        title: "two candidates",
        providerId: "provider-1",
        providerName: "Provider",
        modelRecordId: "model-1",
        providerModelId: "image-model",
        modelDisplayName: "Image Model",
        payload: { sourceNodeId: "image-1", canvasRunId: "run-1" },
      },
      result,
    });

    expect(execute).toHaveBeenCalledTimes(2);
    expect(progress).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ imageCount: 2, generationCount: 2, providerRequestCount: 2 });
    expect(materialized.resultPatch.generationArtifactIds).toEqual([
      buildTaskGenerationArtifactId({ taskId: "task-two-candidates", kind: "image", index: 0 }),
      buildTaskGenerationArtifactId({ taskId: "task-two-candidates", kind: "image", index: 1 }),
    ]);
  });

  it("stops before the next provider request when the task is cancelled", async () => {
    const execute = vi.fn(async () => ({ imageUrls: ["https://example.test/one.png"] }));
    const isCancelled = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await expect(executeImageGenerationBatch({ generationCount: 2, execute, isCancelled }))
      .rejects.toThrow("TASK_CANCELLED");
    expect(execute).toHaveBeenCalledOnce();
  });

  it("keeps distinct candidate slots when separate requests return the same URL", async () => {
    const execute = vi.fn(async () => ({ imageUrls: ["https://example.test/candidate.png"] }));

    const result = await executeImageGenerationBatch({ generationCount: 2, execute });

    expect(result.imageUrls).toEqual([
      "https://example.test/candidate.png",
      "https://example.test/candidate.png",
    ]);
    expect(result).toMatchObject({ imageCount: 2, providerRequestCount: 2 });
  });

  it("requests only the remaining candidate count after a partial native batch", async () => {
    const execute = vi.fn(async (_batchIndex: number, remaining: number) => ({
      imageUrls: Array.from({ length: Math.min(2, remaining) }, (_, index) => `https://example.test/${remaining}-${index}.png`),
    }));

    const result = await executeImageGenerationBatch({ generationCount: 3, execute });

    expect(execute).toHaveBeenNthCalledWith(1, 0, 3);
    expect(execute).toHaveBeenNthCalledWith(2, 1, 1);
    expect(result).toMatchObject({ imageCount: 3, providerRequestCount: 2 });
  });
});
