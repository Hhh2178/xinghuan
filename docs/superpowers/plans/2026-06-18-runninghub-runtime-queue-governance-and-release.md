# RunningHub Runtime Queue Governance And Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the RunningHub runtime path so RH workflow and RH app tasks can execute under unified backend governance, while ordinary worker tasks use per-user independent concurrency and queue progression, then finish gray validation, production rollout, version/document closure, and archive-safe release records.

**Architecture:** Keep the existing capability queues (`image` / `video` / `audio`) as the outer worker lanes, but move runtime governance into layered gates inside the worker: capability slot, user window, then provider-platform window. RunningHub remains a provider protocol inside the same task system, but its runtime target is normalized into explicit execution descriptors so the backend can route to workflow or app endpoints without frontend-special-case logic. Release and validation are treated as part of the feature, not a follow-up.

**Tech Stack:** TypeScript, React, Node HTTP server, PostgreSQL, Redis, existing single-port/release scripts, CodeGraph, gray/prod deployment on Tencent Cloud Ubuntu host.

---

## Current Status Snapshot

- Local repo already contains first-stage RH + queue governance commit:
  - `d9b653c feat: add runninghub and user queue governance`
- Gray already points to:
  - `20260618-runninghub-user-queue-governance-gray-r1-d9b653c`
- Confirmed gap:
  - RH detail page id `2004516402230509570` is not the runnable runtime id
  - actual workflow runtime id is `1997246493079834625`
- Confirmed architecture mismatch:
  - API task creation still assumes RH uses `webappId`
  - worker submit/query still assumes RH uses `ai-app/run`
- Confirmed unfinished validation:
  - ordinary queue still needs same-user waiting and cross-user independence proof
  - RH still needs real workflow submit/query proof under local concurrency `2`

## File Structure

### Backend / worker / shared

- Modify: `apps/api/src/server.ts`
  - Expand RH queued-task creation to support `targetType`, `workflowId`, `webappId`, `runTargetId`, and explicit `taskCapability`.
- Modify: `apps/api/src/runninghub-catalog.ts`
  - Normalize RH items so page ids, runtime ids, and descriptor fields are kept separately and clearly.
- Modify: `apps/api/src/runninghub-execution-descriptor.ts`
  - Define descriptor model for RH `workflow` and `app` execution.
- Modify: `apps/worker/src/worker.ts`
  - Branch RH submit/query by descriptor target type and preserve layered queue governance.
- Modify: `packages/shared/src/task-queue-settings.ts`
  - Ensure capability concurrency, per-user concurrency, and RH platform concurrency share one canonical shape.
- Modify: `packages/shared/src/index.ts`
  - Re-export any new RH or queue types.

### Admin / frontend support

- Modify: `apps/admin/src/admin-types.ts`
  - Extend RH item and queue governance payload types.
- Modify: `apps/admin/src/admin-api-client.ts`
  - Support RH target fields and queue-governance read/write payloads.
- Modify: `apps/admin/src/admin-runninghub-item-editor.tsx`
  - Show page id vs runtime id vs target type clearly, without forcing users to infer endpoint shape.
- Modify: `apps/admin/src/admin-runninghub-workspace.tsx`
  - Show RH runtime diagnostics, queue settings, and test state.
- Modify: `apps/admin/src/admin-readonly-panels.tsx`
  - Keep queue settings readable in plain Chinese.

### Verification / release / docs

- Modify: `scripts/verify-runninghub-queue-governance-contract.mjs`
  - Assert workflow-aware RH routing exists.
- Modify: `scripts/verify-runninghub-workflow-api.mjs`
  - Cover RH workflow submit/query path.
- Modify: `scripts/verify-user-queue-governance-contract.mjs`
  - Assert user-window gating contract remains intact.
- Modify: `DEVLOG.md`
- Modify: `README.md`
- Modify: `MEMORY.md`
- Modify: `docs/prd/README.md`
- Modify: `docs/prd/v0.1.0/progress.md`
- Modify: `docs/prd/v0.1.0/changelog.md`
- Modify: `docs/project-atlas/interfaces-and-dataflow.md`
- Modify: `docs/project-atlas/worker-execution-chain.md`
- Modify: `ops/README.md`
- Create: `ops/runninghub-runtime-queue-governance-release-2026-06-18.md`

