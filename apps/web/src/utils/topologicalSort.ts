import type { Node, Edge } from '@xyflow/react';

/**
 * 在仅包含 executableTypes 的节点子图上做 Kahn 拓扑排序。
 * 仅保留两端都是可执行节点的边作为依赖关系。
 * 若存在环或孤岛,环节点会按照稳定顺序追加到末尾(尽力而为)。
 */
export function topologicalSort(
  nodes: Node[],
  edges: Edge[],
  executableTypes: Set<string>
): string[] {
  const exeNodes = nodes.filter((n) => n.type && executableTypes.has(n.type));
  const stableOrderedNodes = [...exeNodes].sort((a, b) => {
    const ax = Number.isFinite(a.position?.x) ? a.position.x : 0;
    const bx = Number.isFinite(b.position?.x) ? b.position.x : 0;
    if (ax !== bx) return ax - bx;
    const ay = Number.isFinite(a.position?.y) ? a.position.y : 0;
    const by = Number.isFinite(b.position?.y) ? b.position.y : 0;
    if (ay !== by) return ay - by;
    return a.id.localeCompare(b.id);
  });
  const exeIds = new Set(exeNodes.map((n) => n.id));
  const stableRank = new Map(stableOrderedNodes.map((node, index) => [node.id, index] as const));

  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  exeIds.forEach((id) => {
    inDegree.set(id, 0);
    adj.set(id, []);
  });

  for (const e of edges) {
    if (exeIds.has(e.source) && exeIds.has(e.target) && e.source !== e.target) {
      adj.get(e.source)!.push(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    }
  }

  const enqueueSorted = (queue: string[], id: string) => {
    queue.push(id);
    queue.sort((left, right) => (stableRank.get(left) || 0) - (stableRank.get(right) || 0));
  };

  // 用稳定视觉顺序作为入队 tie-breaker,保证多下游分支每轮顺序一致
  const queue: string[] = [];
  for (const n of stableOrderedNodes) {
    if ((inDegree.get(n.id) || 0) === 0) queue.push(n.id);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(id);
    for (const next of adj.get(id) || []) {
      const d = (inDegree.get(next) || 0) - 1;
      inDegree.set(next, d);
      if (d === 0) enqueueSorted(queue, next);
    }
  }

  if (result.length < exeIds.size) {
    // 环或异常,把剩下未排序的按稳定顺序补上
    const got = new Set(result);
    for (const n of stableOrderedNodes) {
      if (!got.has(n.id)) result.push(n.id);
    }
  }

  return result;
}
