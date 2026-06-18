# RunningHub And User Queue Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Commit the current RunningHub first-stage work, then add real RunningHub workflow execution, provider-side concurrency gating, per-user queue governance for ordinary worker tasks, and release-safe migration dependency validation before the next gray rollout.

**Architecture:** Keep the existing capability-based worker queues (`image/audio/video`) as the outer execution lanes, then add a second layer of execution governance: per-user active-window limits for ordinary generation tasks, plus provider-platform windows for RunningHub tasks. RunningHub remains a provider protocol and is not split into a separate task system; instead, RH tasks pass through a dedicated execution gate so they can queue independently without blocking other protocols. Release migration safety is fixed in the packaging/runtime chain, not papered over in runbooks.

**Tech Stack:** TypeScript, React, Vite, Node HTTP server, PostgreSQL, Redis, existing worker/task queue runtime, CodeGraph, static verification scripts under `scripts/`

---

## File Structure

### Backend / shared / worker

- Modify: `packages/shared/src/task-queue-settings.ts`
  - Extend queue settings from capability-only concurrency into capability concurrency + per-user windows + provider-specific governance fields.
- Modify: `packages/shared/src/index.ts`
  - Re-export new queue governance types.
- Modify: `apps/api/src/server.ts`
  - Read/write expanded system settings, expose RH concurrency settings, persist user-level queue governance config, surface queue diagnostics.
- Modify: `apps/worker/src/worker.ts`
  - Add execution gate for per-user concurrency and RunningHub provider concurrency without blocking unrelated protocols.
- Modify: `apps/api/src/runninghub-catalog.ts`
  - Ensure real RH item execution fields are complete enough for real workflow testing.
- Modify: `apps/api/src/runninghub-execution-descriptor.ts`
  - Add any missing submit/polling/upload defaults needed by the real RH workflow.
- Modify: `apps/api/src/provider-task-service.ts` or equivalent RH execution path file if the current RH submit/query logic lives outside `server.ts`
  - Normalize RH runtime dispatch, queue admission, and failure messages.
- Modify: `scripts/db-migrate.mjs`
  - Fix `pg` dependency resolution in packaged release directories.
- Modify: `package.json`
  - Add focused verification commands if needed.

### Admin

- Modify: `apps/admin/src/admin-types.ts`
  - Add expanded queue governance shapes and RH platform settings.
- Modify: `apps/admin/src/admin-api-client.ts`
  - Add read/write methods for queue governance and RH execution settings.
- Modify: `apps/admin/src/admin-readonly-panels.tsx`
  - Replace capability-only controls with clearer queue governance controls.
- Modify: `apps/admin/src/admin-runninghub-workspace.tsx`
  - Add real workflow test controls and RH queue/concurrency visibility.
- Modify: `apps/admin/src/admin-runninghub-item-editor.tsx`
  - Add any execution descriptor fields required by the real RH workflow doc.
- Modify: `apps/admin/src/styles.css`
  - Layout/support styles for new queue governance controls and RH runtime status blocks.

### Verification / docs / ops

- Create: `scripts/verify-runninghub-queue-governance-contract.mjs`
  - Assert RH concurrency settings and execution gate wiring exist.
- Create: `scripts/verify-user-queue-governance-contract.mjs`
  - Assert per-user queue governance settings and worker checks exist.
- Create: `scripts/verify-db-migrate-release-deps.mjs`
  - Assert release migration script still resolves `pg` in packaged/release context.
- Modify: `scripts/verify-runninghub-workflow-api.mjs`
  - Expand to cover the real RH workflow config path where appropriate.
- Modify: `DEVLOG.md`
  - Record implementation, local verification, RH real test, gray rollout.
- Modify: `README.md`
  - Update current RH and queue governance status if active release changes.
- Modify: `MEMORY.md`
  - Record queue governance rules and migration dependency resolution.
- Modify: `docs/prd/README.md`
  - Update active gray/production status when release pointers change.
- Modify: `docs/prd/v0.1.0/progress.md`
  - Record queue governance and RH execution governance capability.
- Modify: `docs/prd/v0.1.0/changelog.md`
  - Record externally visible change summary.
- Modify: `docs/project-atlas/interfaces-and-dataflow.md`
  - Add queue-governance and RH execution-gate data flow.
