import type { Node, NodeChange } from '@xyflow/react';

import type { GroupBoxData } from '../nodes/GroupBoxNode';

export const CANVAS_MIN_ZOOM = 0.025;
export const CANVAS_MAX_ZOOM = 1.15;

export function isGroupBoxNode(node: Node | null | undefined): boolean {
  return node?.type === 'groupBox';
}

export function isGroupBoxLocked(data: Partial<GroupBoxData> | null | undefined): boolean {
  return data?.locked !== false;
}

export function getGroupBoxSize(node: Node, fallback = { width: 0, height: 0 }) {
  const data = (node.data || {}) as Partial<GroupBoxData>;
  return {
    width: data.width || (node as any).width || (node as any).measured?.width || fallback.width,
    height: data.height || (node as any).height || (node as any).measured?.height || fallback.height,
  };
}

export function getGroupBoxLiveMemberIds(nodes: Node[], groupNode: Node): string[] {
  const { width, height } = getGroupBoxSize(groupNode);
  const gx = groupNode.position.x;
  const gy = groupNode.position.y;
  const liveMembers: string[] = [];
  for (const node of nodes) {
    if (node.id === groupNode.id) continue;
    if (isGroupBoxNode(node)) continue;
    const nodeWidth = (node as any).width || (node as any).measured?.width || 200;
    const nodeHeight = (node as any).height || (node as any).measured?.height || 100;
    const centerX = node.position.x + nodeWidth / 2;
    const centerY = node.position.y + nodeHeight / 2;
    if (centerX >= gx && centerX <= gx + width && centerY >= gy && centerY <= gy + height) {
      liveMembers.push(node.id);
    }
  }
  return liveMembers;
}

export function findLockedGroupForNode(nodes: Node[], nodeId: string): Node | null {
  for (const node of nodes) {
    if (!isGroupBoxNode(node)) continue;
    if (!isGroupBoxLocked((node.data || {}) as Partial<GroupBoxData>)) continue;
    const memberIds = getGroupBoxLiveMemberIds(nodes, node);
    if (memberIds.includes(nodeId)) {
      return node;
    }
  }
  return null;
}

export function filterLockedNodePositionChanges(
  changes: NodeChange[],
  lockedNodeId: string | null | undefined,
): NodeChange[] {
  if (!lockedNodeId) return changes;
  return changes.filter((change) => !(change.type === 'position' && (change as any).id === lockedNodeId));
}
