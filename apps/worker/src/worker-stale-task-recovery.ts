import type { TaskRow } from "./worker-task-store.js";

const MAX_PROVIDER_POLL_RECOVERY_ATTEMPTS = 3;

export type StaleTaskRecovery =
  | { action: "requeue_provider_poll"; patch: Record<string, unknown> }
  | { action: "fail"; patch: Record<string, unknown> };

export function resolveStaleTaskRecovery(task: TaskRow): StaleTaskRecovery {
  const upstreamTaskId = safeText(task.result.upstreamTaskId || task.result.taskId);
  const recoveryAttempts = Math.max(0, Math.floor(Number(task.result.providerPollRecoveryAttempts) || 0));
  if (task.capability === "video" && upstreamTaskId && recoveryAttempts < MAX_PROVIDER_POLL_RECOVERY_ATTEMPTS) {
    return {
      action: "requeue_provider_poll",
      patch: {
        upstreamTaskId,
        taskId: upstreamTaskId,
        outputRecoveryMode: "provider_poll_resume",
        outputRecoveryAvailable: true,
        providerPollRecoveryAttempts: recoveryAttempts + 1,
        recoveryReason: "worker_stalled_with_upstream_task",
        runtimeStage: "queued",
        materializationStatus: "queued",
        recoveryQueuedAt: new Date().toISOString(),
      },
    };
  }
  return {
    action: "fail",
    patch: {
      failureReason: "worker_stalled_or_upstream_timeout",
      reaperReason: "worker_stalled_or_upstream_timeout",
    },
  };
}

function safeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
