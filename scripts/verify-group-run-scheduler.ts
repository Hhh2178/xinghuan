import assert from 'node:assert/strict';

import type { GroupExecutionPlan } from '../apps/web/src/components/canvas/groupExecutionPlan';
import { createGroupRunScheduler } from '../apps/web/src/components/canvas/groupRunScheduler';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

function plan(groupId: string, dependencies: Record<string, string[]>): GroupExecutionPlan {
  const executableIds = Object.keys(dependencies);
  const dependents = Object.fromEntries(executableIds.map((id) => [id, [] as string[]]));
  for (const [targetId, sourceIds] of Object.entries(dependencies)) {
    for (const sourceId of sourceIds) dependents[sourceId].push(targetId);
  }
  const descendants = Object.fromEntries(executableIds.map((id) => {
    const visited = new Set<string>();
    const queue = [...dependents[id]];
    while (queue.length > 0) {
      const next = queue.shift()!;
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(...dependents[next]);
    }
    return [id, [...visited]];
  }));
  return {
    groupId,
    groupName: groupId,
    memberIds: executableIds,
    executableIds,
    layers: [],
    order: executableIds,
    dependencies,
    dependents,
    descendants,
    externalDependencies: [],
  };
}

async function flush() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

{
  const blockers = new Map<string, ReturnType<typeof deferred<{ ok: boolean }>>>();
  const scheduler = createGroupRunScheduler();
  const admissions = Array.from({ length: 5 }, (_, index) => {
    const groupId = `group-${index + 1}`;
    const nodeId = `node-${index + 1}`;
    const blocker = deferred<{ ok: boolean }>();
    blockers.set(nodeId, blocker);
    return scheduler.admit({
      plan: plan(groupId, { [nodeId]: [] }),
      executionCount: 1,
      failureRetryCount: 0,
      executeNode: () => blocker.promise,
    });
  });
  admissions.forEach((result) => assert.equal(result.ok, true));
  const sixth = scheduler.admit({
    plan: plan('group-6', { 'node-6': [] }),
    executionCount: 1,
    failureRetryCount: 0,
    executeNode: async () => ({ ok: true }),
  });
  assert.deepEqual(sixth, {
    ok: false,
    code: 'GROUP_LIMIT',
    message: '并行分组已达上限（5/5），请等待任一分组完成后再试。',
  });
  const duplicate = scheduler.admit({
    plan: plan('group-1', { 'node-repeat': [] }),
    executionCount: 1,
    failureRetryCount: 0,
    executeNode: async () => ({ ok: true }),
  });
  assert.deepEqual(duplicate, { ok: false, code: 'GROUP_ACTIVE', message: '该分组正在执行' });
  scheduler.cancelAll();
}

{
  const started: string[] = [];
  const active = new Set<string>();
  let maximumActive = 0;
  const blockers = new Map<string, ReturnType<typeof deferred<{ ok: boolean }>>>();
  const dependencies = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`node-${index + 1}`, []]));
  const scheduler = createGroupRunScheduler();
  const admission = scheduler.admit({
    plan: plan('wide-group', dependencies),
    executionCount: 1,
    failureRetryCount: 0,
    executeNode: (nodeId) => {
      started.push(nodeId);
      active.add(nodeId);
      maximumActive = Math.max(maximumActive, active.size);
      const blocker = deferred<{ ok: boolean }>();
      blockers.set(nodeId, blocker);
      return blocker.promise.finally(() => active.delete(nodeId));
    },
  });
  assert.equal(admission.ok, true);
  await flush();
  assert.equal(started.length, 10);
  assert.equal(maximumActive, 10);
  blockers.get(started[0])!.resolve({ ok: true });
  await flush();
  assert.equal(started.length, 11);
  assert.equal(maximumActive, 10);
  scheduler.cancelAll();
}

{
  const started: string[] = [];
  const scheduler = createGroupRunScheduler();
  const admission = scheduler.admit({
    plan: plan('branch-group', {
      'failed-root': [],
      'blocked-child': ['failed-root'],
      'healthy-root': [],
      'healthy-child': ['healthy-root'],
    }),
    executionCount: 1,
    failureRetryCount: 0,
    executeNode: async (nodeId) => {
      started.push(nodeId);
      return nodeId === 'failed-root' ? { ok: false, error: 'expected failure' } : { ok: true };
    },
  });
  assert.equal(admission.ok, true);
  if (!admission.ok) throw new Error('branch admission failed');
  const outcome = await admission.completion;
  assert.equal(outcome.status, 'failed');
  assert.deepEqual(started.sort(), ['failed-root', 'healthy-child', 'healthy-root'].sort());
  assert.deepEqual(outcome.failedNodeIds, ['failed-root']);
  assert.deepEqual(outcome.blockedNodeIds, ['blocked-child']);
}

{
  const releaseFirst = deferred<{ ok: boolean }>();
  const releaseSecond = deferred<{ ok: boolean }>();
  const scheduler = createGroupRunScheduler();
  const first = scheduler.admit({
    plan: plan('first', { first: [] }),
    executionCount: 1,
    failureRetryCount: 0,
    executeNode: () => releaseFirst.promise,
  });
  const second = scheduler.admit({
    plan: plan('second', { second: [] }),
    executionCount: 1,
    failureRetryCount: 0,
    executeNode: () => releaseSecond.promise,
  });
  if (!first.ok || !second.ok) throw new Error('isolation admission failed');
  await flush();
  releaseFirst.resolve({ ok: true });
  assert.equal((await first.completion).status, 'succeeded');
  assert.equal(scheduler.getSnapshot().activeGroupIds.includes('second'), true);
  releaseSecond.resolve({ ok: true });
  assert.equal((await second.completion).status, 'succeeded');
}

{
  const blocker = deferred<{ ok: boolean }>();
  const scheduler = createGroupRunScheduler();
  const first = scheduler.admit({
    plan: plan('owner-a', { root: [], shared: ['root'] }),
    executionCount: 1,
    failureRetryCount: 0,
    executeNode: () => blocker.promise,
  });
  assert.equal(first.ok, true);
  const conflict = scheduler.admit({
    plan: plan('owner-b', { shared: [] }),
    executionCount: 1,
    failureRetryCount: 0,
    executeNode: async () => ({ ok: true }),
  });
  assert.deepEqual(conflict, { ok: false, code: 'NODE_ACTIVE', message: '节点 shared 正在其他分组中执行' });
  scheduler.cancelAll();
}

{
  const started: string[] = [];
  const scheduler = createGroupRunScheduler();
  const admission = scheduler.admit({
    plan: plan('rounds', { first: [] }),
    executionCount: 2,
    failureRetryCount: 0,
    resolvePlan: (round) => round === 2 ? plan('rounds', { second: [] }) : plan('rounds', { first: [] }),
    executeNode: async (nodeId) => {
      started.push(nodeId);
      return { ok: true };
    },
  });
  if (!admission.ok) throw new Error('round admission failed');
  assert.equal((await admission.completion).status, 'succeeded');
  assert.deepEqual(started, ['first', 'second']);
}

console.log('verify-group-run-scheduler: ok');
