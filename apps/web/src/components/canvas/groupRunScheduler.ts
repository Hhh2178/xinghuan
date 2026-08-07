import type { GroupExecutionPlan } from './groupExecutionPlan';

export const MAX_ACTIVE_MANUAL_GROUPS = 5;
export const MAX_ACTIVE_MANUAL_NODES = 10;

export type GroupRunStatus = 'running' | 'succeeded' | 'failed' | 'cancelled';
export type GroupNodeRunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'blocked';

export interface GroupNodeExecutionResult {
  ok: boolean;
  error?: string;
}

export interface GroupRunOutcome {
  groupId: string;
  status: Exclude<GroupRunStatus, 'running'>;
  completedRounds: number;
  failedNodeIds: string[];
  blockedNodeIds: string[];
}

export interface GroupRunRequest {
  plan: GroupExecutionPlan;
  executionCount: number;
  failureRetryCount: number;
  resolvePlan?: (round: number) => GroupExecutionPlan;
  executeNode: (nodeId: string, context: { groupId: string; round: number; attempt: number }) => Promise<GroupNodeExecutionResult>;
}

export interface GroupRunSnapshot {
  activeGroupIds: string[];
  activeNodeIds: string[];
  groupStates: Record<string, {
    status: GroupRunStatus;
    round: number;
    executionCount: number;
    nodeStates: Record<string, GroupNodeRunStatus>;
  }>;
}

export type GroupRunAdmission =
  | { ok: true; runId: string; completion: Promise<GroupRunOutcome> }
  | { ok: false; code: 'GROUP_LIMIT' | 'GROUP_ACTIVE' | 'NODE_ACTIVE'; message: string };

interface ActiveGroupRun {
  runId: string;
  request: GroupRunRequest;
  round: number;
  completedRounds: number;
  nodeStates: Map<string, GroupNodeRunStatus>;
  cancelled: boolean;
  completion: Promise<GroupRunOutcome>;
  resolveCompletion: (outcome: GroupRunOutcome) => void;
}

export interface GroupRunScheduler {
  admit: (request: GroupRunRequest) => GroupRunAdmission;
  cancelAll: () => void;
  getSnapshot: () => GroupRunSnapshot;
  subscribe: (listener: (snapshot: GroupRunSnapshot) => void) => () => void;
}

