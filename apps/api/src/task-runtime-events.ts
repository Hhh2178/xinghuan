import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import type { Pool } from "pg";

interface CreateTaskRuntimeEventStoreOptions {
  usePostgresRepository: () => boolean;
  getPostgresPool: () => Promise<Pool>;
  filePath: string;
}

interface TaskRuntimeEventInput {
  taskId: string;
  eventType: string;
  payload?: Record<string, unknown>;
}

export function createTaskRuntimeEventStore(options: CreateTaskRuntimeEventStoreOptions) {
  async function appendTaskRuntimeEvent(input: TaskRuntimeEventInput) {
    if (!input.taskId || !input.eventType) return;
    if (options.usePostgresRepository()) {
      const pool = await options.getPostgresPool();
      await pool.query(
        `insert into xh_task_runtime_events (id, task_id, event_type, payload)
         values ($1, $2, $3, $4::jsonb)`,
        [
          `tre-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          input.taskId,
          input.eventType,
          JSON.stringify(input.payload || {}),
        ],
      );
      return;
    }
    await mkdir(dirname(options.filePath), { recursive: true });
    await appendFile(
      options.filePath,
      `${JSON.stringify({
        id: `tre-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        taskId: input.taskId,
        eventType: input.eventType,
        payload: input.payload || {},
        createdAt: new Date().toISOString(),
      })}\n`,
      "utf8",
    );
  }

  async function appendTaskRuntimeEventBestEffort(input: TaskRuntimeEventInput) {
    try {
      await appendTaskRuntimeEvent(input);
    } catch (error) {
      console.warn("task-runtime-event-write-failed", JSON.stringify({
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