- Modify: `docs/project-atlas/worker-execution-chain.md`
  - Document capability queue, user gate, RH platform gate, and release migration caveat removal.
- Create: `ops/runninghub-user-queue-governance-gray-release-2026-06-18.md`
  - Gray rollout record for this batch.

## Task 0: Freeze The Current RH Slice With A Local Commit

**Files:**
- Modify: existing tracked RH/doc files already in worktree

- [ ] **Step 1: Review current uncommitted scope**

Run: `git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b status --short`  
Expected: RH first-stage files, docs, and release-note additions are visible.

- [ ] **Step 2: Re-run minimum RH sanity checks before commit**

Run: `node scripts/verify-runninghub-single-node-contract.mjs`  
Expected: PASS

Run: `npm run build -w @xinghuan/web`  
Expected: PASS

- [ ] **Step 3: Create the local checkpoint commit**

```bash
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b add AGENTS.md DEVLOG.md MEMORY.md README.md apps/api/src/server.ts apps/web/src/components/nodes/RunningHubNode.tsx apps/web/src/services/runninghubCatalog.ts apps/web/src/utils/runninghubNodeSchema.ts docs/prd/README.md docs/project-atlas/api-navigation.md docs/project-atlas/interfaces-and-dataflow.md ops/README.md ops/runninghub-workspace-gray-release-2026-06-18.md scripts/verify-runninghub-single-node-contract.mjs docs/superpowers/plans/2026-06-18-runninghub-workspace-and-single-node.md
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b commit -m "feat: ship runninghub workspace first stage"
```

- [ ] **Step 4: Sync CodeGraph**

Run: `codegraph sync`  
Expected: successful sync output

## Task 1: Design And Persist Expanded Queue Governance Settings

**Files:**
- Modify: `packages/shared/src/task-queue-settings.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/admin-api-client.ts`
- Modify: `apps/admin/src/admin-readonly-panels.tsx`
- Test: `scripts/verify-user-queue-governance-contract.mjs`

- [ ] **Step 1: Write the failing queue-governance contract**

```js
import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const shared = await readFile(new URL("../packages/shared/src/task-queue-settings.ts", import.meta.url), "utf8");
const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const admin = await readFile(new URL("../apps/admin/src/admin-readonly-panels.tsx", import.meta.url), "utf8");

assert.match(shared, /userConcurrency/);
assert.match(shared, /runninghub/);
assert.match(worker, /acquireUserExecutionWindow/);
assert.match(worker, /acquireRunningHubExecutionWindow/);
assert.match(admin, /用户并发/);
assert.match(admin, /RunningHub 并发/);
```

- [ ] **Step 2: Run the contract to confirm it fails**

Run: `node scripts/verify-user-queue-governance-contract.mjs`  
Expected: FAIL because shared/admin/worker governance fields do not exist yet.

- [ ] **Step 3: Expand shared queue settings types**

Target shape:

```ts
export interface TaskQueueCapabilityConfig {
  concurrency: number;
  userConcurrency: number;
}

export interface RunningHubQueueGovernance {
  enabled: boolean;
  maxConcurrent: number;
  queueEnabled: boolean;
}

export interface TaskQueueSettings {
  image: TaskQueueCapabilityConfig;
  audio: TaskQueueCapabilityConfig;
  video: TaskQueueCapabilityConfig;
  runninghub: RunningHubQueueGovernance;
}
```

- [ ] **Step 4: Extend API normalization and persistence**

Implementation requirements:
- old `{ image/audio/video.concurrency }` settings must still normalize safely
- new fields default conservatively
- write path must keep revision-conflict semantics intact
- admin system payload must return the expanded settings in one shape

- [ ] **Step 5: Add admin controls**

Admin UX requirements:
- capability section still shows image/audio/video worker concurrency
- each capability adds “单用户并发上限”
- RH adds a separate block:
  - `启用 RunningHub 平台并发治理`
  - `同时执行上限`
  - `超过上限自动排队`
- copy must explain behavior in plain Chinese

- [ ] **Step 6: Re-run focused validations**

Run: `node scripts/verify-user-queue-governance-contract.mjs`  
Expected: PASS

Run: `npm run build -w @xinghuan/shared`  
Expected: PASS

Run: `npm run build -w @xinghuan/api`  
Expected: PASS

