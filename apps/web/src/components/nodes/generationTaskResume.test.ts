import { describe, expect, it } from 'vitest';
import {
  initializeGenerationTaskRuns,
  mergeUniqueUrls,
  patchGenerationTaskRun,
  resumableTaskRuns,
  taskRunIds,
  type PersistedGenerationTaskRun,
} from './generationTaskResume';

describe('generation task resume contract', () => {
  const runs = [
    { batchIndex: 0, taskId: 'task-a', kind: 'video', resumeKind: 'external-video', status: 'polling', progress: '5%', outputCount: 0 },
    { batchIndex: 1, taskId: 'task-b', kind: 'video', resumeKind: 'external-video', status: 'success', progress: '100%', outputCount: 1 },
    { batchIndex: 2, taskId: 'task-c', kind: 'video', resumeKind: 'seedance', status: 'running', progress: '45%', outputCount: 0 },
  ];

  it('returns every active persisted batch for the requested query route', () => {
    expect(resumableTaskRuns(runs, ['external-video'])).toEqual([runs[0]]);
    expect(resumableTaskRuns(runs, ['seedance'])).toEqual([runs[2]]);
  });

  it('never resumes terminal or descriptor-free task runs', () => {
    expect(resumableTaskRuns([
      { ...runs[0], status: 'error' },
      { ...runs[0], taskId: undefined },
      { ...runs[0], resumeKind: undefined },
    ])).toEqual([]);
  });

  it('merges restored outputs and task ids without duplicates', () => {
    expect(mergeUniqueUrls(['saved.mp4'], ['restored.mp4', 'saved.mp4'])).toEqual(['saved.mp4', 'restored.mp4']);
    expect(taskRunIds(runs)).toEqual(['task-a', 'task-b', 'task-c']);
  });

  it('makes a newly initialized batch patchable before the next render', () => {
    const taskRunsRef = { current: [] as PersistedGenerationTaskRun[] };
    const initialTaskRuns: PersistedGenerationTaskRun[] = [
      { batchIndex: 0, kind: 'image', status: 'queued', progress: '0%', outputCount: 0 },
      { batchIndex: 1, kind: 'image', status: 'queued', progress: '0%', outputCount: 0 },
    ];

    initializeGenerationTaskRuns(taskRunsRef, initialTaskRuns);
    const next = patchGenerationTaskRun(taskRunsRef, 1, {
      status: 'success',
      progress: '100%',
      outputCount: 1,
    });

    expect(next).toEqual([
      initialTaskRuns[0],
      { ...initialTaskRuns[1], status: 'success', progress: '100%', outputCount: 1 },
    ]);
    expect(taskRunsRef.current).toBe(next);
  });

  it('preserves earlier child results while later children finish', () => {
    const taskRunsRef = { current: [] as PersistedGenerationTaskRun[] };
    initializeGenerationTaskRuns(taskRunsRef, [
      { batchIndex: 0, kind: 'video', status: 'queued', progress: '0%', outputCount: 0 },
      { batchIndex: 1, kind: 'video', status: 'queued', progress: '0%', outputCount: 0 },
      { batchIndex: 2, kind: 'video', status: 'queued', progress: '0%', outputCount: 0 },
    ]);

    patchGenerationTaskRun(taskRunsRef, 2, { status: 'error', error: 'provider failed' });
    patchGenerationTaskRun(taskRunsRef, 0, { status: 'success', progress: '100%', outputCount: 1 });

    expect(taskRunsRef.current.map(({ batchIndex, status }) => ({ batchIndex, status }))).toEqual([
      { batchIndex: 0, status: 'success' },
      { batchIndex: 1, status: 'queued' },
      { batchIndex: 2, status: 'error' },
    ]);
  });
});
