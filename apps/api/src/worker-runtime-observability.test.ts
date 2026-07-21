import { describe, expect, it } from "vitest";

import { readEnvironmentWorkerRuntimeSlots, summarizeWorkerRuntimeQueue } from "./worker-runtime-observability.js";

describe("worker runtime observability", () => {
  it("reads only the requested environment and summarizes an exact queue", async () => {
    const patterns: string[] = [];
    const values = new Map([
      ["xinghuan:worker-runtime:gray:worker-a", JSON.stringify([
        { workerId: "worker-a", capability: "video", queue: "xinghuan:tasks:gray:video", slotIndex: 0, state: "active", updatedAt: 100 },
        { workerId: "worker-a", capability: "video", queue: "xinghuan:tasks:production:video", slotIndex: 1, state: "active", updatedAt: 100 },
      ])],
    ]);
    const slots = await readEnvironmentWorkerRuntimeSlots({
      async *scanIterator(options) {
        patterns.push(options.MATCH);
        yield ["xinghuan:worker-runtime:gray:worker-a"];
      },
      async get(key) {
        return values.get(key) ?? null;
      },
    }, "gray");

    expect(patterns).toEqual(["xinghuan:worker-runtime:gray:*"]);
    expect(summarizeWorkerRuntimeQueue(slots, "xinghuan:tasks:gray:video")).toEqual({
      effectiveConcurrency: 1,
      slotCount: 1,
      workerCount: 1,
    });
  });
});
