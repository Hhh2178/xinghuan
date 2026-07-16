import assert from 'node:assert/strict';

import { resolveGroupExecutionPlan, resolveManagedExecutionOrder } from '../apps/web/src/components/canvas/groupExecutionManager';
import { topologicalSort } from '../apps/web/src/utils/topologicalSort';

const executableTypes = new Set(['text', 'image', 'output']);

const fanOutNodes = [
  { id: 'a', type: 'text', position: { x: 0, y: 0 }, data: {} },
  { id: 'c', type: 'output', position: { x: 320, y: 80 }, data: {} },
  { id: 'b', type: 'image', position: { x: 160, y: 0 }, data: {} },
];
const fanOutEdges = [
  { id: 'e1', source: 'a', target: 'b' },
  { id: 'e2', source: 'a', target: 'c' },
];

assert.deepEqual(
  topologicalSort(fanOutNodes as any, fanOutEdges as any, executableTypes),
  ['a', 'b', 'c'],
  'fan-out branches should follow a stable visual tie-breaker when no downstream dependency exists',
);

const managerNodes = [
  {
    id: 'manager-1',
    type: 'group-execution-manager',
    position: { x: 0, y: 0 },
    data: {
      enabled: true,
      executionCount: 3,
      groupOrder: ['group-2', 'group-1'],
      skippedGroupIds: ['group-2'],
    },
  },
  {
    id: 'group-1',
    type: 'groupBox',
    position: { x: 0, y: 0 },
    data: { name: '第一组', memberIds: ['a1', 'a2'], width: 300, height: 200, locked: true, executionCount: 2 },
  },
  {
    id: 'group-2',
    type: 'groupBox',
    position: { x: 420, y: 0 },
    data: { name: '第二组', memberIds: ['b1'], width: 300, height: 200, locked: true },
  },
  { id: 'a1', type: 'text', position: { x: 40, y: 40 }, data: {} },
  { id: 'a2', type: 'image', position: { x: 180, y: 40 }, data: {} },
  { id: 'b1', type: 'output', position: { x: 460, y: 40 }, data: {} },
  { id: 'outside', type: 'output', position: { x: 820, y: 40 }, data: {} },
];
const managerEdges = [
  { id: 'ga', source: 'a1', target: 'a2' },
];

const plan = resolveGroupExecutionPlan(managerNodes as any, managerEdges as any, executableTypes);
assert.equal(plan.managerPresent, true, 'manager node should be discovered');
assert.equal(plan.managerEnabled, true, 'manager should default to enabled when configured');
assert.equal(plan.executionCount, 3, 'execution count should be normalized and preserved');
assert.deepEqual(
  resolveManagedExecutionOrder(plan),
  ['a1', 'a2', 'a1', 'a2', 'outside'],
  'managed execution should respect group order, per-group count, skip flags, and append standalone nodes',
);

console.log('verify-group-execution-manager-contract: ok');
