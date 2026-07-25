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
    expect(progress).toHaveBeenCalledTimes(4);
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({
      completed: 2,
      generationBatch: { total: 2, completed: 2, providerRequestCount: 2, children: expect.any(Array) },
    }));
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

  it("submits one provider request for every requested candidate", async () => {
    const execute = vi.fn(async (_batchIndex: number, remaining: number) => ({
      imageUrls: Array.from({ length: Math.min(2, remaining) }, (_, index) => `https://example.test/${remaining}-${index}.png`),
    }));

    const result = await executeImageGenerationBatch({ generationCount: 3, execute });

    expect(execute).toHaveBeenCalledTimes(3);
    expect(execute).toHaveBeenNthCalledWith(1, 0, 1);
    expect(execute).toHaveBeenNthCalledWith(2, 1, 1);
    expect(execute).toHaveBeenNthCalledWith(3, 2, 1);
    expect(result).toMatchObject({ imageCount: 3, providerRequestCount: 3 });
  });

  it("submits requested children concurrently and orders results by batch index", async () => {
    const gates = deferredExecutions(3);
    const promise = executeImageGenerationBatch({ generationCount: 3, execute: gates.execute });

    await vi.waitFor(() => expect(gates.started).toEqual([0, 1, 2]));
    gates.resolve(2, { imageUrls: ["/2.png"], taskId: "provider-2" });
    gates.resolve(0, { imageUrls: ["/0.png"], taskId: "provider-0" });
    gates.resolve(1, { imageUrls: ["/1.png"], taskId: "provider-1" });

    await expect(promise).resolves.toMatchObject({
      imageUrls: ["/0.png", "/1.png", "/2.png"],
      taskIds: ["provider-0", "provider-1", "provider-2"],
      generationBatch: {
        children: [
          { batchIndex: 0, status: "succeeded", taskId: "provider-0" },
          { batchIndex: 1, status: "succeeded", taskId: "provider-1" },
          { batchIndex: 2, status: "succeeded", taskId: "provider-2" },
        ],
      },
    });
  });

  it("keeps completed child state and ignores late results after cancellation", async () => {
    const gates = deferredExecutions(3);
    let cancelled = false;
    const progress: unknown[] = [];
    const promise = executeImageGenerationBatch({
      generationCount: 3,
      maximumConcurrency: 2,
      execute: gates.execute,
      isCancelled: async () => cancelled,
      onProgress: async (snapshot) => {
        progress.push(structuredClone(snapshot));
        if (JSON.stringify(snapshot).includes('"batchIndex":0,"status":"succeeded"')) cancelled = true;
      },
    });

    await vi.waitFor(() => expect(gates.started).toEqual([0, 1]));
    gates.resolve(0, { imageUrls: ["/completed.png"], taskId: "provider-0" });
    await vi.waitFor(() => expect(JSON.stringify(progress)).toContain('"status":"succeeded"'));
    gates.resolve(1, { imageUrls: ["/late.png"], taskId: "provider-1" });

    await expect(promise).rejects.toMatchObject({
      message: "TASK_CANCELLED",
      resultPatch: {
        imageUrls: ["/completed.png"],
        generationBatch: {
          children: [
            { batchIndex: 0, status: "succeeded" },
            { batchIndex: 1, status: "cancelled" },
            { batchIndex: 2, status: "cancelled" },
          ],
        },
      },
    });
    expect(gates.started).toEqual([0, 1]);
    expect(JSON.stringify(progress)).not.toContain("/late.png");
  });
});

function deferredExecutions(count: number) {
  const started: number[] = [];
  const slots = Array.from({ length: count }, () => {
    let resolve!: (value: Record<string, unknown>) => void;
    const promise = new Promise<Record<string, unknown>>((done) => { resolve = done; });
    return { promise, resolve };
  });
  return {
    started,
    execute: vi.fn((batchIndex: number) => {
      started.push(batchIndex);
      return slots[batchIndex].promise;
    }),
    resolve(batchIndex: number, value: Record<string, unknown>) {
      slots[batchIndex].resolve(value);
    },
  };
}
