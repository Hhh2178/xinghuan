# Generation Delivery And Agent P0 v0.8.3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate Provider resubmission from artifact recovery, make Agent environment readiness a release gate, and deploy the same `0.8.3` release artifact to the old-server Gray and Production without deleting historical releases.

**Architecture:** Recovery execution becomes an explicit Worker operation resolved from a backward-compatible task contract. Admin writes the operation into both payload and result during the transition, while Worker uses one pure resolver before any Provider adapter can run. A read-only release verifier checks bootstrap definitions, environment publications, `text_chat` route candidates, explicit runtime controls, and real frontend/backend non-fallback canaries.

**Tech Stack:** TypeScript, Vitest, Node.js verification scripts, PostgreSQL task store, Redis queues, existing Admin HTTP APIs, existing release Harness.

## Global Constraints

- Product version is exactly `0.8.3`; Gray and Production promotions do not increment it again.
- Release IDs may use `r1`, `r2`, and later sub-sequences while the product version remains `0.8.3`.
- Only the old server is in scope for deployment.
- Historical Gray and Production release directories must not be deleted; retention is observation/dry-run only.
- Production promotion reuses the exact Gray archive and SHA-256.
- No Provider key, password, cookie, signed URL, database URL, or SSH key content may enter Git or logs.

---

### Task 1: Lock The Recovery Operation Contract

**Files:**
- Modify: `apps/worker/src/worker-output-recovery.ts`
- Create: `apps/worker/src/worker-output-recovery.test.ts`
- Modify: `apps/worker/src/worker.ts`
- Modify: `apps/api/src/admin-task-list-routes.ts`
- Modify: `apps/api/src/admin-task-list-routes.test.ts`

**Interfaces:**
- Produces: `resolveWorkerTaskOperation(task): "provider_execution" | "output_recovery"`.
- Consumes: existing `TaskRow.payload`, `TaskRow.result`, and `executeOutputRecoveryTask`.

- [ ] **Step 1: Write failing Worker tests**

Cover payload-only, result-only legacy recovery, conflicting fields, and ordinary Provider tasks. Recovery must win whenever either trusted persisted field is `output_only`.

- [ ] **Step 2: Run the focused Worker test and confirm RED**

Run: `npm test -- apps/worker/src/worker-output-recovery.test.ts`

Expected: fail because `resolveWorkerTaskOperation` does not exist.

- [ ] **Step 3: Implement the pure resolver and use it at the dispatch boundary**

`worker.ts` must call the resolver before `executeTask`; only `provider_execution` may enter Provider adapters.

- [ ] **Step 4: Extend the Admin route test and confirm RED**

Assert that recover-output persists `payload.outputRecoveryMode="output_only"` while retaining the same task ID and existing generation payload.

- [ ] **Step 5: Write both payload and result markers in one task update**

The result marker remains for diagnostics/backward compatibility; the payload marker is the durable execution command read by old and new Workers.

- [ ] **Step 6: Run focused API and Worker tests and confirm GREEN**

Run: `npm test -- apps/api/src/admin-task-list-routes.test.ts apps/worker/src/worker-output-recovery.test.ts`

Expected: all focused tests pass and a result-only task resolves to output recovery.

### Task 2: Add A Cross-Layer Recovery Contract Verifier

**Files:**
- Create: `scripts/verify-output-recovery-operation-contract.mjs`
- Modify: `package.json`
- Modify: `scripts/package-release.mjs`
- Modify: `docs/systems/worker/output-materialization.md`

**Interfaces:**
- Produces: `npm run verify:output-recovery-operation-contract`.
- Consumes: Admin route source, Worker resolver source, and release package manifest.

- [ ] **Step 1: Write the verifier with a deliberate failing assertion**

The verifier must require the Admin payload marker, Worker resolver usage, result-only compatibility, and release inclusion of the Worker module.

- [ ] **Step 2: Run it and confirm RED before package wiring**

Run: `npm run verify:output-recovery-operation-contract`

Expected: fail until the script is registered and release package coverage is explicit.

- [ ] **Step 3: Register the verifier and release source**

Add the command to `package.json` and include the verifier in the packaged release scripts.

- [ ] **Step 4: Run the verifier and focused tests**

Expected: verifier and focused tests pass.

### Task 3: Make Agent Environment Readiness A Release Gate

