import { describe, expect, it } from 'vitest';

import { readCanvasRunTaskProgress } from './canvas-run-task-progress.js';

describe('canvas run task progress', () => {
  it('reads image batch progress written by the Worker task runtime', () => {
    expect(readCanvasRunTaskProgress({ generationBatch: { completed: 2, total: 3, providerRequestCount: 2 } }))
      .toEqual({ completed: 2, total: 3, providerRequestCount: 2 });
  });

  it('reads video batch progress from the legacy-flat Worker runtime fields', () => {
    expect(readCanvasRunTaskProgress({ generationCount: 3, completedGenerationCount: 1, providerRequestCount: 1 }))
      .toEqual({ completed: 1, total: 3, providerRequestCount: 1 });
  });

  it('reads the flattened progress event used for Canvas Run event deduplication', () => {
    expect(readCanvasRunTaskProgress({ completed: 2, generationCount: 3, providerRequestCount: 2 }))
      .toEqual({ completed: 2, total: 3, providerRequestCount: 2 });
  });

  it('projects ordered child states without Provider output URLs', () => {
    expect(readCanvasRunTaskProgress({
      generationBatch: {
        completed: 1,
        total: 2,
        providerRequestCount: 2,
        children: [
          { batchIndex: 1, status: 'running', outputUrls: ['https://private.invalid/1.png'] },
          { batchIndex: 0, status: 'succeeded', taskId: 'provider-0', generationArtifactIds: ['artifact-0'] },
        ],
      },
    })).toEqual({
      completed: 1,
      total: 2,
      providerRequestCount: 2,
      taskRuns: [
        { batchIndex: 0, status: 'succeeded', taskId: 'provider-0', generationArtifactIds: ['artifact-0'] },
        { batchIndex: 1, status: 'running', generationArtifactIds: [] },
      ],
    });
  });

  it('reads child states back from a persisted progress event payload', () => {
    expect(readCanvasRunTaskProgress({
      completed: 0,
      generationCount: 2,
      providerRequestCount: 2,
      taskRuns: [
        { batchIndex: 0, status: 'running', generationArtifactIds: [] },
        { batchIndex: 1, status: 'running', generationArtifactIds: [] },
      ],
    })).toMatchObject({
      completed: 0,
      total: 2,
      providerRequestCount: 2,
      taskRuns: [
        { batchIndex: 0, status: 'running' },
        { batchIndex: 1, status: 'running' },
      ],
    });
  });
});
