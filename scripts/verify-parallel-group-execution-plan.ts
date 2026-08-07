import assert from 'node:assert/strict';

import {
  buildGroupExecutionPlan,
  buildTopologicalLayers,
  resolvePreparedBoundaryNodeIds,
} from '../apps/web/src/components/canvas/groupExecutionPlan';

const executableTypes = new Set(['text', 'image', 'output']);

assert.deepEqual(
  [...resolvePreparedBoundaryNodeIds([
    { id: 'text-ready', type: 'text', position: { x: 0, y: 0 }, data: { text: 'ready' } },
    { id: 'upload-ready', type: 'upload', position: { x: 0, y: 0 }, data: { urls: ['asset.png'] } },
    { id: 'running', type: 'text', position: { x: 0, y: 0 }, data: { text: 'stale', status: 'running' } },
    { id: 'empty', type: 'text', position: { x: 0, y: 0 }, data: { text: '' } },
  ] as any)].sort(),
  ['text-ready', 'upload-ready'],
);

const nodes = [
  { id: 'left-root', type: 'text', position: { x: 0, y: 0 }, data: {} },
  { id: 'right-root', type: 'text', position: { x: 0, y: 160 }, data: {} },
  { id: 'left-mid', type: 'image', position: { x: 180, y: 0 }, data: {} },
  { id: 'right-mid', type: 'image', position: { x: 180, y: 160 }, data: {} },
  { id: 'join', type: 'output', position: { x: 360, y: 80 }, data: {} },
];
const edges = [
  { id: 'left-edge', source: 'left-root', target: 'left-mid' },
  { id: 'right-edge', source: 'right-root', target: 'right-mid' },
  { id: 'left-join', source: 'left-mid', target: 'join' },
  { id: 'right-join', source: 'right-mid', target: 'join' },
];

const layered = buildTopologicalLayers(nodes as any, edges as any, executableTypes);
assert.equal(layered.ok, true, 'valid DAG should produce topology layers');
if (layered.ok) {
  assert.deepEqual(layered.layers, [
    ['left-root', 'right-root'],
    ['left-mid', 'right-mid'],
    ['join'],
  ]);
  assert.deepEqual(layered.dependencies.join, ['left-mid', 'right-mid']);
}

for (let index = 0; index < 20; index += 1) {
  assert.deepEqual(
    buildTopologicalLayers(nodes as any, [...edges].reverse() as any, executableTypes),
    layered,
    'topology layers should be stable regardless of edge input order',
  );
}

const cycle = buildTopologicalLayers(
  nodes.slice(0, 2) as any,
  [
    { id: 'cycle-a', source: 'left-root', target: 'right-root' },
    { id: 'cycle-b', source: 'right-root', target: 'left-root' },
  ] as any,
  executableTypes,
);
assert.deepEqual(cycle, {
  ok: false,
  errors: [{ code: 'CYCLE', nodeIds: ['left-root', 'right-root'] }],
});

const selfEdge = buildTopologicalLayers(
  nodes.slice(0, 1) as any,
  [{ id: 'self', source: 'left-root', target: 'left-root' }] as any,
  executableTypes,
);
assert.deepEqual(selfEdge, {
  ok: false,
  errors: [{ code: 'SELF_EDGE', nodeIds: ['left-root'] }],
});

const overlapping = buildGroupExecutionPlan({
  groupId: 'group-a',
  groupName: 'A',
  memberIds: ['left-root', 'left-mid'],
  groupMemberships: [
    { groupId: 'group-a', memberIds: ['left-root', 'left-mid'] },
    { groupId: 'group-b', memberIds: ['left-mid'] },
  ],
  nodes: nodes as any,
  edges: edges as any,
  executableNodeTypes: executableTypes,
  boundaryReadyNodeIds: new Set<string>(),
});
assert.deepEqual(overlapping, {
  ok: false,
  errors: [{ code: 'DUPLICATE_MEMBERSHIP', nodeIds: ['left-mid'], groupIds: ['group-a', 'group-b'] }],
});

const externalExecutable = buildGroupExecutionPlan({
  groupId: 'group-target',
  groupName: 'Target',
  memberIds: ['left-mid'],
  groupMemberships: [{ groupId: 'group-target', memberIds: ['left-mid'] }],
  nodes: nodes as any,
  edges: edges as any,
  executableNodeTypes: executableTypes,
  boundaryReadyNodeIds: new Set<string>(),
});
assert.deepEqual(externalExecutable, {
  ok: false,
  errors: [{ code: 'EXTERNAL_EXECUTABLE_DEPENDENCY', nodeIds: ['left-root', 'left-mid'] }],
});

const preparedBoundary = buildGroupExecutionPlan({
  groupId: 'group-target',
  groupName: 'Target',
  memberIds: ['left-mid'],
  groupMemberships: [{ groupId: 'group-target', memberIds: ['left-mid'] }],
  nodes: nodes as any,
  edges: edges as any,
  executableNodeTypes: executableTypes,
  boundaryReadyNodeIds: new Set(['left-root']),
});
assert.equal(preparedBoundary.ok, true, 'explicit prepared boundary input should be accepted');
if (preparedBoundary.ok) {
  assert.deepEqual(preparedBoundary.plan.layers, [['left-mid']]);
  assert.deepEqual(preparedBoundary.plan.externalDependencies, [{ sourceId: 'left-root', targetId: 'left-mid' }]);
}

console.log('verify-parallel-group-execution-plan: ok');
