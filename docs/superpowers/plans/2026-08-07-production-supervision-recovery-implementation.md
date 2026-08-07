# Production Supervision Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI supervision runtime state truthful, restore the old server in observe mode, validate it with the parallel group runtime and a controlled GRS AI GPT image canary, then promote the same release through old Production and the new server.

**Architecture:** Keep database controls and process gates separate but expose both in diagnostics. Correct current-route health aggregation at the repository boundary, derive Admin assistant state from the runtime response, and use the existing immutable release/harness workflow for staged server promotion.

**Tech Stack:** TypeScript, React Admin, PostgreSQL repository queries, API/Worker process environment, systemd release deployment, project Harness and remote verification scripts.

## Global Constraints

- Old server Gray is the first remote target.
- Old Production runs in observe mode with automatic recovery and quality evaluation disabled.
- New server is untouched until old Production is stable.
- One minimal paid GRS AI GPT image canary runs only after non-billable checks pass.
- Secrets and environment file contents are never printed or committed.
- The same immutable release artifact is promoted within each server.

---

### Task 1: Runtime Gate Diagnostics And Truthful Admin State

**Files:**
- Create: `apps/api/src/agent-runtime-gates.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/worker/src/worker.ts`
- Modify: `apps/admin/src/admin-agent-governance-api.ts`
- Modify: `apps/admin/src/admin-agent-governance-workspace.tsx`
- Modify: `apps/admin/src/admin-assistant-panel.tsx`
- Create: `scripts/verify-agent-runtime-gate-diagnostics.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `readAgentRuntimeProcessGates(env): { apiCanvasRunsEnabled: boolean; workerCanvasRunsEnabled?: boolean }`
- Extends: Admin overview/runtime status with process-gate state separate from database controls.

- [ ] **Step 1: Write failing diagnostics contracts**

Assert unset flags are false, explicit `true` flags are true, database controls do not mask disabled process gates, and the initial Admin message has no hardcoded `mode: "fallback"` before status is loaded.

- [ ] **Step 2: Run and confirm failure**

Run: `npx tsx scripts/verify-agent-runtime-gate-diagnostics.ts`

Expected: FAIL because gate parsing is inline and Admin welcome mode is hardcoded.

- [ ] **Step 3: Implement shared gate parsing and runtime projection**

Move exact-true parsing into the focused helper, inject the API result into the existing governance/status response, and preserve disabled-by-default behavior.

- [ ] **Step 4: Make Admin state derived and explicit**

Render loading/available/restricted from the fetched runtime response. Keep actual fallback mode only for a streamed fallback result or a real request failure. Label database controls and process activation separately.

- [ ] **Step 5: Run focused tests, type-check, and build**

Run: `npx tsx scripts/verify-agent-runtime-gate-diagnostics.ts`

Run: `npm run type-check -w @xinghuan/api`

Run: `npm run type-check -w @xinghuan/admin`

Run: `npm run build -w @xinghuan/api`

Run: `npm run build -w @xinghuan/admin`

- [ ] **Step 6: Commit runtime truth changes**

```bash
git add apps/api/src/agent-runtime-gates.ts apps/api/src/server.ts apps/worker/src/worker.ts apps/admin/src/admin-agent-governance-api.ts apps/admin/src/admin-agent-governance-workspace.tsx apps/admin/src/admin-assistant-panel.tsx scripts/verify-agent-runtime-gate-diagnostics.ts package.json
git commit -m "fix(agent): expose effective supervision gates"
```

### Task 2: Current Published Route Health Aggregation

**Files:**
- Modify: `apps/api/src/agent-governance-repository.ts`
- Create: `scripts/verify-agent-overview-route-health.ts`
- Modify: `package.json`

**Interfaces:**
- Changes: `readOverview(environment)` counts unhealthy entries only for active published pool versions in the selected environment.
- Preserves: historical health rows and `listLlmPools()` audit visibility.

- [ ] **Step 1: Write failing repository contract**

Use a query-capture fake pool and assert the unhealthy count joins active publications, published versions, enabled pools, and enabled entries for one environment instead of scanning every health row.

- [ ] **Step 2: Run and confirm failure**

Run: `npx tsx scripts/verify-agent-overview-route-health.ts`

Expected: FAIL because the current query counts global historical health.

- [ ] **Step 3: Implement environment-scoped aggregation**

Change `readOverview` to accept the selected environment and count distinct unhealthy route entries joined through non-retired publications and enabled current routing objects. Do not delete or rewrite health history.

- [ ] **Step 4: Run contract and API regression**

Run: `npx tsx scripts/verify-agent-overview-route-health.ts`

Run: `npm run type-check -w @xinghuan/api`

Expected: PASS.

- [ ] **Step 5: Commit health aggregation**

```bash
git add apps/api/src/agent-governance-repository.ts scripts/verify-agent-overview-route-health.ts package.json
git commit -m "fix(agent): scope current route health metrics"
```

### Task 3: Release Preparation And Local Verification

**Files:**
- Modify: root/package workspace versions using the existing patch-version release command.
- Modify: `docs/systems/agent-runtime/README.md`
- Modify: `docs/logbooks/daily/2026/2026-08/2026-08-07.md`
- Create/update: release logbooks and `ops/current/release-state.json` only when each deployment actually succeeds.

**Interfaces:**
- Produces: one Gray release artifact containing both the group runtime and supervision fixes.

- [ ] **Step 1: Run combined local verification**

Run all focused group-runtime and supervision contracts, affected workspace type-checks/builds, `npm run ci`, `npm run harness:verify:project`, and `npm run harness:verify:release`.

- [ ] **Step 2: Increment Gray patch version once**

Use the repository's documented patch release command and verify every workspace version remains aligned. Do not increment again for Production promotion.

- [ ] **Step 3: Build the immutable server artifact**

Use the existing protected release builder and source-encapsulation path. Verify the development worktree still runs from source and only server artifacts are encapsulated.

- [ ] **Step 4: Commit release preparation**

Commit version, system documentation, daily evidence, and generated canonical release metadata required before deployment.

### Task 4: Old Server Gray Deployment And Non-Billable Acceptance

**Files:**
- Follow: `ops/current/gray.md`
- Follow: `docs/systems/observability-and-ops/gray-and-production-operations.md`
- Update after success: Gray release logbook and `ops/current/release-state.json`.

**Interfaces:**
- Deploys: immutable artifact to old Gray only.

- [ ] **Step 1: Preflight old Gray**

Confirm the authorized SSH target, current release, rollback release, disk capacity, API/Worker service state, environment namespace, and database target without printing secrets.

- [ ] **Step 2: Deploy and verify services**

Deploy the release, restart only old Gray API/Worker, and verify internal/public health, version, environment, database, Redis namespace, and permission readiness.

- [ ] **Step 3: Run deterministic Canvas fixtures**

Verify chain order, fan-out/fan-in layering, disconnected branch concurrency, cycle rejection, external dependency rejection, five-group admission, sixth rejection, ten-node cap, fair scheduling, independent failure continuation, and global cancellation.

- [ ] **Step 4: Validate AI supervision observe mode**

Enable/confirm Gray process gates and database controls, create a supported Workflow Region plan, start it, inspect SSE/event ledger, and prove automatic recovery and quality evaluation remain disabled for the Production canary configuration.

- [ ] **Step 5: Record Gray evidence**

Update the Gray release logbook and canonical state only after all required checks pass. Preserve rollback anchor and run retention dry-run before any protected pruning.

### Task 5: Controlled GRS AI GPT Image Canary

**Files:**
- Use an existing authenticated stress/canary verifier if available; otherwise add one focused script under `scripts/` without credentials.
- Update: validation logbook with task IDs redacted to non-secret operational identifiers as permitted by project practice.

**Interfaces:**
- Creates: one minimal paid GPT image task through the configured GRS AI Provider in old Gray.

- [ ] **Step 1: Confirm non-billable gates are green**

Do not submit a paid task until service health, permissions, topology scheduling, AI supervision planning, queues, and rollback evidence are green.

- [ ] **Step 2: Submit one minimal image task**

Use the existing test account and published GRS AI GPT image model. Request the minimum supported output count and ordinary test dimensions.

- [ ] **Step 3: Verify end-to-end delivery**

Confirm task creation, queue admission, Worker claim, Provider completion, artifact materialization, Canvas node completion sequence, downstream readiness, generation-library visibility, and downloadable output.

- [ ] **Step 4: Record cost-bounded evidence and clean disposable Canvas data**

Do not delete task/audit history. Remove only explicitly disposable test Canvas/project fixtures through supported APIs.

### Task 6: Old Production Promotion And Inspection

**Files:**
- Follow: `ops/current/production.md`
- Update after success: Production release logbook and canonical release state.

**Interfaces:**
- Promotes: the same verified old Gray artifact to old Production.

- [ ] **Step 1: Set Production controls to observe mode**

Patch only the four runtime controls with revision protection: Agent and Canvas Run enabled; automatic recovery and quality evaluation disabled.

- [ ] **Step 2: Enable Production process gates and promote artifact**

Apply the two boolean process gates through the protected environment procedure, promote the exact Gray artifact, and restart Production API/Worker.

- [ ] **Step 3: Run controlled Production inspection**

Verify effective gates, current published route health, plan creation, one non-paid deterministic run, concurrent group runtime behavior, cancellation isolation, service logs, queue health, and error rates. No paid Production generation is required unless separately authorized.

- [ ] **Step 4: Record Production evidence or rollback**

If any gate fails, disable process gates or activate the recorded rollback release. Update canonical state only on success.

### Task 7: New Server Gray And Production

**Files:**
- Follow the runbooks in `D:/codex/泽臻服务器` after reading its `AGENTS.md`.
- Update this repository's release logbooks and canonical state after each successful environment.

**Interfaces:**
- Repeats: the verified artifact and acceptance matrix on the migration target.

- [ ] **Step 1: Read new-server authority and preflight state**

Confirm authorized credentials are consumed only from the new-server workspace and never printed. Verify current Gray/Production releases, databases, route publications, runtime controls, and rollback anchors.

- [ ] **Step 2: Deploy new Gray and run the old-Gray acceptance matrix**

Include route publication/bootstrap gaps discovered during preflight. Do not proceed if the new environment lacks required Agent definitions or LLM route publications.

- [ ] **Step 3: Promote the same artifact to new Production**

Use observe mode first and repeat effective-gate, topology, scheduling, service, and route-health verification.

- [ ] **Step 4: Record final dual-server state**

Update release logbooks, validation evidence, retention state, `ops/current/release-state.json`, and current human-readable projections.

### Task 8: GitHub Push And Final Governance Verification

**Files:**
- No new functional files; reconcile documentation and release state generated by prior tasks.

**Interfaces:**
- Produces: clean committed branch and pushed remote containing source, tests, plans, and verified release records.

- [ ] **Step 1: Run final repository gates**

Run: `npm run verify:no-runtime-artifacts-staged`

Run: `npm run verify:staged-source-size-guard`

Run: `npm run verify:file-hotspot-budgets`

Run: `npm run verify:hotspot-watchlist-contract`

Run: `npm run verify:release-logbook-sync-staged`

Run: `npm run verify:current-release-entry-consistency`

Run: `npm run harness:verify:workspace`

Run: `npm run harness:verify:release`

- [ ] **Step 2: Commit final operational evidence**

Commit only expected source, tests, canonical state, and logbooks. Exclude runtime artifacts, credentials, downloaded media, logs, and release bundles.

- [ ] **Step 3: Push GitHub with diagnostics on failure**

Push the current branch using the configured remote. On failure, capture the exact transport/authentication error, verify remote and credential-helper configuration without printing secrets, retry only the failed network step, and record the result.

