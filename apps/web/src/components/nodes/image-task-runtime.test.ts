import { describe, expect, it } from 'vitest';
import { collectImageTaskIds } from './image-task-runtime';

describe('image task runtime', () => {
  it('deduplicates current, persisted and resumable task IDs for cancellation', () => {
    expect(collectImageTaskIds(
      ['saved-1', 'saved-1'],
      'saved-2',
      [{ taskId: 'saved-2' }, { taskId: 'run-3' }, { taskId: '' }],
    )).toEqual(['saved-1', 'saved-2', 'run-3']);
  });
});
