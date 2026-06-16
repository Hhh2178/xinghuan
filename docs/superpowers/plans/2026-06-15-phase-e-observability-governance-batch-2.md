# Phase E Observability Governance Batch 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the second minimal observability-governance layer for Phase E so `/api/admin/system` can report simple health judgments, threshold-driven warnings, and short-window trend deltas instead of only raw counters.

**Architecture:** Extend the existing `readTaskObservabilitySummary` and `readAuditObservabilitySummary` output with a lightweight `health` block and short-window comparison fields that can be computed from current task/audit data without adding new tables. Reuse the admin read-only system panel to surface these values as explicit operational rows, then tighten the verification script and docs so release state and completion criteria stay aligned.

**Tech Stack:** TypeScript, Node.js, React, existing monorepo scripts, PostgreSQL/file-mode dual repository path

---

### Task 1: Freeze Batch 2 scope and completion checklist

**Files:**
- Create: `docs/superpowers/plans/2026-06-15-phase-e-observability-governance-batch-2.md`
- Modify: `docs/production-multi-user-hardening-plan-2026-06-13.md`
- Modify: `docs/prd/v0.1.0/progress.md`

- [x] **Step 1: Record the exact Batch 2 scope**

Batch 2 is limited to:

- task failure health judgment from existing `1h/24h/7d` windows
- requestId coverage health judgment from existing sample coverage
- conflict activity health judgment from existing `24h` conflict counters
- simple short-window trend/delta values derived from current windows
- admin system panel display
- verification and docs sync

- [x] **Step 2: Lock the completion criteria**

Completion criteria to write into docs:

- `/api/admin/system` returns:
  - `observability.tasks.health`
  - `observability.tasks.trend`
  - `observability.audits.coverageHealth`
  - `observability.audits.conflicts.health`
- admin system panel renders explicit health/trend rows
- `scripts/verify-system-observability.mjs` asserts the new structure
- gray/prod release docs describe Batch 2 as complete

### Task 2: Extend backend observability payload

**Files:**
- Modify: `apps/api/src/server.ts`

- [x] **Step 1: Add minimal task health/trend computation**

Backend additions should compute:

- `health.status`:
  - `healthy` when `failedLast24h === 0`
  - `warning` when `failedLast24h > 0 && failedLast7d <= failedLast24h * 3`
  - `critical` when `failedLast24h > 0 && failedLast7d > failedLast24h * 3`
- `health.summary`
- `trend.failed24hVs7dDailyAverage`
  - compare `failedLast24h` against `Math.round(failedLast7d / 7)`

- [x] **Step 2: Add minimal audit coverage/conflict health computation**

Backend additions should compute:

- `coverageHealth.status`
  - `healthy` when coverage `>= 80`
  - `warning` when coverage `>= 40 && < 80`
  - `critical` when coverage `< 40`
- `coverageHealth.summary`
- `conflicts.health.status`
  - `healthy` when total conflicts `=== 0`
  - `warning` when `1..5`
  - `critical` when `> 5`
- `conflicts.health.summary`

### Task 3: Extend admin types and render rows

**Files:**
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/admin-readonly-panels.tsx`

- [x] **Step 1: Add the new response types**

Extend `SystemInfo` so the frontend matches the backend additions exactly:

- `observability.tasks.health.status`
- `observability.tasks.health.summary`
- `observability.tasks.trend.failed24hVs7dDailyAverage`
- `observability.audits.coverageHealth.status`
- `observability.audits.coverageHealth.summary`
- `observability.audits.conflicts.health.status`
- `observability.audits.conflicts.health.summary`

- [x] **Step 2: Render the new rows in the system panel**

Add explicit rows for:

- `任务健康`
- `24h 失败 vs 7d 日均`
- `请求ID健康`
- `冲突健康`

Keep the implementation in the existing read-only table style; do not introduce a new panel component.

### Task 4: Tighten verification

**Files:**
- Modify: `scripts/verify-system-observability.mjs`
- Modify: `scripts/verify-admin-readonly-panels-contract.mjs`

- [x] **Step 1: Extend API verification assertions**

`verify-system-observability.mjs` must assert the new fields exist and are typed correctly:

- task health status/summary
- task trend numeric field
- audit coverageHealth status/summary
- audit conflicts.health status/summary

- [x] **Step 2: Extend readonly panel contract assertions**

`verify-admin-readonly-panels-contract.mjs` must assert the new row labels exist:

- `任务健康`
- `24h 失败 vs 7d 日均`
- `请求ID健康`
- `冲突健康`

### Task 5: Verification and release-state sync

**Files:**
- Modify: `DEVLOG.md`
- Modify: `README.md`
- Modify: `MEMORY.md`
- Modify: `ops/README.md`

- [x] **Step 1: Run focused verification**

Run:

```bash
npm run type-check -w @xinghuan/api
npm run type-check -w @xinghuan/admin
npm run build -w @xinghuan/api
npm run build -w @xinghuan/admin
node scripts/verify-admin-readonly-panels-contract.mjs
node scripts/verify-system-observability.mjs
```

- [x] **Step 2: Sync state docs**

Update state docs to say Batch 2 is complete only if the commands above pass and the payload shape is live.

---

## Self-Review

- Spec coverage: this plan covers checklist, backend payload, frontend display, verification, and state-doc sync for Batch 2.
- Placeholder scan: no `TBD` or deferred implementation markers remain.
- Type consistency: the planned property names match current `SystemInfo` naming style and current `/api/admin/system` layout.
