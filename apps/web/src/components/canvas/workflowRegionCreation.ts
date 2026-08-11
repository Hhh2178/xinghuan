import type { Node } from '@xyflow/react';
import {
  assertWorkflowRegionLayout,
  type WorkflowDocument,
  type WorkflowRegionVisual,
} from '@xinghuan/shared';

import { rectOf } from '../../utils/nodePlacement';
import { getGroupBoxLiveMemberIds } from './groupBoxGuards';

export type WorkflowRegionCreationResult =
  | { ok: true; workflow: WorkflowDocument }
  | { ok: false; code: 'EMPTY_SELECTION' | 'MEMBER_CONFLICT' | 'REGION_OVERLAP'; workflowName?: string };

export function buildWorkflowRegionFromSelection(input: {
  nodes: Node[];
  selectedIds: readonly string[];
  workflows: WorkflowDocument[];
  color: string;
  newId: () => string;
}): WorkflowRegionCreationResult {
  const selectedIds = new Set(input.selectedIds);
  const expandedIds = new Set<string>();
  for (const node of input.nodes) {
    if (selectedIds.has(node.id) && node.type !== 'bulkPhantom') expandedIds.add(node.id);
  }
  for (const group of input.nodes.filter((node) => node.type === 'groupBox')) {
    const liveMembers = getGroupBoxLiveMemberIds(input.nodes, group);
    if (selectedIds.has(group.id) || liveMembers.some((nodeId) => selectedIds.has(nodeId))) {
      expandedIds.add(group.id);
      liveMembers.forEach((nodeId) => expandedIds.add(nodeId));
    }
  }
  if (expandedIds.size === 0) return { ok: false, code: 'EMPTY_SELECTION' };
  const existingOwner = input.workflows.find((workflow) => workflow.memberNodeIds.some((nodeId) => expandedIds.has(nodeId)));
  if (existingOwner) return { ok: false, code: 'MEMBER_CONFLICT', workflowName: existingOwner.name };

  const memberNodes = input.nodes.filter((node) => expandedIds.has(node.id));
  const region = workflowRegionAroundNodes(memberNodes, input.color);
  if (!region) return { ok: false, code: 'EMPTY_SELECTION' };
  const workflow: WorkflowDocument = {
    schemaVersion: 1,
    id: input.newId(),
    name: `工作流 ${input.workflows.length + 1}`,
    revision: 1,
    memberNodeIds: [...expandedIds],
    variables: [],
    inputValues: {},
    bindings: [],
    stages: [],
    region,
  };
  try {
    assertWorkflowRegionLayout([...input.workflows, workflow]);
    return { ok: true, workflow };
  } catch {
    return { ok: false, code: 'REGION_OVERLAP' };
  }
}

export function workflowRegionAroundNodes(nodes: readonly Node[], color: string): WorkflowRegionVisual | null {
  if (nodes.length === 0) return null;
  const rects = nodes.map((node) => rectOf(node));
  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.w));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.h));
  return {
    x: minX - 48,
    y: minY - 72,
    width: Math.max(320, maxX - minX + 96),
    height: Math.max(220, maxY - minY + 120),
    color: color.toUpperCase(),
  };
}

export function dissolveWorkflowRegion(workflows: WorkflowDocument[], workflowId: string): WorkflowDocument[] {
  const next = workflows.filter((workflow) => workflow.id !== workflowId);
  return next.length === workflows.length ? workflows : next;
}

export function expandWorkflowRegionToIncludeNodes(
  region: WorkflowRegionVisual,
  nodes: readonly Node[],
): WorkflowRegionVisual {
  const memberBounds = workflowRegionAroundNodes(nodes, region.color);
  if (!memberBounds) return region;
  const minX = Math.min(region.x, memberBounds.x);
  const minY = Math.min(region.y, memberBounds.y);
  const maxX = Math.max(region.x + region.width, memberBounds.x + memberBounds.width);
  const maxY = Math.max(region.y + region.height, memberBounds.y + memberBounds.height);
  return {
    ...region,
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