Run: `npm run build -w @xinghuan/admin`  
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b add packages/shared/src/task-queue-settings.ts packages/shared/src/index.ts apps/api/src/server.ts apps/admin/src/admin-types.ts apps/admin/src/admin-api-client.ts apps/admin/src/admin-readonly-panels.tsx scripts/verify-user-queue-governance-contract.mjs
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b commit -m "feat: add queue governance settings"
```

## Task 2: Add Per-User Execution Windows For Ordinary Worker Tasks

**Files:**
- Modify: `apps/worker/src/worker.ts`
- Modify: `apps/api/src/server.ts`
- Test: `scripts/verify-user-queue-governance-contract.mjs`
- Test: `scripts/verify-worker-queue.mjs` or a new focused queue script if needed

- [ ] **Step 1: Add a failing worker assertion for user-gated execution**

Contract additions:

```js
assert.match(worker, /task\.userId/);
assert.match(worker, /acquireUserExecutionWindow/);
assert.match(worker, /releaseUserExecutionWindow/);
assert.match(worker, /requeueDeferredTask|deferTaskExecution/);
```

- [ ] **Step 2: Implement user execution gate in worker**

Behavior:
- capability queue still controls total active worker slots
- before actual task execution, worker checks the task owner
- if user active count is below that capability's `userConcurrency`, execute immediately
- if not, task returns to a deferred wait path and is retried later
- non-owned system tasks fall back to existing capability-only behavior

- [ ] **Step 3: Keep unrelated users independent**

Execution rules:
- user A filling their image slots must not block user B image tasks
- audio/video remain isolated by capability
- deferred tasks must not be marked `running` while waiting for user window

- [ ] **Step 4: Surface queue state accurately**

API/admin state requirements:
- distinguish:
  - `queued` because not yet picked
  - `waiting_user_window` because user cap is full
- admin observability should show enough state to debug fairness

- [ ] **Step 5: Re-run focused verification**

Run: `node scripts/verify-user-queue-governance-contract.mjs`  
Expected: PASS

Run: `npm run verify:worker`  
Expected: PASS

Run: `npm run build -w @xinghuan/api`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b add apps/worker/src/worker.ts apps/api/src/server.ts scripts/verify-user-queue-governance-contract.mjs
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b commit -m "feat: gate worker execution by user concurrency"
```

## Task 3: Add RunningHub Platform Concurrency Gate And Auto-Queue Progression

**Files:**
- Modify: `apps/worker/src/worker.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/runninghub-execution-descriptor.ts`
- Test: `scripts/verify-runninghub-queue-governance-contract.mjs`

- [ ] **Step 1: Write the failing RH governance contract**

```js
import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");

assert.match(worker, /runninghub/);
assert.match(worker, /acquireRunningHubExecutionWindow/);
assert.match(worker, /releaseRunningHubExecutionWindow/);
assert.match(worker, /waiting_provider_window|waiting_runninghub_window/);
assert.match(server, /runninghub: \{/);
```

- [ ] **Step 2: Implement RH platform gate**

Behavior:
- applies only when provider protocol is `runninghub`
- checks global RH active count against `runninghub.maxConcurrent`
- if capacity exists, execute RH submit/polling normally
- if full, task stays deferred without consuming non-RH execution

- [ ] **Step 3: Ensure auto progression**

Rules:
- when one RH task completes/fails/cancels, next waiting RH task becomes eligible automatically
- queue progression is FIFO within the waiting RH lane unless an existing local priority rule already applies
- non-RH tasks never need the RH gate

- [ ] **Step 4: Keep RH gate layered after user gate**

Order:
1. capability queue slot obtained
2. user window checked
3. RH platform window checked if protocol is RH
4. actual provider call starts

Reason:
- preserves per-user fairness even inside RH
- prevents one user from monopolizing RH window if user caps are lower

- [ ] **Step 5: Verify focused contract/build**

Run: `node scripts/verify-runninghub-queue-governance-contract.mjs`  
Expected: PASS

