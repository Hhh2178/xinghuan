import type { TaskDisplayTone, TaskRuntimeStage, TaskStatus } from "@xinghuan/shared";

interface TaskRuntimeProjectionInput {
  status: TaskStatus;
  waitReason?: string;
  waitDetail?: string;
  queueHint?: string;
  runtimeStage?: string;
  providerState?: string;
  failureReason?: string;
  error?: string;
  cancellationMessage?: string;
  logs?: string[];
}

export interface TaskRuntimeProjectionResult {
  displayStatus: string;
  displayMessage: string;
  displayTone: TaskDisplayTone;
  runtimeStage?: TaskRuntimeStage;
  providerState?: string;
}

const runtimeStageSet = new Set<TaskRuntimeStage>([
  "queued",
  "submitted",
  "running",
  "polling",
  "materializing",
  "succeeded",
  "failed",
  "cancelled",
]);

function normalizeRuntimeStage(value: unknown): TaskRuntimeStage | undefined {
  const text = String(value || "").trim().toLowerCase();
  return runtimeStageSet.has(text as TaskRuntimeStage)
    ? (text as TaskRuntimeStage)
    : undefined;
}

function latestLog(logs: string[] | undefined) {
  return Array.isArray(logs) ? logs.filter(Boolean).slice(-1)[0] || "" : "";
}

export function projectTaskRuntimeDisplayState(input: TaskRuntimeProjectionInput): TaskRuntimeProjectionResult {
  const runtimeStage = normalizeRuntimeStage(input.runtimeStage);
  const providerStateText = String(input.providerState || "").trim();
  const providerState = providerStateText || undefined;
  const waitReason = String(input.waitReason || "").trim();
  const waitDetail = String(input.waitDetail || "").trim();
  const queueHint = String(input.queueHint || "").trim();
  const failureReason = String(input.failureReason || input.error || "").trim();
  const cancellationMessage = String(input.cancellationMessage || "").trim();
  const logTail = latestLog(input.logs);

  if (input.status === "succeeded") {
    return {
      displayStatus: "成功",
      displayMessage: "任务已完成，结果已回填。",
      displayTone: "success",
      runtimeStage: runtimeStage || "succeeded",
      providerState,
    };
  }

  if (input.status === "failed") {
    return {
      displayStatus: "失败",
      displayMessage: failureReason || logTail || "任务执行失败。",
      displayTone: "danger",
      runtimeStage: runtimeStage || "failed",
      providerState,
    };
  }

  if (input.status === "cancelled") {
    return {
      displayStatus: "已取消",
      displayMessage: cancellationMessage || logTail || "任务已取消。",
      displayTone: "danger",
      runtimeStage: runtimeStage || "cancelled",
      providerState,
    };
  }

  if (input.status === "running") {
    if (providerStateText.toUpperCase() === "QUEUED" || waitReason === "waiting_runninghub_window") {
      return {
        displayStatus: "排队中",
        displayMessage: waitDetail || queueHint || "任务正在等待可用执行窗口。",
        displayTone: "warning",
        runtimeStage: runtimeStage || "polling",
        providerState,
      };
    }
    return {
      displayStatus: "运行中",
      displayMessage: queueHint || "任务已提交，正在生成。",
      displayTone: "warning",
      runtimeStage: runtimeStage || "running",
      providerState,
    };
  }

  if (waitReason === "waiting_runninghub_window") {
    return {
      displayStatus: "排队中",
      displayMessage: waitDetail || "正在等待 RunningHub 可用窗口。",
      displayTone: "muted",
      runtimeStage: runtimeStage || "queued",
      providerState,
    };
  }

  return {
    displayStatus: "排队",
    displayMessage: waitDetail || queueHint || logTail || "任务已入队，等待处理。",
    displayTone: "muted",
    runtimeStage: runtimeStage || "queued",
    providerState,
  };
}
