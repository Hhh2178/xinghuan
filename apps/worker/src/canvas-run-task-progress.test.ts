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
});
