# Parallel Group Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single serial manual group runner with validated DAG-layer execution supporting five active groups, ten active nodes, deterministic completion correlation, and isolated cancellation.

**Architecture:** Add pure graph planning and bounded scheduling modules beside the existing Canvas runtime. Keep `Canvas.tsx` as wiring, use Zustand only for observable ownership/progress, and preserve the existing node `useRunTrigger` contract while replacing timestamp correlation with a monotonic completion sequence.

**Tech Stack:** React 19, TypeScript, Zustand 5, XYFlow, Node/tsx contract tests, existing Canvas runtime and Harness scripts.

## Global Constraints

- Maximum active manual groups is exactly `5`.
- Maximum active nodes across all manual groups is exactly `10`.
- A sixth group is rejected and is never queued.
- Independent ready nodes run concurrently; downstream nodes wait for every upstream success.
- A failed branch blocks only its descendants; independent branches continue.
- Global Run All and Group Execution Manager remain exclusive with manual group runs.
- Active-round topology and membership are immutable; later rounds re-snapshot and revalidate.
- Do not expand `Canvas.tsx` with planning or scheduling algorithms.
- PC visual verification uses `1920x1080` only.

---

### Task 1: Validated DAG Planning

**Files:**
- Create: `apps/web/src/components/canvas/groupExecutionPlan.ts`
- Modify: `apps/web/src/utils/topologicalSort.ts`
- Modify: `apps/web/src/components/canvas/groupExecutionManager.ts`
- Modify: `scripts/verify-group-execution-manager-contract.ts`
- Create: `scripts/verify-parallel-group-execution-plan.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `buildGroupExecutionPlan(input: GroupExecutionPlanInput): GroupExecutionPlanResult`
- Produces: `buildTopologicalLayers(nodes, edges, executableNodeTypes): TopologicalLayerResult`
- Consumes: `getGroupBoxLiveMemberIds` only for deliberate membership synchronization, never for active-plan authority.

- [ ] **Step 1: Write failing graph contracts**

Cover a chain, fan-out/fan-in, disconnected subgraphs, stable repeated layers, self-edge, multi-node cycle, duplicate group membership, external executable upstream rejection, and accepted explicit static boundary input. The expected result shape is:

```ts
type GroupExecutionPlanResult =
  | { ok: true; plan: GroupExecutionPlan }
  | { ok: false; errors: GroupExecutionPlanError[] };

interface GroupExecutionPlan {
  groupId: string;
  groupName: string;
  memberIds: string[];
  executableIds: string[];
  layers: string[][];
  dependencies: Record<string, string[]>;
  descendants: Record<string, string[]>;
  externalDependencies: Array<{ sourceId: string; targetId: string }>;
}
```

- [ ] **Step 2: Run the contracts and verify current behavior fails**

Run: `npx tsx scripts/verify-parallel-group-execution-plan.ts`

Expected: FAIL because cycles are silently appended, overlapping groups are accepted, and external executable dependencies are discarded.

- [ ] **Step 3: Implement pure validated planning**

Implement Kahn layering with stable `x`, `y`, then ID tie-breaking. Return errors for `SELF_EDGE`, `CYCLE`, `DUPLICATE_MEMBERSHIP`, and `EXTERNAL_EXECUTABLE_DEPENDENCY`. Keep `topologicalSort()` as a compatibility wrapper that throws on invalid topology instead of appending unresolved nodes.

- [ ] **Step 4: Run focused graph contracts**

Run: `npx tsx scripts/verify-parallel-group-execution-plan.ts`

Run: `npx tsx scripts/verify-group-execution-manager-contract.ts`

Expected: both PASS with no visual-order cycle fallback.

- [ ] **Step 5: Commit the planning boundary**

```bash
git add apps/web/src/components/canvas/groupExecutionPlan.ts apps/web/src/utils/topologicalSort.ts apps/web/src/components/canvas/groupExecutionManager.ts scripts/verify-parallel-group-execution-plan.ts scripts/verify-group-execution-manager-contract.ts package.json
git commit -m "fix(canvas): validate group execution topology"
```

### Task 2: Monotonic Completion And Targeted Run Release

**Files:**
- Modify: `apps/web/src/stores/runBus.ts`
- Modify: `apps/web/src/hooks/useRunTrigger.ts`
- Create: `scripts/verify-run-bus-completion-sequence.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `LastDoneInfo.sequence: number`
- Produces: `releaseRun(nodeId: string): void`
- Preserves: `triggerRun`, `triggerRunMany`, `markDone`, and global `cancelAll`.

