import { describe, expect, it } from 'vitest';

import { readPersistedOutputMediaSnapshot, shouldCollectOutputNodeUpstream } from './outputNodeMaterialMode';

describe('shouldCollectOutputNodeUpstream', () => {
  it('keeps normal output nodes connected to upstream materials', () => {
    expect(shouldCollectOutputNodeUpstream({})).toBe(true);
  });

  it('lets generated text-split outputs display only their assigned segment', () => {
    expect(shouldCollectOutputNodeUpstream({ ignoreUpstreamMaterials: true })).toBe(false);
  });
});

describe('readPersistedOutputMediaSnapshot', () => {
  it('restores completed videos from ordinary canvas fields after refresh', () => {
    expect(readPersistedOutputMediaSnapshot({
      videoUrl: '/files/first.mp4',
      videoUrls: ['/files/first.mp4', '/files/second.mp4'],
    })).toEqual({
      images: [],
      videos: ['/files/first.mp4', '/files/second.mp4'],
      audios: [],
    });
  });

  it('deduplicates persisted media without changing its order', () => {
    expect(readPersistedOutputMediaSnapshot({
      imageUrl: '/files/a.png',
      imageUrls: ['/files/a.png', '/files/b.png'],
      urls: ['/files/b.png'],
    }).images).toEqual(['/files/a.png', '/files/b.png']);
  });
});
