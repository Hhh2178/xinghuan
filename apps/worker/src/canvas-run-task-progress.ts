export interface CanvasRunTaskProgress {
  completed: number;
  total: number;
  providerRequestCount: number;
}

export function readCanvasRunTaskProgress(value: unknown): CanvasRunTaskProgress | null {
  const result = object(value);
  const batch = object(result.generationBatch);
  const total = positive(batch.total) || positive(result.generationCount);
  if (!total) return null;

  const completed = Math.min(
    total,
    positive(batch.completed) || positive(result.completedGenerationCount) || 0,
  );
  const providerRequestCount = positive(batch.providerRequestCount) || positive(result.providerRequestCount) || 0;
  return { completed, total, providerRequestCount };
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function positive(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}
