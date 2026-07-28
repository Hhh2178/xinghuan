import { describe, expect, it } from "vitest";

import { applyTaskFinalization, createRetriedTask, isTerminalTaskStatus } from "./task-lifecycle.js";

describe("task finalization", () => {
  it("sets finalizedAt only when a task first becomes terminal", () => {
    expect(isTerminalTaskStatus("succeeded")).toBe(true);
    expect(applyTaskFinalization({ status: "succeeded", finalizedAt: undefined }, 1000)).toMatchObject({ finalizedAt: 1000 });
    expect(applyTaskFinalization({ status: "failed", finalizedAt: 900 }, 1000)).toMatchObject({ finalizedAt: 900 });
    expect(applyTaskFinalization({ status: "running", finalizedAt: undefined }, 1000).finalizedAt).toBeUndefined();
  });

  it("does not carry a finalized timestamp into a retry", () => {
    const task = createRetriedTask({
      id: "task-original",
      title: "original",
      status: "failed",
      logs: [],
      createdAt: 1,
      updatedAt: 2,
      finalizedAt: 2,
    }, { id: "task-retry", ownerId: "admin", now: 3 });

    expect(task).not.toHaveProperty("finalizedAt");
  });

  it("preserves the original execution identity snapshot on retry", () => {
    const executionIdentitySnapshot = {
      providerId: "provider-rh",
      providerName: "RunningHub",
      modelRecordId: "model-rh-video",
      providerModelId: "/rhart-video-g/image-to-video",
      modelName: "RH image to video",
    };
    const task = createRetriedTask({
      id: "task-original",
      title: "original",
      status: "failed",
      executionIdentitySnapshot,
      logs: [],
      createdAt: 1,
      updatedAt: 2,
    }, { id: "task-retry", ownerId: "admin", now: 3 });

    expect(task.executionIdentitySnapshot).toEqual(executionIdentitySnapshot);
  });

  it("removes output recovery mode when creating a new provider retry", () => {
    const task = createRetriedTask({
      id: "task-recovery",
      title: "recover",
      status: "failed",
      payload: { taskCapability: "video", outputRecoveryMode: "provider_poll_resume" },
      logs: [],
      createdAt: 1,
      updatedAt: 2,
    }, { id: "task-retry", ownerId: "admin", now: 3 });

    expect(task.payload).toEqual({ taskCapability: "video" });
  });
});
