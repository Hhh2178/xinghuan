import type { Pool } from "pg";

interface CreateWorkerRuntimeEventWriterOptions {
  pool: Pool;
}

interface WorkerRuntimeEventInput {
  taskId: string;
  eventType: string;
  payload?: Record<string, unknown>;
}

export function createWorkerRuntimeEventWriter(options: CreateWorkerRuntimeEventWriterOptions) {
  async function appendTaskRuntimeEvent(input: WorkerRuntimeEventInput) {
    if (!input.taskId || !input.eventType) return;
    await options.pool.query(
      `insert into xh_task_runtime_events (id, task_id, event_type, payload)
       values ($1, $2, $3, $4::jsonb)`,
      [
        `tre-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        input.taskId,
        input.eventType,
        JSON.stringify(input.payload || {}),
      ],
    );
  }

  async function appendTaskRuntimeEventBestEffort(input: WorkerRuntimeEventInput) {
    try {
      await appendTaskRuntimeEvent(input);
    } catch (error) {
      console.warn("worker-runtime-event-write-failed", JSON.stringify({
        taskId: input.taskId,
        eventType: input.eventType,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  return {
    appendTaskRuntimeEvent,
    appendTaskRuntimeEventBestEffort,
  };
}
