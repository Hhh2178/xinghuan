import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';

import {
  buildWorkflowRegionFromSelection,
  dissolveWorkflowRegion,
  expandWorkflowRegionToIncludeNodes,
  workflowRegionAroundNodes,
} from './workflowRegionCreation';

describe('workflow region creation', () => {
  it('expands a selected group member to the complete explicit node group', () => {
    const nodes = [
      { id: 'group-1', type: 'groupBox', position: { x: 0, y: 0 }, data: { width: 500, height: 300, memberIds: ['node-a', 'node-b'] } },
      { id: 'node-a', type: 'text', position: { x: 50, y: 80 }, width: 120, height: 80, data: {} },
      { id: 'node-b', type: 'image', position: { x: 250, y: 80 }, width: 120, height: 80, data: {} },
    ] as Node[];
    const result = buildWorkflowRegionFromSelection({ nodes, selectedIds: ['node-a'], workflows: [], color: '#10B981', newId: () => 'workflow-1' });

    expect(result).toMatchObject({ ok: true, workflow: { id: 'workflow-1', memberNodeIds: ['node-a', 'group-1', 'node-b'] } });
  });

  it('rejects existing membership and overlapping regions', () => {
    const nodes = [{ id: 'node-a', type: 'text', position: { x: 100, y: 100 }, width: 120, height: 80, data: {} }] as Node[];
    const existing = [{ schemaVersion: 1 as const, id: 'workflow-old', name: 'Old', revision: 1, memberNodeIds: ['node-a'], variables: [], inputValues: {}, bindings: [], stages: [], region: { x: 0, y: 0, width: 640, height: 420, color: '#2F6B5F' } }];
    expect(buildWorkflowRegionFromSelection({ nodes, selectedIds: ['node-a'], workflows: existing, color: '#10B981', newId: () => 'workflow-new' }))
      .toEqual({ ok: false, code: 'MEMBER_CONFLICT', workflowName: 'Old' });

    expect(buildWorkflowRegionFromSelection({ nodes: [{ ...nodes[0], id: 'node-b' }], selectedIds: ['node-b'], workflows: existing, color: '#10B981', newId: () => 'workflow-new' }))
      .toEqual({ ok: false, code: 'REGION_OVERLAP' });
  });

  it('expands an existing region to keep newly assigned members inside the visible boundary', () => {
    const node = { id: 'node-b', type: 'text', position: { x: 700, y: 420 }, width: 120, height: 80, data: {} } as Node;
    const region = expandWorkflowRegionToIncludeNodes(
      { x: 50, y: 50, width: 320, height: 220, color: '#10B981' },
      [node],
    );

    expect(region).toEqual({ x: 50, y: 50, width: 922, height: 522, color: '#10B981' });
    expect(workflowRegionAroundNodes([node], '#10b981')).toEqual({
      x: 652,
      y: 348,
      width: 320,
      height: 224,
      color: '#10B981',
    });
  });

  it('dissolves only the selected workflow region while preserving other workflows', () => {
    const workflows = [
      { schemaVersion: 1 as const, id: 'workflow-a', name: 'A', revision: 3, memberNodeIds: ['node-a'], variables: [], inputValues: {}, bindings: [], stages: [], region: { x: 0, y: 0, width: 640, height: 420, color: '#2F6B5F' } },
      { schemaVersion: 1 as const, id: 'workflow-b', name: 'B', revision: 2, memberNodeIds: ['node-b'], variables: [], inputValues: {}, bindings: [], stages: [], region: { x: 800, y: 0, width: 640, height: 420, color: '#5B4B8A' } },
    ];

    expect(dissolveWorkflowRegion(workflows, 'workflow-a')).toEqual([workflows[1]]);
    expect(dissolveWorkflowRegion(workflows, 'missing')).toBe(workflows);
  });
});
