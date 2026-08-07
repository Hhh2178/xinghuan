import type { Edge, Node } from '@xyflow/react';

export type TopologicalPlanError =
  | { code: 'SELF_EDGE'; nodeIds: string[] }
  | { code: 'CYCLE'; nodeIds: string[] };

export type GroupExecutionPlanError = TopologicalPlanError
  | { code: 'DUPLICATE_MEMBERSHIP'; nodeIds: string[]; groupIds: string[] }
  | { code: 'EXTERNAL_EXECUTABLE_DEPENDENCY'; nodeIds: string[] };

export interface TopologicalLayerPlan {
  layers: string[][];
  order: string[];
  dependencies: Record<string, string[]>;
  dependents: Record<string, string[]>;
  descendants: Record<string, string[]>;
}

export type TopologicalLayerResult =
  | ({ ok: true } & TopologicalLayerPlan)
  | { ok: false; errors: TopologicalPlanError[] };

export interface GroupExecutionPlan extends TopologicalLayerPlan {
  groupId: string;
  groupName: string;
  memberIds: string[];
  executableIds: string[];
  externalDependencies: Array<{ sourceId: string; targetId: string }>;
}

export type GroupExecutionPlanResult =
  | { ok: true; plan: GroupExecutionPlan }
  | { ok: false; errors: GroupExecutionPlanError[] };

export interface GroupExecutionPlanInput {
  groupId: string;
  groupName: string;
  memberIds: string[];
  groupMemberships: Array<{ groupId: string; memberIds: string[] }>;
  nodes: Node[];
  edges: Edge[];
  executableNodeTypes: Set<string>;
  boundaryReadyNodeIds: Set<string>;
}

function stableNodeOrder(nodes: Node[]) {
  return [...nodes].sort((left, right) => {
    const leftX = Number.isFinite(left.position?.x) ? left.position.x : 0;
    const rightX = Number.isFinite(right.position?.x) ? right.position.x : 0;
    if (leftX !== rightX) return leftX - rightX;
    const leftY = Number.isFinite(left.position?.y) ? left.position.y : 0;
    const rightY = Number.isFinite(right.position?.y) ? right.position.y : 0;
    if (leftY !== rightY) return leftY - rightY;
    return left.id.localeCompare(right.id);
  });
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)));
}

