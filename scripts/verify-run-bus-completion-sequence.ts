import assert from 'node:assert/strict';

import { useRunBusStore } from '../apps/web/src/stores/runBus';

useRunBusStore.setState({
  currentRunId: null,
  runningIds: [],
  lastDone: null,
  completionSequence: 0,
  mode: 'idle',
  batchTotal: 0,
  batchDoneCount: 0,
} as any);

const originalNow = Date.now;
Date.now = () => 1_786_099_200_000;

try {
  const state = useRunBusStore.getState() as any;
  state.triggerRunMany(['a', 'b'], 'batch');
  state.markDone('a', true);
  const first = useRunBusStore.getState().lastDone as any;
  state.triggerRun('a', 'batch');
  state.markDone('a', true);
  const second = useRunBusStore.getState().lastDone as any;

  assert.equal(first.ts, second.ts, 'the regression fixture should complete twice in one millisecond');
  assert.equal(first.sequence, 1);
  assert.equal(second.sequence, 2);

  useRunBusStore.getState().triggerRunMany(['a', 'b'], 'batch');
  (useRunBusStore.getState() as any).releaseRun('a');
  assert.deepEqual(useRunBusStore.getState().runningIds, ['b']);
  assert.equal(useRunBusStore.getState().currentRunId, 'b');
  assert.equal(useRunBusStore.getState().mode, 'batch');
} finally {
  Date.now = originalNow;
  useRunBusStore.getState().cancelAll();
}

console.log('verify-run-bus-completion-sequence: ok');
