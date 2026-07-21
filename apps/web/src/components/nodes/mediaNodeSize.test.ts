import { describe, expect, it } from 'vitest';
import {
  constrainMediaNodeResize,
  fitMediaNodeFromWidth,
  measureMediaNodeChrome,
  mediaAspectRatio,
} from './mediaNodeSize';

const chrome = {
  horizontalChrome: 20,
  verticalChrome: 116,
  minWidth: 220,
  minHeight: 180,
  maxWidth: 980,
  maxHeight: 980,
};

describe('single media node sizing', () => {
  it('measures chrome in layout pixels so canvas zoom cannot corrupt persisted height', () => {
    const chromeAtTwelvePercentZoom = measureMediaNodeChrome({
      rootWidth: 220,
      headerHeight: 41,
      bodyScrollHeight: 496,
      mediaWidth: 196,
      mediaHeight: 386,
      borderCompensation: 4,
    });

    expect(chromeAtTwelvePercentZoom).toEqual({ horizontal: 24, vertical: 155 });
    expect(fitMediaNodeFromWidth(220, {
      ...chromeAtTwelvePercentZoom,
      horizontalChrome: chromeAtTwelvePercentZoom.horizontal,
      verticalChrome: chromeAtTwelvePercentZoom.vertical,
      aspectRatio: 941 / 1672,
      minWidth: 220,
      minHeight: 180,
      maxWidth: 980,
      maxHeight: 980,
    }).h).toBeCloseTo(503.4, 0);
  });

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