export function buildTopologicalLayers(
  nodes: Node[],
  edges: Edge[],
  executableNodeTypes: Set<string>,
): TopologicalLayerResult {
  const executableNodes = stableNodeOrder(nodes.filter((node) => node.type && executableNodeTypes.has(node.type)));
  const executableIds = new Set(executableNodes.map((node) => node.id));
  const rank = new Map(executableNodes.map((node, index) => [node.id, index] as const));
  const dependencies = Object.fromEntries(executableNodes.map((node) => [node.id, [] as string[]]));
  const dependents = Object.fromEntries(executableNodes.map((node) => [node.id, [] as string[]]));
  const selfEdgeIds = new Set<string>();
  const seenEdges = new Set<string>();

  for (const edge of edges) {
    if (!executableIds.has(edge.source) || !executableIds.has(edge.target)) continue;
    if (edge.source === edge.target) {
      selfEdgeIds.add(edge.source);
      continue;
    }
    const key = `${edge.source}\u0000${edge.target}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    dependencies[edge.target].push(edge.source);
    dependents[edge.source].push(edge.target);
  }

  const byRank = (left: string, right: string) => (rank.get(left) ?? 0) - (rank.get(right) ?? 0);
  for (const ids of Object.values(dependencies)) ids.sort(byRank);
  for (const ids of Object.values(dependents)) ids.sort(byRank);

  if (selfEdgeIds.size > 0) {
    return {
      ok: false,
      errors: [{ code: 'SELF_EDGE', nodeIds: [...selfEdgeIds].sort(byRank) }],
    };
  }

  const remainingDependencies = new Map(
    executableNodes.map((node) => [node.id, dependencies[node.id].length] as const),
  );
  let ready = executableNodes.filter((node) => dependencies[node.id].length === 0).map((node) => node.id);
  const layers: string[][] = [];
  const order: string[] = [];

  while (ready.length > 0) {
    const layer = [...ready].sort(byRank);
    layers.push(layer);
    order.push(...layer);
    const nextReady = new Set<string>();
    for (const nodeId of layer) {
      for (const dependentId of dependents[nodeId]) {
        const remaining = (remainingDependencies.get(dependentId) || 0) - 1;
        remainingDependencies.set(dependentId, remaining);
        if (remaining === 0) nextReady.add(dependentId);
      }
    }
    ready = [...nextReady].sort(byRank);
  }

  if (order.length !== executableNodes.length) {
    const completed = new Set(order);
    return {
      ok: false,
      errors: [{
        code: 'CYCLE',
        nodeIds: executableNodes.filter((node) => !completed.has(node.id)).map((node) => node.id),
      }],
    };
  }

  const descendants = Object.fromEntries(executableNodes.map((node) => {
    const visited = new Set<string>();
    const queue = [...dependents[node.id]];
    while (queue.length > 0) {
      const descendantId = queue.shift()!;
      if (visited.has(descendantId)) continue;
      visited.add(descendantId);
      queue.push(...dependents[descendantId]);
    }
    return [node.id, [...visited].sort(byRank)];
  }));

  return { ok: true, layers, order, dependencies, dependents, descendants };
}

export function buildGroupExecutionPlan(input: GroupExecutionPlanInput): GroupExecutionPlanResult {
  const membershipByNode = new Map<string, string[]>();
  for (const membership of input.groupMemberships) {
    for (const nodeId of uniqueIds(membership.memberIds)) {
      const groupIds = membershipByNode.get(nodeId) || [];
      if (!groupIds.includes(membership.groupId)) groupIds.push(membership.groupId);
      membershipByNode.set(nodeId, groupIds);
    }
  }

  const duplicateEntries = [...membershipByNode.entries()]
    .filter(([, groupIds]) => groupIds.length > 1)
    .sort(([left], [right]) => left.localeCompare(right));
  if (duplicateEntries.length > 0) {
    const groupIds = uniqueIds(duplicateEntries.flatMap(([, ids]) => ids));
    return {
      ok: false,
      errors: [{
        code: 'DUPLICATE_MEMBERSHIP',
        nodeIds: duplicateEntries.map(([nodeId]) => nodeId),
        groupIds,
      }],
    };
  }

  const nodeById = new Map(input.nodes.map((node) => [node.id, node] as const));
  const memberIds = uniqueIds(input.memberIds).filter((nodeId) => nodeById.has(nodeId));
  const memberIdSet = new Set(memberIds);
  const executableIds = memberIds.filter((nodeId) => {
    const node = nodeById.get(nodeId);
    return Boolean(node?.type && input.executableNodeTypes.has(node.type));
  });
  const executableIdSet = new Set(executableIds);
  const externalDependencies = input.edges
    .filter((edge) => executableIdSet.has(edge.target) && !memberIdSet.has(edge.source))
    .map((edge) => ({ sourceId: edge.source, targetId: edge.target }))
    .filter((edge, index, values) => values.findIndex((candidate) => (
      candidate.sourceId === edge.sourceId && candidate.targetId === edge.targetId
    )) === index)
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId) || left.targetId.localeCompare(right.targetId));

  const missingExternal = externalDependencies.find((dependency) => {
    const source = nodeById.get(dependency.sourceId);
    return Boolean(source?.type && input.executableNodeTypes.has(source.type))
      && !input.boundaryReadyNodeIds.has(dependency.sourceId);
  });
  if (missingExternal) {
    return {
      ok: false,
      errors: [{
        code: 'EXTERNAL_EXECUTABLE_DEPENDENCY',
        nodeIds: [missingExternal.sourceId, missingExternal.targetId],
      }],
    };
  }

  const subNodes = input.nodes.filter((node) => memberIdSet.has(node.id));
  const subEdges = input.edges.filter((edge) => memberIdSet.has(edge.source) && memberIdSet.has(edge.target));
  const topology = buildTopologicalLayers(subNodes, subEdges, input.executableNodeTypes);
  if (!topology.ok) return topology;

  return {
    ok: true,
    plan: {
      groupId: input.groupId,
      groupName: input.groupName,
      memberIds,
      executableIds,
      externalDependencies,
      layers: topology.layers,
      order: topology.order,
      dependencies: topology.dependencies,
      dependents: topology.dependents,
      descendants: topology.descendants,
    },
  };
}
