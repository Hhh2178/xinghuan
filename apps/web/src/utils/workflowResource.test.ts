import { describe, expect, it } from 'vitest';
import { createWorkflowResourceManifest } from './workflowResource';

describe('workflow resource export', () => {
  it('cleans media from the exported clone while preserving node dimensions', () => {
    const node = {
      id: 'text-1',
      type: 'text',
      position: { x: 20, y: 30 },
      width: 720,
      height: 460,
      data: {
        prompt: 'keep prompt',
        size: { w: 720, h: 460 },
        imageUrls: ['https://example.test/generated.png'],
        videoUrls: ['https://example.test/generated.mp4'],
        localRefVideos: ['https://example.test/reference.mp4'],
      },
    } as any;

    const manifest = createWorkflowResourceManifest({ nodes: [node], edges: [] }, { title: 'Test workflow' });
    expect(manifest.nodes[0]).toMatchObject({ width: 720, height: 460, data: { prompt: 'keep prompt', size: { w: 720, h: 460 } } });
    expect(manifest.nodes[0].data).not.toHaveProperty('imageUrls');
    expect(manifest.nodes[0].data).not.toHaveProperty('videoUrls');
    expect(manifest.nodes[0].data).not.toHaveProperty('localRefVideos');
    expect(node.data.videoUrls).toEqual(['https://example.test/generated.mp4']);
  });
});