Run: `npm run build -w @xinghuan/api`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b add apps/worker/src/worker.ts apps/api/src/server.ts apps/api/src/runninghub-execution-descriptor.ts scripts/verify-runninghub-queue-governance-contract.mjs
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b commit -m "feat: add runninghub execution gate"
```

## Task 4: Complete Real RunningHub Workflow Configuration And Real Test Flow

**Files:**
- Modify: `apps/api/src/runninghub-catalog.ts`
- Modify: `apps/api/src/runninghub-execution-descriptor.ts`
- Modify: `apps/admin/src/admin-runninghub-workspace.tsx`
- Modify: `apps/admin/src/admin-runninghub-item-editor.tsx`
- Modify: `scripts/verify-runninghub-workflow-api.mjs`
- Test: real gray/manual workflow execution using the provided RH doc

- [ ] **Step 1: Map the real RH workflow doc into our descriptor model**

Input source:
- RH doc: `https://www.runninghub.cn/call-api/api-detail/2004516402230509570?apiType=3`

Deliverables:
- identify submit endpoint
- identify polling endpoint / task status field
- identify required inputs and file/url handling
- identify result path and failure path

Important:
- do not commit the provided key into Git
- configure key only in environment/admin runtime

- [ ] **Step 2: Extend RH item editor if the real workflow needs extra fields**

Possible additions:
- explicit submit endpoint override
- polling status path
- result output path
- upload handling mode
- task id extraction path

- [ ] **Step 3: Create one real testable RH item**

Requirements:
- use the provided test key only in runtime config
- save a concrete RH catalog item suitable for real execution
- make the item selectable in the RH workspace and RH node flow

- [ ] **Step 4: Run local/static verification**

Run: `node scripts/verify-runninghub-workflow-contract.mjs`  
Expected: PASS

Run: `node scripts/verify-runninghub-workflow-api.mjs`  
Expected: PASS

Run: `npm run build -w @xinghuan/admin`  
Expected: PASS

Run: `npm run build -w @xinghuan/api`  
Expected: PASS

- [ ] **Step 5: Perform real RH workflow test**

Manual/gray acceptance checklist:
- real RH item submits successfully
- if RH window is available, task enters execution
- if RH window is full, additional RH tasks wait then auto-progress
- returned task status and failure messages are accurate
- result asset reaches our task/material chain correctly

- [ ] **Step 6: Commit**

```bash
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b add apps/api/src/runninghub-catalog.ts apps/api/src/runninghub-execution-descriptor.ts apps/admin/src/admin-runninghub-workspace.tsx apps/admin/src/admin-runninghub-item-editor.tsx scripts/verify-runninghub-workflow-api.mjs
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b commit -m "feat: support real runninghub workflow execution"
```

## Task 5: Fix Release Migration Dependency Chain

**Files:**
- Modify: `scripts/db-migrate.mjs`
- Modify: `package.json`
- Create: `scripts/verify-db-migrate-release-deps.mjs`
- Possibly modify: release packaging script(s) under `scripts/` if `pg` omission comes from packaging layout

- [ ] **Step 1: Write the failing release-deps contract**

```js
import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const migrate = await readFile(new URL("../scripts/db-migrate.mjs", import.meta.url), "utf8");
assert.match(migrate, /from \"pg\"|await import\\(\"pg\"\\)/);
assert.doesNotMatch(migrate, /PG_DRIVER_NOT_INSTALLED[\\s\\S]*return/);
```

- [ ] **Step 2: Reproduce packaged-release resolution path locally**

Goal:
- confirm whether the fault is ESM import timing, dependency omission, or release packaging path shape

- [ ] **Step 3: Implement the actual fix**

Acceptable outcomes:
- `db-migrate` resolves `pg` directly from packaged install
- release package includes the dependency path needed at runtime
- migration script no longer silently degrades into `PG_DRIVER_NOT_INSTALLED` in a valid release install

- [ ] **Step 4: Verify**

Run: `node scripts/verify-db-migrate-release-deps.mjs`  
Expected: PASS

Run: `npm run build:single-port`  
Expected: PASS

Run: `node scripts/verify-release-package-contract.mjs`  
Expected: PASS

