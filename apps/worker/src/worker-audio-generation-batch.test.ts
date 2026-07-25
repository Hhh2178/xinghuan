import { describe, expect, it, vi } from "vitest";

describe("worker audio generation batch", () => {
  it("submits one audio request per requested child and keeps batch order", async () => {
    const { executeAudioGenerationBatch } = await import("./worker-audio-generation-batch.js");
    const started: number[] = [];
    const resolvers: Array<(value: Record<string, unknown>) => void> = [];
    const execute = vi.fn((batchIndex: number) => {
      started.push(batchIndex);
      return new Promise<Record<string, unknown>>((resolve) => { resolvers[batchIndex] = resolve; });
    });
    const promise = executeAudioGenerationBatch({ generationCount: 2, execute });

    await vi.waitFor(() => expect(started).toEqual([0, 1]));
    resolvers[1]({ audioUrls: ["/1.wav"], taskId: "audio-1" });
    resolvers[0]({ audioUrls: ["/0.wav"], taskId: "audio-0" });

    await expect(promise).resolves.toMatchObject({
      audioUrls: ["/0.wav", "/1.wav"],
      audioCount: 2,
      generationCount: 2,
      providerRequestCount: 2,
      generationBatch: { children: [
        { batchIndex: 0, status: "succeeded", taskId: "audio-0" },
        { batchIndex: 1, status: "succeeded", taskId: "audio-1" },
      ] },
    });
  });
});
