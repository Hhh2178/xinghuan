import { describe, expect, it } from 'vitest';

import { NODE_GROUPS, NODE_REGISTRY, getNodeMeta } from './nodeRegistry';

describe('retired SD2.0 node', () => {
  it('removes SD2.0 from creation groups while preserving legacy canvas metadata', () => {
    expect(NODE_GROUPS.core.nodes.some((node) => node.type === 'seedance')).toBe(false);
    expect(NODE_REGISTRY.find((node) => node.type === 'seedance')?.hidden).toBe(true);
    expect(getNodeMeta('seedance')?.label).toBe('SD2.0');
  });
});
