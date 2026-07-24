import { describe, expect, it } from 'vitest';

import { NODE_GROUPS, NODE_REGISTRY, getNodeMeta } from './nodeRegistry';

describe('retired SD2.0 node', () => {
  it('removes SD2.0 from creation groups while preserving legacy canvas metadata', () => {
    expect(NODE_GROUPS.core.nodes.some((node) => node.type === 'seedance')).toBe(false);
    expect(NODE_REGISTRY.find((node) => node.type === 'seedance')?.hidden).toBe(true);
    expect(getNodeMeta('seedance')?.label).toBe('SD2.0');
  });
});

describe('canvas node catalog presentation', () => {
  it('keeps legacy nodes readable while removing retired creation entries', () => {
    expect(NODE_GROUPS.auxiliary.nodes.some((node) => node.type === 'remove-ai-watermark')).toBe(false);
    expect(getNodeMeta('remove-ai-watermark')?.hidden).toBe(true);
  });

  it('splits workflow, logic, and tool creation entries with uniform group colors', () => {
    expect(getNodeMeta('idea')?.label).toBe('灵感笔记');
    expect(NODE_GROUPS.workflow.nodes.every((node) => node.color === 'teal')).toBe(true);
    expect(NODE_GROUPS.logic.nodes.every((node) => node.color === 'sky')).toBe(true);
    expect(NODE_GROUPS.tool.nodes.every((node) => node.color === 'orange')).toBe(true);
    expect(NODE_GROUPS.workflow.nodes.some((node) => node.type === 'canvas-agent')).toBe(false);
    expect(getNodeMeta('canvas-agent')?.hidden).toBe(true);
  });
});