**Files:**
- Create: `scripts/verify-agent-environment-readiness.mjs`
- Create: `scripts/verify-agent-environment-readiness-contract.mjs`
- Modify: `package.json`
- Modify: `scripts/package-release.mjs`
- Modify: `docs/systems/agent-runtime/README.md`
- Modify: `docs/systems/observability-and-ops/release-gates.md`

**Interfaces:**
- Produces: a read-only runtime verifier requiring `--expected-environment=gray|production` through environment variables or CLI arguments.
- Consumes: `/api/status`, Admin login, `/api/admin/agent-runtime/roles`, `/llm-pools`, `/overview`, `/api/assistant/chat`, and `/api/admin/assistant/chat`.

- [ ] **Step 1: Write a contract test for verifier requirements**

Require checks for all 8 bootstrap definitions, the three required Agent publications, the three route publications, non-empty `text_chat` candidates, explicit runtime controls, environment match, and `mode=agent` for frontend/backend canaries.

- [ ] **Step 2: Run the contract test and confirm RED**

Expected: fail because the runtime verifier does not exist.

- [ ] **Step 3: Implement the read-only verifier**

The verifier must never bootstrap, publish, change controls, or print credentials. Missing state returns structured failure codes; fallback mode is failure.

- [ ] **Step 4: Register and package both verifier scripts**

Add the static contract verifier to the project Harness. Keep the real runtime verifier opt-in because it requires target credentials and performs two billed chat canaries.

- [ ] **Step 5: Run static Agent contracts**

Run: `npm run verify:agent-environment-readiness-contract && npm run verify:agent-runtime-architecture-contract`.

### Task 4: Build And Commit v0.8.3

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `docs/memory/current-state.md`
- Modify: release and validation records created for `0.8.3-r1`.

- [ ] **Step 1: Set root product version to `0.8.3`**
- [ ] **Step 2: Run focused tests, type-check, build, full tests, release Harness, and staged governance**
- [ ] **Step 3: Create the release archive and record its SHA-256**
- [ ] **Step 4: Commit source and release evidence, then push GitHub**

### Task 5: Deploy Old-Server Gray r1

**Files:**
- Create: `docs/logbooks/releases/gray/2026-07-27-generation-delivery-agent-p0-v083-r1.md`
- Create: `docs/logbooks/validations/2026-07-27-generation-delivery-agent-p0-gray-v083-r1.md`
- Modify: `ops/current/release-state.json`
- Modify: `ops/current/gray.md`
- Modify: `ops/README.md`
- Modify: `docs/logbooks/releases/current-release-index.md`

- [ ] **Step 1: Capture Gray preflight and rollback release**
- [ ] **Step 2: Deploy the exact archive without retention apply or any deletion command**
- [ ] **Step 3: Verify status, API/Worker, permission readiness, homepage/Admin, and Agent readiness canaries**
- [ ] **Step 4: Create a controlled failed task with a local recovery source and invoke recover-output**
- [ ] **Step 5: Prove task ID is unchanged, Provider submit count is zero, cost item count is unchanged, Artifact is readable, and final status is succeeded**
- [ ] **Step 6: Record evidence and commit without pruning historical releases**

### Task 6: Promote The Same Archive To Old-Server Production

**Files:**
- Create: `docs/logbooks/releases/production/2026-07-27-generation-delivery-agent-p0-v083-r1.md`
- Create: `docs/logbooks/validations/2026-07-27-generation-delivery-agent-p0-production-v083-r1.md`
- Modify: `ops/current/release-state.json`
- Modify: `ops/current/production.md`
- Modify: `ops/README.md`
- Modify: `docs/logbooks/releases/current-release-index.md`

- [ ] **Step 1: Back up Production database and capture current/rollback state**
- [ ] **Step 2: Promote the identical Gray archive and verify its SHA-256**
- [ ] **Step 3: Verify internal/public status, API/Worker, permission readiness, homepage/Admin, and Agent readiness canaries**
- [ ] **Step 4: Do not create destructive Production fixtures; verify recovery contract from the deployed artifact and Gray evidence**
- [ ] **Step 5: Record that retention apply was not run and no historical release directory was deleted**
- [ ] **Step 6: Commit and push deployment evidence**

## Rollback Rules

- Any Gray failure restores the previous Gray `current` symlink and restarts only Gray API/Worker.
- Any Production failure restores the recorded Production rollback release and restarts only Production API/Worker.
- Database rollback is used only when a migration is incompatible; this batch should not require a schema migration.
- Failed sub-builds remain on disk for audit unless they expose secrets; no recursive or retention deletion is allowed in this objective.
