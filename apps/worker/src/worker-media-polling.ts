import {
  extractApimartFinalTaskId,
  extractApimartTask,
  extractApimartVideoResult,
} from "./worker-apimart-video-adapter.js";
import { extractAicopyVideoResult } from "@xinghuan/model-core";
import {
  extractImageOutputs,
  openAiEndpoint,
  providerHeaders,
} from "./worker-provider-utils.js";
import {
  buildUpstreamBusinessFailurePatch,
  createWorkerTaskError,
} from "./worker-task-lifecycle.js";

type RuntimeHeartbeatPatch = Record<string, unknown>;

function plainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function safeText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function wait(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function pollApimartVideoTask(options: {
  baseUrl: string;
  apiKey: string;
  taskId: string;
  statusPath: string;
  resultVideoPath: string;
  pollPathTemplate: string;
  finalResultTaskIdPath: string;
  finalResultPathTemplate: string;
  finalResultVideoPath: string;
  pollIntervalMs: number;
  timeoutMs?: number;
  onHeartbeat?: (patch: RuntimeHeartbeatPatch) => Promise<void>;
}) {
  const startedAt = Date.now();
  for (;;) {
    if (typeof options.timeoutMs === "number" && options.timeoutMs > 0 && Date.now() - startedAt > options.timeoutMs) {
      throw new Error("视频生成轮询超时");
    }
    if (options.pollIntervalMs > 0) await wait(options.pollIntervalMs);
    const pollPath = safeText(options.pollPathTemplate, "tasks/{task_id}").replace("{task_id}", encodeURIComponent(options.taskId));
    const response = await fetch(openAiEndpoint(options.baseUrl, pollPath), {
      method: "GET",
      headers: providerHeaders(options.apiKey),
      signal: AbortSignal.timeout(120000),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`视频任务轮询失败 ${response.status}: ${text.slice(0, 500)}`);
    const raw = text ? JSON.parse(text) : {};
    const result = extractApimartVideoResult(raw, {
      statusPath: options.statusPath,
      resultVideoPath: options.resultVideoPath,
    });
    const status = safeText(result.status).toLowerCase();
    await options.onHeartbeat?.({
      heartbeatAt: new Date().toISOString(),
      upstreamTaskId: options.taskId,
      taskId: options.taskId,
      upstreamStatus: status || "pending",
      runtimeStage: "polling",
    });
    if (result.videoUrls.length > 0 && (!status || isCompletedAsyncStatus(status))) return result;
    if (options.finalResultPathTemplate) {
      const finalTaskId = extractApimartFinalTaskId(raw, { taskIdPath: options.finalResultTaskIdPath });
      if (finalTaskId) {
        const finalResult = await fetchFinalApimartVideoResult({
          baseUrl: options.baseUrl,
          apiKey: options.apiKey,
          taskId: finalTaskId,
          statusPath: options.statusPath,
          resultVideoPath: options.finalResultVideoPath || options.resultVideoPath,
          finalResultPathTemplate: options.finalResultPathTemplate,
        });
        const finalStatus = safeText(finalResult.status).toLowerCase();
        if (finalResult.videoUrls.length > 0 && (!finalStatus || isCompletedAsyncStatus(finalStatus))) return finalResult;
        if (isFailedAsyncStatus(finalStatus)) {
          const failureDetail = safeText(finalResult.failureReason, finalStatus || "unknown");
          throw createWorkerTaskError(`视频任务失败: ${failureDetail}`, buildUpstreamBusinessFailurePatch(failureDetail));
        }
      }
    }
    if (isFailedAsyncStatus(status)) {
      const failureDetail = safeText(result.failureReason, status || "unknown");
      throw createWorkerTaskError(`视频任务失败: ${failureDetail}`, buildUpstreamBusinessFailurePatch(failureDetail));
    }
  }
}

export async function pollAicopyVideoTask(options: {
  baseUrl: string;
  apiKey: string;
  taskId: string;
  statusPath: string;
  resultVideoPath: string;
  resultPaths?: string[];
  pollPathTemplate: string;
  contentPathTemplate?: string;
  pollIntervalMs: number;
  timeoutMs?: number;
  onHeartbeat?: (patch: RuntimeHeartbeatPatch) => Promise<void>;
}) {
  const startedAt = Date.now();
  for (;;) {
    if (typeof options.timeoutMs === "number" && options.timeoutMs > 0 && Date.now() - startedAt > options.timeoutMs) {
      throw new Error("视频生成轮询超时");
    }
    if (options.pollIntervalMs > 0) await wait(options.pollIntervalMs);
    const pollPath = safeText(options.pollPathTemplate, "videos/{task_id}").replace("{task_id}", encodeURIComponent(options.taskId));
    const response = await fetch(openAiEndpoint(options.baseUrl, pollPath), {
      method: "GET",
      headers: providerHeaders(options.apiKey),
      signal: AbortSignal.timeout(120000),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`视频任务轮询失败 ${response.status}: ${text.slice(0, 500)}`);
    const raw = text ? JSON.parse(text) : {};
    const result = extractAicopyVideoResult(raw, {
      statusPath: options.statusPath,
      resultVideoPath: options.resultVideoPath,
      resultPaths: options.resultPaths,
    });
    const status = safeText(result.status).toLowerCase();
    await options.onHeartbeat?.({
      heartbeatAt: new Date().toISOString(),
      upstreamTaskId: options.taskId,
      taskId: options.taskId,
      upstreamStatus: status || "pending",
      runtimeStage: "polling",
    });
    if (result.videoUrls.length > 0 && (!status || isCompletedAsyncStatus(status))) return result;
    if (isCompletedAsyncStatus(status)) {
      const contentPath = safeText(options.contentPathTemplate, "videos/{task_id}/content")
        .replace("{task_id}", encodeURIComponent(options.taskId));
      return {
        ...result,
        videoUrls: [openAiEndpoint(options.baseUrl, contentPath)],
        usedContentFallback: true,
      };
    }
    if (isFailedAsyncStatus(status)) {
      const failureDetail = safeText(result.failureReason, status || "unknown");
      throw createWorkerTaskError(`视频任务失败: ${failureDetail}`, buildUpstreamBusinessFailurePatch(failureDetail));
    }
  }
}

export async function fetchFinalApimartVideoResult(options: {
  baseUrl: string;
  apiKey: string;
  taskId: string;
  statusPath: string;
  resultVideoPath: string;
  finalResultPathTemplate: string;
}) {
  const finalPath = safeText(options.finalResultPathTemplate).replace("{task_id}", encodeURIComponent(options.taskId));
  const response = await fetch(openAiEndpoint(options.baseUrl, finalPath), {
    method: "GET",
    headers: providerHeaders(options.apiKey),
    signal: AbortSignal.timeout(120000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`最终视频结果查询失败 ${response.status}: ${text.slice(0, 500)}`);
  const raw = text ? JSON.parse(text) : {};
  return extractApimartVideoResult(raw, {
    statusPath: options.statusPath,
    resultVideoPath: options.resultVideoPath,
  });
}

export async function pollApimartImageTask(options: {
  baseUrl: string;
  apiKey: string;
  taskId: string;
  statusPath: string;
  pollIntervalMs: number;
  timeoutMs?: number;
  onHeartbeat?: (patch: RuntimeHeartbeatPatch) => Promise<void>;
}) {
  const startedAt = Date.now();
  let deadline = typeof options.timeoutMs === "number" && options.timeoutMs > 0 ? startedAt + options.timeoutMs : Number.POSITIVE_INFINITY;
  const pollPathTemplate = "tasks/{task_id}";
  for (;;) {
    if (Date.now() > deadline) throw new Error("APIMart 图像生成轮询超时");
    if (options.pollIntervalMs > 0) await wait(options.pollIntervalMs);
    const statusPath = pollPathTemplate.replace("{task_id}", encodeURIComponent(options.taskId));
    const response = await fetch(openAiEndpoint(options.baseUrl, statusPath), {
      method: "GET",
      headers: providerHeaders(options.apiKey),
      signal: AbortSignal.timeout(120000),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`APIMart 图像轮询失败 ${response.status}: ${text.slice(0, 500)}`);
    const raw = text ? JSON.parse(text) : {};
    const data = raw && typeof raw === "object" && !Array.isArray(raw)
      ? plainObject((raw as Record<string, unknown>).data)
      : {};
    const estimatedTimeSec = Number(data.estimated_time);
    if (Number.isFinite(estimatedTimeSec) && estimatedTimeSec > 0) {
      const adaptiveDeadline = startedAt + Math.min((estimatedTimeSec + 90) * 1000, 600000);
      deadline = Math.max(deadline, adaptiveDeadline);
    }
    const extracted = extractImageOutputs(raw);
    const taskState = extractApimartTask(raw, { statusPath: options.statusPath || "data.status" });
    const status = safeText(taskState.status).toLowerCase();
    await options.onHeartbeat?.({
      heartbeatAt: new Date().toISOString(),
      upstreamTaskId: options.taskId,
      taskId: options.taskId,
      upstreamStatus: status || "pending",
      runtimeStage: "polling",
    });
    if (extracted.imageUrls.length > 0) return extracted;
    if (["failed", "error", "cancelled", "canceled"].includes(status)) {
      throw createWorkerTaskError(
        `APIMart 图像任务失败: ${status || "unknown"}`,
        buildUpstreamBusinessFailurePatch(status || "unknown", text),
      );
    }
  }
}

export async function pollModelScopeImageTask(options: {
  baseUrl: string;
  apiKey: string;
  taskId: string;
  statusPath: string;
  pollPathTemplate: string;
  pollIntervalMs: number;
  timeoutMs?: number;
  onHeartbeat?: (patch: RuntimeHeartbeatPatch) => Promise<void>;
}) {
  const startedAt = Date.now();
  const pollPathTemplate = safeText(options.pollPathTemplate, "tasks/{task_id}");
  for (;;) {
    if (typeof options.timeoutMs === "number" && options.timeoutMs > 0 && Date.now() - startedAt > options.timeoutMs) {
      throw new Error("ModelScope 图像生成轮询超时");
    }
    if (options.pollIntervalMs > 0) await wait(options.pollIntervalMs);
    const statusPath = pollPathTemplate.replace("{task_id}", encodeURIComponent(options.taskId));
    const response = await fetch(openAiEndpoint(options.baseUrl, statusPath), {
      method: "GET",
      headers: modelScopeHeaders(options.apiKey, "poll"),
      signal: AbortSignal.timeout(120000),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`ModelScope 图像轮询失败 ${response.status}: ${text.slice(0, 500)}`);
    const raw = text ? JSON.parse(text) : {};
    const extracted = extractImageOutputs(raw);
    const taskState = extractModelScopeImageTask(raw, { taskStatusPath: options.statusPath });
    const status = safeText(taskState.status).toLowerCase();
    await options.onHeartbeat?.({
      heartbeatAt: new Date().toISOString(),
      upstreamTaskId: options.taskId,
      taskId: options.taskId,
      upstreamStatus: status || "pending",
      runtimeStage: "polling",
    });
    if (extracted.imageUrls.length > 0 && (!status || isCompletedAsyncStatus(status))) return extracted;
    if (isFailedAsyncStatus(status)) {
      throw createWorkerTaskError(
        `ModelScope 图像任务失败: ${status || "unknown"}`,
        buildUpstreamBusinessFailurePatch(status || "unknown", text),
      );
    }
  }
}

export function extractModelScopeImageTask(raw: unknown, advancedConfig: Record<string, unknown>) {
  const root = plainObject(raw);
  const data = plainObject(root.data);
  const taskIdPath = safeText(advancedConfig.taskIdPath, "task_id");
  const statusPath = safeText(advancedConfig.taskStatusPath, "task_status");
  return {
    taskId:
      readPathText(root, taskIdPath)
      || safeText(root.task_id)
      || safeText(data.task_id)
      || safeText(root.id),
    status:
      readPathText(root, statusPath)
      || safeText(root.task_status)
      || safeText(data.task_status)
      || safeText(root.status),
  };
}

export function modelScopeHeaders(apiKey: string, mode: "submit" | "poll") {
  return {
    ...providerHeaders(apiKey),
    ...(mode === "submit" ? { "X-ModelScope-Async-Mode": "true" } : {}),
    ...(mode === "poll" ? { "X-ModelScope-Task-Type": "image_generation" } : {}),
  };
}

export function isCompletedAsyncStatus(status: string) {
  return ["completed", "succeeded", "success", "done", "succeed"].includes(status);
}

export function isFailedAsyncStatus(status: string) {
  return ["failed", "failure", "error", "cancelled", "canceled", "fail"].includes(status);
}

export function readPathText(value: Record<string, unknown>, path: string) {
  if (!path) return "";
  let current: unknown = value;
  for (const segment of path.split(".").filter(Boolean)) {
    if (current && typeof current === "object" && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[segment];
      continue;
    }
    return "";
  }
  return safeText(current);
}
