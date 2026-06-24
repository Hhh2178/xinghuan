import type { TaskStatus } from "@xinghuan/shared";

import {
  normalizeUnifiedFailure,
  readWorkerTaskResultPatch,
  type WorkerFailurePatch,
} from "./worker-runtime-diagnostics.js";

interface TaskLifecycleTaskLike {
  id: string;
  capability: string;
}

interface TaskLifecycleTrace {
  taskId: string;
  capability: string;
  trace: Record<string, unknown>;
}

interface CreateWorkerTaskLifecycleOptions {
  workerId: string;
  appendTaskLog: (taskId: string, line: string) => Promise<void>;
  updateTask: (
    taskId: string,
    status: TaskStatus,
    newLogs: string[],
    resultPatch?: Record<string, unknown>,
    options?: { replaceResult: boolean },
  ) => Promise<"updated" | "cancelled" | "missing">;
  logWorkerEvent: (event: string, payload: Record<string, unknown>) => void;
  appendTaskRuntimeEventBestEffort: (input: {
    taskId: string;
    eventType: string;
    payload?: Record<string, unknown>;
  }) => Promise<void>;
}

export function createWorkerTaskLifecycle(options: CreateWorkerTaskLifecycleOptions) {
  async function dropCancelledAttempt(input: TaskLifecycleTrace & {
    line: string;
    message: string;
  }) {
    await options.appendTaskLog(input.taskId, `${options.workerId} ${input.line}`);
    options.logWorkerEvent("task.cancelled_detected", {
      ...input.trace,
      taskId: input.taskId,
      capability: input.capability,
      message: input.message,
    });
  }

  async function keepCancelledState(input: TaskLifecycleTrace & {
    line: string;
    message: string;
  }) {
    await options.appendTaskLog(input.taskId, `${options.workerId} ${input.line}`);
    options.logWorkerEvent("task.cancelled_detected", {
      ...input.trace,
      taskId: input.taskId,
      capability: input.capability,
      message: input.message,
    });
  }

  async function failTask(input: {
    task: TaskLifecycleTaskLike;
    trace: Record<string, unknown>;
    error: unknown;
    baseResultPatch?: Record<string, unknown>;
    replaceResult?: boolean;
  }) {
    const normalized = normalizeUnifiedFailure(input.error);
    const failedResult = await options.updateTask(
      input.task.id,
      "failed",
      [`${options.workerId} 执行失败: ${input.error instanceof Error ? input.error.message : String(input.error)}`],
      {
        ...readWorkerTaskResultPatch(input.error),
        ...(input.baseResultPatch || {}),
        workerId: options.workerId,
        failedAt: new Date().toISOString(),
        failureReason: normalized.failureReason,
        failureCategory: normalized.failureCategory,
        providerDiagnostic: normalized.providerDiagnostic,
        upstreamHttpStatus: normalized.upstreamHttpStatus,
        upstreamResponseSnippet: normalized.upstreamResponseSnippet,
        runtimeStage: "failed",
        providerState: "FAILED",
      },
      { replaceResult: input.replaceResult === true },
    );
    if (failedResult === "cancelled") {
      await keepCancelledState({
        taskId: input.task.id,
        capability: input.task.capability,
        trace: input.trace,
        line: "检测到任务已取消，保留取消状态",
        message: "failure kept cancelled state",
      });
      return "cancelled" as const;
    }
    options.logWorkerEvent("task.failed", {
      ...input.trace,
      taskId: input.task.id,
      capability: input.task.capability,
      status: "failed",
      error: input.error instanceof Error ? input.error.message : String(input.error),
    });
    await options.appendTaskRuntimeEventBestEffort({
      taskId: input.task.id,
      eventType: "task_failed",
      payload: {
        capability: input.task.capability,
        failureReason: normalized.failureReason,
        failureCategory: normalized.failureCategory,
      },
    });
    return failedResult;
  }

  return {
    dropCancelledAttempt,
    keepCancelledState,
    failTask,
  };
}

export function createWorkerTaskError(message: string, resultPatch: Record<string, unknown> = {}) {
  const error = new Error(message) as Error & { resultPatch?: Record<string, unknown> };
  error.name = "WorkerTaskError";
  error.resultPatch = resultPatch;
  return error;
}

export function buildUpstreamBusinessFailurePatch(detail: unknown, snippet?: unknown): Record<string, unknown> & WorkerFailurePatch {
  const diagnostic = safeText(detail, "unknown");
  const responseSnippet = safeText(snippet, diagnostic).slice(0, 500);
  return {
    failureCategory: "upstream_business_failed",
    providerDiagnostic: diagnostic,
    upstreamResponseSnippet: responseSnippet,
  };
}

function safeText(value: unknown, fallback = "") {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}