- [ ] **Step 1: Write the failing completion contract**

Freeze `Date.now()` to one value, complete the same node twice, and assert the second `LastDoneInfo.sequence` is greater. Assert `releaseRun('a')` removes only `a` while leaving `b` active.

- [ ] **Step 2: Run and confirm failure**

Run: `npx tsx scripts/verify-run-bus-completion-sequence.ts`

Expected: FAIL because `sequence` and `releaseRun` do not exist.

- [ ] **Step 3: Implement sequence and targeted release**

Increment `completionSequence` inside the Zustand `markDone` state update. Keep timestamps for logs and sound notification only. `releaseRun` must remove one ID and must not reset batch totals or other running IDs.

- [ ] **Step 4: Run contract and Web type-check**

Run: `npx tsx scripts/verify-run-bus-completion-sequence.ts`

Run: `npm run type-check -w @xinghuan/web`

Expected: PASS.

- [ ] **Step 5: Commit run-bus correlation**

```bash
git add apps/web/src/stores/runBus.ts apps/web/src/hooks/useRunTrigger.ts scripts/verify-run-bus-completion-sequence.ts package.json
git commit -m "fix(canvas): correlate node completions monotonically"
```

### Task 3: Five-Group Admission And Ten-Node Fair Scheduler

**Files:**
- Create: `apps/web/src/components/canvas/groupRunScheduler.ts`
- Create: `apps/web/src/stores/groupRunStore.ts`
- Create: `scripts/verify-group-run-scheduler.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `createGroupRunScheduler(deps: GroupRunSchedulerDependencies): GroupRunScheduler`
- Produces: `admit(request): { ok: true; runId: string } | { ok: false; code: AdmissionErrorCode; message: string }`
- Produces: store projections `activeGroupIds`, `activeNodeIds`, `groupStates`, and `globalMode`.
- Consumes: validated `GroupExecutionPlan` from Task 1 and completion sequence from Task 2.

- [ ] **Step 1: Write failing scheduler contracts**

Use deferred promises as node executions. Assert five groups admit, sixth rejects without queueing, duplicate group rejects, active nodes never exceed ten, round-robin gives a waiting group a slot, success/failure/cancel release ownership, and one group completion does not stop another.

- [ ] **Step 2: Run and confirm failure**

Run: `npx tsx scripts/verify-group-run-scheduler.ts`

Expected: FAIL because scheduler/store modules do not exist.

- [ ] **Step 3: Implement bounded fair scheduling**

The scheduler owns per-group ready queues and rotates a cursor across active groups. It dispatches while `activeNodeCount < 10`, never admits more than five groups, and calls a targeted release for natural completion. Global cancellation sets every run cancellation token and then invokes `cancelAll()` once.

- [ ] **Step 4: Implement descendant-only failure blocking**

After retries are exhausted, mark the node failed, mark its transitive descendants blocked, continue other ready branches, and finish the group as failed only after all running independent nodes settle. Do not start the next round after failure.

- [ ] **Step 5: Run scheduler and graph contracts**

Run: `npx tsx scripts/verify-group-run-scheduler.ts`

Run: `npx tsx scripts/verify-parallel-group-execution-plan.ts`

Expected: PASS.

- [ ] **Step 6: Commit scheduler and observable store**

```bash
git add apps/web/src/components/canvas/groupRunScheduler.ts apps/web/src/stores/groupRunStore.ts scripts/verify-group-run-scheduler.ts package.json
git commit -m "feat(canvas): schedule parallel group branches safely"
```

### Task 4: Canvas Runtime And Group Controls Integration

**Files:**
- Modify: `apps/web/src/components/canvas/useCanvasRuntime.ts`
- Modify: `apps/web/src/stores/groupBus.ts`
- Modify: `apps/web/src/components/nodes/GroupBoxNode.tsx`
- Modify: `apps/web/src/components/Canvas.tsx`
- Modify: `apps/web/src/components/CanvasToolbar.tsx`
- Modify: `scripts/verify-canvas-runtime-split-contract.mjs`
- Create: `scripts/verify-parallel-group-runtime-integration.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `createGroupRunScheduler`, `useGroupRunStore`, and validated planning.
- Produces: `handleRunGroup(groupId, memberIds, executionCount)`.
- Produces: aggregate toolbar projection without making `isRunning` a manual-group admission lock.

