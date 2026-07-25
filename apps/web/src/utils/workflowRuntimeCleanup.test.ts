import { describe, expect, it } from 'vitest';
import { cleanupNodeRuntimeForWorkflowTemplate } from './workflowRuntimeCleanup';

describe('workflow runtime cleanup', () => {
  it('removes generated and referenced media without touching workflow parameters', () => {
    const data = {
      prompt: 'keep this prompt',
      size: { w: 640, h: 420 },
      referenceImages: ['https://example.test/image.png'],
      localRefVideos: ['https://example.test/video.mp4'],
      directVideoUrls: ['https://example.test/output.mp4'],
      imageUrl: 'https://example.test/generated.png',
      videoUrls: ['https://example.test/generated.mp4'],
      taskIds: ['task-1'],
    };

    expect(cleanupNodeRuntimeForWorkflowTemplate('video', data)).toEqual({
      prompt: 'keep this prompt',
      size: { w: 640, h: 420 },
    });
    expect(data.referenceImages).toHaveLength(1);
    expect(data.localRefVideos).toHaveLength(1);
  });

  it('keeps the source node data unchanged for local canvas persistence', () => {
    const data = { imageUrls: ['https://example.test/image.png'], size: { w: 500, h: 300 } };
    cleanupNodeRuntimeForWorkflowTemplate('image', data);
    expect(data).toEqual({ imageUrls: ['https://example.test/image.png'], size: { w: 500, h: 300 } });
  });

  it('removes transient supervised execution projections from workflow exports', () => {
    expect(cleanupNodeRuntimeForWorkflowTemplate('image', {
      prompt: 'keep',
      __runtimeProjection: { runId: 'run-1', status: 'running' },
    })).toEqual({ prompt: 'keep' });
  });
});
