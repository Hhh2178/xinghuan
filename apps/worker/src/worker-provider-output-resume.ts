import { shouldUseAicopyVideoAdapter } from "@xinghuan/model-core";

import { shouldUseApimartVideoAdapter } from "./worker-apimart-video-adapter.js";
import { pollAicopyVideoTask, pollApimartVideoTask } from "./worker-media-polling.js";
import type { ResumeProviderOutputInput } from "./worker-output-recovery.js";
import { createWorkerTaskError } from "./worker-task-lifecycle.js";

interface ProviderOutputResumeDependencies {
  touchTaskRuntime: (taskId: string, patch: Record<string, unknown>) => Promise<unknown>;
  pollApimart?: typeof pollApimartVideoTask;
  pollAicopy?: typeof pollAicopyVideoTask;
}

export async function resumeProviderVideoOutput(
  input: ResumeProviderOutputInput,
  dependencies: ProviderOutputResumeDependencies,
): Promise<Record<string, unknown>> {
  const { task, apiKey, upstreamTaskId } = input;
  const protocol = normalizeProtocol(task.providerProtocol);
  const advancedMode = safeText(task.payload.advancedMode || task.payload.mode);
  const touchRecoveryHeartbeat = async (patch: Record<string, unknown>) => {
    await dependencies.touchTaskRuntime(task.id, {
      ...patch,
      runtimeStage: "provider_poll_recovery",
    });
  };
  await touchRecoveryHeartbeat({
    heartbeatAt: new Date().toISOString(),
    upstreamTaskId,
    taskId: upstreamTaskId,
    outputRecoveryMode: "provider_poll_resume",
  });

  if (shouldUseAicopyVideoAdapter({
    protocol,
    advancedMode,
    modelId: task.providerModelId,
    providerBaseUrl: task.providerBaseUrl,
  })) {
    const requestContract = plainObject(task.payload.requestContract);
    const polled = await (dependencies.pollAicopy || pollAicopyVideoTask)({
      baseUrl: task.providerBaseUrl,
      apiKey,
      taskId: upstreamTaskId,
      statusPath: safeText(task.payload.taskStatusPath, "status"),
      resultVideoPath: safeText(task.payload.resultVideoPath, "data.output"),
      resultPaths: Array.isArray(requestContract.resultPaths) ? requestContract.resultPaths as string[] : undefined,
      pollPathTemplate: safeText(task.payload.pollPathTemplate, "videos/{task_id}"),
      contentPathTemplate: safeText(task.payload.contentPathTemplate, "videos/{task_id}/content"),
      pollIntervalMs: clampNumber(task.payload.pollIntervalMs, 2000, 500, 10000),
      timeoutMs: clampOptionalNumber(task.payload.timeoutMs || task.payload.maxPollMs, 5000, 1800000),
      onHeartbeat: touchRecoveryHeartbeat,
    });
    return videoRecoveryResult(task.providerId, task.providerModelId, upstreamTaskId, "aicopy-video", polled);
  }

  if (shouldUseApimartVideoAdapter({
    protocol,
    advancedMode,
    modelId: task.providerModelId,
    providerBaseUrl: task.providerBaseUrl,
  })) {
    const polled = await (dependencies.pollApimart || pollApimartVideoTask)({
      baseUrl: task.providerBaseUrl,
      apiKey,
      taskId: upstreamTaskId,
      statusPath: safeText(task.payload.taskStatusPath || task.payload.pollStatusPath, "data.status"),
      resultVideoPath: safeText(task.payload.resultVideoPath, "data.result.videos"),
      pollPathTemplate: safeText(task.payload.pollPathTemplate, "tasks/{task_id}"),
      finalResultTaskIdPath: safeText(task.payload.finalResultTaskIdPath),
      finalResultPathTemplate: safeText(task.payload.finalResultPathTemplate),
      finalResultVideoPath: safeText(task.payload.finalResultVideoPath),
      pollIntervalMs: clampNumber(task.payload.pollIntervalMs, 2000, 500, 10000),
      timeoutMs: clampOptionalNumber(task.payload.timeoutMs || task.payload.maxPollMs, 5000, 1800000),
      onHeartbeat: touchRecoveryHeartbeat,
    });
    return videoRecoveryResult(task.providerId, task.providerModelId, upstreamTaskId, "apimart-video", polled);
  }

  throw createWorkerTaskError(`当前 Provider 不支持按原任务号恢复轮询: ${protocol || "unknown"}`, {
    failureCategory: "provider_content_unavailable",
    outputRecoveryAvailable: false,
    upstreamTaskId,
  });
}

function videoRecoveryResult(
  providerId: string,
  modelId: string,
  upstreamTaskId: string,
  adapter: string,
  polled: { status: string; videoUrls: string[] },
) {
  return {
    adapter,
    providerId,
    modelId,
    taskId: upstreamTaskId,
    upstreamTaskId,
    videoUrls: polled.videoUrls,
    remoteVideoUrls: polled.videoUrls,
    videoCount: polled.videoUrls.length,
    providerState: safeText(polled.status || "completed"),
  };
}

function normalizeProtocol(value: unknown) {
  return safeText(value).toLowerCase();
}

function safeText(value: unknown, fallback = "") {
  const text = String(value ?? fallback).trim();
  return text || fallback;
}

function plainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function clampOptionalNumber(value: unknown, min: number, max: number) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : undefined;
}
