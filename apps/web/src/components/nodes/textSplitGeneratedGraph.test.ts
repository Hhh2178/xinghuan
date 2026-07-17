import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';

import {
  buildTextSplitGeneratedGraph,
  reconcileTextSplitGeneratedGraph,
} from './textSplitGeneratedGraph';

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

  it('preserves reused output positions, downstream edges, and topology order on rerun', () => {
    const first = buildTextSplitGeneratedGraph({
      sourceNode,
      segments: ['first', 'second'],
      mode: 'output',
      existingNodes: [sourceNode],
    });
    const movedOutputs = first.nodes.map((node, index) => ({
      ...node,
      position: { x: 1200, y: 300 + index * 420 },
      data: { ...node.data, customLabel: `output ${index + 1}` },
    }));
    const downstreamNodes: Node[] = [
      { id: 'image-1', type: 'image', position: { x: 1800, y: 300 }, data: {} },
      { id: 'video-1', type: 'video', position: { x: 1800, y: 720 }, data: {} },
    ];
    const downstreamEdges: Edge[] = [
      { id: 'output-0-image', source: movedOutputs[0].id, target: 'image-1' },
      { id: 'output-1-video', source: movedOutputs[1].id, target: 'video-1' },
    ];
    const existingNodes = [sourceNode, movedOutputs[0], downstreamNodes[0], movedOutputs[1], downstreamNodes[1]];
    const existingEdges = [...first.edges, ...downstreamEdges];

    const generated = buildTextSplitGeneratedGraph({
      sourceNode,
      segments: ['updated first', 'updated second'],
      mode: 'output',
      existingNodes,
    });
    const result = reconcileTextSplitGeneratedGraph({ existingNodes, existingEdges, generated });

    expect(result.nodes.map((node) => node.id)).toEqual(existingNodes.map((node) => node.id));
    expect(result.nodes.filter((node) => node.type === 'output').map((node) => node.position)).toEqual([
      { x: 1200, y: 300 },
      { x: 1200, y: 720 },
    ]);
    expect(result.nodes.filter((node) => node.type === 'output').map((node) => (node.data as any).directOutputText)).toEqual([
      'updated first',
      'updated second',
    ]);
    expect(result.nodes.filter((node) => node.type === 'output').map((node) => (node.data as any).customLabel)).toEqual([
      'output 1',
      'output 2',
    ]);
    expect(result.edges).toEqual(existingEdges);
  });

  it('only appends new outputs when the segment count grows', () => {
    const first = buildTextSplitGeneratedGraph({
      sourceNode,
      segments: ['first', 'second'],
      mode: 'output',
      existingNodes: [sourceNode],
    });
    const downstreamNode: Node = { id: 'image-1', type: 'image', position: { x: 1800, y: 300 }, data: {} };
    const downstreamEdge: Edge = { id: 'output-0-image', source: first.nodes[0].id, target: downstreamNode.id };
    const existingNodes = [sourceNode, ...first.nodes, downstreamNode];
    const existingEdges = [...first.edges, downstreamEdge];

    const generated = buildTextSplitGeneratedGraph({
      sourceNode,
      segments: ['first', 'second', 'third'],
      mode: 'output',
      existingNodes,
    });
    const result = reconcileTextSplitGeneratedGraph({ existingNodes, existingEdges, generated });

    expect(result.nodes.slice(0, existingNodes.length).map((node) => node.id)).toEqual(existingNodes.map((node) => node.id));
    expect(result.nodes.at(-1)?.id).toBe(`output-auto-text-split-${sourceNode.id}-2`);
    expect(result.edges).toContainEqual(downstreamEdge);
  });

  it('only removes surplus outputs and their edges when the segment count shrinks', () => {
    const first = buildTextSplitGeneratedGraph({
      sourceNode,
      segments: ['first', 'second', 'third'],
      mode: 'output',
      existingNodes: [sourceNode],
    });
    const downstreamNodes: Node[] = first.nodes.map((_, index) => ({
      id: `consumer-${index}`,
      type: 'image',
      position: { x: 1800, y: index * 400 },
      data: {},
    }));
    const downstreamEdges: Edge[] = first.nodes.map((node, index) => ({
      id: `output-${index}-consumer`,
      source: node.id,
      target: downstreamNodes[index].id,
    }));
    const existingNodes = [sourceNode, ...first.nodes, ...downstreamNodes];
    const existingEdges = [...first.edges, ...downstreamEdges];

    const generated = buildTextSplitGeneratedGraph({
      sourceNode,
      segments: ['first', 'second'],
      mode: 'output',
      existingNodes,
    });
    const result = reconcileTextSplitGeneratedGraph({ existingNodes, existingEdges, generated });

    expect(result.nodes.some((node) => node.id === first.nodes[2].id)).toBe(false);
    expect(result.nodes.some((node) => node.id === downstreamNodes[2].id)).toBe(true);
    expect(result.edges).toContainEqual(downstreamEdges[0]);
    expect(result.edges).toContainEqual(downstreamEdges[1]);
    expect(result.edges.some((edge) => edge.source === first.nodes[2].id || edge.target === first.nodes[2].id)).toBe(false);
  });

  it('preserves manual text nodes and their downstream topology on rerun', () => {
    const first = buildTextSplitGeneratedGraph({
      sourceNode,
      segments: ['first'],
      mode: 'text',
      existingNodes: [sourceNode],
    });
    const textNode = { ...first.nodes[0], position: { x: 1200, y: 360 } };
    const consumer: Node = { id: 'consumer-1', type: 'image', position: { x: 1800, y: 360 }, data: {} };
    const downstreamEdge: Edge = { id: 'text-consumer', source: textNode.id, target: consumer.id };
    const existingNodes = [sourceNode, textNode, consumer];

    const generated = buildTextSplitGeneratedGraph({
      sourceNode,
      segments: ['updated'],
      mode: 'text',
      existingNodes,
    });
    const result = reconcileTextSplitGeneratedGraph({ existingNodes, existingEdges: [downstreamEdge], generated });

    expect(result.nodes.map((node) => node.id)).toEqual(existingNodes.map((node) => node.id));
    expect(result.nodes[1]).toMatchObject({ position: { x: 1200, y: 360 }, data: { prompt: 'updated' } });
    expect(result.edges).toEqual([downstreamEdge]);
  });
});
