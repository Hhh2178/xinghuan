import { describe, expect, it, vi } from "vitest";

import { buildOutputRecoveryFailurePatch, executeOutputRecoveryTask } from "./worker-output-recovery.js";
import type { TaskRow } from "./worker-task-store.js";

function recoverableVideoTask(): TaskRow {
  return {
    id: "task-recover-provider-poll",
    title: "Recover Plato output",
    status: "running",
    ownerId: "user-1",
    providerId: "provider-plato",
    providerName: "Plato",
    providerBaseUrl: "https://provider.test",
    providerProtocol: "apimart",
    providerEnabled: true,
    apiKeyCipher: "ciphertext",
    rhKeyPool: [],
    modelRecordId: "model-record-1",
    providerModelId: "grok-1.5-video-15s",
    modelDisplayName: "Grok video",
    capability: "video",
    modelEnabled: true,
    payload: { taskCapability: "video", outputRecoveryMode: "provider_poll_resume" },
    result: {
      adapter: "apimart-video",
      upstreamTaskId: "upstream-existing-1",
      outputRecoveryMode: "provider_poll_resume",
      failureReason: "previous local failure",
    },
    logs: [],
  };
}

describe("worker output recovery", () => {
  it("keeps an existing upstream video task recoverable after local polling fails", () => {
    const task = recoverableVideoTask();
    task.result = { upstreamTaskId: "upstream-existing-1", adapter: "apimart-video" };

    expect(buildOutputRecoveryFailurePatch(task, {}, new Error("local polling ended"))).toMatchObject({
      outputRecoveryAvailable: true,
      outputRecoveryMode: "provider_poll_resume",
      upstreamTaskId: "upstream-existing-1",
      materializationStatus: "pending",
    });
  });

  it("resumes the existing provider task without submitting a new generation", async () => {
    const resumeProviderOutput = vi.fn(async () => ({
      adapter: "apimart-video",
      providerState: "completed",
      videoUrls: ["https://provider.test/result.mp4"],
      remoteVideoUrls: ["https://provider.test/result.mp4"],
    }));

    const result = await executeOutputRecoveryTask(
      recoverableVideoTask(),
      () => "decrypted-key",
      { resumeProviderOutput },
    );

    expect(resumeProviderOutput).toHaveBeenCalledOnce();
    expect(resumeProviderOutput).toHaveBeenCalledWith(expect.objectContaining({
      upstreamTaskId: "upstream-existing-1",
      apiKey: "decrypted-key",
    }));
    expect(result).toMatchObject({
      outputRecoveryMode: "output_only",
      providerPollResumed: true,
      failureReason: null,
      failureCategory: null,
      remoteVideoUrls: ["https://provider.test/result.mp4"],
      videoUrls: ["https://provider.test/result.mp4"],
    });
  });
});
