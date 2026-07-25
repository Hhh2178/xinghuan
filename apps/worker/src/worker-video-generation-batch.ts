import { boundedGenerationCount } from "./worker-image-generation-batch.js";
import {
  executeGenerationBatch,
  type GenerationBatchProgress,
} from "./worker-generation-batch.js";

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
  generationBatch: Pick<GenerationBatchProgress, "total" | "completed" | "providerRequestCount" | "children">;
}

export async function executeVideoGenerationBatch(options: {
  generationCount: unknown;
  maximumConcurrency?: unknown;
  execute: (batchIndex: number, remaining: number) => Promise<VideoGenerationResult>;
  isCancelled?: () => Promise<boolean>;
  onProgress?: (progress: VideoGenerationBatchProgress) => Promise<void>;
}) {
  const total = boundedGenerationCount(options.generationCount);
  try {
    const batch = await executeGenerationBatch({
      generationCount: total,
      maximumConcurrency: options.maximumConcurrency,
      outputKey: "videoUrls",
      remoteOutputKey: "remoteVideoUrls",
      execute: options.execute,
      isCancelled: options.isCancelled,
      onProgress: async (progress) => options.onProgress?.(videoProgress(progress)),
    });
    return videoResult(batch, total);
  } catch (error) {
    mapErrorResultPatch(error, (patch) => videoResult(patch, total));
    throw error;
  }
}

function videoProgress(progress: GenerationBatchProgress): VideoGenerationBatchProgress {
  return {
    completed: progress.completed,
    total: progress.total,
    providerRequestCount: progress.providerRequestCount,
    videoUrls: progress.outputUrls,
    remoteVideoUrls: progress.remoteOutputUrls.filter((url) => progress.outputUrls.includes(url)),
    taskIds: progress.taskIds,
    generationBatch: {
      total: progress.total,
      completed: progress.completed,
      providerRequestCount: progress.providerRequestCount,
      children: progress.children,
    },
  };
}

function videoResult(value: Record<string, unknown>, total: number) {
  const outputUrls = strings(value.outputUrls);
  const remoteOutputUrls = strings(value.remoteOutputUrls).filter((url) => outputUrls.includes(url));
  const taskIds = strings(value.taskIds);
  const { outputUrls: _outputs, remoteOutputUrls: _remote, ...rest } = value;
  return {
    ...rest,
    videoUrls: outputUrls,
    remoteVideoUrls: remoteOutputUrls,
    videoCount: outputUrls.length,
    generationCount: total,
    taskIds,
    ...(taskIds.length > 0 ? { taskId: taskIds[taskIds.length - 1] } : {}),
  };
}

function mapErrorResultPatch(error: unknown, map: (patch: Record<string, unknown>) => Record<string, unknown>) {
  if (!error || typeof error !== "object") return;
  const current = (error as { resultPatch?: unknown }).resultPatch;
  if (current && typeof current === "object" && !Array.isArray(current)) {
    (error as { resultPatch: Record<string, unknown> }).resultPatch = map(current as Record<string, unknown>);
  }
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean) : [];
}
