import { describe, expect, it } from 'vitest';
import { buildPoseOutputData, planPoseOutputTargets } from './pose-output-runtime';

describe('pose output runtime', () => {
  it('normalizes single and collection output fields from the same result list', () => {
    const data = buildPoseOutputData('pose-1', [
      { imageUrl: 'a.png', prompt: 'a', metadata: { preset: 'a' } },
      { imageUrl: 'b.png', prompt: 'b', metadata: { preset: 'b' } },
    ], 'openpose', 123);

    expect(data).toMatchObject({
      title: '姿势分镜合集',
      imageUrl: 'a.png',
      imageUrls: ['a.png', 'b.png'],
      outputText: 'a\n\nb',
      poseMasterSourceId: 'pose-1',
      poseMasterOutputMode: 'collection',
      updatedAt: 123,
    });
    expect(data?.poseMasterMetadata).toEqual([{ preset: 'a' }, { preset: 'b' }]);
  });

  it('reuses managed output and removes duplicate legacy auto outputs', () => {
    const plan = planPoseOutputTargets(
      'pose-1',
      [
        { id: 'output-auto-pose-master-pose-1-old', type: 'output' },
        { id: 'output-auto-pose-1-legacy', type: 'output' },
        { id: 'output-manual', type: 'output' },
      ],
      [
        { source: 'pose-1', target: 'output-auto-pose-master-pose-1-old' },
        { source: 'pose-1', target: 'output-auto-pose-1-legacy' },
        { source: 'pose-1', target: 'output-manual' },
      ],
    );

    expect(plan).toEqual({
      targetOutputId: 'output-auto-pose-master-pose-1-old',
      removableOutputIds: ['output-auto-pose-1-legacy'],
    });
  });
});
