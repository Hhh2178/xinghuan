import type { Node } from '@xyflow/react';
import {
  isWorkflowBoundaryConnectionAllowed,
  type WorkflowDocument,
} from '@xinghuan/shared';

export type WorkflowConnectionMembershipResolution =
  | { kind: 'direct' }
  | { kind: 'join'; workflowId: string; joiningNodeId: string }
  | { kind: 'blocked' };

export function resolveWorkflowConnectionMembership(input: {
  source: Node;
  target: Node;
  workflows: readonly WorkflowDocument[];
}): WorkflowConnectionMembershipResolution {
  const sourceWorkflow = workflowForNode(input.workflows, input.source.id);
  const targetWorkflow = workflowForNode(input.workflows, input.target.id);
  if (isAllowed(input.source, input.target, sourceWorkflow?.id || null, targetWorkflow?.id || null)) {
    return { kind: 'direct' };
  }

  if (sourceWorkflow && !targetWorkflow && isFullyInside(input.target, sourceWorkflow) && isAllowed(input.source, input.target, sourceWorkflow.id, sourceWorkflow.id)) {
    return { kind: 'join', workflowId: sourceWorkflow.id, joiningNodeId: input.target.id };
  }
  if (targetWorkflow && !sourceWorkflow && isFullyInside(input.source, targetWorkflow) && isAllowed(input.source, input.target, targetWorkflow.id, targetWorkflow.id)) {
    return { kind: 'join', workflowId: targetWorkflow.id, joiningNodeId: input.source.id };
  }
  return { kind: 'blocked' };
}

function workflowForNode(workflows: readonly WorkflowDocument[], nodeId: string) {
  return workflows.find((workflow) => workflow.memberNodeIds.includes(nodeId));
}

function isAllowed(source: Node, target: Node, sourceWorkflowId: string | null, targetWorkflowId: string | null) {
  return isWorkflowBoundaryConnectionAllowed({
    sourceWorkflowId,
    targetWorkflowId,
    sourceNodeType: source.type || '',
    targetNodeType: target.type || '',
  });
}

function isFullyInside(node: Node, workflow: WorkflowDocument) {
  const width = node.measured?.width ?? node.width;
  const height = node.measured?.height ?? node.height;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width! <= 0 || height! <= 0) return false;
  const right = node.position.x + width!;
  const bottom = node.position.y + height!;
  const regionRight = workflow.region.x + workflow.region.width;
  const regionBottom = workflow.region.y + workflow.region.height;
  return node.position.x >= workflow.region.x
    && node.position.y >= workflow.region.y
    && right <= regionRight
    && bottom <= regionBottom;
}
