import { describe, expect, it } from 'vitest';
import { appendImageGenerationResult, type ImageGenerationAggregation } from './image-node-runtime';

const empty: ImageGenerationAggregation = {
  imageUrls: ['existing'],
  remoteImageUrls: [],
  taskIds: ['task-1'],
  lastTaskId: 'task-1',
  usedI2I: false,
};

describe('appendImageGenerationResult', () => {
  it('deduplicates local and remote output URLs while retaining response order', () => {
    expect(appendImageGenerationResult(empty, {
      imageUrls: ['existing', 'new'],
      remoteImageUrls: ['remote-1', 'remote-1'],
      taskId: 'task-2',
      usedI2I: true,
    })).toEqual({
      imageUrls: ['existing', 'new'],
      remoteImageUrls: ['remote-1'],
      taskIds: ['task-1', 'task-2'],
      lastTaskId: 'task-2',
      usedI2I: true,
    });
  });

  it('does not duplicate a task id but still advances the latest response id', () => {
    expect(appendImageGenerationResult(empty, {
      imageUrls: ['next'],
      remoteImageUrls: [],
      taskId: 'task-1',
      usedI2I: false,
    })).toMatchObject({ taskIds: ['task-1'], lastTaskId: 'task-1', imageUrls: ['existing', 'next'] });
  });
});
