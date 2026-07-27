import { describe, expect, it } from 'vitest';
import { collectFirstImageUrl } from './toolbox-material-binding';

describe('toolbox material binding', () => {
  it('binds the first owner-visible image from direct, collection or frame fields', () => {
    expect(collectFirstImageUrl([{ data: { imageUrl: '  /files/output/direct.png  ' } }])).toBe('/files/output/direct.png');
    expect(collectFirstImageUrl([{ data: { generatedImages: ['', '/files/output/generated.png'] } }])).toBe('/files/output/generated.png');
    expect(collectFirstImageUrl([{ data: { firstFrameUrl: '/files/output/frame.png' } }])).toBe('/files/output/frame.png');
  });

  it('does not bind non-image upload URLs', () => {
    expect(collectFirstImageUrl([{ data: { uploadType: 'video', url: '/files/output/video.mp4' } }])).toBe('');
  });
});
