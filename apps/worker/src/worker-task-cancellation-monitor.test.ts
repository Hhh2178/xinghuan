import { describe, expect, it, vi } from "vitest";

import { createWorkerTaskCancellationMonitor } from "./worker-task-cancellation-monitor.js";

describe("worker task cancellation monitor", () => {
  it("aborts an in-flight provider request after cancellation is observed", async () => {
    let scheduled: (() => void) | undefined;
    const monitor = createWorkerTaskCancellationMonitor({
      taskId: "task-1",
      intervalMs: 1000,
      isTaskCancelled: vi.fn(async () => true),
      schedule: (callback) => {
        scheduled = callback;
        return 1 as unknown as NodeJS.Timeout;
      },
      clear: vi.fn(),
    });

    scheduled?.();
    await vi.waitFor(() => expect(monitor.signal.aborted).toBe(true));
    monitor.stop();
  });
});
