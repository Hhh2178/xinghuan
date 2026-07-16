import { describe, expect, it } from 'vitest';

import { compareSemanticVersions } from './authority-state-version.mjs';

describe('compareSemanticVersions', () => {
  it('allows a deployed environment to trail the product candidate', () => {
    expect(compareSemanticVersions('0.6.13', '0.7.0')).toBeLessThan(0);
  });

  it('recognizes equal versions with an optional v prefix', () => {
    expect(compareSemanticVersions('v0.7.0', '0.7.0')).toBe(0);
  });

  it('detects an environment version that is ahead of the candidate', () => {
    expect(compareSemanticVersions('0.7.1', '0.7.0')).toBeGreaterThan(0);
  });

  it('orders prerelease versions below their stable release', () => {
    expect(compareSemanticVersions('0.7.0-rc.1', '0.7.0')).toBeLessThan(0);
  });
});
