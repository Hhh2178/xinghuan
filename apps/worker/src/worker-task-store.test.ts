import { describe, expect, it, vi } from "vitest";

import { createWorkerTaskStore } from "./worker-task-store.js";

describe("worker task store", () => {
  it("atomically lets only one worker claim a duplicated queued task", async () => {
    let queued = true;
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("set status = 'running'") && sql.includes("and status = 'queued'")) {
          if (!queued) return { rowCount: 0, rows: [] };
          queued = false;
          return { rowCount: 1, rows: [{ id: "task-1" }] };
        }
        if (sql.includes("select status from xh_tasks")) return { rows: [{ status: queued ? "queued" : "running" }] };
        throw new Error(`unexpected query: ${sql}`);
      }),
    } as any;
    const store = createWorkerTaskStore(pool);

    const results = await Promise.all([
      store.claimQueuedTask("task-1", "worker-a claimed"),
      store.claimQueuedTask("task-1", "worker-b claimed"),
    ]);

    expect(results).toEqual(["claimed", "already_claimed"]);
    expect(pool.query).toHaveBeenCalledTimes(3);
  });

  it("transitions a stale task only while it is still running and unchanged", async () => {
    const pool = {
      query: vi.fn(async (sql: string, params: unknown[]) => {
        expect(sql).toContain("status = 'running'");
        expect(sql).toContain("updated_at <= $5");
        expect(params[1]).toBe("queued");
        return { rowCount: 1, rows: [{ id: "task-1" }] };
      }),
    } as any;
    const store = createWorkerTaskStore(pool);

    await expect(store.transitionStaleRunningTask(
      "task-1",
      "queued",
      "recover existing upstream task",
      { outputRecoveryMode: "provider_poll_resume" },
      new Date("2026-07-28T00:00:00.000Z"),
    )).resolves.toBe(true);
  });
});
