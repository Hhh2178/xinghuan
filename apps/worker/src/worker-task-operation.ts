import type { TaskRow } from "./worker-task-store.js";
import { dispatchWorkerOperation } from "./worker-operation-dispatch.js";

export type WorkerTaskOperation = "provider_execution" | "output_recovery";
export type WorkerTaskExecutionResult = Record<string, unknown>;

export interface WorkerTaskOperationInput {
  task: Pick<TaskRow, "payload" | "result">;
  executeProvider: () => Promise<WorkerTaskExecutionResult>;
  executeOutputRecovery: () => Promise<WorkerTaskExecutionResult>;
}

export function resolveWorkerTaskOperation(task: Pick<TaskRow, "payload" | "result">): WorkerTaskOperation {
  return task.payload.outputRecoveryMode === "output_only" || task.result.outputRecoveryMode === "output_only"
    ? "output_recovery"
    : "provider_execution";
}

export async function executeWorkerTaskOperation(input: WorkerTaskOperationInput): Promise<WorkerTaskExecutionResult> {
  return dispatchWorkerOperation({
    operation: resolveWorkerTaskOperation(input.task),
    handlers: {
      providerExecution: () => input.executeProvider(),
      outputRecovery: () => input.executeOutputRecovery(),
    },
  });
}
