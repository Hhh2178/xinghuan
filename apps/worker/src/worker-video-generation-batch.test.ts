import { describe, expect, it, vi } from "vitest";

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
});
