import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import type { WorkflowDocument } from '@xinghuan/shared';

import { resolveWorkflowConnectionMembership } from './workflowConnectionMembership';

const node = (id: string, type: string, x: number, y: number): Node => ({
  id,
  type,
  position: { x, y },
  measured: { width: 320, height: 240 },
  data: {},
});

const workflow = (memberNodeIds: string[]): WorkflowDocument => ({
  schemaVersion: 1,
  id: 'workflow-1',
  name: 'Workflow 1',
  revision: 1,
  memberNodeIds,
  variables: [],
  inputValues: {},
  bindings: [],
  stages: [],
  region: { x: 0, y: 0, width: 1600, height: 1000, color: '#66706D' },
});

describe('workflow connection membership', () => {
  it('joins an unowned candidate selector that is visibly inside the source workflow before connecting', () => {
    const source = node('image-1', 'image', 120, 120);
    const target = node('selector-1', 'smart-candidate-selector', 640, 160);

    expect(resolveWorkflowConnectionMembership({ source, target, workflows: [workflow([source.id])] })).toEqual({
      kind: 'join',
      workflowId: 'workflow-1',
      joiningNodeId: target.id,
    });
  });

  it('does not join an unowned node that is outside the visible workflow region', () => {
    const source = node('image-1', 'image', 120, 120);
    const target = node('selector-1', 'smart-candidate-selector', 1700, 160);

    expect(resolveWorkflowConnectionMembership({ source, target, workflows: [workflow([source.id])] })).toEqual({ kind: 'blocked' });
  });

  it('keeps connections between existing members direct', () => {
    const source = node('image-1', 'image', 120, 120);
    const target = node('selector-1', 'smart-candidate-selector', 640, 160);

    expect(resolveWorkflowConnectionMembership({ source, target, workflows: [workflow([source.id, target.id])] })).toEqual({ kind: 'direct' });
  });
});
