import type { Edge, Node } from '@xyflow/react';

import { topologicalSort } from '../../utils/topologicalSort';
import { getGroupBoxLiveMemberIds, isGroupBoxNode } from './groupBoxGuards';

export const GROUP_EXECUTION_MANAGER_NODE_TYPE = 'group-execution-manager' as const;
export const DEFAULT_GROUP_FAILURE_RETRY_COUNT = 3;
export const MAX_GROUP_FAILURE_RETRY_COUNT = 10;

export interface GroupExecutionManagerData {
  title: string;
  enabled: boolean;
  executionCount: number;
  failureRetryCount: number;
  groupOrder: string[];
  skippedGroupIds: string[];
  groups?: Array<{
    groupId: string;
    groupName: string;
    skipped: boolean;
  }>;
  note?: string;
}

export interface GroupExecutionGroupBlock {
  groupId: string;
  groupName: string;
  memberIds: string[];
  executableIds: string[];
  skipped: boolean;
  executionCount: number;
}

export interface GroupExecutionPlan {
  managerPresent: boolean;
  managerEnabled: boolean;
  executionCount: number;
  failureRetryCount: number;
  groupBlocks: GroupExecutionGroupBlock[];
  standaloneIds: string[];
}

function uniqueStrings(values: string[]) {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = String(value || '').trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function normalizeExecutionCount(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(1, Math.min(99, Math.floor(numeric)));
}

export function normalizeGroupFailureRetryCount(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_GROUP_FAILURE_RETRY_COUNT;
  return Math.max(0, Math.min(MAX_GROUP_FAILURE_RETRY_COUNT, Math.floor(numeric)));
}

export function normalizeGroupExecutionManagerData(
  data: Partial<GroupExecutionManagerData> | null | undefined,
  groupIds: string[],
): GroupExecutionManagerData {
  const canonicalGroupIds = uniqueStrings(groupIds);
  const incomingOrder = uniqueStrings(Array.isArray(data?.groupOrder) ? data!.groupOrder : []);
  const incomingSkipped = uniqueStrings(Array.isArray(data?.skippedGroupIds) ? data!.skippedGroupIds : []);
  const order = [...incomingOrder.filter((id) => canonicalGroupIds.includes(id))];
  for (const groupId of canonicalGroupIds) {
    if (!order.includes(groupId)) order.push(groupId);
  }
  const skippedGroupIds = incomingSkipped.filter((id) => canonicalGroupIds.includes(id));
  return {
    title: typeof data?.title === 'string' && data.title.trim() ? data.title : '全局组执行管理',
    enabled: data?.enabled !== false,
    executionCount: normalizeExecutionCount(data?.executionCount),
    failureRetryCount: normalizeGroupFailureRetryCount(data?.failureRetryCount),
    groupOrder: order,
    skippedGroupIds,
    note: typeof data?.note === 'string' ? data.note : '',
  };
}

export function findGroupExecutionManagerNode(nodes: Node[]): Node | null {
  return nodes.find((node) => node.type === GROUP_EXECUTION_MANAGER_NODE_TYPE) || null;
}

export function buildGroupExecutionManagerDataFromNodes(
  nodes: Node[],
  managerNode?: Node | null,
): GroupExecutionManagerData {
  const groupIds = nodes.filter(isGroupBoxNode).map((node) => node.id);
  const normalized = normalizeGroupExecutionManagerData((managerNode?.data || {}) as Partial<GroupExecutionManagerData>, groupIds);
  const groups = groupIds
    .map((groupId) => {
      const groupNode = nodes.find((node) => node.id === groupId);
      return groupNode
        ? {
            groupId,
            groupName: typeof (groupNode.data as any)?.name === 'string' && String((groupNode.data as any).name).trim()
              ? String((groupNode.data as any).name)
              : '未命名组',
            skipped: normalized.skippedGroupIds.includes(groupId),
          }
        : null;
    })
    .filter((item): item is { groupId: string; groupName: string; skipped: boolean } => Boolean(item));
  return {
    ...normalized,
    groupOrder: normalized.groupOrder.filter((id) => groupIds.includes(id)),
    skippedGroupIds: normalized.skippedGroupIds.filter((id) => groupIds.includes(id)),
    groups,
  };
}

export function resolveGroupExecutionPlan(
  nodes: Node[],
  edges: Edge[],
  executableNodeTypes: Set<string>,
): GroupExecutionPlan {
  const groupNodes = nodes.filter(isGroupBoxNode);
  const managerNode = nodes.find((node) => node.type === GROUP_EXECUTION_MANAGER_NODE_TYPE);
  const groupIds = groupNodes.map((node) => node.id);
  const managerData = normalizeGroupExecutionManagerData((managerNode?.data || {}) as Partial<GroupExecutionManagerData>, groupIds);
  const groupNodeMap = new Map(groupNodes.map((node) => [node.id, node] as const));
  const memberIdSet = new Set<string>();

  const groupBlocks = managerData.groupOrder
    .map((groupId) => {
      const groupNode = groupNodeMap.get(groupId);
      if (!groupNode) return null;
      const memberIds = getGroupBoxLiveMemberIds(nodes, groupNode).filter((id) => id !== groupId);
      const memberIdLookup = new Set(memberIds);
      memberIds.forEach((id) => memberIdSet.add(id));
      const subNodes = nodes.filter((node) => memberIdLookup.has(node.id));
      const subEdges = edges.filter((edge) => memberIdLookup.has(edge.source) && memberIdLookup.has(edge.target));
      return {
        groupId,
        groupName: typeof (groupNode.data as any)?.name === 'string' && String((groupNode.data as any).name).trim()
          ? String((groupNode.data as any).name)
          : '未命名组',
        memberIds,
        executableIds: topologicalSort(subNodes, subEdges, executableNodeTypes),
        skipped: managerData.skippedGroupIds.includes(groupId),
        executionCount: normalizeExecutionCount((groupNode.data as any)?.executionCount),
      } satisfies GroupExecutionGroupBlock;
    })
    .filter((item): item is GroupExecutionGroupBlock => Boolean(item));

  const standaloneNodes = nodes.filter((node) => {
    if (node.type === GROUP_EXECUTION_MANAGER_NODE_TYPE) return false;
    if (isGroupBoxNode(node)) return false;
    return !memberIdSet.has(node.id);
  });
  const standaloneIds = topologicalSort(
    standaloneNodes,
    edges.filter((edge) => !memberIdSet.has(edge.source) && !memberIdSet.has(edge.target)),
    executableNodeTypes,
  );

  return {
    managerPresent: Boolean(managerNode),
    managerEnabled: managerData.enabled,
    executionCount: managerData.executionCount,
    failureRetryCount: managerData.failureRetryCount,
    groupBlocks,
    standaloneIds,
  };
}

export function resolveManagedExecutionOrder(plan: GroupExecutionPlan): string[] {
  return [
    ...plan.groupBlocks
      .filter((block) => !block.skipped)
      .flatMap((block) => Array.from({ length: block.executionCount }, () => block.executableIds).flat()),
    ...plan.standaloneIds,
  ];
}

export function resolveGlobalExecutionOrder(
  nodes: Node[],
  edges: Edge[],
  executableNodeTypes: Set<string>,
): string[] {
  const plan = resolveGroupExecutionPlan(nodes, edges, executableNodeTypes);
  return resolveManagedExecutionOrder(plan);
}
