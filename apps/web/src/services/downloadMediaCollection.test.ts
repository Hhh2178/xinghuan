import { describe, expect, it } from 'vitest';
import { uniqueDownloadUrls } from './downloadMediaCollection';

describe('uniqueDownloadUrls', () => {
  it('trims empty values and de-duplicates repeated output media', () => {
    expect(uniqueDownloadUrls([' /files/output/a.png ', '', '/files/output/a.png', '/files/output/b.png']))
      .toEqual(['/files/output/a.png', '/files/output/b.png']);
  });
});
