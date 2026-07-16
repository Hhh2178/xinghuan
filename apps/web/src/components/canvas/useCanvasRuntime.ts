import { useCallback, useRef, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { useRunBusStore } from '../../stores/runBus';
import type { LastDoneInfo } from '../../stores/runBus';
import { logBus } from '../../stores/logs';
import { topologicalSort } from '../../utils/topologicalSort';
import {
  resolveGroupExecutionPlan,
  resolveManagedExecutionOrder,
} from './groupExecutionManager';

interface UseCanvasRuntimeArgs {
  getNodes: () => Node[];
  getEdges: () => Edge[];
  executableNodeTypes: Set<string>;
}

export async function runNodeWithRetries(
  nodeId: string,
  runAttempt: () => Promise<LastDoneInfo | null>,
  options: {
    maxRetries?: number;
    shouldCancel?: () => boolean;
    onRetry?: (retry: number, failure: LastDoneInfo) => void;
    retryDelay?: () => Promise<void>;
  } = {},
) {
  const maxRetries = Math.max(0, Math.floor(options.maxRetries ?? 3));
  let completed: LastDoneInfo | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (options.shouldCancel?.()) return null;
    completed = await runAttempt();
    if (!completed || completed.ok) return completed;
    if (attempt < maxRetries) {
      options.onRetry?.(attempt + 1, completed);
      await options.retryDelay?.();
    }
  }
  throw new Error(`NODE_RUN_FAILED_AFTER_RETRIES:${nodeId}:${completed?.error || 'unknown'}`);
}

export function useCanvasRuntime({
  getNodes,
  getEdges,
  executableNodeTypes,
}: UseCanvasRuntimeArgs) {
  const [isRunning, setIsRunning] = useState(false);
  const cancelRunRef = useRef(false);
  const batchTotal = useRunBusStore((state) => state.batchTotal);
  const batchDone = useRunBusStore((state) => state.batchDoneCount);

  const runNodesByOrder = useCallback(
    async (order: string[]) => {
      if (order.length === 0) return 0;
      const { triggerRun, setBatchProgress } = useRunBusStore.getState();
      const managerMode = useRunBusStore.getState().mode === 'batch' && useRunBusStore.getState().batchTotal > 0;
      if (!managerMode) {
        setBatchProgress(order.length, 0);
      }
      try {
        for (let i = 0; i < order.length; i += 1) {
          if (cancelRunRef.current) break;
          const id = order[i];
          await runNodeWithRetries(id, async () => {
            const previousDoneTs = useRunBusStore.getState().lastDone?.ts || 0;
            return new Promise<LastDoneInfo | null>((resolve) => {
              let done = false;
              const finish = (result: LastDoneInfo | null) => {
                if (done) return;
                done = true;
                unsub();
                window.clearTimeout(timer);
                resolve(result);
              };
              const unsub = useRunBusStore.subscribe((state) => {
                if (state.lastDone && state.lastDone.id === id && state.lastDone.ts > previousDoneTs) finish(state.lastDone);
                if (cancelRunRef.current) finish(null);
              });
              const timer = window.setTimeout(() => finish({ id, ok: false, ts: Date.now(), error: 'NODE_RUN_TIMEOUT' }), 60 * 60 * 1000);
              triggerRun(id, 'batch');
            });
          }, {
            maxRetries: 3,
            shouldCancel: () => cancelRunRef.current,
            onRetry: (retry, failure) => logBus.warn(`节点执行失败，正在重试 ${retry}/3：${failure.error || id}`, '组执行'),
            retryDelay: () => new Promise((resolve) => window.setTimeout(resolve, 80)),
          });
          if (!managerMode) {
            setBatchProgress(order.length, i + 1);
          }
        }
      } finally {
        // Managed multi-round runs own the outer lifecycle; standalone runs still need a settled batch state.
        if (!managerMode && cancelRunRef.current) {
          setBatchProgress(order.length, order.length);
        }
      }
      return order.length;
    },
    [],
  );

  const runManagedRounds = useCallback(async () => {
    let completedRounds = 0;
    cancelRunRef.current = false;
    setIsRunning(true);
    const { setBatchProgress, cancelAll } = useRunBusStore.getState();
    try {
      const initialPlan = resolveGroupExecutionPlan(getNodes(), getEdges(), executableNodeTypes);
      const shouldUseManager = initialPlan.managerPresent && initialPlan.managerEnabled;
      const totalRounds = shouldUseManager ? initialPlan.executionCount : 1;
      setBatchProgress(totalRounds, 0);
      for (let round = 0; round < totalRounds; round += 1) {
        if (cancelRunRef.current) break;
        const plan = resolveGroupExecutionPlan(getNodes(), getEdges(), executableNodeTypes);
        const order = shouldUseManager
          ? resolveManagedExecutionOrder(plan)
          : topologicalSort(getNodes(), getEdges(), executableNodeTypes);
        if (order.length === 0) {
          if (round === 0) {
            alert('画布上没有可执行节点');
          }
          break;
        }
        await runNodesByOrder(order);
        if (cancelRunRef.current) break;
        completedRounds += 1;
        setBatchProgress(totalRounds, completedRounds);
      }
      return completedRounds;
    } finally {
      cancelAll();
      setIsRunning(false);
      cancelRunRef.current = false;
    }
  }, [executableNodeTypes, getEdges, getNodes, runNodesByOrder]);

  const handleRunAll = useCallback(async () => {
    if (isRunning) return;
    await runManagedRounds();
  }, [isRunning, runManagedRounds]);

  const handleRunGroup = useCallback(
    async (ids: string[], executionCount = 1) => {
      if (isRunning) return;
      cancelRunRef.current = false;
      setIsRunning(true);
      const nodes = getNodes();
      const edges = getEdges();
      const idSet = new Set(ids);
      const subNodes = nodes.filter((node) => idSet.has(node.id));
      const subEdges = edges.filter((edge) => idSet.has(edge.source) && idSet.has(edge.target));
      const executable = subNodes.filter((node) => node.type && executableNodeTypes.has(node.type));
      if (executable.length === 0) {
        setIsRunning(false);
        alert('所选节点中没有可执行节点');
        return;
      }
      try {
        const order = topologicalSort(subNodes, subEdges, executableNodeTypes);
        const rounds = Math.max(1, Math.min(99, Math.floor(Number(executionCount) || 1)));
        for (let round = 0; round < rounds && !cancelRunRef.current; round += 1) {
          await runNodesByOrder(order);
        }
      } finally {
        useRunBusStore.getState().cancelAll();
        setIsRunning(false);
        cancelRunRef.current = false;
      }
    },
    [executableNodeTypes, getEdges, getNodes, isRunning, runNodesByOrder],
  );

  const handleRunAllGroups = useCallback(async () => {
    if (isRunning) return;
    await runManagedRounds();
  }, [isRunning, runManagedRounds]);

  const handleCancelRun = useCallback(() => {
    cancelRunRef.current = true;
    useRunBusStore.getState().cancelAll();
  }, []);

  return {
    batchDone,
    batchTotal,
    handleCancelRun,
    handleRunAll,
    handleRunGroup,
    handleRunAllGroups,
    isRunning,
  };
}
