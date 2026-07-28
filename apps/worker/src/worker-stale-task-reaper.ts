import type { TaskStatus } from "@xinghuan/shared";
import type { Pool } from "pg";

import { resolveStaleTaskRecovery } from "./worker-stale-task-recovery.js";
import type { TaskRow } from "./worker-task-store.js";

export async function reapStaleRunningTasks(options: {
  pool: Pick<Pool, "query">;
  workerId: string;
  staleRunningTaskMs: number;
  readTask: (taskId: string) => Promise<TaskRow | null>;
  transitionStaleRunningTask: (
    taskId: string,
    status: TaskStatus,
    logLine: string,
    resultPatch: Record<string, unknown>,
    staleUpdatedAt: Date,
  ) => Promise<boolean>;
  requeueTask: (taskId: string, capability: string) => Promise<unknown>;
  logWorkerEvent: (event: string, payload: Record<string, unknown>) => void;
  taskTraceContext: (task: TaskRow) => Record<string, unknown>;
}) {
  if (options.staleRunningTaskMs <= 0) return;
  const result = await options.pool.query(
    `select id, updated_at
     from xh_tasks
     where status = 'running'
       and updated_at < now() - ($1::bigint * interval '1 millisecond')
     order by updated_at asc
     limit 50`,
    [options.staleRunningTaskMs],
  );
  for (const row of result.rows) {
    const taskId = String(row.id || "").trim();
    if (!taskId) continue;
    const staleUpdatedAt = row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at);
    const staleSince = row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at || "");
    const task = await options.readTask(taskId);
    const recovery = task ? resolveStaleTaskRecovery(task) : { action: "fail" as const, patch: {} };
    const requeueProviderPoll = recovery.action === "requeue_provider_poll";
    const transitioned = await options.transitionStaleRunningTask(
      taskId,
      requeueProviderPoll ? "queued" : "failed",
      requeueProviderPoll
        ? `${options.workerId} reaper 检测到视频任务长时间无 heartbeat，沿用原上游任务号恢复轮询`
        : `${options.workerId} reaper 检测到运行任务长时间无 heartbeat，按悬挂任务回收`,
      {
        ...recovery.patch,
        workerId: options.workerId,
        ...(requeueProviderPoll
          ? { requeuedAt: new Date().toISOString() }
          : { failedAt: new Date().toISOString(), reapedAt: new Date().toISOString() }),
        staleSince,
      },
      staleUpdatedAt,
    );
    if (!transitioned) continue;
    if (requeueProviderPoll && task) await options.requeueTask(taskId, task.capability);
    options.logWorkerEvent("task.reaped", {
      ...(task ? options.taskTraceContext(task) : {}),
      taskId,
      staleSince,
      staleRunningTaskMs: options.staleRunningTaskMs,
      recoveryAction: recovery.action,
    });
    console.warn("xinghuan-worker reaped stale task", JSON.stringify({
      workerId: options.workerId,
      taskId,
      staleSince,
      staleRunningTaskMs: options.staleRunningTaskMs,
      recoveryAction: recovery.action,
    }));
  }
}