Run: `node scripts/verify-release-preflight-contract.mjs`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b add scripts/db-migrate.mjs package.json scripts/verify-db-migrate-release-deps.mjs
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b commit -m "fix: restore release db migrate dependencies"
```

## Task 6: Final Verification, Gray Rollout, And Documentation Closure

**Files:**
- Modify: `DEVLOG.md`
- Modify: `README.md`
- Modify: `MEMORY.md`
- Modify: `docs/prd/README.md`
- Modify: `docs/prd/v0.1.0/progress.md`
- Modify: `docs/prd/v0.1.0/changelog.md`
- Modify: `docs/project-atlas/interfaces-and-dataflow.md`
- Modify: `docs/project-atlas/worker-execution-chain.md`
- Modify: `ops/README.md`
- Create: `ops/runninghub-user-queue-governance-gray-release-2026-06-18.md`

- [ ] **Step 1: Run the full focused validation set**

Run: `node scripts/verify-runninghub-single-node-contract.mjs`  
Expected: PASS

Run: `node scripts/verify-runninghub-workflow-contract.mjs`  
Expected: PASS

Run: `node scripts/verify-runninghub-workflow-api.mjs`  
Expected: PASS

Run: `node scripts/verify-runninghub-queue-governance-contract.mjs`  
Expected: PASS

Run: `node scripts/verify-user-queue-governance-contract.mjs`  
Expected: PASS

Run: `node scripts/verify-db-migrate-release-deps.mjs`  
Expected: PASS

Run: `npm run build -w @xinghuan/shared`  
Expected: PASS

Run: `npm run build -w @xinghuan/api`  
Expected: PASS

Run: `npm run build -w @xinghuan/admin`  
Expected: PASS

Run: `npm run build -w @xinghuan/web`  
Expected: PASS

Run: `npm run build:single-port`  
Expected: PASS

- [ ] **Step 2: Package release**

Run: `npm run package:release -- 20260618-runninghub-user-queue-governance-gray-r1-<sha>`  
Expected: release tarball generated under `dist-release/`

- [ ] **Step 3: Gray rollout**

Server-side requirements:
- upload release tarball
- extract to new gray release directory
- `npm ci`
- load gray env
- `npm run db:migrate`
- switch `current`
- restart gray api/worker services

Required post-rollout checks:
- `GET http://127.0.0.1:18200/api/status`
- `verify:release-preflight`
- `verify:request-chain-observability`
- `verify:system-observability`

- [ ] **Step 4: Gray acceptance scenarios**

Must verify:
- non-RH image tasks from user A and user B do not block each other incorrectly
- one user exceeding their own window goes into waiting state
- RH task concurrency limit is respected
- extra RH tasks queue and auto-progress
- RH real workflow returns correct result/failure text
- `db:migrate` succeeds in the release directory

- [ ] **Step 5: Update docs and ops logs**

Minimum matrix:
- `DEVLOG.md`
- `ops/runninghub-user-queue-governance-gray-release-2026-06-18.md`
- `ops/README.md`
- if active gray release changed:
  - `README.md`
  - `MEMORY.md`
  - `docs/prd/README.md`
- product layer:
  - `docs/prd/v0.1.0/progress.md`
  - `docs/prd/v0.1.0/changelog.md`
- architecture layer:
  - `docs/project-atlas/interfaces-and-dataflow.md`
  - `docs/project-atlas/worker-execution-chain.md`

- [ ] **Step 6: Sync CodeGraph**

Run: `codegraph sync`  
Expected: successful sync output

- [ ] **Step 7: Final commit for docs/release records**

```bash
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b add DEVLOG.md README.md MEMORY.md docs/prd/README.md docs/prd/v0.1.0/progress.md docs/prd/v0.1.0/changelog.md docs/project-atlas/interfaces-and-dataflow.md docs/project-atlas/worker-execution-chain.md ops/README.md ops/runninghub-user-queue-governance-gray-release-2026-06-18.md
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b commit -m "docs: record queue governance gray rollout"
```

## Self-Review

- Spec coverage:
  - local checkpoint commit: Task 0
  - ordinary worker per-user concurrency and queueing: Tasks 1-2
  - RH platform concurrency and queue progression: Task 3
  - RH real workflow execution test: Task 4
  - release migration dependency repair: Task 5
  - gray rollout and documentation closure: Task 6
- Placeholder scan:
  - No `TODO`, `TBD`, or “implement later” placeholders remain.
- Type consistency:
  - governance fields are introduced in shared settings first, then consumed by API/admin/worker.
  - RH gate is explicitly layered after capability queue and user gate.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-18-runninghub-and-user-queue-governance.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints
