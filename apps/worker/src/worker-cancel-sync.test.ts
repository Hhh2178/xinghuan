import { describe, expect, it, vi } from "vitest";

import { createWorkerCancelSync } from "./worker-cancel-sync.js";

describe("worker cancel synchronization", () => {
  it("drops a late successful result after generation or evaluation was cancelled", async () => {
    const dropCancelledAttempt = vi.fn(async () => undefined);
    const sync = createWorkerCancelSync({
      isTaskCancelled: vi.fn(async () => true),
      dropCancelledAttempt,
      keepCancelledState: vi.fn(async () => undefined),
      logWorkerEvent: vi.fn(),
    });

    await expect(sync.dropResultIfCancelled({ taskId: "quality-task-1", capability: "chat", trace: { canvasRunId: "run-1" } })).resolves.toBe(true);
    expect(dropCancelledAttempt).toHaveBeenCalledWith(expect.objectContaining({ taskId: "quality-task-1", capability: "chat", line: expect.stringContaining("丢弃执行结果") }));
  });

  it("drops a late upstream error instead of reviving a cancelled task as failed", async () => {
    const dropCancelledAttempt = vi.fn(async () => undefined);
    const sync = createWorkerCancelSync({
      isTaskCancelled: vi.fn(async () => true),
      dropCancelledAttempt,
      keepCancelledState: vi.fn(async () => undefined),
      logWorkerEvent: vi.fn(),
    });

    await expect(sync.dropErrorIfCancelled({ taskId: "generation-task-1", capability: "video", trace: { canvasRunId: "run-1" } })).resolves.toBe(true);
    expect(dropCancelledAttempt).toHaveBeenCalledWith(expect.objectContaining({ taskId: "generation-task-1", capability: "video", line: expect.stringContaining("丢弃执行错误") }));
  });

  it("keeps normal completion when no cancellation was requested", async () => {
    const dropCancelledAttempt = vi.fn(async () => undefined);
    const sync = createWorkerCancelSync({
      isTaskCancelled: vi.fn(async () => false),
      dropCancelledAttempt,
      keepCancelledState: vi.fn(async () => undefined),
      logWorkerEvent: vi.fn(),
    });

    await expect(sync.dropResultIfCancelled({ taskId: "task-1", capability: "image", trace: {} })).resolves.toBe(false);
    expect(dropCancelledAttempt).not.toHaveBeenCalled();
  });
});