export function createGroupRunScheduler(options: {
  maxGroups?: number;
  maxNodes?: number;
} = {}): GroupRunScheduler {
  const maxGroups = options.maxGroups ?? MAX_ACTIVE_MANUAL_GROUPS;
  const maxNodes = options.maxNodes ?? MAX_ACTIVE_MANUAL_NODES;
  const groups = new Map<string, ActiveGroupRun>();
  const nodeOwners = new Map<string, string>();
  const activeNodeOwners = new Map<string, string>();
  const listeners = new Set<(snapshot: GroupRunSnapshot) => void>();
  let runSequence = 0;
  let groupCursor = 0;
  let pumpScheduled = false;

  const snapshot = (): GroupRunSnapshot => ({
    activeGroupIds: [...groups.keys()],
    activeNodeIds: [...activeNodeOwners.keys()],
    groupStates: Object.fromEntries([...groups.entries()].map(([groupId, run]) => [groupId, {
      status: 'running' as const,
      round: run.round,
      executionCount: run.request.executionCount,
      nodeStates: Object.fromEntries(run.nodeStates),
    }])),
  });

  const emit = () => {
    const next = snapshot();
    for (const listener of listeners) listener(next);
  };

  const orderedIds = (run: ActiveGroupRun, status: GroupNodeRunStatus) =>
    run.request.plan.order.filter((nodeId) => run.nodeStates.get(nodeId) === status);

  const releaseGroup = (run: ActiveGroupRun, status: GroupRunOutcome['status']) => {
    if (!groups.has(run.request.plan.groupId)) return;
    groups.delete(run.request.plan.groupId);
    for (const [nodeId, groupId] of nodeOwners) {
      if (groupId === run.request.plan.groupId) nodeOwners.delete(nodeId);
    }
    for (const [nodeId, groupId] of activeNodeOwners) {
      if (groupId === run.request.plan.groupId) activeNodeOwners.delete(nodeId);
    }
    run.resolveCompletion({
      groupId: run.request.plan.groupId,
      status,
      completedRounds: run.completedRounds,
      failedNodeIds: orderedIds(run, 'failed'),
      blockedNodeIds: orderedIds(run, 'blocked'),
    });
    emit();
    schedulePump();
  };

  const resetRound = (run: ActiveGroupRun) => {
    run.nodeStates = new Map(run.request.plan.executableIds.map((nodeId) => [nodeId, 'pending'] as const));
  };

  const settleGroupIfComplete = (run: ActiveGroupRun) => {
    if (!groups.has(run.request.plan.groupId) || run.cancelled) return;
    const states = [...run.nodeStates.values()];
    if (states.some((status) => status === 'running' || status === 'pending')) return;
    if (states.some((status) => status === 'failed')) {
      releaseGroup(run, 'failed');
      return;
    }
    run.completedRounds += 1;
    if (run.completedRounds >= run.request.executionCount) {
      releaseGroup(run, 'succeeded');
      return;
    }
    run.round += 1;
    let nextPlan: GroupExecutionPlan;
    try {
      nextPlan = run.request.resolvePlan?.(run.round) || run.request.plan;
    } catch {
      releaseGroup(run, 'failed');
      return;
    }
    for (const [nodeId, groupId] of nodeOwners) {
      if (groupId === run.request.plan.groupId) nodeOwners.delete(nodeId);
    }
    const conflict = nextPlan.memberIds.find((nodeId) => nodeOwners.has(nodeId));
    if (conflict || nextPlan.groupId !== run.request.plan.groupId) {
      releaseGroup(run, 'failed');
      return;
    }
    run.request.plan = nextPlan;
    for (const nodeId of nextPlan.memberIds) nodeOwners.set(nodeId, nextPlan.groupId);
    resetRound(run);
    emit();
    schedulePump();
  };

  const markFailure = (run: ActiveGroupRun, nodeId: string) => {
    run.nodeStates.set(nodeId, 'failed');
    for (const descendantId of run.request.plan.descendants[nodeId] || []) {
      if (run.nodeStates.get(descendantId) === 'pending') run.nodeStates.set(descendantId, 'blocked');
    }
  };

  const execute = async (run: ActiveGroupRun, nodeId: string) => {
    let result: GroupNodeExecutionResult = { ok: false, error: 'NODE_RUN_FAILED' };
    for (let attempt = 0; attempt <= run.request.failureRetryCount; attempt += 1) {
      if (run.cancelled || !groups.has(run.request.plan.groupId)) return;
      try {
        result = await run.request.executeNode(nodeId, {
          groupId: run.request.plan.groupId,
          round: run.round,
          attempt,
        });
      } catch (error) {
        result = { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
      if (result.ok) break;
    }

    if (!groups.has(run.request.plan.groupId) || run.cancelled) return;
    activeNodeOwners.delete(nodeId);
    if (result.ok) run.nodeStates.set(nodeId, 'succeeded');
    else markFailure(run, nodeId);
    emit();
    settleGroupIfComplete(run);
    schedulePump();
  };

  const readyNode = (run: ActiveGroupRun) => run.request.plan.order.find((nodeId) => {
    if (run.nodeStates.get(nodeId) !== 'pending') return false;
    return (run.request.plan.dependencies[nodeId] || []).every(
      (dependencyId) => run.nodeStates.get(dependencyId) === 'succeeded',
    );
  });

  const pump = () => {
    pumpScheduled = false;
    while (activeNodeOwners.size < maxNodes && groups.size > 0) {
      const groupIds = [...groups.keys()];
      let dispatched = false;
      for (let offset = 0; offset < groupIds.length; offset += 1) {
        const index = (groupCursor + offset) % groupIds.length;
        const groupId = groupIds[index];
        const run = groups.get(groupId);
        if (!run || run.cancelled) continue;
        const nodeId = readyNode(run);
        if (!nodeId || activeNodeOwners.has(nodeId)) continue;
        run.nodeStates.set(nodeId, 'running');
        activeNodeOwners.set(nodeId, groupId);
        groupCursor = (index + 1) % groupIds.length;
        dispatched = true;
        emit();
        void execute(run, nodeId);
        break;
      }
      if (!dispatched) break;
    }
  };

  function schedulePump() {
    if (pumpScheduled) return;
    pumpScheduled = true;
    queueMicrotask(pump);
  }

  return {
    admit: (request) => {
      const groupId = request.plan.groupId;
      if (groups.has(groupId)) {
        return { ok: false, code: 'GROUP_ACTIVE', message: '该分组正在执行' };
      }
      if (groups.size >= maxGroups) {
        return {
          ok: false,
          code: 'GROUP_LIMIT',
          message: `并行分组已达上限（${maxGroups}/${maxGroups}），请等待任一分组完成后再试。`,
        };
      }
      const conflictingNodeId = request.plan.memberIds.find((nodeId) => nodeOwners.has(nodeId));
      if (conflictingNodeId) {
        return { ok: false, code: 'NODE_ACTIVE', message: `节点 ${conflictingNodeId} 正在其他分组中执行` };
      }

      let resolveCompletion!: (outcome: GroupRunOutcome) => void;
      const completion = new Promise<GroupRunOutcome>((resolve) => { resolveCompletion = resolve; });
      const run: ActiveGroupRun = {
        runId: `manual-group-run-${++runSequence}`,
        request: {
          ...request,
          executionCount: Math.max(1, Math.min(99, Math.floor(request.executionCount || 1))),
          failureRetryCount: Math.max(0, Math.min(10, Math.floor(request.failureRetryCount || 0))),
        },
        round: 1,
        completedRounds: 0,
        nodeStates: new Map(),
        cancelled: false,
        completion,
        resolveCompletion,
      };
      resetRound(run);
      groups.set(groupId, run);
      for (const nodeId of request.plan.memberIds) nodeOwners.set(nodeId, groupId);
      emit();
      schedulePump();
      return { ok: true, runId: run.runId, completion };
    },
    cancelAll: () => {
      for (const run of [...groups.values()]) {
        run.cancelled = true;
        releaseGroup(run, 'cancelled');
      }
      activeNodeOwners.clear();
      nodeOwners.clear();
      emit();
    },
    getSnapshot: snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
  };
}
