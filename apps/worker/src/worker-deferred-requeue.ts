import { taskQueueNameForCapability, type TaskQueueCapability, type TaskStatus } from "@xinghuan/shared";
import type { RedisClientType } from "redis";

import type { TaskRow } from "./worker-task-store.js";

type WorkerTaskUpdateOutcome = "updated" | "cancelled" | "missing";

export type DeferredWaitReason = "waiting_user_window" | "waiting_runninghub_window";

interface CreateWorkerDeferredRequeueOptions {
  workerId: string;
  queueName: string;
  redis: RedisClientType;
  taskDeferredRetryMs: number;
  wait: (ms: number) => Promise<void>;
  appendTaskLog: (taskId: string, line: string) => Promise<void>;
  touchQueuedTaskRuntime: (taskId: string, resultPatch: Record<string, unknown>) => Promise<void>;
  updateTask: (
    taskId: string,
    status: TaskStatus,
    newLogs: string[],
    resultPatch?: Record<string, unknown>,
  ) => Promise<WorkerTaskUpdateOutcome>;
}

export function createWorkerDeferredRequeue(options: CreateWorkerDeferredRequeueOptions) {
  async function deferTaskExecution(
    task: TaskRow,
    waitReason: DeferredWaitReason,
    detail: string,
  ) {
    await options.touchQueuedTaskRuntime(task.id, {
      waitReason,
      waitDetail: detail,
      waitUpdatedAt: new Date().toISOString(),
      runtimeStage: "queued",
    });
    await options.appendTaskLog(task.id, `${options.workerId} 等待执行窗口: ${detail}`);
    await options.wait(Math.max(200, options.taskDeferredRetryMs));
    await requeueDeferredTask(task.id, task.capability);
  }

  async function requeueDeferredTaskAfterRelease(taskId: string, capability: string) {
    await options.wait(Math.max(500, options.taskDeferredRetryMs));
    await requeueDeferredTask(taskId, capability);
  }

  async function requeueRunningTask(task: TaskRow, detail: string, resultPatch: Record<string, unknown> = {}) {
    return options.updateTask(task.id, "queued", [`${options.workerId} RunningHub 上游并发已满，任务回退到队列等待重试: ${detail}`], {
      ...resultPatch,
      workerId: options.workerId,
      status: "queued",
      runtimeStage: "queued",
      waitReason: "waiting_runninghub_window",
      waitDetail: detail,
      waitUpdatedAt: new Date().toISOString(),
      requeuedAt: new Date().toISOString(),
    });
  }

  async function requeueDeferredTask(taskId: string, capability: string) {
    const queueCapability = capabilityToQueueCapability(capability);
    if (!queueCapability) return;
    const queue = taskQueueNameForCapability(options.queueName, queueCapability);
    await options.redis.lPush(queue, taskId);
  }

  return {
    deferTaskExecution,
    requeueDeferredTaskAfterRelease,
    requeueRunningTask,
  };
}

export function shouldRequeueAfterRelease(outcome: WorkerTaskUpdateOutcome) {
  return outcome === "updated";
}

export function capabilityToQueueCapability(capability: string): TaskQueueCapability | null {
  if (capability === "image" || capability === "audio" || capability === "video") return capability;
  if (capability === "chat") return "video";
  return null;
}
