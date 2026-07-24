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
}

export async function executeImageGenerationBatch(options: {
  generationCount: unknown;
  execute: (batchIndex: number, remaining: number) => Promise<ImageGenerationResult>;
  isCancelled?: () => Promise<boolean>;
  onProgress?: (progress: ImageGenerationBatchProgress) => Promise<void>;
}) {
  const total = boundedGenerationCount(options.generationCount);
  const imageUrls: string[] = [];
  const remoteImageUrls: string[] = [];
  const taskIds: string[] = [];
  let lastResult: ImageGenerationResult = {};
  let providerRequestCount = 0;

  for (let batchIndex = 0; batchIndex < total; batchIndex += 1) {
    if (await options.isCancelled?.()) throw new Error("TASK_CANCELLED");

    lastResult = await options.execute(batchIndex, 1);
    providerRequestCount += 1;
    imageUrls.push(...strings(lastResult.imageUrls));
    remoteImageUrls.push(...strings(lastResult.remoteImageUrls));
    const taskId = text(lastResult.taskId);
    if (taskId && !taskIds.includes(taskId)) taskIds.push(taskId);

    await options.onProgress?.({
      completed: Math.min(total, imageUrls.length),
      total,
      providerRequestCount,
      imageUrls: imageUrls.slice(0, total),
      remoteImageUrls: remoteImageUrls.filter((url) => imageUrls.slice(0, total).includes(url)),
      taskIds: [...taskIds],
    });
  }

  const completedImageUrls = imageUrls.slice(0, total);
  return {
    ...lastResult,
    imageUrls: completedImageUrls,
    remoteImageUrls: remoteImageUrls.filter((url) => completedImageUrls.includes(url)),
    imageCount: completedImageUrls.length,
    generationCount: total,
    providerRequestCount,
    taskIds,
    ...(taskIds.length > 0 ? { taskId: taskIds[taskIds.length - 1] } : {}),
  };
}

export function boundedGenerationCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(4, Math.round(parsed))) : 1;
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
