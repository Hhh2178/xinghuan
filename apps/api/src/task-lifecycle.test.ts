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
});
