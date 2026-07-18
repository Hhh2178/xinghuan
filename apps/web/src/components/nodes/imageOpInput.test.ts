import { describe, expect, it } from 'vitest';
import { missingImageInputMessage } from './imageOpInput';

const material = <K extends 'text' | 'video' | 'audio'>(kind: K) => ({
  id: `${kind}-1`,
  kind,
  url: `/files/example.${kind === 'video' ? 'mp4' : kind === 'audio' ? 'mp3' : 'txt'}`,
  sourceNodeId: 'upstream-1',
  origin: 'upstream' as const,
});

describe('image operation input diagnostics', () => {
  it('guides video inputs through a frame extraction node', () => {
    expect(missingImageInputMessage({ texts: [], videos: [material('video')], audios: [] }))
      .toContain('首尾帧获取');
  });

  it('distinguishes incompatible media from a missing connection', () => {
    expect(missingImageInputMessage({ texts: [], videos: [], audios: [material('audio')] }))
      .toContain('上游提供的是音频');
    expect(missingImageInputMessage({ texts: [], videos: [], audios: [] }))
      .toBe('请连接一个有可用输出的上游图片节点。');
  });
});
