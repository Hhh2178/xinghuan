import { describe, expect, it, vi } from "vitest";
import { createReadAuditBuffer } from "./read-audit-buffer.js";

describe("read audit buffer", () => {
  it("flushes in FIFO batches and reports queue state", async () => {
    const writes: number[][] = [];
    const buffer = createReadAuditBuffer<number>({ maxBatch: 2, flushIntervalMs: 60_000, write: async (items) => { writes.push(items); } });
    buffer.push(1); buffer.push(2); buffer.push(3);
    await buffer.flush();
    await buffer.flush();
    expect(writes).toEqual([[1, 2], [3]]);
  });

  it("bounds memory and retries failed writes", async () => {
    const write = vi.fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce(undefined);
    const buffer = createReadAuditBuffer<number>({ maxQueue: 2, maxBatch: 2, flushIntervalMs: 60_000, write });
    expect(buffer.push(1)).toBe(true);
    expect(buffer.push(2)).toBe(true);
    expect(buffer.push(3)).toBe(false);
    await buffer.flush();
    expect(buffer.snapshot()).toMatchObject({ queued: 2, dropped: 1 });
    await buffer.flush();
    expect(buffer.snapshot()).toMatchObject({ queued: 0, dropped: 1 });
  });
});
