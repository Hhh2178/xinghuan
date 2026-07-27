import { attachOutputFetchContext } from "./output-materials.js";
import { providerHeaders } from "./worker-provider-utils.js";
import { createWorkerTaskError } from "./worker-task-lifecycle.js";
import type { TaskRow } from "./worker-task-store.js";

export async function executeOutputRecoveryTask(
  task: TaskRow,
  decryptSecret: (value: string) => string,
): Promise<Record<string, unknown>> {
  const previous = plainObject(task.result);
  const remoteVideoUrls = stringList(previous.remoteVideoUrls || previous.videoUrls).filter((url) => /^https?:\/\//i.test(url));
  const remoteImageUrls = stringList(previous.remoteImageUrls || previous.imageUrls).filter((url) => /^https?:\/\//i.test(url));
  const remoteAudioUrls = stringList(previous.remoteAudioUrls || previous.audioUrls).filter((url) => /^https?:\/\//i.test(url));
  if (remoteVideoUrls.length === 0 && remoteImageUrls.length === 0 && remoteAudioUrls.length === 0) {
    throw createWorkerTaskError("任务没有可恢复的 Provider 远程产物", {
      failureCategory: "provider_content_unavailable",
      outputRecoveryAvailable: false,
      materializationStatus: "unavailable",
    });
  }
  const apiKey = decryptSecret(task.apiKeyCipher);
  return attachOutputFetchContext({
    ...previous,
    imageUrls: remoteImageUrls,
    videoUrls: remoteVideoUrls,
    audioUrls: remoteAudioUrls,
    remoteImageUrls,
    remoteVideoUrls,
    remoteAudioUrls,
    outputRecoveryMode: "output_only",
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
  if (!available) return {};
  return {
    remoteVideoUrls,
    remoteImageUrls,
    remoteAudioUrls,
    outputRecoveryAvailable: true,
    outputRecoveryMode: "output_only",
    materializationStatus: "pending",
    materializationAttempts: Math.max(
      Number(task.result.materializationAttempts) || 0,
      Number(source.materializationAttempts) || 0,
    ) + 1,
    providerState: safeText(source.providerState || source.upstreamStatus || "completed"),
    upstreamTaskId: safeText(source.upstreamTaskId || source.taskId) || undefined,
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