## Task 1: Lock Current Baseline And Preserve Investigation Context

**Files:**
- Modify: `scripts/verify-runninghub-queue-governance-contract.mjs`
- Keep referenced context from:
  - `tmp-runninghub-page.html`
  - `tmp-runninghub-main.js`
  - `tmp-runninghub-api-detail.js`

- [ ] **Step 1: Review current workspace state**

Run: `git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b status --short`
Expected: only the RH investigation contract change and temporary RH inspection files are present.

- [ ] **Step 2: Confirm current gray and version status before new code changes**

Run: `ssh -i D:\codex\服务器\Tencent_Cloud_Server.pem -p 728 ubuntu@101.33.75.38 "readlink -f /opt/apps/xinghuan-canvas-next/current && curl -s http://127.0.0.1:18200/api/status"`
Expected: gray symlink points to `20260618-runninghub-user-queue-governance-gray-r1-d9b653c` and app status reports current version.

- [ ] **Step 3: Preserve the RH investigation conclusion in the plan context**

Record these runtime facts in implementation notes:

```text
detail sku id: 2004516402230509570
workflow runtime id: 1997246493079834625
apiType=3 => WORKFLOW_SKU
real submit path => /openapi/v2/run/workflow/{workflowId}
```

- [ ] **Step 4: Sync CodeGraph baseline before code edits**

Run: `codegraph sync`
Expected: index updated with current working tree.

## Task 2: Normalize RunningHub Runtime Targets In The API Layer

**Files:**
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/runninghub-catalog.ts`
- Modify: `apps/api/src/runninghub-execution-descriptor.ts`
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/admin-api-client.ts`
- Test: `scripts/verify-runninghub-queue-governance-contract.mjs`

- [ ] **Step 1: Write the failing RH target-resolution contract**

Contract additions:

```js
assert.match(server, /workflowId/);
assert.match(server, /webappId/);
assert.match(server, /targetType/);
assert.match(server, /taskCapability/);
assert.match(server, /runTargetId/);
```

- [ ] **Step 2: Run contract to confirm current gap**

Run: `node scripts/verify-runninghub-queue-governance-contract.mjs`
Expected: FAIL or partially fail because API still only models `webappId`.

- [ ] **Step 3: Implement canonical RH execution descriptor**

Target descriptor shape:

```ts
export interface RunningHubExecutionDescriptor {
  targetType: "workflow" | "app";
  pageId?: string;
  webappId?: string;
  workflowId?: string;
  runTargetId: string;
  taskCapability: "image" | "video" | "audio" | "chat";
  submitMode: "openapi-v2-workflow" | "ai-app";
  queryMode: "openapi-v2-query" | "outputs";
}
```

- [ ] **Step 4: Extend API task creation to persist explicit RH runtime fields**

Requirements:
- if admin stores a workflow runtime id, use it directly
- if only a page/sku id is available, keep it as reference metadata and reject execution unless runtime id is known
- `taskCapability` must come from the RH item, not be hardcoded to `video`
- payload must preserve `targetType`, `runTargetId`, and source ids for diagnostics

- [ ] **Step 5: Keep admin model readable**

Admin requirements:
- `页面ID` and `实际运行ID` shown as separate fields
- `目标类型` shown as a dropdown: `工作流` / `AI 应用`
- help copy explains:
  - workflow submit uses runtime workflow id
  - app submit uses RH app id

- [ ] **Step 6: Re-run focused verification**

Run: `node scripts/verify-runninghub-queue-governance-contract.mjs`
Expected: PASS

Run: `npm run build -w @xinghuan/api`
Expected: PASS

