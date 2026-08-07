import type { Node, Edge } from '@xyflow/react';

import { buildTopologicalLayers } from '../components/canvas/groupExecutionPlan';

/**
 * 在仅包含 executableTypes 的节点子图上做 Kahn 拓扑排序。
 * 仅保留两端都是可执行节点的边作为依赖关系。
 * 非法拓扑直接拒绝，不能把环节点按视觉顺序补到末尾继续执行。
 */
export function topologicalSort(
  nodes: Node[],
  edges: Edge[],
  executableTypes: Set<string>
): string[] {
  const result = buildTopologicalLayers(nodes, edges, executableTypes);
  if (!result.ok) {
    const first = result.errors[0];
    throw new Error(`INVALID_TOPOLOGY:${first.code}:${first.nodeIds.join(',')}`);
  }
  return result.order;
}
