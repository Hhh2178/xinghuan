import type { Edge, Node } from '@xyflow/react';

export type CanvasEdgeEmphasis =
  | 'normal'
  | 'muted'
  | 'direct-upstream'
  | 'direct-downstream'
  | 'transitive-upstream'
  | 'transitive-downstream';

export function classifyCanvasEdgeEmphasis(nodes: Node[], edges: Edge[]): Map<string, CanvasEdgeEmphasis> {
  const result = new Map(edges.map((edge) => [edge.id, 'normal' as CanvasEdgeEmphasis]));
  const selected = nodes.filter((node) => node.selected);
  if (selected.length !== 1) return result;

  const selectedId = selected[0].id;
  const incoming = new Map<string, Edge[]>();
  const outgoing = new Map<string, Edge[]>();
  for (const edge of edges) {
    incoming.set(edge.target, [...(incoming.get(edge.target) || []), edge]);
    outgoing.set(edge.source, [...(outgoing.get(edge.source) || []), edge]);
    result.set(edge.id, 'muted');
  }

  for (const edge of incoming.get(selectedId) || []) result.set(edge.id, 'direct-upstream');
  for (const edge of outgoing.get(selectedId) || []) result.set(edge.id, 'direct-downstream');
  markReachableEdges(selectedId, incoming, 'source', result, 'transitive-upstream');
  markReachableEdges(selectedId, outgoing, 'target', result, 'transitive-downstream');
  return result;
}

function markReachableEdges(
  startId: string,
  adjacency: Map<string, Edge[]>,
  nextNodeKey: 'source' | 'target',
  emphasis: Map<string, CanvasEdgeEmphasis>,
  transitiveState: 'transitive-upstream' | 'transitive-downstream',
) {
  const visitedNodes = new Set([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    for (const edge of adjacency.get(nodeId) || []) {
      const current = emphasis.get(edge.id);
      if (current === 'muted') emphasis.set(edge.id, transitiveState);
      const nextNodeId = edge[nextNodeKey];
      if (!visitedNodes.has(nextNodeId)) {
        visitedNodes.add(nextNodeId);
        queue.push(nextNodeId);
      }
    }
  }
}
