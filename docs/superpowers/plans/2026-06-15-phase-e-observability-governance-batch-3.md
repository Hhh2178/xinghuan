# Phase E Observability Governance Batch 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the current Phase E governance follow-up by adding longer-window observability trends, actionable in-product alert items, and fresher requestId coverage signals that can be verified end to end.

**Architecture:** Extend `/api/admin/system` on top of the existing Phase E payload instead of introducing new tables or a separate monitoring service. Reuse current task/audit data, derive 30d and recent-window metrics in the API layer, surface alert items in the existing admin read-only system panel, and raise requestId sample freshness by auditing key admin auth/system reads with request context.

**Tech Stack:** TypeScript, Node.js, React, existing monorepo verification scripts, PostgreSQL/file-mode dual repository path

---

### Task 1: Freeze Batch 3 scope and release target

**Files:**
- Create: `docs/superpowers/plans/2026-06-15-phase-e-observability-governance-batch-3.md`
- Modify: `docs/production-multi-user-hardening-plan-2026-06-13.md`
- Modify: `docs/prd/v0.1.0/progress.md`

- [x] **Step 1: Record exact Batch 3 scope**

Batch 3 is limited to:

- task failure long-window metrics derived from current `24h/7d/30d` windows
- audit requestId recent-window coverage derived from current audit rows
- conflict long-window metrics derived from current `24h/7d/30d` windows
- in-product active alert items assembled from database, redis, task, coverage and conflict states
- requestId coverage freshness uplift by auditing key admin auth/system reads
- admin system panel display, verification and release-state sync

- [x] **Step 2: Lock completion criteria**

Completion criteria:

- `/api/admin/system` returns:
  - `observability.tasks.failedLast30d`
  - `observability.tasks.trend.failed24hVs30dDailyAverage`
  - `observability.tasks.trend.failed7dVs30dDailyAverage`
  - `observability.audits.sampledLast24h`
  - `observability.audits.withRequestIdLast24h`
  - `observability.audits.requestIdCoverageLast24hPercent`
  - `observability.audits.sampledLast7d`
  - `observability.audits.withRequestIdLast7d`
  - `observability.audits.requestIdCoverageLast7dPercent`
  - `observability.audits.conflicts.totalLast7d`
  - `observability.audits.conflicts.totalLast30d`
  - `observability.audits.conflicts.trend`
  - `observability.alerts`
- admin system panel renders explicit longer-window and alert rows
- admin auth/system reads contribute requestId-tagged audit samples
- verification scripts assert the new payload and UI contract
- gray / production docs can describe Batch 3 as complete

### Task 2: Extend backend observability payload and alert assembly

**Files:**
- Modify: `apps/api/src/server.ts`

- [x] **Step 1: Add task 30d windows and long-horizon deltas**

Backend additions:

- add `failedLast30d`
- add `trend.failed30dDailyAverageBaseline`
- add `trend.failed24hVs30dDailyAverage`
- add `trend.failed7dDailyAverage`
- add `trend.failed7dVs30dDailyAverage`

- [x] **Step 2: Add audit recent coverage and conflict long-window metrics**

Backend additions:

- add:
  - `sampledLast24h`
  - `withRequestIdLast24h`
  - `requestIdCoverageLast24hPercent`
  - `sampledLast7d`
  - `withRequestIdLast7d`
  - `requestIdCoverageLast7dPercent`
- keep existing latest-sample coverage fields for compatibility
- add conflict fields:
  - `totalLast7d`
  - `totalLast30d`
  - `trend.total24hDailyAverageBaseline`
  - `trend.total24hVs7dDailyAverage`
  - `trend.total30dDailyAverageBaseline`
  - `trend.total24hVs30dDailyAverage`

- [x] **Step 3: Assemble active alert items**

Add `observability.alerts` with:

- `activeCount`
- `highestSeverity`
- `items[]` entries built from:
  - database target mismatch / DB error
  - redis configured but not connected
  - task health warning/critical
  - requestId coverage health warning/critical
  - conflict health warning/critical

Each alert item should include:

- `code`
- `severity`
- `source`
- `summary`
- `action`

### Task 3: Improve requestId coverage freshness

**Files:**
- Modify: `apps/api/src/server.ts`

- [x] **Step 1: Add auth/system read audit samples**

Add request-context-bearing audit writes for:

- successful admin login
- admin logout when actor is admin
- `GET /api/admin/system`

These records should use the existing audit storage path and include requestId / ip / userAgent.

- [x] **Step 2: Keep the change narrow**

Do not audit every read endpoint. Limit this batch to the smallest set that improves requestId sample freshness without flooding the audit table.

### Task 4: Extend admin types and readonly system panel

**Files:**
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/admin-readonly-panels.tsx`

- [x] **Step 1: Add Batch 3 response types**

Extend `SystemInfo` with:

- task 30d metrics and long-window trend fields
- audit recent-window coverage fields
- conflict long-window trend fields
- `observability.alerts`

- [x] **Step 2: Render explicit rows**

Add rows for:

- `30d 失败任务`
- `24h 失败 vs 30d 日均`
- `7d 日均 vs 30d 日均`
- `近24h 请求ID覆盖率`
- `近7d 请求ID覆盖率`
- `7d 冲突总数`
- `30d 冲突总数`
- `24h 冲突 vs 30d 日均`
- `活动告警`

Keep the existing read-only table style; no new panel abstraction.

### Task 5: Tighten verification and docs

**Files:**
- Modify: `scripts/verify-system-observability.mjs`
- Modify: `scripts/verify-admin-readonly-panels-contract.mjs`
- Modify: `DEVLOG.md`
- Modify: `README.md`
- Modify: `MEMORY.md`
- Modify: `ops/README.md`

- [x] **Step 1: Extend verification assertions**

`verify-system-observability.mjs` must assert:

- task 30d metrics and trend fields
- audit recent coverage fields
- conflict 7d/30d fields and trend
- alert structure
- recent requestId coverage is sampled and positive after the script’s tagged writes

`verify-admin-readonly-panels-contract.mjs` must assert the new row labels exist.

- [x] **Step 2: Run focused acceptance**

Run:

```bash
npm run type-check -w @xinghuan/api
npm run type-check -w @xinghuan/admin
npm run build -w @xinghuan/api
npm run build -w @xinghuan/admin
node scripts/verify-admin-readonly-panels-contract.mjs
node scripts/verify-system-observability.mjs
```

- [x] **Step 3: Sync state docs**

Only after the commands above pass:

- update state docs to mark Batch 3 complete
- record what changed in observability payload and current acceptance scope
- state clearly whether release/deploy happened in this batch

---

## Self-Review

- Spec coverage: this plan covers Batch 3 scope freeze, backend payload, alert assembly, requestId freshness uplift, admin display, verification, and state-doc sync.
- Placeholder scan: no `TBD` or deferred markers remain.
- Type consistency: planned field names align with the current `SystemInfo` layout and current `/api/admin/system` naming style.
