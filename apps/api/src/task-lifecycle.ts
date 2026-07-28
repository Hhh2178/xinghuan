import { canCancelTask, canRetryTask, type TaskStatus } from "@xinghuan/shared";

export interface TaskLifecycleRecord {
  id: string;
  title: string;
  status: TaskStatus;
  ownerId?: string;
  providerId?: string;
  modelId?: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  logs: string[];
  createdAt: number;
  updatedAt: number;
  finalizedAt?: number;
}

const TERMINAL_TASK_STATUSES = new Set(["succeeded", "failed", "cancelled"]);

export function isTerminalTaskStatus(status: string) {
  return TERMINAL_TASK_STATUSES.has(status);
}

export function applyTaskFinalization<T extends { status: string; finalizedAt?: number }>(task: T, now = Date.now()): T {
  if (!isTerminalTaskStatus(task.status) || Number(task.finalizedAt) > 0) return task;
  return { ...task, finalizedAt: now };
}

export interface TaskRetryOptions {
  id: string;
  ownerId: string;
  now?: number;
}

export function taskCancellationPatch(actorEmail: string, now = Date.now()) {
  return {
    status: "cancelled" as const,
    result: {
      cancelledAt: new Date(now).toISOString(),
      cancelledBy: actorEmail,
    },
    logs: [`管理员取消任务 (${actorEmail})`],
    updatedAt: now,
  };
}

export function applyTaskCancellation<T extends TaskLifecycleRecord>(task: T, actorEmail: string, now = Date.now()): T {
  assertTaskCancellable(task.status);
  const patch = taskCancellationPatch(actorEmail, now);
  return {
    ...task,
    status: patch.status,
    result: {
      ...plainObject(task.result),
      ...patch.result,
    },
    logs: [...safeLogLines(task.logs), ...patch.logs],
    updatedAt: patch.updatedAt,
  };
}

export function createRetriedTask<T extends TaskLifecycleRecord>(task: T, options: TaskRetryOptions): T {
  assertTaskRetryable(task.status);
  const now = options.now ?? Date.now();
  const { finalizedAt: _finalizedAt, ...retrySource } = task;
  const { outputRecoveryMode: _outputRecoveryMode, ...providerPayload } = plainObject(task.payload);
  return {
    ...retrySource,
    id: options.id,
    status: "queued",
    ownerId: task.ownerId || options.ownerId,
    payload: providerPayload,
    result: {
      retryOfTaskId: task.id,
      retryCreatedAt: new Date(now).toISOString(),
    },
    logs: [`由任务 ${task.id} 重试创建`],
    createdAt: now,
    updatedAt: now,
  } as unknown as T;
}

export function assertTaskCancellable(status: TaskStatus) {
  if (!canCancelTask(status)) {
    throw new Error(`任务当前状态为 ${status}，不可取消`);
  }
}

export function assertTaskRetryable(status: TaskStatus) {
  if (!canRetryTask(status)) {
    throw new Error(`任务当前状态为 ${status}，不可重试`);
  }
}

function plainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function safeLogLines(value: unknown) {
  return Array.isArray(value) ? value.map((line) => String(line ?? "").trim()).filter(Boolean) : [];
}
