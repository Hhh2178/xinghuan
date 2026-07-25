export interface CanvasRunTaskProgress {
  completed: number;
  total: number;
  providerRequestCount: number;
  taskRuns?: Array<{
    batchIndex: number;
    status: string;
    taskId?: string;
    error?: string;
    generationArtifactIds: string[];
  }>;
}

export function readCanvasRunTaskProgress(value: unknown): CanvasRunTaskProgress | null {
  const result = object(value);
  const batch = object(result.generationBatch);
  const total = positive(batch.total) || positive(result.generationCount);
  if (!total) return null;

  const completed = Math.min(
    total,
    positive(batch.completed) || positive(result.completedGenerationCount) || positive(result.completed) || 0,
  );
  const providerRequestCount = positive(batch.providerRequestCount) || positive(result.providerRequestCount) || 0;
  const rawTaskRuns = Array.isArray(batch.children)
    ? batch.children
    : Array.isArray(result.taskRuns) ? result.taskRuns : [];
  const taskRuns = rawTaskRuns.length > 0
    ? rawTaskRuns.map(object).map((child) => compact({
      batchIndex: Math.max(0, Math.floor(Number(child.batchIndex) || 0)),
      status: childStatus(child.status),
      taskId: text(child.taskId) || undefined,
      error: safeError(child.error) || undefined,
      generationArtifactIds: strings(child.generationArtifactIds),
    })).sort((left, right) => left.batchIndex - right.batchIndex)
    : [];
  return { completed, total, providerRequestCount, ...(taskRuns.length > 0 ? { taskRuns } : {}) };
}

function childStatus(value: unknown) {
  const status = text(value);
  return ['queued', 'running', 'succeeded', 'failed', 'cancelled'].includes(status) ? status : 'queued';
}

function safeError(value: unknown) {
  return text(value)
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [redacted]')
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[redacted url]')
    .slice(0, 500);
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function text(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function positive(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}
