import { describe, expect, it } from 'vitest';
import { mergeUniqueUrls, resumableTaskRuns, taskRunIds } from './generationTaskResume';

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
});
