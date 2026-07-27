# v0.8.3 Old-Server Stability And Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the `0.8.3` recovery, Agent, release-safety, crash-isolation, Canvas performance, hotspot-structure, and release improvements only to old-server Gray and Production.

**Architecture:** The work is six independently releasable sub-builds. r1 makes Provider dispatch and remote deployment safe; r2-r6 isolate frontend failures, measure and improve Canvas behavior, then extract hotspots without replacing React Flow, persistence authority, or Provider protocols.

**Tech Stack:** TypeScript, React, React Flow, Vite, Vitest, Node.js release scripts, PostgreSQL, Redis, systemd, existing Harness.

## Global Constraints

- Product version is exactly `0.8.3`; release IDs carry `r1`, `r2`, and later sequences.
- Deployment is only `ubuntu@101.33.75.38:728`; Gray is `/opt/apps/xinghuan-canvas-next`, Production is `/opt/apps/xinghuan-canvas`.
- `43.131.246.222` and `zezhen.online` must fail target verification and are never touched.
- Gray and Production use separate roots, services, env files, URLs, ports and databases; Production uses the accepted Gray archive and SHA-256.
- Never run retention apply or delete release directories.
- Do not log or commit secret values, signed URLs, database URLs, cookies, or SSH key contents.
- Preserve Canvas ownership, revisions, persistence, task states and Provider protocols unless a task explicitly changes a tested boundary.
- Stage explicit paths only. Do not use `git add -A`.

## r1: Recovery, Agent Gate, And Old-Server Safety

### Task 1: Isolate Worker Task Operation Dispatch

**Files:**

- Create: `apps/worker/src/worker-task-operation.ts`
- Create: `apps/worker/src/worker-task-operation.test.ts`
- Modify: `apps/worker/src/worker-output-recovery.ts`
- Modify: `apps/worker/src/worker.ts`
- Modify: `apps/api/src/admin-task-list-routes.ts`
- Modify: `apps/api/src/admin-task-list-routes.test.ts`

**Interfaces:**

~~~ts
export type WorkerTaskOperation = 'provider_execution' | 'output_recovery';
export type WorkerTaskExecutionResult = Record<string, unknown>;

export function resolveWorkerTaskOperation(
  task: Pick<TaskRow, 'payload' | 'result'>,
): WorkerTaskOperation;

export interface WorkerTaskOperationInput {
  task: TaskRow;
  executeProvider: () => Promise<WorkerTaskExecutionResult>;
  executeOutputRecovery: () => Promise<WorkerTaskExecutionResult>;
}

export async function executeWorkerTaskOperation(
  input: WorkerTaskOperationInput,
): Promise<WorkerTaskExecutionResult>;
~~~

- [x] **Step 1: Write failing resolver and dispatch tests**

~~~ts
it.each([
  [{ payload: { outputRecoveryMode: 'output_only' } }, 'output_recovery'],
  [{ result: { outputRecoveryMode: 'output_only' } }, 'output_recovery'],
  [{ payload: { outputRecoveryMode: 'provider_execution' }, result: { outputRecoveryMode: 'output_only' } }, 'output_recovery'],
  [{ payload: { taskCapability: 'video' }, result: {} }, 'provider_execution'],
])('resolves %j to %s', (task, expected) => {
  expect(resolveWorkerTaskOperation(task as TaskRow)).toBe(expected);
});

it('never invokes Provider execution for recovery', async () => {
  const provider = vi.fn(async () => ({ status: 'succeeded' } as WorkerTaskExecutionResult));
  const recovery = vi.fn(async () => ({ status: 'succeeded' } as WorkerTaskExecutionResult));
  await executeWorkerTaskOperation({ task: resultOnlyRecoveryTask, executeProvider: provider, executeOutputRecovery: recovery });
  expect(provider).not.toHaveBeenCalled();
  expect(recovery).toHaveBeenCalledOnce();
});
~~~

- [x] **Step 2: Run RED**

Run: `npm test -- apps/worker/src/worker-task-operation.test.ts`

Expected: failure because the operation module does not exist.

- [x] **Step 3: Implement the pure operation module**

~~~ts
export function resolveWorkerTaskOperation(task: Pick<TaskRow, 'payload' | 'result'>): WorkerTaskOperation {
  return task.payload.outputRecoveryMode === 'output_only' || task.result.outputRecoveryMode === 'output_only'
    ? 'output_recovery'
    : 'provider_execution';
}

