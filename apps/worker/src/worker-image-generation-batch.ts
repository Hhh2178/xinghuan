import {
  executeGenerationBatch,
  type GenerationBatchProgress,
} from "./worker-generation-batch.js";
import { inheritOutputFetchContext } from "./output-materials.js";

export interface ImageGenerationResult extends Record<string, unknown> {
  imageUrls?: unknown;
  remoteImageUrls?: unknown;
  taskId?: unknown;
}

export interface ImageGenerationBatchProgress {
  completed: number;
  total: number;
  providerRequestCount: number;
  imageUrls: string[];
  remoteImageUrls: string[];
  taskIds: string[];
  generationBatch: Pick<GenerationBatchProgress, "total" | "completed" | "providerRequestCount" | "children">;
}

export async function executeImageGenerationBatch(options: {
  generationCount: unknown;
  maximumConcurrency?: unknown;
  execute: (batchIndex: number, remaining: number) => Promise<ImageGenerationResult>;
  isCancelled?: () => Promise<boolean>;
  onProgress?: (progress: ImageGenerationBatchProgress) => Promise<void>;
}) {
  const total = boundedGenerationCount(options.generationCount);
  try {
    const batch = await executeGenerationBatch({
      generationCount: total,
      maximumConcurrency: options.maximumConcurrency,
      outputKey: "imageUrls",
      remoteOutputKey: "remoteImageUrls",
      execute: options.execute,
      isCancelled: options.isCancelled,
      onProgress: async (progress) => options.onProgress?.(imageProgress(progress)),
    });
    return imageResult(batch, total);
  } catch (error) {
    mapErrorResultPatch(error, (patch) => imageResult(patch, total));
    throw error;
  }
}

export function boundedGenerationCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(4, Math.round(parsed))) : 1;
}

function imageProgress(progress: GenerationBatchProgress): ImageGenerationBatchProgress {
  return inheritOutputFetchContext({
    completed: progress.completed,
    total: progress.total,
    providerRequestCount: progress.providerRequestCount,
    imageUrls: progress.outputUrls,
    remoteImageUrls: progress.remoteOutputUrls.filter((url) => progress.outputUrls.includes(url)),
    taskIds: progress.taskIds,
    generationBatch: {
      total: progress.total,
      completed: progress.completed,
      providerRequestCount: progress.providerRequestCount,
      children: progress.children,
    },
  }, progress);
}

function imageResult(value: Record<string, unknown>, total: number) {
  const outputUrls = strings(value.outputUrls);
  const remoteOutputUrls = strings(value.remoteOutputUrls).filter((url) => outputUrls.includes(url));
  const taskIds = strings(value.taskIds);
  const { outputUrls: _outputs, remoteOutputUrls: _remote, ...rest } = value;
  return inheritOutputFetchContext({
    ...rest,
    imageUrls: outputUrls,
    remoteImageUrls: remoteOutputUrls,
    imageCount: outputUrls.length,
    generationCount: total,
    taskIds,
    ...(taskIds.length > 0 ? { taskId: taskIds[taskIds.length - 1] } : {}),
  }, value);
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
