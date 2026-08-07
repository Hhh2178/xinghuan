import { useCallback, useEffect, useRef, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { useRunBusStore } from '../../stores/runBus';
import type { LastDoneInfo } from '../../stores/runBus';
import { logBus } from '../../stores/logs';
import { useGroupRunStore } from '../../stores/groupRunStore';
import { topologicalSort } from '../../utils/topologicalSort';
import {
  DEFAULT_GROUP_FAILURE_RETRY_COUNT,
  normalizeGroupFailureRetryCount,
  resolveGroupExecutionPlan,
  resolveManagedExecutionOrder,
} from './groupExecutionManager';
import {
  buildGroupExecutionPlan,
  resolvePreparedBoundaryNodeIds,
  type GroupExecutionPlanError,
} from './groupExecutionPlan';
import { createGroupRunScheduler, type GroupRunScheduler } from './groupRunScheduler';

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
  const maxRetries = normalizeGroupFailureRetryCount(options.maxRetries);
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

function nodeDisplayName(nodes: Node[], nodeId: string) {
  const node = nodes.find((candidate) => candidate.id === nodeId);
  const data = (node?.data || {}) as Record<string, unknown>;
  return String(data.name || data.title || data.label || nodeId);
}

function groupPlanErrorMessage(groupName: string, errors: GroupExecutionPlanError[], nodes: Node[]) {
  const error = errors[0];
  const names = error.nodeIds.map((nodeId) => nodeDisplayName(nodes, nodeId)).join('、');
  if (error.code === 'CYCLE' || error.code === 'SELF_EDGE') {
    return `分组「${groupName}」存在循环拓扑：${names}`;
  }
  if (error.code === 'DUPLICATE_MEMBERSHIP') {
    return `分组成员存在重复归属：${names}`;
  }
  return `分组「${groupName}」缺少必须同时执行的上游节点：${names}`;
}

export function useCanvasRuntime({
  getNodes,
  getEdges,
  executableNodeTypes,
}: UseCanvasRuntimeArgs) {
  const [isGlobalRunning, setIsGlobalRunning] = useState(false);
  const [runNotice, setRunNotice] = useState<string | null>(null);
  const cancelRunRef = useRef(false);
  const runNoticeTimerRef = useRef<number | null>(null);
  const manualGroupSchedulerRef = useRef<GroupRunScheduler | null>(null);
  if (!manualGroupSchedulerRef.current) manualGroupSchedulerRef.current = createGroupRunScheduler();
  const activeGroupIds = useGroupRunStore((state) => state.activeGroupIds);
  const activeNodeIds = useGroupRunStore((state) => state.activeNodeIds);
  const batchTotal = useRunBusStore((state) => state.batchTotal);
  const batchDone = useRunBusStore((state) => state.batchDoneCount);

  const showRunNotice = useCallback((message: string) => {
    setRunNotice(message);
    logBus.warn(message, '组执行');
    if (runNoticeTimerRef.current !== null) window.clearTimeout(runNoticeTimerRef.current);
    runNoticeTimerRef.current = window.setTimeout(() => {
      setRunNotice(null);
      runNoticeTimerRef.current = null;
    }, 4200);
  }, []);

  useEffect(() => {
    const scheduler = manualGroupSchedulerRef.current!;
    const unsubscribe = scheduler.subscribe((snapshot) => useGroupRunStore.getState().applySnapshot(snapshot));
    return () => {
      unsubscribe();
      scheduler.cancelAll();
      useGroupRunStore.getState().reset();
      if (runNoticeTimerRef.current !== null) window.clearTimeout(runNoticeTimerRef.current);
    };
  }, []);

  const runNodeOnce = useCallback((id: string, shouldCancel: () => boolean) => {
    const previousCompletionSequence = useRunBusStore.getState().completionSequence;
    return new Promise<LastDoneInfo | null>((resolve) => {
      let done = false;
      const finish = (result: LastDoneInfo | null) => {
        if (done) return;
        done = true;
        unsubscribe();
        window.clearTimeout(timer);
        resolve(result);
      };
      const unsubscribe = useRunBusStore.subscribe((state) => {
        if (state.lastDone && state.lastDone.id === id && state.lastDone.sequence > previousCompletionSequence) {
          finish(state.lastDone);
        }
        if (shouldCancel()) finish(null);
      });
      const timer = window.setTimeout(() => finish({
        id,
        ok: false,
        ts: Date.now(),
        sequence: previousCompletionSequence,
        error: 'NODE_RUN_TIMEOUT',
      }), 60 * 60 * 1000);
      useRunBusStore.getState().triggerRun(id, 'batch');
    });
  }, []);

  const runNodesByOrder = useCallback(
    async (order: string[], failureRetryCount = DEFAULT_GROUP_FAILURE_RETRY_COUNT) => {
      if (order.length === 0) return 0;
      const { setBatchProgress } = useRunBusStore.getState();
      const managerMode = useRunBusStore.getState().mode === 'batch' && useRunBusStore.getState().batchTotal > 0;
      if (!managerMode) {
        setBatchProgress(order.length, 0);
      }
      try {
        for (let i = 0; i < order.length; i += 1) {
          if (cancelRunRef.current) break;
          const id = order[i];
          await runNodeWithRetries(id, () => runNodeOnce(id, () => cancelRunRef.current), {
            maxRetries: failureRetryCount,
            shouldCancel: () => cancelRunRef.current,
            onRetry: (retry, failure) => logBus.warn(`节点执行失败，正在重试 ${retry}/${failureRetryCount}：${failure.error || id}`, '组执行'),
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
    [runNodeOnce],
  );

  const runManagedRounds = useCallback(async () => {
    let completedRounds = 0;
    cancelRunRef.current = false;
    setIsGlobalRunning(true);
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
        await runNodesByOrder(
          order,
          shouldUseManager ? plan.failureRetryCount : DEFAULT_GROUP_FAILURE_RETRY_COUNT,
        );
        if (cancelRunRef.current) break;
        completedRounds += 1;
        setBatchProgress(totalRounds, completedRounds);
      }
      return completedRounds;
    } finally {
      cancelAll();
      setIsGlobalRunning(false);
      cancelRunRef.current = false;
    }
  }, [executableNodeTypes, getEdges, getNodes, runNodesByOrder]);

  const handleRunAll = useCallback(async () => {
    if (isGlobalRunning) return;
    if (activeGroupIds.length > 0) {
      showRunNotice('已有分组正在执行，请先停止分组任务再运行全部画布');
      return;
    }
    await runManagedRounds();
  }, [activeGroupIds.length, isGlobalRunning, runManagedRounds, showRunNotice]);

  const handleRunGroup = useCallback(
    async (groupId: string, ids: string[], executionCount = 1) => {
      if (isGlobalRunning) {
        showRunNotice('正在运行全部画布或组执行管理器，暂时不能启动手动分组');
        return;
      }
      if (manualGroupSchedulerRef.current!.getSnapshot().activeGroupIds.length === 0) {
        cancelRunRef.current = false;
      }

      const resolvePlan = () => {
        const nodes = getNodes();
        const edges = getEdges();
        const groupNode = nodes.find((node) => node.id === groupId && node.type === 'groupBox');
        const currentMemberIds = groupNode && Array.isArray((groupNode.data as any)?.memberIds)
          ? ((groupNode.data as any).memberIds as string[])
          : ids;
        const groupName = String((groupNode?.data as any)?.name || (groupId.startsWith('selection:') ? '临时选区' : groupId));
        const groupMemberships = nodes
          .filter((node) => node.type === 'groupBox')
          .map((node) => ({
            groupId: node.id,
            memberIds: Array.isArray((node.data as any)?.memberIds) ? (node.data as any).memberIds as string[] : [],
          }));
        if (!groupMemberships.some((membership) => membership.groupId === groupId)) {
          groupMemberships.push({ groupId, memberIds: currentMemberIds });
        }
        const result = buildGroupExecutionPlan({
          groupId,
          groupName,
          memberIds: currentMemberIds,
          groupMemberships,
          nodes,
          edges,
          executableNodeTypes,
          boundaryReadyNodeIds: resolvePreparedBoundaryNodeIds(nodes),
        });
        if (!result.ok) {
          const message = groupPlanErrorMessage(groupName, result.errors, nodes);
          showRunNotice(message);
          throw new Error(message);
        }
        if (result.plan.executableIds.length === 0) {
          const message = `分组「${groupName}」没有可执行节点`;
          showRunNotice(message);
          throw new Error(message);
        }
        return result.plan;
      };

      let initialPlan;
      try {
        initialPlan = resolvePlan();
      } catch {
        return;
      }
      const managerNode = getNodes().find((node) => node.type === 'group-execution-manager');
      const failureRetryCount = normalizeGroupFailureRetryCount((managerNode?.data as any)?.failureRetryCount);
      const admission = manualGroupSchedulerRef.current!.admit({
        plan: initialPlan,
        executionCount,
        failureRetryCount,
        resolvePlan: () => resolvePlan(),
        executeNode: async (nodeId, context) => {
          if (context.attempt > 0) {
            logBus.warn(`节点执行失败，正在重试 ${context.attempt}/${failureRetryCount}：${nodeDisplayName(getNodes(), nodeId)}`, '组执行');
          }
          const completed = await runNodeOnce(nodeId, () => cancelRunRef.current);
          return completed
            ? { ok: completed.ok, error: completed.error }
            : { ok: false, error: 'GROUP_RUN_CANCELLED' };
        },
      });
      if (!admission.ok) {
        showRunNotice(admission.message);
        return;
      }
      void admission.completion.then((outcome) => {
        if (outcome.status === 'failed') {
          showRunNotice(`分组「${initialPlan.groupName}」执行失败，未满足依赖的下游已停止`);
        }
      });
    },
    [executableNodeTypes, getEdges, getNodes, isGlobalRunning, runNodeOnce, showRunNotice],
  );

  const handleRunAllGroups = useCallback(async () => {
    if (isGlobalRunning) return;
    if (activeGroupIds.length > 0) {
      showRunNotice('已有手动分组正在执行，暂时不能启动组执行管理器');
      return;
    }
    await runManagedRounds();
  }, [activeGroupIds.length, isGlobalRunning, runManagedRounds, showRunNotice]);

  const handleCancelRun = useCallback(() => {
    cancelRunRef.current = true;
    manualGroupSchedulerRef.current?.cancelAll();
    useRunBusStore.getState().cancelAll();
  }, []);

  const isRunning = isGlobalRunning || activeGroupIds.length > 0;

  return {
    batchDone,
    batchTotal,
    handleCancelRun,
    handleRunAll,
    handleRunGroup,
    handleRunAllGroups,
    activeGroupCount: activeGroupIds.length,
    activeNodeCount: activeNodeIds.length,
    isGlobalRunning,
    isRunning,
    runNotice,
  };
}
