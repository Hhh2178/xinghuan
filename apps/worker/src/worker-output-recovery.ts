import { attachOutputFetchContext } from "./output-materials.js";
import { providerHeaders } from "./worker-provider-utils.js";
import { createWorkerTaskError } from "./worker-task-lifecycle.js";
import type { TaskRow } from "./worker-task-store.js";

export interface ResumeProviderOutputInput {
  task: TaskRow;
  apiKey: string;
  upstreamTaskId: string;
}

interface OutputRecoveryOptions {
  resumeProviderOutput?: (input: ResumeProviderOutputInput) => Promise<Record<string, unknown>>;
}

export async function executeOutputRecoveryTask(
  task: TaskRow,
  decryptSecret: (value: string) => string,
  options: OutputRecoveryOptions = {},
): Promise<Record<string, unknown>> {
  const previous = plainObject(task.result);
  const mode = safeText(task.payload.outputRecoveryMode || previous.outputRecoveryMode, "output_only");
  const apiKey = decryptSecret(task.apiKeyCipher);
  let recovered = previous;
  let providerPollResumed = false;
  if (mode === "provider_poll_resume") {
    const upstreamTaskId = safeText(previous.upstreamTaskId || previous.taskId);
    if (!upstreamTaskId || task.capability !== "video") {
      throw createWorkerTaskError("任务缺少可继续轮询的上游视频任务号", {
        failureCategory: "provider_content_unavailable",
        outputRecoveryAvailable: false,
        materializationStatus: "unavailable",
      });
    }
    if (!options.resumeProviderOutput) throw new Error("Worker 未配置 Provider 续轮询恢复器");
    const resumed = await options.resumeProviderOutput({ task, apiKey, upstreamTaskId });
    recovered = { ...previous, ...resumed, upstreamTaskId };
    providerPollResumed = true;
  }
  const remoteVideoUrls = stringList(recovered.remoteVideoUrls || recovered.videoUrls).filter((url) => /^https?:\/\//i.test(url));
  const remoteImageUrls = stringList(recovered.remoteImageUrls || recovered.imageUrls).filter((url) => /^https?:\/\//i.test(url));
  const remoteAudioUrls = stringList(recovered.remoteAudioUrls || recovered.audioUrls).filter((url) => /^https?:\/\//i.test(url));
  if (remoteVideoUrls.length === 0 && remoteImageUrls.length === 0 && remoteAudioUrls.length === 0) {
    throw createWorkerTaskError("任务没有可恢复的 Provider 远程产物", {
      failureCategory: "provider_content_unavailable",
      outputRecoveryAvailable: false,
      materializationStatus: "unavailable",
    });
  }
  return attachOutputFetchContext({
    ...recovered,
    imageUrls: remoteImageUrls,
    videoUrls: remoteVideoUrls,
    audioUrls: remoteAudioUrls,
    remoteImageUrls,
    remoteVideoUrls,
    remoteAudioUrls,
    outputRecoveryMode: "output_only",
    providerPollResumed,
    providerPollResumedAt: providerPollResumed ? new Date().toISOString() : undefined,
    outputRecoveryAvailable: true,
    failureReason: null,
    failureCategory: null,
    providerDiagnostic: null,
    upstreamHttpStatus: null,
    upstreamResponseSnippet: null,
    failedAt: null,
    reaperReason: null,
    materializationFailure: null,
    materializationStatus: "retrying",
    materializationAttempts: Math.max(0, Number(previous.materializationAttempts) || 0) + 1,
  }, {
    origin: task.providerBaseUrl,
    headers: apiKey ? providerHeaders(apiKey) : {},
  });
}

export function buildOutputRecoveryFailurePatch(task: TaskRow, result: Record<string, unknown>, error: unknown) {
  const source = Object.keys(result).length > 0 ? result : task.result;
  const remoteVideoUrls = stringList(source.remoteVideoUrls || source.videoUrls).filter((url) => /^https?:\/\//i.test(url));
  const remoteImageUrls = stringList(source.remoteImageUrls || source.imageUrls).filter((url) => /^https?:\/\//i.test(url));
  const remoteAudioUrls = stringList(source.remoteAudioUrls || source.audioUrls).filter((url) => /^https?:\/\//i.test(url));
  const available = remoteVideoUrls.length + remoteImageUrls.length + remoteAudioUrls.length > 0;
  const upstreamTaskId = safeText(source.upstreamTaskId || source.taskId);
  const providerPollRecoverable = !available && task.capability === "video" && Boolean(upstreamTaskId);
  if (!available && !providerPollRecoverable) return {};
  return {
    remoteVideoUrls,
    remoteImageUrls,
    remoteAudioUrls,
    outputRecoveryAvailable: true,
    outputRecoveryMode: providerPollRecoverable ? "provider_poll_resume" : "output_only",
    materializationStatus: "pending",
    materializationAttempts: Math.max(
      Number(task.result.materializationAttempts) || 0,
      Number(source.materializationAttempts) || 0,
    ) + 1,
    providerState: safeText(source.providerState || source.upstreamStatus || "completed"),
    upstreamTaskId: upstreamTaskId || undefined,
    materializationFailure: error instanceof Error ? error.message : String(error),
  };
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => safeText(item)).filter(Boolean) : [];
}

function plainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeText(value: unknown, fallback = "") {
  const text = String(value ?? fallback).trim();
  return text || fallback;
}