export async function executeWorkerTaskOperation(input: WorkerTaskOperationInput) {
  return resolveWorkerTaskOperation(input.task) === 'output_recovery'
    ? input.executeOutputRecovery()
    : input.executeProvider();
}
~~~

Keep Provider adapter imports and secret handling in worker.ts. Remove the temporary resolver export from worker-output-recovery.ts.

- [x] **Step 4: Replace the Worker inline ternary**

~~~ts
const result = await executeWorkerTaskOperation({
  task,
  executeProvider: () => executeTask(task, cancellationMonitor?.signal),
  executeOutputRecovery: () => executeOutputRecoveryTask(task, decryptSecret),
});
~~~

Worker.ts must be at or below its hotspot budget; do not raise that budget.

- [x] **Step 5: Preserve Admin dual-write behavior**

~~~ts
payload: { ...plainObject(currentTask.payload), outputRecoveryMode: 'output_only' },
result: { ...currentResult, outputRecoveryMode: 'output_only' },
~~~

The route test asserts unchanged task ID, preserved generation payload, and both markers.

- [ ] **Step 6: Run GREEN and commit**

Run: `npm test -- apps/worker/src/worker-task-operation.test.ts apps/api/src/admin-task-list-routes.test.ts`

Run: `npm run verify:file-hotspot-budgets`

Commit: `git add apps/worker/src/worker-task-operation.ts apps/worker/src/worker-task-operation.test.ts apps/worker/src/worker-output-recovery.ts apps/worker/src/worker.ts apps/api/src/admin-task-list-routes.ts apps/api/src/admin-task-list-routes.test.ts && git commit -m "fix(worker): isolate output recovery dispatch"`

### Task 2: Add the Cross-Layer Recovery Contract Gate

**Files:**

- Create: `scripts/verify-output-recovery-operation-contract.mjs`
- Modify: `package.json`, `scripts/package-release.mjs`
- Modify: `docs/systems/worker/output-materialization.md`

**Interface:** `npm run verify:output-recovery-operation-contract`

- [ ] **Step 1: Make the verifier fail until package wiring is present**

