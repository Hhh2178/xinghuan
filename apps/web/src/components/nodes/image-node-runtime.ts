export interface ImageGenerationResult {
  imageUrls: string[];
  remoteImageUrls: string[];
  taskId?: string;
  usedI2I: boolean;
}

export interface ImageGenerationAggregation {
  imageUrls: string[];
  remoteImageUrls: string[];
  taskIds: string[];
  lastTaskId?: string;
  usedI2I: boolean;
}

const appendUnique = (current: string[], incoming: string[]) => {
  const next = [...current];
  for (const value of incoming) {
    if (value && !next.includes(value)) next.push(value);
  }
  return next;
};

export function appendImageGenerationResult(
  current: ImageGenerationAggregation,
  result: ImageGenerationResult,
): ImageGenerationAggregation {
  return {
    imageUrls: appendUnique(current.imageUrls, result.imageUrls),
    remoteImageUrls: appendUnique(current.remoteImageUrls, result.remoteImageUrls),
    taskIds: result.taskId && !current.taskIds.includes(result.taskId)
      ? [...current.taskIds, result.taskId]
      : [...current.taskIds],
    lastTaskId: result.taskId || current.lastTaskId,
    usedI2I: current.usedI2I || result.usedI2I,
  };
}
