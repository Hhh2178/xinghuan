import { boundedGenerationCount } from "./worker-image-generation-batch.js";

export interface VideoGenerationResult extends Record<string, unknown> {
  videoUrls?: unknown;
  remoteVideoUrls?: unknown;
  taskId?: unknown;
}

export interface VideoGenerationBatchProgress {
  completed: number;
  total: number;
  providerRequestCount: number;
  videoUrls: string[];
  remoteVideoUrls: string[];
  taskIds: string[];
}

export async function executeVideoGenerationBatch(options: {
  generationCount: unknown;
  execute: (batchIndex: number, remaining: number) => Promise<VideoGenerationResult>;
  isCancelled?: () => Promise<boolean>;
  onProgress?: (progress: VideoGenerationBatchProgress) => Promise<void>;
}) {
  const total = boundedGenerationCount(options.generationCount);
  const videoUrls: string[] = [];
  const remoteVideoUrls: string[] = [];
  const taskIds: string[] = [];
  let lastResult: VideoGenerationResult = {};
  let providerRequestCount = 0;

  for (let batchIndex = 0; batchIndex < total; batchIndex += 1) {
    if (await options.isCancelled?.()) throw new Error("TASK_CANCELLED");
    lastResult = await options.execute(batchIndex, 1);
    providerRequestCount += 1;
    videoUrls.push(...strings(lastResult.videoUrls));
    remoteVideoUrls.push(...strings(lastResult.remoteVideoUrls));
    const taskId = text(lastResult.taskId);
    if (taskId && !taskIds.includes(taskId)) taskIds.push(taskId);
    await options.onProgress?.({
      completed: Math.min(total, videoUrls.length),
      total,
      providerRequestCount,
      videoUrls: videoUrls.slice(0, total),
      remoteVideoUrls: remoteVideoUrls.filter((url) => videoUrls.slice(0, total).includes(url)),
      taskIds: [...taskIds],
    });
  }

  const completedVideoUrls = videoUrls.slice(0, total);
  return {
    ...lastResult,
    videoUrls: completedVideoUrls,
    remoteVideoUrls: remoteVideoUrls.filter((url) => completedVideoUrls.includes(url)),
    videoCount: completedVideoUrls.length,
    generationCount: total,
    providerRequestCount,
    taskIds,
    ...(taskIds.length > 0 ? { taskId: taskIds[taskIds.length - 1] } : {}),
  };
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
