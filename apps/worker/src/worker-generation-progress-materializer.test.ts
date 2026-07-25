import { describe, expect, it, vi } from "vitest";

import {
  createGenerationProgressMaterializer,
  executeGenerationBatchWithMaterializedProgress,
} from "./worker-generation-progress-materializer.js";

const task = {
  id: "task-batch",
  ownerId: "owner-1",
  title: "batch",
  providerId: "provider-1",
  providerName: "Provider",
  modelRecordId: "model-1",
  providerModelId: "image-model",
  modelDisplayName: "Image Model",
  payload: { sourceNodeId: "image-1" },
};

describe("worker generation progress materializer", () => {
  it("persists a platform artifact projection before the whole batch finishes", async () => {
    const persist = vi.fn(async () => undefined);
    const materialize = vi.fn(async () => ({
      artifacts: [],
      resourceItems: [],
      resultPatch: {
        generationArtifactIds: ["artifact-0"],
        resourceItemIds: ["artifact-0"],
        resourceCount: 1,
        materializedImageUrls: ["/files/output/task-batch-image-0.png"],
        materializedVideoUrls: [],
        materializedAudioUrls: [],
        generationBatch: batch(1, ["artifact-0"]),
      },
    }));
    const progress = createGenerationProgressMaterializer({
      dataDir: "test-data",
      task,
      persist,
      materialize,
    });

    await progress.record({
      result: {
        completed: 1,
        total: 3,
        imageUrls: ["https://provider.test/0.png"],
        generationBatch: batch(1),
      },
      runtimePatch: { progress: "1/3", runtimeStage: "generating_batch" },
    });

    expect(materialize).toHaveBeenCalledOnce();
    expect(persist).toHaveBeenLastCalledWith(expect.objectContaining({
      progress: "1/3",
      generationArtifactIds: ["artifact-0"],
      materializedImageUrls: ["/files/output/task-batch-image-0.png"],
      generationBatch: expect.objectContaining({
        children: expect.arrayContaining([
          expect.objectContaining({ batchIndex: 0, generationArtifactIds: ["artifact-0"] }),
        ]),
      }),
    }));
  });

  it("keeps materialized outputs in a later partial-failure result patch", async () => {
    const progress = createGenerationProgressMaterializer({
      dataDir: "test-data",
      task,
      persist: vi.fn(async () => undefined),
      materialize: vi.fn(async () => ({
        artifacts: [],
        resourceItems: [],
        resultPatch: {
          generationArtifactIds: ["artifact-0"],
          resourceItemIds: ["artifact-0"],
          resourceCount: 1,
          materializedImageUrls: ["/files/output/task-batch-image-0.png"],
          materializedVideoUrls: [],
          materializedAudioUrls: [],
          generationBatch: batch(1, ["artifact-0"]),
        },
      })),
    });
    await progress.record({
      result: { completed: 1, total: 2, imageUrls: ["https://provider.test/0.png"], generationBatch: batch(1) },
      runtimePatch: { progress: "1/2" },
    });
    const error = Object.assign(new Error("second child failed"), {
      resultPatch: {
        imageUrls: ["https://provider.test/0.png"],
        generationBatch: {
          total: 2,
          completed: 1,
          providerRequestCount: 2,
          children: [
            { batchIndex: 0, status: "succeeded", generationArtifactIds: [] },
            { batchIndex: 1, status: "failed", generationArtifactIds: [], error: "failed" },
          ],
        },
      },
    });

    progress.mergeIntoError(error);

    expect(error.resultPatch).toMatchObject({
      materializedImageUrls: ["/files/output/task-batch-image-0.png"],
      generationArtifactIds: ["artifact-0"],
      generationBatch: {
        children: [
          { batchIndex: 0, status: "succeeded", generationArtifactIds: ["artifact-0"] },
          { batchIndex: 1, status: "failed", generationArtifactIds: [], error: "failed" },
        ],
      },
    });
  });

  it("serializes callbacks and does not rematerialize the same completed count", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const materialize = vi.fn(async () => {
      await gate;
      return {
        artifacts: [],
        resourceItems: [],
        resultPatch: {
          generationArtifactIds: ["artifact-0"],
          resourceItemIds: ["artifact-0"],
          resourceCount: 1,
          materializedImageUrls: ["/files/output/task-batch-image-0.png"],
          materializedVideoUrls: [],
          materializedAudioUrls: [],
          generationBatch: batch(1, ["artifact-0"]),
        },
      };
    });
    const progress = createGenerationProgressMaterializer({
      dataDir: "test-data",
      task,
      persist: vi.fn(async () => undefined),
      materialize,
    });
    const snapshot = { completed: 1, total: 3, imageUrls: ["https://provider.test/0.png"], generationBatch: batch(1) };

    const first = progress.record({ result: snapshot, runtimePatch: { progress: "1/3" } });
    const duplicate = progress.record({ result: snapshot, runtimePatch: { progress: "1/3" } });
    await vi.waitFor(() => expect(materialize).toHaveBeenCalledOnce());
    release();
    await Promise.all([first, duplicate]);

    expect(materialize).toHaveBeenCalledOnce();
  });

  it("merges partial artifacts into an error thrown by the shared batch boundary", async () => {
    const execute = vi.fn(async (onProgress: (batch: {
      completed: number;
      total: number;
      generationBatch: unknown;
      imageUrls?: string[];
    }) => Promise<void>) => {
      await onProgress({
        completed: 1,
        total: 2,
        imageUrls: ["https://provider.test/0.png"],
        generationBatch: batch(1),
      });
      throw Object.assign(new Error("second child failed"), {
        resultPatch: { generationBatch: batch(1) },
      });
    });

    await expect(executeGenerationBatchWithMaterializedProgress({
      dataDir: "test-data",
      task,
      persist: vi.fn(async () => undefined),
      materialize: vi.fn(async () => ({
        artifacts: [],
        resourceItems: [],
        resultPatch: {
          generationArtifactIds: ["artifact-0"],
          materializedImageUrls: ["/files/output/task-batch-image-0.png"],
          generationBatch: batch(1, ["artifact-0"]),
        },
      })),
      execute,
      runtimePatch: (progress) => ({ progress: `${progress.completed}/${progress.total}` }),
    })).rejects.toMatchObject({
      resultPatch: {
        generationArtifactIds: ["artifact-0"],
        materializedImageUrls: ["/files/output/task-batch-image-0.png"],
      },
    });
  });
});

function batch(completed: number, artifactIds: string[] = []) {
  return {
    total: 3,
    completed,
    providerRequestCount: 2,
    children: [
      { batchIndex: 0, status: "succeeded", generationArtifactIds: artifactIds },
      { batchIndex: 1, status: completed > 1 ? "succeeded" : "running", generationArtifactIds: [] },
      { batchIndex: 2, status: "queued", generationArtifactIds: [] },
    ],
  };
}
