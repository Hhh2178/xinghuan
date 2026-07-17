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

interface ReconcileTextSplitGeneratedGraphOptions {
  existingNodes: Node[];
  existingEdges: Edge[];
  generated: TextSplitGeneratedGraph;
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
  const nodeIds = segments.map((_, index) => mode === 'output'
    ? `output-auto-text-split-${sourceNode.id}-${index}`
    : `text-split-manual-${sourceNode.id}-${index}`);
  const existingNodeById = new Map(existingNodes.map((node) => [node.id, node]));
  const nextNodeIds = new Set(nodeIds);
  const newRects = rects.filter((_, index) => !existingNodeById.has(nodeIds[index]));
  const placementNodes = existingNodes.filter((node) => !replaceNodeIds.has(node.id) || nextNodeIds.has(node.id));
  const offset = placeBatchNodes(newRects, placementNodes, {
    excludeIds: new Set([sourceNode.id]),
    source: `placement:text-split-${mode}:${sourceNode.id}`,
  });

  const nodes: Node[] = segments.map((segment, index) => {
    const nodeId = nodeIds[index];
    const existingNode = existingNodeById.get(nodeId);
    return {
      id: nodeId,
      type: mode === 'output' ? 'output' : 'text',
      position: existingNode?.position || { x: rects[index].x + offset.dx, y: rects[index].y + offset.dy },
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

export function reconcileTextSplitGeneratedGraph({
  existingNodes,
  existingEdges,
  generated,
}: ReconcileTextSplitGeneratedGraphOptions): { nodes: Node[]; edges: Edge[] } {
  const generatedNodeById = new Map(generated.nodes.map((node) => [node.id, node]));
  const generatedEdgeById = new Map(generated.edges.map((edge) => [edge.id, edge]));
  const staleNodeIds = new Set(
    [...generated.replaceNodeIds].filter((nodeId) => !generatedNodeById.has(nodeId)),
  );
  const seenNodeIds = new Set<string>();
  const nodes = existingNodes.flatMap((node) => {
    if (staleNodeIds.has(node.id)) return [];
    const replacement = generatedNodeById.get(node.id);
    if (!replacement) return [node];
    seenNodeIds.add(node.id);
    return [{
      ...node,
      type: replacement.type,
      data: { ...(node.data || {}), ...(replacement.data || {}) },
    }];
  });
  for (const node of generated.nodes) {
    if (!seenNodeIds.has(node.id)) nodes.push(node);
  }

  const seenEdgeIds = new Set<string>();
  const edges = existingEdges.flatMap((edge) => {
    if (staleNodeIds.has(edge.source) || staleNodeIds.has(edge.target)) return [];
    const replacement = generatedEdgeById.get(edge.id);
    if (!replacement) return [edge];
    seenEdgeIds.add(edge.id);
    return edge.source === replacement.source && edge.target === replacement.target ? [edge] : [replacement];
  });
  for (const edge of generated.edges) {
    if (!seenEdgeIds.has(edge.id)) edges.push(edge);
  }

  return { nodes, edges };
}
