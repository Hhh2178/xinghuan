import { describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(async () => undefined),
  readFile: vi.fn(async () => { throw Object.assign(new Error("missing"), { code: "ENOENT" }); }),
  rename: vi.fn(async () => undefined),
  stat: vi.fn(async () => ({ size: 1 })),
  writeFile: vi.fn(async () => undefined),
}));

import { attachOutputFetchContext, materializeTaskOutputs } from "./output-materials.js";
import { executeVideoGenerationBatch } from "./worker-video-generation-batch.js";

describe("worker video generation batch", () => {
  it("submits distinct async video requests and retains every completed video", async () => {
    const execute = vi.fn(async (batchIndex: number) => ({
      taskId: `upstream-${batchIndex + 1}`,
      videoUrls: [`https://example.test/video-${batchIndex + 1}.mp4`],
      remoteVideoUrls: [`https://example.test/video-${batchIndex + 1}.mp4`],
    }));
    const progress = vi.fn(async () => undefined);

    const result = await executeVideoGenerationBatch({ generationCount: 2, execute, onProgress: progress });

    expect(execute).toHaveBeenCalledTimes(2);
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({
      completed: 2,
      total: 2,
      providerRequestCount: 2,
      videoUrls: ["https://example.test/video-1.mp4", "https://example.test/video-2.mp4"],
    }));
    expect(result).toMatchObject({
      videoUrls: ["https://example.test/video-1.mp4", "https://example.test/video-2.mp4"],
      videoCount: 2,
      generationCount: 2,
      providerRequestCount: 2,
      taskIds: ["upstream-1", "upstream-2"],
    });
  });

  it("does not stop early when a provider returns multiple videos", async () => {
    const execute = vi.fn(async () => ({ videoUrls: ["https://example.test/a.mp4", "https://example.test/b.mp4"] }));

    const result = await executeVideoGenerationBatch({ generationCount: 3, execute });

    expect(execute).toHaveBeenCalledTimes(3);
    expect(execute).toHaveBeenNthCalledWith(1, 0, 1);
    expect(execute).toHaveBeenNthCalledWith(2, 1, 1);
    expect(execute).toHaveBeenNthCalledWith(3, 2, 1);
    expect(result).toMatchObject({ videoCount: 3, providerRequestCount: 3 });
  });

  it("orders concurrently completed videos by batch index", async () => {
    const started: number[] = [];
    const resolvers: Array<(value: Record<string, unknown>) => void> = [];
    const execute = vi.fn((batchIndex: number) => {
      started.push(batchIndex);
      return new Promise<Record<string, unknown>>((resolve) => { resolvers[batchIndex] = resolve; });
    });
    const promise = executeVideoGenerationBatch({ generationCount: 2, execute });

    await vi.waitFor(() => expect(started).toEqual([0, 1]));
    resolvers[1]({ videoUrls: ["/1.mp4"], taskId: "video-1" });
    resolvers[0]({ videoUrls: ["/0.mp4"], taskId: "video-0" });

    await expect(promise).resolves.toMatchObject({
      videoUrls: ["/0.mp4", "/1.mp4"],
      generationBatch: { children: [
        { batchIndex: 0, status: "succeeded" },
        { batchIndex: 1, status: "succeeded" },
      ] },
    });
  });

  it("preserves non-persisted download headers through progress and final batch projections", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("video", {
      status: 200,
      headers: { "content-type": "video/mp4" },
    }));
    const materializedSnapshots: Record<string, unknown>[] = [];
    const execute = vi.fn(async (batchIndex: number) => attachOutputFetchContext({
      taskId: `upstream-${batchIndex}`,
      videoUrls: [`https://secure-provider.test/video-${batchIndex}.mp4`],
      remoteVideoUrls: [`https://secure-provider.test/video-${batchIndex}.mp4`],
    }, {
      origin: "https://secure-provider.test",
      headers: { authorization: "Bearer private-download-token" },
    }));

    const result = await executeVideoGenerationBatch({
      generationCount: 2,
      maximumConcurrency: 1,
      execute,
      onProgress: async (snapshot) => {
        if (snapshot.completed !== 1 || materializedSnapshots.length > 0) return;
        materializedSnapshots.push((await materializeTaskOutputs({
          dataDir: "test-data",
          task: materializeTask,
          result: snapshot as unknown as Record<string, unknown>,
        })).resultPatch);
      },
    });
    await materializeTaskOutputs({ dataDir: "test-data", task: materializeTask, result });

    expect(materializedSnapshots).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy.mock.calls.every(([, init]) => (
      (init?.headers as Record<string, string>)?.authorization === "Bearer private-download-token"
    ))).toBe(true);
    expect(JSON.stringify(result)).not.toContain("private-download-token");
    fetchSpy.mockRestore();
  });
});

const materializeTask = {
  id: "task-secure-video",
  ownerId: "owner-1",
  title: "secure video",
  providerId: "provider-1",
  providerName: "Provider",
  modelRecordId: "model-1",
  providerModelId: "video-model",
  modelDisplayName: "Video Model",
  payload: { sourceNodeId: "video-1" },
};