~~~js
assert.match(adminSource, /payload:[\s\S]*outputRecoveryMode:[\s\S]*output_only/);
assert.match(operationSource, /result\.outputRecoveryMode === ['"]output_only['"]/);
assert.match(workerSource, /executeWorkerTaskOperation\(/);
assert.doesNotMatch(workerSource, /payload\.outputRecoveryMode === ['"]output_only['"] \? await executeOutputRecoveryTask/);
assert.match(packageSource, /verify:output-recovery-operation-contract/);
~~~

- [ ] **Step 2: Register and package the verifier**

Add the command to package.json. Add its path to requiredPaths and includedPaths in scripts/package-release.mjs.

- [ ] **Step 3: Correct operator documentation**

State that only the r1 deployed contract plus the Gray fixture guarantees output-only recovery; Production use remains prohibited before that evidence exists.

- [ ] **Step 4: Run and commit**

Run: `npm run verify:output-recovery-operation-contract && npm test -- apps/worker/src/worker-task-operation.test.ts apps/api/src/admin-task-list-routes.test.ts`

Commit: `git add scripts/verify-output-recovery-operation-contract.mjs package.json scripts/package-release.mjs docs/systems/worker/output-materialization.md && git commit -m "test(release): guard output recovery operation contract"`

### Task 3: Make Old-Server Target Selection Fail Closed

**Files:**

- Create: `config/release-target-profiles.json`
- Create: `scripts/release/target-profile.mjs`
- Create: `scripts/verify-old-server-release-target.mjs`
- Modify: `scripts/release/_shared.mjs`, `scripts/release/deploy-gray-release.mjs`, `scripts/release/verify-gray-runtime.mjs`
- Modify: `package.json`, `scripts/package-release.mjs`, `docs/systems/observability-and-ops/release-gates.md`

**Interfaces:**

~~~ts
export interface ReleaseTargetFingerprint {
  profile: 'old-server';
  environment: 'gray' | 'production';
  host: '101.33.75.38';
  port: 728;
  remoteRoot: string;
  sharedEnvFile: string;
  serviceName: string;
  workerServiceName: string;
  publicStatusUrl: string;
  internalStatusUrl: string;
  expectedDatabaseName: string;
}

export async function loadReleaseTargetProfile(input: {
  profile: 'old-server';
  environment: 'gray' | 'production';
}): Promise<ReleaseTargetFingerprint>;

export function assertOldServerTarget(target: ReleaseTargetFingerprint): void;
~~~

- [ ] **Step 1: Add allowed Gray/Production and rejected-new-server tests**

~~~ts
expect(assertOldServerTarget(oldGray)).toBeUndefined();
expect(assertOldServerTarget(oldProduction)).toBeUndefined();
expect(() => assertOldServerTarget({ ...oldGray, host: '43.131.246.222' })).toThrow('OLD_SERVER_TARGET_MISMATCH');
~~~

- [ ] **Step 2: Create the non-secret profile**

It contains exact host, port, roots, services, worker services, env-file paths, status URLs, queue names and expected database names for both environments. It includes no key paths, passwords, tokens or database URLs.

- [ ] **Step 3: Require target profile for deploy and runtime verification**

The r1 deploy and runtime commands require `--target-profile=old-server`. Resolve settings from that profile before CLI overrides. Reject any override that differs from the profile. Output only a sanitized fingerprint.

- [ ] **Step 4: Register, package, verify and commit**

Run: `npm run verify:old-server-release-target -- --target-profile=old-server --env=gray`

Run: `npm run verify:old-server-release-target -- --target-profile=old-server --env=production`

Commit: `git add config/release-target-profiles.json scripts/release/target-profile.mjs scripts/verify-old-server-release-target.mjs scripts/release/_shared.mjs scripts/release/deploy-gray-release.mjs scripts/release/verify-gray-runtime.mjs package.json scripts/package-release.mjs docs/systems/observability-and-ops/release-gates.md && git commit -m "fix(release): lock v0.8.3 to old server"`

### Task 4: Make Agent Environment Readiness a Release Gate

**Files:**

- Create: `scripts/verify-agent-environment-readiness.mjs`
- Create: `scripts/verify-agent-environment-readiness-contract.mjs`
- Modify: `package.json`, `scripts/package-release.mjs`
- Modify: `docs/systems/agent-runtime/README.md`, `docs/systems/observability-and-ops/release-gates.md`

- [ ] **Step 1: Write the static contract before implementation**

It requires checks for eight bootstrap definitions, three Agent publications, three route publications, non-empty `text_chat` candidates, explicit controls, target environment, frontend/admin canaries and `mode=agent` without fallback.

- [ ] **Step 2: Implement a read-only runtime verifier**

It uses the old-server profile and authenticated Admin read endpoints. It never bootstraps, publishes, mutates controls or prints credentials. Billed canaries run only with `--allow-billed-canaries=true`; otherwise the verifier records that live canaries were deliberately skipped.

- [ ] **Step 3: Register, package, verify and commit**

Run: `npm run verify:agent-environment-readiness-contract && npm run verify:agent-runtime-architecture-contract`

Commit: `git add scripts/verify-agent-environment-readiness.mjs scripts/verify-agent-environment-readiness-contract.mjs package.json scripts/package-release.mjs docs/systems/agent-runtime/README.md docs/systems/observability-and-ops/release-gates.md && git commit -m "test(agent): gate environment readiness"`

### Task 5: Build, Package, And Commit r1

**Files:**

- Modify: `package.json`, `package-lock.json`
- Modify: r1 plan/spec/audit, worker and Agent system docs
- Create: r1 Gray and Production release/validation records

- [ ] **Step 1: Set product version without creating a tag**

Run: `npm version 0.8.3 --no-git-tag-version`

- [ ] **Step 2: Run the r1 local release matrix**

~~~bash
npm test -- apps/worker/src/worker-task-operation.test.ts apps/api/src/admin-task-list-routes.test.ts
npm run verify:output-recovery-operation-contract
npm run verify:old-server-release-target -- --target-profile=old-server --env=gray
npm run verify:old-server-release-target -- --target-profile=old-server --env=production
npm run verify:agent-environment-readiness-contract
npm run type-check
npm run build:single-port
npm test
npm run harness:verify:release
npm run verify:release-governance-contract
~~~

- [ ] **Step 3: Create exactly one archive and record SHA-256**

Run: `npm run package:release -- 20260727-generation-delivery-agent-p0-v083-r1`

Record archive name, SHA-256, source commit, target fingerprint and preflight current links. Do not run retention commands.

- [ ] **Step 4: Commit source, docs and local evidence**

Stage only intentional files. The commit must pass hotspot checks without increasing the worker budget.

### Task 6: Gray r1 and Production r1

**Files:**

- Create: `docs/logbooks/releases/gray/2026-07-27-generation-delivery-agent-p0-v083-r1.md`
- Create: `docs/logbooks/validations/2026-07-27-generation-delivery-agent-p0-gray-v083-r1.md`
- Create: `docs/logbooks/releases/production/2026-07-27-generation-delivery-agent-p0-v083-r1.md`
- Create: `docs/logbooks/validations/2026-07-27-generation-delivery-agent-p0-production-v083-r1.md`
- Modify after success only: `ops/current/release-state.json`, `ops/current/gray.md`, `ops/current/production.md`, `ops/README.md`, `docs/logbooks/releases/current-release-index.md`, `docs/memory/current-state.md`

- [ ] **Step 1: Capture Gray preflight and deploy through target profile**

Confirm the sanitized target is `101.33.75.38:728` and the Gray root before upload.

- [ ] **Step 2: Run Gray runtime, Agent and recovery acceptance**

The isolated recovery fixture proves same task ID, zero Provider submissions, unchanged cost count, readable artifact and terminal success. Record safe counts/codes only.

- [ ] **Step 3: Promote the identical archive to Production**

Create an authorized Production database backup, compare archive SHA to Gray evidence, then perform only non-destructive runtime/Agent/recovery-code verification. Do not create a Production fixture.

- [ ] **Step 4: Record, commit and push release evidence**

Both records state `retentionApplyRun: false`, previous current link, target fingerprint and archive SHA. Confirm historical release directories remain present.

## r2: Scoped Crash Recovery And Legacy Visible Copy

### Task 7: Add Client-Safe Diagnostics and Boundary Components

**Files:**

- Create: `apps/web/src/components/errors/ui-failure-diagnostic.ts`
- Create: `apps/web/src/components/errors/ErrorRecoveryPanel.tsx`
- Create: `apps/web/src/components/errors/NodeRenderBoundary.tsx`
- Create: `apps/web/src/components/errors/WorkspaceErrorBoundary.tsx`
- Create tests: matching `*.test.tsx` files
- Modify: `apps/web/src/components/ErrorBoundary.tsx`, `apps/web/src/App.tsx`, `apps/admin/src/admin-route-error-boundary.tsx`

**Interface:**

~~~ts
interface UiFailureDiagnostic {
  id: string;
  scope: 'app-shell' | 'workspace' | 'node-renderer' | 'lazy-chunk' | 'media-preview' | 'admin-route';
  code: string;
  occurredAt: string;
  recoverable: boolean;
  userMessage: string;
}
~~~

- [ ] **Step 1: Write redaction and reset tests**

~~~ts
const diagnostic = toUiFailureDiagnostic(new Error('https://secret.example/path'), 'node-renderer');
expect(diagnostic).toMatchObject({ scope: 'node-renderer', recoverable: true });
expect(diagnostic.userMessage).not.toContain('secret.example');
~~~

- [ ] **Step 2: Implement diagnostic and recovery panel**

The panel displays a safe message, diagnostic ID, retry and secondary reload. Development may log a stack; production markup must not render raw component stacks, URLs or secrets.

- [ ] **Step 3: Install workspace and node-renderer boundaries**

The node wrapper preserves the node footprint and resets only when node ID, type or data revision changes. Workspace reset never mutates Canvas storage, nodes or edges.

- [ ] **Step 4: Replace user-visible penguin/garbled fallback copy**

Change only visible copy and styles in this task. Keep `penguin:*` events, persisted schema keys, local-storage keys and historic hidden node types intact.

- [ ] **Step 5: Verify and commit**

Run focused component tests, `npm run verify:web-lazy-import-recovery`, Web build, node render smoke, 1920×1080 browser QA and hotspot gates.

### Task 8: Record and Guard Legacy Identifier Compatibility

**Files:**

- Create: `docs/records/canvas/2026-07-27-penguin-compatibility-inventory.md`
- Create: `scripts/verify-penguin-compatibility-inventory.mjs`
- Modify: `docs/systems/canvas/README.md`, `package.json`

- [ ] **Step 1: Inventory each T8-penguin, penguin event, template and hidden node type**

Every entry is exactly one of `visible-copy`, `compatibility-contract` or `dead-code`, with consumers and the removal/migration rule.

- [ ] **Step 2: Prove dead-code candidates**

Use CodeGraph and behavior/import tests before marking any candidate dead. A missing visible reference alone is not proof that saved Canvas data does not depend on it.

- [ ] **Step 3: Add the inventory verifier and commit**

The verifier fails when new user-visible T8-penguin copy or a penguin fallback is introduced without inventory coverage. Named compatibility constants remain allowed.

### Task 9: Release r2

- [ ] **Step 1: Run local component, Web build, contract and release Harness checks**
- [ ] **Step 2: Gray-test node crash, workspace crash, second lazy-chunk failure, media preview failure and preserved pending Canvas data**
- [ ] **Step 3: Promote the same SHA to Production after non-destructive runtime verification**
- [ ] **Step 4: Record Gray/Production evidence and no-retention confirmation**

## r3: Loading and Render Measurement

### Task 10: Create Deterministic Canvas Fixtures and Measurement Harness

**Files:**

- Create: `apps/web/src/testing/canvas-performance-fixtures.ts`
- Create: `scripts/measure-canvas-performance.mjs`
- Create: `scripts/verify-canvas-performance-budget.mjs`
- Create: `docs/logbooks/validations/2026-07-27-canvas-performance-baseline-v083.md`
- Modify: `package.json`, `docs/systems/canvas/README.md`

- [ ] **Step 1: Build empty, 50, 100 and 200-node fixtures**

Fixtures use stable IDs/positions/edges, groups and bounded runtime projections. They never create external Provider work.

- [ ] **Step 2: Capture baseline before optimizing**

Record performance marks, long tasks, React commits, node render count, updateNodeInternals calls, polling requests and drag-frame timestamps. Write raw JSON only to a gitignored runtime artifact path; commit summary metrics to the validation record.

- [ ] **Step 3: Add a budget comparator**

It fails if entry, Canvas, Admin, CSS or selected node chunks or scenario metrics exceed recorded budget without an explicit validation-record waiver.

### Task 11: Defer Workspace Preload Until Authentication

**Files:**

- Create: `apps/web/src/utils/workspace-preload.ts`
- Create: `apps/web/src/utils/workspace-preload.test.ts`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/utils/lazyImportRecovery.ts`

- [ ] **Step 1: Write preload tests**

Test no module-evaluation Canvas preload, one idle preload after authentication and no retry loop after failed prefetch.

- [ ] **Step 2: Replace eager Promise.all initialization**

~~~ts
scheduleWorkspacePreload({
  isAuthenticated: Boolean(currentUser),
  preload: () => Promise.all([loadSidebar(), loadCanvas(), loadRHToolsProvider()]),
  requestIdleCallback: window.requestIdleCallback,
});
~~~

Prefetch failure must not block workspace navigation.

- [ ] **Step 3: Compare fixture baseline, chunk sizes and network waterfall**

Keep heavy MediaPipe/editor chunks interaction-driven unless benchmark evidence shows safe earlier loading.

- [ ] **Step 4: Release r3 through old-server Gray then same-SHA Production**

## r4: Canvas Narrow Mutation and Render Control

### Task 12: Centralize Node Mutation Semantics

**Files:**

- Create: `apps/web/src/components/canvas/canvas-node-mutations.ts`
- Create: `apps/web/src/components/canvas/canvas-node-mutations.test.ts`
- Modify: `apps/web/src/components/Canvas.tsx`
- Modify first callers: `apps/web/src/components/nodes/useUpdateNodeData.ts`, `apps/web/src/components/nodes/UploadNode.tsx`, `apps/web/src/components/nodes/TextSplitNode.tsx`

- [ ] **Step 1: Test identity preservation and snapshot equivalence**

Test untouched node/edge references, data patch, selection, layout and runtime projection behavior, then compare persistence snapshots before/after migration.

- [ ] **Step 2: Implement immutable per-ID patches and animation-frame batching**

~~~ts
export function patchNodeData(nodes: Node[], id: string, patch: Record<string, unknown>): Node[];
export function patchNodesById(nodes: Node[], patches: ReadonlyMap<string, NodePatch>): Node[];
export function createAnimationFrameBatch<T>(flush: (items: T[]) => void): {
  enqueue(item: T): void;
  dispose(): void;
};
~~~

- [ ] **Step 3: Migrate only the three named callers**

Do not mass-replace node updates. Measure after each caller and preserve persistence/revision behavior.

- [ ] **Step 4: Release r4 after 50/100/200-node regression and same-SHA Production verification**

### Task 13: Evaluate Visibility Rendering With Evidence

**Files:**

- Create: `apps/web/src/components/canvas/visible-elements-evaluation.test.tsx`
- Modify only if accepted: `apps/web/src/components/Canvas.tsx`
- Modify: r4 performance validation record

- [ ] **Step 1: Test off-screen grouped nodes, Workflow Region edges, selection, fit-view and runtime projection with visibility rendering off/on**
- [ ] **Step 2: Enable only if all behavior tests pass and 100/200-node measurements improve**
- [ ] **Step 3: Otherwise record rejection and retain current rendering**

## r5: Hot Node and CSS Boundaries

### Task 14: Split Hot Nodes One Responsibility Per Commit

**Files:**

- Create/modify under `apps/web/src/components/nodes/pose-master/`, `toolbox-param/`, `image/`, `drawing-board/`
- Modify matching behavior/render tests and hotspot ledger

- [ ] **Step 1: PoseMaster: extract field schema, preview section, then runtime actions in three tested commits**
- [ ] **Step 2: ToolboxParam: extract parameter section, material binding, then preview helper in three tested commits**
- [ ] **Step 3: Image and DrawingBoard: extract runtime action services before view sections**
- [ ] **Step 4: Run source-size/hotspot gates after every extraction**

### Task 15: Split CSS Along Runtime Boundaries

**Files:**

- Create: `apps/web/src/styles/error-recovery.css`, `canvas-shell.css`, `node-chrome.css`
- Create: `apps/admin/src/styles/route-shell.css`
- Modify: current Web/Admin style entry files and CSS contract tests

- [ ] **Step 1: Move only styles owned by each boundary and preserve cascade order through explicit imports**
- [ ] **Step 2: Add selector-scope tests rejecting broad global error selectors**
- [ ] **Step 3: Verify HMR, 1920×1080 layout, CSS budget and affected node smoke**
- [ ] **Step 4: Release r5 through old-server Gray and same-SHA Production**

## r6: API and Worker Orchestration Seams

### Task 16: Finish Worker Dispatch Table

**Files:**

- Create: `apps/worker/src/worker-operation-dispatch.ts` and tests
- Modify: `apps/worker/src/worker.ts`, operation modules and Worker system docs

- [ ] **Step 1: Map Provider execution, output recovery and deterministic Canvas steps as explicit handlers**
- [ ] **Step 2: Add tests for selection, cancellation passthrough and terminal result ownership**
- [ ] **Step 3: Keep Provider adapters out of the dispatch table and re-run lifecycle/output contracts**

### Task 17: Extract API Provider/Model Normalization Residue

**Files:**

- Create or extend focused `apps/api/src/provider-*` modules
- Modify: `apps/api/src/server.ts`, targeted API tests and hotspot ledger

- [ ] **Step 1: Use CodeGraph impact analysis to choose one provider key-pool or import-model normalization seam**
- [ ] **Step 2: Write behavior tests before extraction and preserve HTTP responses/errors**
- [ ] **Step 3: Extract one seam per commit, leaving only route registration in server.ts**
- [ ] **Step 4: Release r6 after affected API/Worker integration and old-server gates**

## Final Verification and Completion Audit

### Task 18: Prove the Full Objective

- [ ] **Step 1: Inspect r1-r6 records and prove every product version is 0.8.3, Gray precedes Production and Production SHA equals Gray SHA**
- [ ] **Step 2: Read old-server release directories and prove no historical release was removed**
- [ ] **Step 3: Inspect target fingerprints and prove no objective command targeted 43.131.246.222 or zezhen.online**
- [ ] **Step 4: Re-run type-check, tests, builds, Harness, release governance, CodeGraph sync and browser smoke**
- [ ] **Step 5: Update current state, system docs, hotspot ledger, release index and daily evidence; commit and push intentional files only**
- [ ] **Step 6: Mark the persistent goal complete only after requirement-by-requirement evidence exists**
