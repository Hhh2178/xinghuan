import type { Edge, Node } from '@xyflow/react';

import { defaultSizeOf, placeBatchNodes, type Rect as PlacementRect } from '../../utils/nodePlacement';

export type TextSplitGeneratedMode = 'output' | 'text';

export const TEXT_SPLIT_RUN_MARKER = 'text-split-run';
export const TEXT_SPLIT_MANUAL_SCATTER_MARKER = 'text-split-manual-scatter';

const REPLACEABLE_MARKERS = new Set([
  TEXT_SPLIT_RUN_MARKER,
  TEXT_SPLIT_MANUAL_SCATTER_MARKER,
  'text-split-loop-scatter',
]);

interface BuildTextSplitGeneratedGraphOptions {
  sourceNode: Node;
  segments: string[];
  mode: TextSplitGeneratedMode;
  existingNodes: Node[];
}

interface TextSplitGeneratedGraph {
  nodes: Node[];
  edges: Edge[];
  replaceNodeIds: Set<string>;
}

export function buildTextSplitGeneratedGraph({
  sourceNode,
  segments,
  mode,
  existingNodes,
}: BuildTextSplitGeneratedGraphOptions): TextSplitGeneratedGraph {
  const marker = mode === 'output' ? TEXT_SPLIT_RUN_MARKER : TEXT_SPLIT_MANUAL_SCATTER_MARKER;
  const replaceNodeIds = new Set(
    existingNodes
      .filter((node) => {
        const data = (node.data as any) || {};
        return data.sourceTextSplitId === sourceNode.id && REPLACEABLE_MARKERS.has(data.autoCreatedBy);
      })
      .map((node) => node.id),
  );
  const size = defaultSizeOf(mode === 'output' ? 'output' : 'text');
  const baseX = sourceNode.position.x + (sourceNode.measured?.width || 500) + 80;
  const baseY = sourceNode.position.y;
  const rects: PlacementRect[] = segments.map((_, index) => ({
    x: mode === 'output' ? baseX : baseX + (index % 2) * (size.w + 36),
    y: mode === 'output' ? baseY + index * (size.h + 36) : baseY + Math.floor(index / 2) * (size.h + 36),
    w: size.w,
    h: size.h,
  }));
  const placementNodes = existingNodes.filter((node) => !replaceNodeIds.has(node.id));
  const offset = placeBatchNodes(rects, placementNodes, {
    excludeIds: new Set([sourceNode.id]),
    source: `placement:text-split-${mode}:${sourceNode.id}`,
  });

  const nodes: Node[] = segments.map((segment, index) => {
    const nodeId = mode === 'output'
      ? `output-auto-text-split-${sourceNode.id}-${index}`
      : `text-split-manual-${sourceNode.id}-${index}`;
    return {
      id: nodeId,
      type: mode === 'output' ? 'output' : 'text',
      position: { x: rects[index].x + offset.dx, y: rects[index].y + offset.dy },
      data: {
        ...(mode === 'output'
          ? { directOutputText: segment, outputText: '', ignoreUpstreamMaterials: true }
          : { prompt: segment }),
        autoCreatedBy: marker,
        sourceTextSplitId: sourceNode.id,
        textSplitIndex: index,
      },
      selected: false,
    };
  });
  const edges: Edge[] = mode === 'output'
    ? nodes.map((node, index) => ({
      id: `edge-text-split-output-${sourceNode.id}-${index}`,
      source: sourceNode.id,
      target: node.id,
      type: 'deletable',
      data: { autoCreatedBy: marker, sourceTextSplitId: sourceNode.id, textSplitIndex: index },
    }))
    : [];

  return { nodes, edges, replaceNodeIds };
}