Run: `npm run build -w @xinghuan/admin`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b add apps/api/src/server.ts apps/api/src/runninghub-catalog.ts apps/api/src/runninghub-execution-descriptor.ts apps/admin/src/admin-types.ts apps/admin/src/admin-api-client.ts apps/admin/src/admin-runninghub-item-editor.tsx scripts/verify-runninghub-queue-governance-contract.mjs
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b commit -m "feat: normalize runninghub runtime targets"
```

## Task 3: Make Worker Execution RH-Target-Aware

**Files:**
- Modify: `apps/worker/src/worker.ts`
- Modify: `apps/api/src/runninghub-execution-descriptor.ts`
- Test: `scripts/verify-runninghub-queue-governance-contract.mjs`
- Test: `scripts/verify-runninghub-workflow-api.mjs`

- [ ] **Step 1: Add failing worker assertions for workflow-aware submit/query**

Contract additions:

```js
assert.match(worker, /task\.payload\.workflowId|task\.payload\.runTargetId/);
assert.match(worker, /openapi\/v2\/run\/workflow/);
assert.match(worker, /openapi\/v2\/query|queryMode/);
assert.match(worker, /targetType/);
```

- [ ] **Step 2: Implement RH submit dispatch by target type**

Required branches:
- `targetType=workflow`
  - submit: `/openapi/v2/run/workflow/{workflowId}`
- `targetType=app`
  - preserve existing ai-app submit path

- [ ] **Step 3: Implement RH query dispatch by target type**

Required branches:
- workflow query follows RH openapi v2 query contract
- app query preserves legacy outputs/query path
- task result stores:
  - `upstreamTaskId`
  - `upstreamStatus`
  - `rhTargetType`
  - `rhRunTargetId`

- [ ] **Step 4: Keep result and failure messages accurate**

Rules:
- do not report success placeholders when upstream actually failed
- if query response has failure code/message, surface it directly
- if query contract changes by target type, store raw summary in task result for admin troubleshooting

- [ ] **Step 5: Re-run focused verification**

Run: `node scripts/verify-runninghub-queue-governance-contract.mjs`
Expected: PASS

Run: `node scripts/verify-runninghub-workflow-api.mjs`
Expected: PASS

Run: `npm run build -w @xinghuan/worker`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b add apps/worker/src/worker.ts apps/api/src/runninghub-execution-descriptor.ts scripts/verify-runninghub-queue-governance-contract.mjs scripts/verify-runninghub-workflow-api.mjs
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b commit -m "feat: execute runninghub workflow targets"
```

## Task 4: Complete Independent Per-User Queue Governance For Ordinary Worker Tasks

**Files:**
- Modify: `packages/shared/src/task-queue-settings.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/worker/src/worker.ts`
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/admin-api-client.ts`
- Modify: `apps/admin/src/admin-readonly-panels.tsx`
- Test: `scripts/verify-user-queue-governance-contract.mjs`

- [ ] **Step 1: Keep the contract explicit**

Required assertions:

```js
assert.match(worker, /acquireUserExecutionWindow/);
assert.match(worker, /releaseUserExecutionWindow/);
assert.match(worker, /waiting_user_window/);
assert.match(admin, /单用户并发上限/);
```

- [ ] **Step 2: Ensure canonical shared settings shape**

Target shape:

```ts
export interface TaskQueueCapabilityConfig {
  concurrency: number;
  userConcurrency: number;
}

export interface RunningHubQueueConfig {
  enabled: boolean;
  concurrency: number;
}
```

- [ ] **Step 3: Make user gating independent by capability and by user**

Execution rules:
- user A image queue full must not block user B image tasks
- image must not affect video/audio
- deferred tasks remain `queued` with `waitReason`
- waiting tasks auto-progress when same-user active count drops

- [ ] **Step 4: Expose queue state clearly in admin**

Admin/output rules:
- show worker concurrency and single-user concurrency separately
- keep copy in plain Chinese
- show RH platform concurrency as a separate block from ordinary worker concurrency

- [ ] **Step 5: Re-run focused verification**

Run: `node scripts/verify-user-queue-governance-contract.mjs`
Expected: PASS

Run: `npm run build -w @xinghuan/shared`
Expected: PASS

Run: `npm run build -w @xinghuan/api`
Expected: PASS

Run: `npm run build -w @xinghuan/admin`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b add packages/shared/src/task-queue-settings.ts packages/shared/src/index.ts apps/api/src/server.ts apps/worker/src/worker.ts apps/admin/src/admin-types.ts apps/admin/src/admin-api-client.ts apps/admin/src/admin-readonly-panels.tsx scripts/verify-user-queue-governance-contract.mjs
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b commit -m "feat: govern ordinary queues by user concurrency"
```