- [ ] **Step 1: Write failing integration contract**

Assert `Canvas.tsx` passes `executeReq.groupId`, `useCanvasRuntime` no longer returns early from manual group execution merely because another group is running, GroupBox subscribes to its own running state, and group completion does not call `cancelAll()`.

- [ ] **Step 2: Run and confirm failure**

Run: `node scripts/verify-parallel-group-runtime-integration.mjs`

Expected: FAIL against the single global `isRunning` path.

- [ ] **Step 3: Wire scheduler into the runtime**

Keep global Run All/manager execution on the existing exclusive path. Manual group requests build and validate a fresh plan, call scheduler admission, and report admission/plan errors through the existing visible notice/log mechanism without `alert()` or a modal backdrop.

- [ ] **Step 4: Wire group and toolbar states**

The GroupBox button shows running state for its own group. The toolbar Cancel button remains visible while any global or manual run is active and cancels all active work. Context-menu group execution uses a stable request identity derived from the selected GroupBox when available.

- [ ] **Step 5: Run integration, type-check, and build**

Run: `node scripts/verify-parallel-group-runtime-integration.mjs`

Run: `node scripts/verify-canvas-runtime-split-contract.mjs`

Run: `npm run type-check -w @xinghuan/web`

Run: `npm run build -w @xinghuan/web`

Expected: PASS.

- [ ] **Step 6: Commit runtime integration**

```bash
git add apps/web/src/components/canvas/useCanvasRuntime.ts apps/web/src/stores/groupBus.ts apps/web/src/components/nodes/GroupBoxNode.tsx apps/web/src/components/Canvas.tsx apps/web/src/components/CanvasToolbar.tsx scripts/verify-canvas-runtime-split-contract.mjs scripts/verify-parallel-group-runtime-integration.mjs package.json
git commit -m "feat(canvas): run five groups with layered concurrency"
```

### Task 5: Documentation, Regression, And Local Acceptance

**Files:**
- Modify: `docs/systems/canvas/node-and-data-model.md`
- Modify: `docs/systems/canvas/README.md`
- Modify: `docs/logbooks/daily/2026/2026-08/2026-08-07.md`
- Modify: relevant hotspot/watchlist record if `Canvas.tsx` changes require it.

**Interfaces:**
- Documents: five-group admission, ten-node global budget, layer semantics, failure propagation, and cancellation ownership.

- [ ] **Step 1: Update system documentation and daily evidence**

Record actual implemented behavior and test commands only. Do not record deployment success before remote verification.

- [ ] **Step 2: Run complete focused regression**

Run: `npm run verify:group-execution-manager`

Run: `npm run verify:parallel-group-execution-plan`

Run: `npm run verify:group-run-scheduler`

Run: `npm run verify:run-bus-completion-sequence`

Run: `npm run verify:parallel-group-runtime-integration`

Run: `npm run type-check -w @xinghuan/web`

Run: `npm run build -w @xinghuan/web`

- [ ] **Step 3: Run governance gates**

Run: `npm run verify:file-hotspot-budgets`

Run: `npm run verify:hotspot-watchlist-contract`

Run: `npm run harness:verify:project`

- [ ] **Step 4: Commit documentation and verified implementation state**

```bash
git add docs/systems/canvas docs/logbooks/daily/2026/2026-08/2026-08-07.md docs/records/architecture
git commit -m "docs(canvas): record parallel group runtime"
```

