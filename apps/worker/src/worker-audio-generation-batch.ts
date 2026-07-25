import { boundedGenerationCount } from "./worker-image-generation-batch.js";
import {
  executeGenerationBatch,
  type GenerationBatchProgress,
} from "./worker-generation-batch.js";

export interface AudioGenerationResult extends Record<string, unknown> {
  audioUrls?: unknown;
  remoteAudioUrls?: unknown;
  taskId?: unknown;
}

export interface AudioGenerationBatchProgress {
  completed: number;
  total: number;
  providerRequestCount: number;
  audioUrls: string[];
  remoteAudioUrls: string[];
  taskIds: string[];
  generationBatch: Pick<GenerationBatchProgress, "total" | "completed" | "providerRequestCount" | "children">;
}

export async function executeAudioGenerationBatch(options: {
  generationCount: unknown;
  maximumConcurrency?: unknown;
  execute: (batchIndex: number, remaining: number) => Promise<AudioGenerationResult>;
  isCancelled?: () => Promise<boolean>;
  onProgress?: (progress: AudioGenerationBatchProgress) => Promise<void>;
}) {
  const total = boundedGenerationCount(options.generationCount);
  try {
    const batch = await executeGenerationBatch({
      generationCount: total,
      maximumConcurrency: options.maximumConcurrency,
      outputKey: "audioUrls",
      remoteOutputKey: "remoteAudioUrls",
      execute: options.execute,
      isCancelled: options.isCancelled,
      onProgress: async (progress) => options.onProgress?.(audioProgress(progress)),
    });
    return audioResult(batch, total);
  } catch (error) {
    mapErrorResultPatch(error, (patch) => audioResult(patch, total));
    throw error;
  }
}

function audioProgress(progress: GenerationBatchProgress): AudioGenerationBatchProgress {
  return {
    completed: progress.completed,
    total: progress.total,
    providerRequestCount: progress.providerRequestCount,
    audioUrls: progress.outputUrls,
    remoteAudioUrls: progress.remoteOutputUrls.filter((url) => progress.outputUrls.includes(url)),
    taskIds: progress.taskIds,
    generationBatch: {
      total: progress.total,
      completed: progress.completed,
      providerRequestCount: progress.providerRequestCount,
      children: progress.children,
    },
  };
}

function audioResult(value: Record<string, unknown>, total: number) {
  const outputUrls = strings(value.outputUrls);
  const remoteOutputUrls = strings(value.remoteOutputUrls).filter((url) => outputUrls.includes(url));
  const taskIds = strings(value.taskIds);
  const { outputUrls: _outputs, remoteOutputUrls: _remote, ...rest } = value;
  return {
    ...rest,
    audioUrls: outputUrls,
    remoteAudioUrls: remoteOutputUrls,
    audioCount: outputUrls.length,
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
