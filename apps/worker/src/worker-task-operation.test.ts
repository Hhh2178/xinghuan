import { describe, expect, it, vi } from "vitest";

import {
  executeWorkerTaskOperation,
  resolveWorkerTaskOperation,
  type WorkerTaskExecutionResult,
} from "./worker-task-operation.js";
import type { TaskRow } from "./worker-task-store.js";

function task(input: { payload?: Record<string, unknown>; result?: Record<string, unknown> } = {}) {
  return {
    payload: input.payload || {},
    result: input.result || {},
  } as TaskRow;
}

describe("worker task operation", () => {
  it.each([
    [task({ payload: { outputRecoveryMode: "output_only" } }), "output_recovery"],
    [task({ result: { outputRecoveryMode: "output_only" } }), "output_recovery"],
    [task({ payload: { outputRecoveryMode: "provider_execution" }, result: { outputRecoveryMode: "output_only" } }), "output_recovery"],
    [task({ payload: { taskCapability: "video" }, result: {} }), "provider_execution"],
  ] as const)("resolves a persisted task to %s", (input, expected) => {
    expect(resolveWorkerTaskOperation(input)).toBe(expected);
  });

  it("never invokes Provider execution for recovery", async () => {
    const provider = vi.fn(async () => ({ status: "succeeded" } as WorkerTaskExecutionResult));
    const recovery = vi.fn(async () => ({ status: "succeeded" } as WorkerTaskExecutionResult));

    await executeWorkerTaskOperation({
      task: task({ result: { outputRecoveryMode: "output_only" } }),
      executeProvider: provider,
      executeOutputRecovery: recovery,
    });

    expect(provider).not.toHaveBeenCalled();
    expect(recovery).toHaveBeenCalledOnce();
  });
});
