import { afterEach, describe, expect, it, vi } from "vitest";

import { runWithOperationHeartbeat } from "./worker-operation-heartbeat.js";

afterEach(() => vi.useRealTimers());

describe("worker operation heartbeat", () => {
  it("keeps a bandwidth-constrained materialization alive until it completes", async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    const operation = new Promise<void>((resolve) => { finish = resolve; });
    const heartbeat = vi.fn(async () => undefined);

    const running = runWithOperationHeartbeat({
      intervalMs: 10_000,
      heartbeat,
      execute: () => operation,
    });
    await vi.advanceTimersByTimeAsync(20_000);
    expect(heartbeat).toHaveBeenCalledTimes(2);

    finish();
    await running;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(heartbeat).toHaveBeenCalledTimes(2);
  });
});
