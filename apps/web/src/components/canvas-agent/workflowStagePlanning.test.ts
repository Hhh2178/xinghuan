import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import type { WorkflowDocument } from '@xinghuan/shared';

import { buildWorkflowStageProjection, reorderWorkflowStages } from './workflowStagePlanning';

const workflow: WorkflowDocument = {
  schemaVersion: 1,
  id: 'workflow-1',
  name: '工作流',
  revision: 1,
  memberNodeIds: ['group-a', 'group-b', 'image', 'video', 'output'],
  variables: [], inputValues: {}, bindings: [], stages: [],
  region: { x: 0, y: 0, width: 1200, height: 500, color: '#2F6B5F' },
};

const nodes = [
  { id: 'group-a', type: 'groupBox', position: { x: 0, y: 0 }, data: { name: '图片', width: 400, height: 240, memberIds: ['image'] } },
  { id: 'group-b', type: 'groupBox', position: { x: 450, y: 0 }, data: { name: '视频', width: 400, height: 240, memberIds: ['video'] } },
  { id: 'image', type: 'image', position: { x: 40, y: 40 }, data: {} },
  { id: 'video', type: 'video', position: { x: 490, y: 40 }, data: {} },
  { id: 'output', type: 'output', position: { x: 900, y: 40 }, data: {} },
] as Node[];
const edges = [
  { id: 'image-video', source: 'image', target: 'video' },
  { id: 'video-output', source: 'video', target: 'output' },
] as Edge[];

describe('workflow stage planning', () => {
  it('projects group stages and an explicit ungrouped stage', () => {
    const projection = buildWorkflowStageProjection(workflow, nodes, edges);
    expect(projection.stages.map((stage) => [stage.name, stage.sourceGroupNodeId])).toEqual([
      ['图片', 'group-a'], ['视频', 'group-b'], ['未分组阶段', null],
    ]);
  });

  it('rejects a drag that places a downstream stage before its dependency', () => {
    const projection = buildWorkflowStageProjection(workflow, nodes, edges);
    const result = reorderWorkflowStages(projection, projection.stages[1].id, projection.stages[0].id, edges);
    expect(result.conflict).toMatchObject({ edgeId: 'image-video', source: 'image', target: 'video' });
  });
});
