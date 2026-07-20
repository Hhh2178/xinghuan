import { describe, expect, it } from 'vitest';
import { constrainMediaNodeResize, fitMediaNodeFromWidth, mediaAspectRatio } from './mediaNodeSize';

const chrome = {
  horizontalChrome: 20,
  verticalChrome: 116,
  minWidth: 220,
  minHeight: 180,
  maxWidth: 980,
  maxHeight: 980,
};

describe('single media node sizing', () => {
  it('fits portrait media without changing its preview ratio', () => {
    const size = fitMediaNodeFromWidth(320, { ...chrome, aspectRatio: 2 / 3 });
    expect(size).toEqual({ w: 320, h: 566 });
    expect((size.w - chrome.horizontalChrome) / (size.h - chrome.verticalChrome)).toBeCloseTo(2 / 3);
  });

  it('fits landscape video without retaining a stale portrait height', () => {
    const size = fitMediaNodeFromWidth(480, { ...chrome, aspectRatio: 16 / 9 });
    expect(size.h).toBeCloseTo(374.75);
    expect((size.w - chrome.horizontalChrome) / (size.h - chrome.verticalChrome)).toBeCloseTo(16 / 9);
  });

  it('lets vertical corner movement drive the same locked media ratio', () => {
    const size = constrainMediaNodeResize(
      { w: 325, h: 720 },
      { ...chrome, aspectRatio: 2 / 3 },
    );
    expect(size.w).toBeGreaterThan(325);
    expect((size.w - chrome.horizontalChrome) / (size.h - chrome.verticalChrome)).toBeCloseTo(2 / 3);
  });

  it('respects both width and height bounds', () => {
    const size = constrainMediaNodeResize(
      { w: 2000, h: 2000 },
      { ...chrome, aspectRatio: 1 },
    );
    expect(size).toEqual({ w: 884, h: 980 });
  });

  it('rejects unusable intrinsic dimensions', () => {
    expect(mediaAspectRatio(0, 1080)).toBeUndefined();
    expect(mediaAspectRatio(1920, 1080)).toBeCloseTo(16 / 9);
  });
});
