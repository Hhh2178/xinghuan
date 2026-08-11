export type GenerationResumeKind =
  | 'external-image'
  | 'external-video'
  | 'external-audio'
  | 'seedance'
  | 'suno'
  | 'mj-image'
  | 'fal-image'
  | 'legacy-image'
  | 'fal-video'
  | 'legacy-video';

export type ResumableTaskStatus =
  | 'queued'
  | 'submitting'
  | 'polling'
  | 'running'
  | 'success'
  | 'error'
  | 'cancelled';

export interface PersistedGenerationTaskRun {
  batchIndex: number;
  taskId?: string;
  kind: 'image' | 'video' | 'audio' | 'seedance';
  resumeKind?: GenerationResumeKind;
  resumeParams?: Record<string, unknown>;
  status: ResumableTaskStatus;
  progress: string;
  error?: string;
  outputCount: number;
  startedAt?: number | null;
  finishedAt?: number | null;
}

export interface GenerationTaskRunsRef<T extends PersistedGenerationTaskRun> {
  current: T[];
}

export function initializeGenerationTaskRuns<T extends PersistedGenerationTaskRun>(
  taskRunsRef: GenerationTaskRunsRef<T>,
  taskRuns: T[],
): T[] {
  taskRunsRef.current = taskRuns;
  return taskRuns;
}

export function patchGenerationTaskRun<T extends PersistedGenerationTaskRun>(
  taskRunsRef: GenerationTaskRunsRef<T>,
  batchIndex: number,
  patch: Partial<T>,
): T[] {
  const next = taskRunsRef.current.map((item) => (
    item.batchIndex === batchIndex ? { ...item, ...patch } : item
  ));
  taskRunsRef.current = next;
  return next;
}

const ACTIVE_TASK_STATUSES = new Set<ResumableTaskStatus>([
  'queued',
  'submitting',
  'polling',
  'running',
]);

export function resumableTaskRuns(
  value: unknown,
  kinds?: readonly GenerationResumeKind[],
): PersistedGenerationTaskRun[] {
  if (!Array.isArray(value)) return [];
  const allowedKinds = kinds ? new Set(kinds) : null;
  return value.filter((item): item is PersistedGenerationTaskRun => {
    if (!item || typeof item !== 'object') return false;
    const run = item as Partial<PersistedGenerationTaskRun>;
    return Number.isInteger(run.batchIndex)
      && typeof run.taskId === 'string'
      && run.taskId.length > 0
      && typeof run.resumeKind === 'string'
      && (!allowedKinds || allowedKinds.has(run.resumeKind as GenerationResumeKind))
      && ACTIVE_TASK_STATUSES.has(run.status as ResumableTaskStatus);
  });
}

export function mergeUniqueUrls(...groups: unknown[]): string[] {
  const merged: string[] = [];
  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    for (const item of group) {
      if (typeof item === 'string' && item.length > 0 && !merged.includes(item)) merged.push(item);
    }
  }
  return merged;
}

export function taskRunIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return mergeUniqueUrls(value.map((item) => (
    item && typeof item === 'object' ? (item as Partial<PersistedGenerationTaskRun>).taskId : undefined
  )));
}
