import type { Edge, Node } from '@xyflow/react';
import {
  findWorkflowStageOrderConflict,
  reconcileWorkflowStageDefinitions,
  type WorkflowDocument,
  type WorkflowStageDefinition,
  type WorkflowStageNodeAssignment,
  type WorkflowStageOrderConflict,
  type WorkflowStageSource,
} from '@xinghuan/shared';

import { getGroupBoxLiveMemberIds, isGroupBoxNode } from '../canvas/groupBoxGuards';

export interface WorkflowStageProjection {
  stages: WorkflowStageDefinition[];
  sources: WorkflowStageSource[];
  assignments: WorkflowStageNodeAssignment[];
  conflict: WorkflowStageOrderConflict | null;
}

export function buildWorkflowStageProjection(workflow: WorkflowDocument, nodes: Node[], edges: Edge[]): WorkflowStageProjection {
  const workflowMemberIds = new Set(workflow.memberNodeIds);
  const groupNodes = nodes.filter((node) => workflowMemberIds.has(node.id) && isGroupBoxNode(node));
  const stageableNodes = nodes.filter((node) => (
    workflowMemberIds.has(node.id)
    && !isGroupBoxNode(node)
    && node.type !== 'group-execution-manager'
    && node.type !== 'workflow-variable-summary'
  ));
  const membersByGroupId = new Map(groupNodes.map((group) => [group.id, new Set(groupMemberIds(nodes, group).filter((id) => workflowMemberIds.has(id)))]));
  const sourceGroupByNodeId = new Map<string, string | null>();
  for (const node of stageableNodes) {
    const containing = groupNodes.filter((group) => membersByGroupId.get(group.id)?.has(node.id));
    if (containing.length > 1) throw new Error(`WORKFLOW_STAGE_MEMBER_CONFLICT:${node.id}:${containing.map((group) => group.id).join(':')}`);
    sourceGroupByNodeId.set(node.id, containing[0]?.id || null);
  }
  const sources: WorkflowStageSource[] = groupNodes.map((group, index) => ({
    sourceGroupNodeId: group.id,
    name: stageName(group, index),
    memberNodeIds: stageableNodes.filter((node) => sourceGroupByNodeId.get(node.id) === group.id).map((node) => node.id),
  }));
  const ungroupedIds = stageableNodes.filter((node) => sourceGroupByNodeId.get(node.id) === null).map((node) => node.id);
  if (ungroupedIds.length > 0) sources.push({ sourceGroupNodeId: null, name: '未分组阶段', memberNodeIds: ungroupedIds });
  const stages = reconcileWorkflowStageDefinitions(workflow.id, workflow.stages, sources);
  const stageIdBySource = new Map(stages.map((stage) => [stage.sourceGroupNodeId || '__ungrouped__', stage.id]));
  const assignments = stageableNodes.map((node) => ({
    nodeId: node.id,
    stageId: stageIdBySource.get(sourceGroupByNodeId.get(node.id) || '__ungrouped__')!,
  }));
  const scopedEdges = edges
    .filter((edge) => workflowMemberIds.has(edge.source) && workflowMemberIds.has(edge.target))
    .map((edge) => ({ id: edge.id, source: edge.source, target: edge.target }));
  return { stages, sources, assignments, conflict: findWorkflowStageOrderConflict(stages, assignments, scopedEdges) };
}

export function reorderWorkflowStages(
  projection: WorkflowStageProjection,
  draggedStageId: string,
  targetStageId: string,
  edges: Edge[],
): { stages: WorkflowStageDefinition[]; conflict: WorkflowStageOrderConflict | null } {
  const stages = [...projection.stages];
  const from = stages.findIndex((stage) => stage.id === draggedStageId);
  const to = stages.findIndex((stage) => stage.id === targetStageId);
  if (from < 0 || to < 0 || from === to) return { stages, conflict: projection.conflict };
  const [dragged] = stages.splice(from, 1);
  stages.splice(to, 0, dragged);
  const ordered = stages.map((stage, order) => ({ ...stage, order }));
  const conflict = findWorkflowStageOrderConflict(
    ordered,
    projection.assignments,
    edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
  );
  return { stages: ordered, conflict };
}

function groupMemberIds(nodes: Node[], group: Node) {
  const explicit = Array.isArray((group.data as Record<string, unknown> | undefined)?.memberIds)
    ? ((group.data as Record<string, unknown>).memberIds as unknown[]).filter((value): value is string => typeof value === 'string')
    : [];
  return [...new Set([...explicit, ...getGroupBoxLiveMemberIds(nodes, group)])];
}

function stageName(group: Node, index: number) {
  const name = (group.data as Record<string, unknown> | undefined)?.name;
  return typeof name === 'string' && name.trim() ? name.trim().slice(0, 160) : `阶段 ${index + 1}`;
}
