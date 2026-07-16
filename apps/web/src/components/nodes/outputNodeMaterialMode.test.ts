import { describe, expect, it } from 'vitest';

import { shouldCollectOutputNodeUpstream } from './outputNodeMaterialMode';

describe('shouldCollectOutputNodeUpstream', () => {
  it('keeps normal output nodes connected to upstream materials', () => {
    expect(shouldCollectOutputNodeUpstream({})).toBe(true);
  });

  it('lets generated text-split outputs display only their assigned segment', () => {
    expect(shouldCollectOutputNodeUpstream({ ignoreUpstreamMaterials: true })).toBe(false);
  });
});
