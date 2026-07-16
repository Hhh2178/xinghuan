import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';

import { buildTextSplitGeneratedGraph } from './textSplitGeneratedGraph';

const sourceNode: Node = {
  id: 'split-1',
  type: 'text-split',
  position: { x: 100, y: 200 },
  measured: { width: 760, height: 520 },
  data: {},
};

describe('buildTextSplitGeneratedGraph', () => {
  it('builds ordered output material nodes and source edges for the default run', () => {
    const result = buildTextSplitGeneratedGraph({
      sourceNode,
      segments: ['第一段', '第二段'],
      mode: 'output',
      existingNodes: [sourceNode],
    });

    expect(result.nodes.map((node) => node.type)).toEqual(['output', 'output']);
    expect(result.nodes.map((node) => (node.data as any).directOutputText)).toEqual(['第一段', '第二段']);
    expect(result.nodes.map((node) => (node.data as any).ignoreUpstreamMaterials)).toEqual([true, true]);
    expect(result.nodes.map((node) => (node.data as any).textSplitIndex)).toEqual([0, 1]);
    expect(result.edges.map((edge) => [edge.source, edge.target])).toEqual([
      ['split-1', result.nodes[0].id],
      ['split-1', result.nodes[1].id],
    ]);
  });

  it('keeps explicit text scattering as a separate text-node path', () => {
    const result = buildTextSplitGeneratedGraph({
      sourceNode,
      segments: ['第一段', '第二段'],
      mode: 'text',
      existingNodes: [sourceNode],
    });

    expect(result.nodes.map((node) => node.type)).toEqual(['text', 'text']);
    expect(result.nodes.map((node) => (node.data as any).prompt)).toEqual(['第一段', '第二段']);
    expect(result.edges).toEqual([]);
  });
});
