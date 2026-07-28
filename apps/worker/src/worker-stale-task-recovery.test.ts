import { describe, expect, it } from "vitest";

import { resolveStaleTaskRecovery } from "./worker-stale-task-recovery.js";
import type { TaskRow } from "./worker-task-store.js";

function task(result: Record<string, unknown>): TaskRow {
  return {
    id: "task-stale-video",
    title: "Stale Plato video",
    status: "running",
    ownerId: "user-1",
    providerId: "provider-plato",
    providerName: "Plato",
    providerBaseUrl: "https://provider.test",
    providerProtocol: "apimart",
    providerEnabled: true,
    apiKeyCipher: "ciphertext",
    rhKeyPool: [],
    modelRecordId: "model-1",
    providerModelId: "grok-video",
    modelDisplayName: "Grok video",
    capability: "video",
    modelEnabled: true,
    payload: { taskCapability: "video" },
    result,
    logs: [],
  };
}

describe("stale task recovery", () => {
  it("requeues a stale video with an existing upstream task for polling-only recovery", () => {
    expect(resolveStaleTaskRecovery(task({
      upstreamTaskId: "upstream-existing-1",
      upstreamStatus: "success",
      runtimeStage: "batch_generating",
    }))).toMatchObject({
      action: "requeue_provider_poll",
      patch: {
        upstreamTaskId: "upstream-existing-1",
        outputRecoveryMode: "provider_poll_resume",
        outputRecoveryAvailable: true,
        providerPollRecoveryAttempts: 1,
      },
    });
  });

  it("falls back to terminal reaping after the recovery budget is exhausted", () => {
    expect(resolveStaleTaskRecovery(task({
      upstreamTaskId: "upstream-existing-1",
      providerPollRecoveryAttempts: 3,
    }))).toMatchObject({ action: "fail" });
  });
});