## Task 5: Finish RunningHub Platform Window Governance Without Blocking Other Workers

**Files:**
- Modify: `apps/worker/src/worker.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/admin/src/admin-runninghub-workspace.tsx`
- Test: `scripts/verify-runninghub-queue-governance-contract.mjs`

- [ ] **Step 1: Keep RH gate layered after user gate**

Order:

```text
1. capability slot
2. user window
3. runninghub platform window
4. upstream submit/poll
```

- [ ] **Step 2: Confirm non-RH tasks never touch RH gate**

Required behavior:
- only `providerProtocol=runninghub` uses RH gate
- ordinary OpenAI / GRSAI / APIMart / ModelScope tasks are unaffected

- [ ] **Step 3: Ensure RH queue progression is automatic**

Rules:
- RH active task completes/fails/cancels
- RH window count releases
- next RH queued task becomes eligible automatically
- non-RH queues continue independently

- [ ] **Step 4: Surface RH queue status in admin**

Minimum visibility:
- `当前执行中`
- `等待平台窗口`
- `平台并发上限`
- recent failure reason if upstream returned `queue limit reached`

- [ ] **Step 5: Re-run focused verification**

Run: `node scripts/verify-runninghub-queue-governance-contract.mjs`
Expected: PASS

Run: `npm run build -w @xinghuan/worker`
Expected: PASS

Run: `npm run build -w @xinghuan/admin`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b add apps/worker/src/worker.ts apps/api/src/server.ts apps/admin/src/admin-runninghub-workspace.tsx scripts/verify-runninghub-queue-governance-contract.mjs
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b commit -m "feat: govern runninghub platform concurrency"
```

## Task 6: Gray Validation Matrix

**Files:**
- Modify if needed: `scripts/verify-runninghub-workflow-api.mjs`
- Modify if needed: `ops/runninghub-runtime-queue-governance-release-2026-06-18.md`

- [ ] **Step 1: Package and deploy new gray release**

Run:

```bash
npm run build:single-port
npm run package:release -- 20260618-runninghub-runtime-queue-gray-r2-<sha>
```

Expected: release archive generated under `dist-release/`.

- [ ] **Step 2: Install on gray**

Server checklist:
- upload release
- extract under `/opt/apps/xinghuan-canvas-next/releases/`
- run `npm ci`
- run `npm run db:migrate`
- switch `current`
- restart gray api / worker

- [ ] **Step 3: Run environment gates**

Run on gray:

```bash
curl -s http://127.0.0.1:18200/api/status
npm run verify:release-preflight
npm run verify:request-chain-observability
npm run verify:system-observability
```

Expected: PASS.

- [ ] **Step 4: Validate ordinary queue same-user waiting**

Scenario:
- temporarily set image `userConcurrency=1`
- submit 2 image tasks with same user
- expected:
  - one running
  - one `waiting_user_window`
  - second starts after first completes

- [ ] **Step 5: Validate cross-user independence**

Scenario:
- same image capability
- user A already occupies their own slot
- submit user B image task
- expected:
  - user B task still runs if global capability slot exists

- [ ] **Step 6: Validate RH single workflow submit**

Use:
- key: runtime env only
- workflow runtime id: `1997246493079834625`
- target page/sku id retained only as reference

Expected:
- task submitted successfully
- worker stores upstream task id
- final status accurate

- [ ] **Step 7: Validate RH 3-task batch with RH concurrency = 2**

Expected:
- 2 RH tasks active
- 1 RH task waiting platform window
- after one finishes, waiting task auto-progresses

- [ ] **Step 8: Record gray acceptance**

Write to `ops/runninghub-runtime-queue-governance-release-2026-06-18.md`:
- release id
- queue settings used
- ordinary queue observations
- RH observations
- unresolved upstream-provider limitations if any

## Task 7: Production Rollout, Versioning, And Documentation Closure

**Files:**
- Modify: `README.md`
- Modify: `MEMORY.md`
- Modify: `DEVLOG.md`
- Modify: `docs/prd/README.md`
- Modify: `docs/prd/v0.1.0/progress.md`
- Modify: `docs/prd/v0.1.0/changelog.md`
- Modify: `docs/project-atlas/interfaces-and-dataflow.md`
- Modify: `docs/project-atlas/worker-execution-chain.md`
- Modify: `ops/README.md`
- Create/Modify: `ops/runninghub-runtime-queue-governance-release-2026-06-18.md`

- [ ] **Step 1: Bump version for this release batch**

Rules:
- same batch gray and production must expose same version
- no major bump without user instruction
- if this batch becomes next public release, increment non-major version once

- [ ] **Step 2: Push production after gray passes**

Server checklist:
- extract production release under `/opt/apps/xinghuan-canvas/releases/`
- `npm ci`
- `npm run db:migrate`
- switch `current`
- restart production api / worker
- check `http://127.0.0.1:18100/api/status`

