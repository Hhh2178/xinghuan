import { describe, expect, it, vi } from "vitest";

import { resumeProviderVideoOutput } from "./worker-provider-output-resume.js";
import type { TaskRow } from "./worker-task-store.js";

describe("provider output polling resume", () => {
  it("polls an existing APIMart task and never needs a submit callback", async () => {
    const pollApimart = vi.fn(async () => ({ status: "success", failureReason: "", videoUrls: ["https://provider.test/result.mp4"] }));
    const touchTaskRuntime = vi.fn(async () => undefined);

    const result = await resumeProviderVideoOutput({
      task: task(),
      apiKey: "decrypted-key",
      upstreamTaskId: "upstream-existing-1",
    }, { pollApimart, touchTaskRuntime });

    expect(pollApimart).toHaveBeenCalledOnce();
    expect(pollApimart).toHaveBeenCalledWith(expect.objectContaining({ taskId: "upstream-existing-1" }));
    expect(result).toMatchObject({
      adapter: "apimart-video",
      taskId: "upstream-existing-1",
      remoteVideoUrls: ["https://provider.test/result.mp4"],
    });
  });
});

function task(): TaskRow {
  return {
    id: "task-1",
    title: "recover",
    status: "running",
    ownerId: "user-1",
    providerId: "provider-1",
    providerName: "Plato",
    providerBaseUrl: "https://provider.test",
    providerProtocol: "apimart",
    providerEnabled: true,
    apiKeyCipher: "ciphertext",
    rhKeyPool: [],
    modelRecordId: "model-1",
    providerModelId: "grok-1.5-video-15s",
    modelDisplayName: "Grok video",
    capability: "video",
    modelEnabled: true,
    payload: {
      taskCapability: "video",
      pollPathTemplate: "videos/{task_id}",
      taskStatusPath: "status",
      resultVideoPath: "data.output",
      pollIntervalMs: 500,
    },
    result: { upstreamTaskId: "upstream-existing-1" },
    logs: [],
  };
}
