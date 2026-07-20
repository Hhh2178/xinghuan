import { describe, expect, it } from 'vitest';
import { appendGeneratedVideoUrls } from './videoGenerationAccumulation';

describe('appendGeneratedVideoUrls', () => {
  it('appends later batches without replacing earlier outputs', () => {
    expect(appendGeneratedVideoUrls(
      ['/files/output/first.mp4'],
      ['/files/output/second.mp4', '/files/output/first.mp4'],
    )).toEqual(['/files/output/first.mp4', '/files/output/second.mp4']);
  });
});