- [ ] **Step 3: Run production smoke**

Minimum checks:
- status endpoint healthy
- admin system queue settings readable
- one ordinary image task smoke
- one RH runtime smoke if provider-side window allows

- [ ] **Step 4: Update the living project documents**

Must update together:
- current gray release pointer
- current production release pointer
- current app version
- RH runtime architecture notes
- queue governance rules
- release conclusion and rollback entry

- [ ] **Step 5: Archive old active-only records if superseded**

Rules:
- move no files in bulk
- archive only after new active release docs exist
- update `ops/archive/README.md` if a new archive batch is created

- [ ] **Step 6: Final verification and CodeGraph sync**

Run:

```bash
node scripts/verify-runninghub-queue-governance-contract.mjs
node scripts/verify-runninghub-workflow-api.mjs
node scripts/verify-user-queue-governance-contract.mjs
npm run build -w @xinghuan/api
npm run build -w @xinghuan/worker
npm run build -w @xinghuan/admin
npm run build:single-port
codegraph sync
```

Expected: PASS.

- [ ] **Step 7: Final commit**

```bash
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b add README.md MEMORY.md DEVLOG.md docs/prd/README.md docs/prd/v0.1.0/progress.md docs/prd/v0.1.0/changelog.md docs/project-atlas/interfaces-and-dataflow.md docs/project-atlas/worker-execution-chain.md ops/README.md ops/runninghub-runtime-queue-governance-release-2026-06-18.md
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b commit -m "docs: record runninghub runtime and queue governance release"
```

## Acceptance Checklist

- [ ] RH workflow tasks no longer assume page id equals runtime id
- [ ] RH app and RH workflow both fit the same backend descriptor model
- [ ] ordinary worker queue is governed independently per user and per capability
- [ ] RH platform concurrency gate does not block non-RH workers
- [ ] gray proves:
  - [ ] same-user waiting
  - [ ] cross-user independence
  - [ ] RH single workflow submit
  - [ ] RH 3-task batch with concurrency 2
- [ ] production receives the same version as gray for the same batch
- [ ] docs, ops records, and atlas pages reflect the released reality

## Self-Review

- Spec coverage:
  - RH runtime id mismatch: Tasks 2-3
  - ordinary worker per-user concurrency: Task 4
  - RH platform queue governance: Task 5
  - gray validation: Task 6
  - production/version/docs closure: Task 7
- Placeholder scan:
  - no `TODO`, `TBD`, or “later fill” placeholders remain
- Type consistency:
  - RH target fields are introduced in API/shared/admin before worker execution depends on them
  - queue governance remains layered and protocol-scoped

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-18-runninghub-runtime-queue-governance-and-release.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, and keep the implementation surface tighter.

**2. Inline Execution** - Execute tasks in this session in controlled batches, with verification before gray and before production.
