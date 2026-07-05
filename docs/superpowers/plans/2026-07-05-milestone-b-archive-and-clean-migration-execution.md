# Milestone-B Archive And Clean Migration Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 先把旧工作树 `xinghuan-milestone-b` 的未收口改造成果做一次只读封存提交，再在唯一活跃工作树 `xinghuan-integration-clean` 中按领域筛选、重建、验证、修复、提交，继续完成剩余结构改造。

**Architecture:** `xinghuan-milestone-b` 只作为 archive/source-of-evidence，不能直接 merge 到主线；`xinghuan-integration-clean` 是唯一开发、验证、灰度和正式发布源。所有迁移按 domain 小批次执行：先审计旧树 diff，再在 clean 写测试/迁移最小代码，再跑验证，再更新台账，再提交。

**Tech Stack:** Git worktrees, npm workspaces, TypeScript, Vitest, project `verify:*` scripts, CodeGraph, release logbooks, repository-boundary harness, gray/production runbooks.

---

## Scope And Non-Negotiables

- Active clean worktree: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean`
- Old archive/source worktree: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b`
- Do not merge `xinghuan-milestone-b` into `xinghuan-integration-clean`.
- Do not cherry-pick WIP commits wholesale unless a later task explicitly approves a tiny already-clean commit.
- Do not continue ComfyUI feature development in this plan. ComfyUI code from old worktree may be archived as evidence only.
- Do not print or commit secrets. In particular, never stage or display `Tencent_Cloud_Server.pem`, `tencent_key_ascii.pem`, or any `*.pem`.
- Do not stage scratch files: `.claude/`, `.eslint-report.json`, `task_plan.md`, `progress.md`, `findings.md`, `tmp-*.log`, local terminal output, or generated reports.
- Do not modify internal proxy routes or services.
- Keep `apps/api/src/server.ts` within hotspot budget. If a migration grows it, stop and split more behavior into focused modules.
- Every migrated domain must have four pieces of evidence: tests/verify output, daily or architecture record, clean commit, and clean `git status --short`.

## Current Execution Snapshot - 2026-07-05

This is the authoritative progress snapshot for continuing the plan.

### Completed In Old Worktree

- Archive branch exists: `archive/xinghuan-milestone-b-wip-20260705`
- Archive commit exists: `a60e689 archive: snapshot milestone-b unfinished repository refactor`
- Remaining untracked old-tree scratch is not migration evidence and must not be copied:
  - `.claude/`
  - `.eslint-report.json`
  - `task_plan.md`
  - `progress.md`
  - `findings.md`
  - `tmp-envsync-api.err.log`
  - `tmp-envsync-api.out.log`

### Completed In Clean Worktree

| Area | Clean commit | Status |
|------|--------------|--------|
| Tooling / CI safety net | `53f8ee8` | Completed before repository wave |
| Auth current-user/login repository slice | `9e27bc7` and gray `20260705-auth-login-repository-gray-r3-v0525` | Completed and gray verified |
| Admin task list heavy-field stripping | `f9d7fff` and gray `c549e71` | Completed and gray verified |
| Postgres pool configurability | `2127368` | Completed and gray verified |
| Shared provider helper rebuild | `7966bd1` | Completed and revalidated |
| Web icon import shrink | `619fcdd` | Completed |
| Provider repository boundary | `c5af7bd`, `fb529c9`, `eeb0a36` | Completed locally |
| Settings repository boundary | `55ad04b` | Completed locally |
| Admin repository boundary | `c0b8b70` | Completed locally |
| Task repository boundary | `41fb8a3` | Completed locally; live gray task pagination must rerun after deploy |
| Admin usage summary repository/service | `340257f` | Completed locally |

### Remaining Scope In This Plan

1. Commit the current docs-only status/decision update.
2. Run final local validation and repair any failing repository/shared/envsync checks.
3. Sync CodeGraph and leave the clean worktree clean.
4. Prepare a gray release gate only after the validation set passes and the user approves deployment.

### Explicit Deferrals

- `environment-sync-local` extraction is deferred. The old archived file is a broad 872-line local sync aggregator and must be migrated in a dedicated follow-up plan, not forced into this repository wave.
- F1 task realtime mechanism is deferred. No SSE or shared frontend polling implementation is introduced in this migration line.
- ComfyUI feature development is frozen. Do not migrate or resume ComfyUI UI, connector, workflow parser, Tailscale, tunnel, or machine-pool work under this plan.

## File Map

### Old Worktree Archive Inputs

- `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/*repository.ts`
- `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/*repository.test.ts`
- `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/environment-sync-local.ts`
- `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/*routes*.ts`
- `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/server.ts`
- `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/packages/shared/src/*.ts`
- `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/scripts/verify-*.mjs`
- `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/docs/logbooks/daily/2026/2026-07/2026-07-05.md`

### Clean Worktree Migration Targets

- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/auth-repository.ts`
- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/provider-repository.ts`
- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/settings-repository.ts`
- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/admin-repository.ts`
- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/task-repository.ts`
- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/admin-usage-summary-repository.ts`
- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/admin-usage-summary-service.ts`
- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/packages/shared/src/*.ts`
- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/scripts/verify-*.mjs`
- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/docs/records/architecture/2026-07-05-migration-completeness-validation.md`
- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/docs/logbooks/daily/2026/2026-07/2026-07-05.md`

---

## Phase 0 - Baseline Safety Check

### Task 0.1: Confirm Both Worktrees And Current Branches

**Files:** no file changes.

- [ ] **Step 1: Confirm clean worktree is the active source**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean branch --show-current
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean status --short
```

Expected:

```text
xinghuan-integration-clean
```

`status --short` must be empty before migration implementation starts. If it is not empty, classify the changes before continuing.

- [ ] **Step 2: Confirm old worktree is dirty source material**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b branch --show-current
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b status --short
```

Expected:

```text
xinghuan-milestone-b
```

`status --short` should show WIP changes. These are archive inputs, not clean completion evidence.

- [ ] **Step 3: Save baseline logs for audit**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean log --oneline -8
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b log --oneline -8
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b diff --stat
```

Expected:

- Clean branch latest commits include the current gray `v0.5.25` records.
- Old branch latest committed work stops around the `2026-07-04` tooling/repository refactor commits.
- Old branch diff shows the WIP repository/environment-sync/shared decomposition.

---

## Phase 1 - Old Worktree Archive Snapshot

### Task 1.1: Create Archive Branch In Old Worktree

**Files:** no content changes required.

- [ ] **Step 1: Create an archive branch from the current old worktree HEAD**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b switch -c archive/xinghuan-milestone-b-wip-20260705
```

Expected:

```text
Switched to a new branch 'archive/xinghuan-milestone-b-wip-20260705'
```

If the branch already exists, run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b branch --show-current
```

Expected: either already on `archive/xinghuan-milestone-b-wip-20260705`, or stop and inspect before switching.

### Task 1.2: Stage Only Archive-Worthy Material

**Files:** stage only project artifacts and docs. Do not edit content in this task.

- [ ] **Step 1: Inspect ignored and untracked high-risk files**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b status --short --ignored
```

Expected:

- Secrets are ignored or untracked but not staged.
- `.claude/`, `.eslint-report.json`, `task_plan.md`, `progress.md`, `findings.md`, and `tmp-*.log` are visible as scratch if present.

- [ ] **Step 2: Stage the archive snapshot with explicit exclusions**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b add -A -- `
  ':!Tencent_Cloud_Server.pem' `
  ':!tencent_key_ascii.pem' `
  ':!*.pem' `
  ':!.claude' `
  ':!.claude/**' `
  ':!.eslint-report.json' `
  ':!task_plan.md' `
  ':!progress.md' `
  ':!findings.md' `
  ':!tmp-*.log' `
  ':!tmp-*.out.log' `
  ':!tmp-*.err.log'
```

Expected: command succeeds without staging scratch or secret files.

- [ ] **Step 3: Verify staged file list**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b diff --cached --name-status
```

Expected staged categories:

- API repository/source/test files.
- Shared package source/test files.
- Verify scripts.
- Project docs and logbooks.
- ComfyUI material may appear only as archive evidence, not as active continuation work.

Forbidden staged categories:

- `Tencent_Cloud_Server.pem`
- `tencent_key_ascii.pem`
- any `*.pem`
- `.claude/`
- `.eslint-report.json`
- `task_plan.md`
- `progress.md`
- `findings.md`
- `tmp-envsync-api.err.log`
- `tmp-envsync-api.out.log`

- [ ] **Step 4: Unstage any forbidden path if it appears**

Run one explicit path at a time:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b restore --staged -- <FORBIDDEN_PATH>
```

Expected: forbidden path disappears from `git diff --cached --name-status`.

### Task 1.3: Commit Archive Snapshot

**Files:** staged archive files only.

- [ ] **Step 1: Create archive commit**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b commit -m "archive: snapshot milestone-b unfinished repository refactor" -m "Archive-only snapshot of the old milestone-b worktree before clean migration.

This commit preserves WIP repository, environment-sync, shared helper, verify-script, and logbook material for later selective analysis.

It is not a release candidate, not a merge source, and must not be merged wholesale into xinghuan-integration-clean.

ComfyUI material remains frozen as evidence only.
Scratch files, temporary logs, and secrets are excluded."
```

Expected: one archive commit is created on `archive/xinghuan-milestone-b-wip-20260705`.

- [ ] **Step 2: Tag archive commit**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b tag archive/milestone-b-wip-20260705
```

Expected: tag created locally.

- [ ] **Step 3: Verify archive commit**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b log --oneline -3
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b diff-tree --no-commit-id --name-only -r HEAD | Select-String -Pattern 'pem|\\.claude|eslint-report|task_plan|progress|findings|tmp-'
```

Expected:

- Latest commit is `archive: snapshot milestone-b unfinished repository refactor`.
- The `Select-String` command returns no forbidden path matches.

---

## Phase 2 - Migration Inventory In Clean Worktree

### Task 2.1: Create Migration Audit Record

**Files:**

- Create or modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/docs/records/architecture/2026-07-05-milestone-b-archive-migration-inventory.md`

- [ ] **Step 1: Create the inventory document**

Use this exact initial structure:

```markdown
# Milestone-B Archive Migration Inventory

Date: 2026-07-05

Source archive branch: `archive/xinghuan-milestone-b-wip-20260705`
Source archive tag: `archive/milestone-b-wip-20260705`
Target branch: `xinghuan-integration-clean`

## Rules

- The archive branch is read-only evidence.
- Do not merge the archive branch.
- Migrate by rebuilding one domain at a time in the clean branch.
- ComfyUI remains frozen and excluded from feature continuation.
- Each migrated domain needs tests, verify output, docs, and a clean commit.

## Inventory

| Domain | Old files | Clean status | Decision | Validation |
| --- | --- | --- | --- | --- |
| Auth repository | `apps/api/src/auth-repository.ts`, tests, auth verify scripts | Completed slice | Keep current-user/login slices; complete more only under a later domain plan | auth repository tests + auth verify scripts |
| Provider repository | `apps/api/src/provider-repository.ts`, route tests, provider verify scripts | Completed | Keep `c5af7bd`/`fb529c9`/`eeb0a36` clean rebuild | provider repository tests + provider route split contract |
| Settings repository | `apps/api/src/settings-repository.ts`, settings route tests | Completed | Keep `55ad04b` clean rebuild | settings repository tests + assistant/task queue contracts |
| Admin repository | `apps/api/src/admin-repository.ts`, admin/audit tests | Completed | Keep `c0b8b70` clean rebuild | admin repository tests + audit/announcement contracts |
| Task repository | `apps/api/src/task-repository.ts`, task cancellation tests | Completed locally | Keep `41fb8a3`; rerun live task pagination after gray deploy | task repository tests + admin task pagination |
| Usage summary repository/service | `apps/api/src/admin-usage-summary-repository.ts`, `apps/api/src/admin-usage-summary-service.ts` | Completed locally | Keep `340257f` clean rebuild | usage summary repository contract |
| Environment sync local | `apps/api/src/environment-sync-local.ts`, envsync verify scripts | Deferred | Do not migrate old 872-line file in this wave; validate current service/smoke and create dedicated follow-up plan | envsync service contract + envsync smoke |
| Shared API/Worker helpers | `packages/shared/src/*` | Completed and revalidated | Keep clean helper rebuild | shared helper tests + package export verify |
| ComfyUI | admin/web/api/connector files | Frozen | Archive only | no active migration |
| Scratch/tool output | `.claude/`, temp logs, task/progress/findings | Excluded | Do not migrate | no staged files |
```

- [ ] **Step 2: Fill actual archive commit hash**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b rev-parse archive/milestone-b-wip-20260705
```

Expected: one commit hash. Add it under the inventory header as:

```markdown
Source archive commit: `<hash>`
```

- [ ] **Step 3: Commit the inventory doc**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean add docs/records/architecture/2026-07-05-milestone-b-archive-migration-inventory.md
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean commit -m "docs: add milestone-b archive migration inventory"
```

Expected: clean branch has one docs-only commit.

---

## Phase 3 - Provider Repository Migration

### Task 3.1: Compare Provider Boundary

**Files:**

- Source: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/provider-repository.ts`
- Source test: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/provider-repository.test.ts`
- Target: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/provider-repository.ts`
- Target test: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/provider-repository.test.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/server.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/admin-provider-routes.ts`
- Verify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/scripts/verify-api-admin-provider-route-split-contract.mjs`

- [ ] **Step 1: Run source/target comparison**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean diff --no-index -- D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean\apps\api\src\provider-repository.ts D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b\apps\api\src\provider-repository.ts
```

Expected:

- If target file is missing, diff exits non-zero because the file does not exist. That is acceptable.
- Identify only provider/model/RH catalog/key-pool behavior. Do not include ComfyUI.

- [ ] **Step 2: Write or migrate provider repository tests first**

Run:

```powershell
npx vitest run apps/api/src/provider-repository.test.ts
```

Expected before implementation: fail if target test/file is missing.

- [ ] **Step 3: Implement provider repository in clean**

Required behavior:

- `readProviderRecords()`
- `readProviderRecordsByProtocol(protocol)`
- `findProviderRecordById(id)`
- `findProviderRecordByNaturalKey(name)`
- `insertProviderRecord(provider)`
- `updateProviderRecord(id, transform)`
- `deleteProviderRecord(id)`
- `readModelRecords()`
- `readEnabledModelRecords()`
- `readModelRecordsByProviderId(providerId)`
- `findModelRecordById(id)`
- `findModelRecordByNaturalKey(providerId, capability, modelId)`
- `findModelWithProviderById(id)`
- `insertModelRecord(model)`
- `updateModelRecord(id, transform)`
- `deleteModelRecord(id)`
- `importProviderModels(providerId, importResult)`
- `updateProviderProbeResult(providerId, result, now)`
- `updateProviderLastFetchedAt(providerId, now)`
- `updateProviderRhCatalog(providerId, transform)`

Implementation rule: file-backed mode may keep JSON array behavior; PostgreSQL mode must use focused provider/model queries and avoid loading `xh_tasks.payload`, `xh_tasks.result`, or full admin view.

- [ ] **Step 4: Wire provider routes and server dependencies**

Change clean `server.ts` and `admin-provider-routes.ts` so provider/model admin paths receive repository functions instead of direct full `readAdminDb()` reads where possible.

Required route behavior:

- `GET /api/admin/providers` reads provider records only.
- Provider probe/fetch reads one provider by id.
- Model list reads models only.
- Model test/update/delete reads model by id and provider by id only when needed.
- RH catalog/key-pool updates write the provider RH catalog field only.

- [ ] **Step 5: Run provider validation**

Run:

```powershell
npm run type-check -w @xinghuan/api
npx vitest run apps/api/src/provider-repository.test.ts apps/api/src/admin-provider-routes.test.ts
node scripts/verify-api-admin-provider-route-split-contract.mjs
npm run verify:runninghub-workflow-contract
npm run verify:model-catalog
npm run verify:provider-model-catalog-contract
```

Expected:

- All commands pass.
- Provider routes do not regress RH/model catalog behavior.

- [ ] **Step 6: Commit provider batch**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean status --short
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean add apps/api/src/provider-repository.ts apps/api/src/provider-repository.test.ts apps/api/src/admin-provider-routes.ts apps/api/src/admin-provider-routes.test.ts apps/api/src/server.ts scripts/verify-api-admin-provider-route-split-contract.mjs docs/logbooks/daily/2026/2026-07/2026-07-05.md docs/records/architecture/2026-07-05-milestone-b-archive-migration-inventory.md
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean commit -m "refactor(api): migrate provider repository boundary"
```

Expected: clean commit with only provider-domain files and docs.

---

## Phase 4 - Settings Repository Migration

### Task 4.1: Migrate Assistant And Queue Settings Boundary

**Files:**

- Target: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/settings-repository.ts`
- Target test: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/settings-repository.test.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/admin-assistant-settings-routes.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/admin-queue-settings-routes.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/admin-system-settings-routes.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/server.ts`
- Verify: route split contracts and `scripts/verify-admin-assistant-settings-save-contract.mjs`

- [ ] **Step 1: Compare old and clean settings repository**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean diff --no-index -- D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean\apps\api\src\settings-repository.ts D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b\apps\api\src\settings-repository.ts
```

Expected: determine exact missing settings behavior.

- [ ] **Step 2: Run failing tests**

Run:

```powershell
npx vitest run apps/api/src/settings-repository.test.ts apps/api/src/admin-assistant-settings-routes.test.ts apps/api/src/admin-system-settings-routes.test.ts
```

Expected before implementation: fail if files or routes are not migrated.

- [ ] **Step 3: Implement settings repository**

Required behavior:

- `readAssistantSettingsRecord()`
- `writeAssistantSettingsRecord(settings, expectedRevision)`
- `readTaskQueueSettingsRecord()`
- `writeTaskQueueSettingsRecord(taskQueueSettings, expectedRevision)`
- file-backed revision preservation.
- PostgreSQL optimistic revision handling.

- [ ] **Step 4: Wire routes**

Required route behavior:

- Assistant settings GET/PATCH must use settings repository, not full `readAdminDb().assistantSettings`.
- Queue/system settings must use settings repository for task queue settings.
- RunningHub concurrency reads must use provider repository, not full admin DB.

- [ ] **Step 5: Run settings validation**

Run:

```powershell
npm run type-check -w @xinghuan/api
npx vitest run apps/api/src/settings-repository.test.ts apps/api/src/admin-assistant-settings-routes.test.ts apps/api/src/admin-system-settings-routes.test.ts
node scripts/verify-api-admin-assistant-settings-route-split-contract.mjs
node scripts/verify-api-queue-settings-route-split-contract.mjs
node scripts/verify-api-system-settings-route-split-contract.mjs
node scripts/verify-admin-assistant-settings-save-contract.mjs
```

Expected: all commands pass.

- [ ] **Step 6: Commit settings batch**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean add apps/api/src/settings-repository.ts apps/api/src/settings-repository.test.ts apps/api/src/admin-assistant-settings-routes.ts apps/api/src/admin-assistant-settings-routes.test.ts apps/api/src/admin-queue-settings-routes.ts apps/api/src/admin-system-settings-routes.ts apps/api/src/admin-system-settings-routes.test.ts apps/api/src/server.ts scripts/verify-api-admin-assistant-settings-route-split-contract.mjs scripts/verify-api-queue-settings-route-split-contract.mjs scripts/verify-api-system-settings-route-split-contract.mjs scripts/verify-admin-assistant-settings-save-contract.mjs docs/logbooks/daily/2026/2026-07/2026-07-05.md docs/records/architecture/2026-07-05-milestone-b-archive-migration-inventory.md
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean commit -m "refactor(api): migrate settings repository boundary"
```

Expected: clean settings-domain commit.

---

## Phase 5 - Admin Repository Migration

### Task 5.1: Migrate Admin Summary, Audit, Announcement, And Lightweight Reads

**Files:**

- Target: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/admin-repository.ts`
- Target test: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/admin-repository.test.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/admin-audit-routes.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/server.ts`
- Add/modify scripts:
  - `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/scripts/verify-admin-audit-records-repository-contract.mjs`
  - `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/scripts/verify-admin-announcement-records-repository-contract.mjs`

- [ ] **Step 1: Compare admin repository**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean diff --no-index -- D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean\apps\api\src\admin-repository.ts D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b\apps\api\src\admin-repository.ts
```

Expected: identify admin summary/audit/announcement/task observability behavior.

- [ ] **Step 2: Run failing tests**

Run:

```powershell
npx vitest run apps/api/src/admin-repository.test.ts apps/api/src/admin-audit-routes.test.ts
```

Expected before implementation: fail if target is missing or incomplete.

- [ ] **Step 3: Implement admin repository**

Required behavior:

- `readAdminDb()` and `writeAdminDb()` remain available for compatibility but are not the preferred read path for summaries.
- `readAdminSummary(userSummary, storage)`
- `readAuditObservabilitySummary()`
- `readTaskObservabilitySummary()`
- `readAnnouncementRecords()`
- `writeAnnouncementRecords(records)`
- `appendAuditRecord(record)`
- `readAuditRecords(query?)`
- `readTaskRecords()` and `writeTaskRecords(records)` only where task repository needs file-backed compatibility.

PostgreSQL rule: summary/audit/announcement reads must use focused SQL and avoid fetching task `payload`, `result`, and `logs` unless the endpoint explicitly needs detail.

- [ ] **Step 4: Run admin validation**

Run:

```powershell
npm run type-check -w @xinghuan/api
npx vitest run apps/api/src/admin-repository.test.ts apps/api/src/admin-audit-routes.test.ts
node scripts/verify-admin-audit-records-repository-contract.mjs
node scripts/verify-admin-announcement-records-repository-contract.mjs
```

Expected: all commands pass.

- [ ] **Step 5: Commit admin batch**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean add apps/api/src/admin-repository.ts apps/api/src/admin-repository.test.ts apps/api/src/admin-audit-routes.ts apps/api/src/admin-audit-routes.test.ts apps/api/src/server.ts scripts/verify-admin-audit-records-repository-contract.mjs scripts/verify-admin-announcement-records-repository-contract.mjs docs/logbooks/daily/2026/2026-07/2026-07-05.md docs/records/architecture/2026-07-05-milestone-b-archive-migration-inventory.md
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean commit -m "refactor(api): migrate admin repository boundary"
```

Expected: clean admin-domain commit.

---

## Phase 6 - Task Repository Migration

### Task 6.1: Migrate Task Detail, List, Log, Write, And Cancellation Boundary

**Files:**

- Target: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/task-repository.ts`
- Target test: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/task-repository.test.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/admin-task-list-routes.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/task-cancellation-service.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/server.ts`
- Add/modify scripts:
  - `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/scripts/verify-task-repository-boundary-contract.mjs`
  - `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/scripts/verify-admin-task-records-repository-contract.mjs`

- [ ] **Step 1: Compare task repository**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean diff --no-index -- D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean\apps\api\src\task-repository.ts D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b\apps\api\src\task-repository.ts
```

Expected: identify detail/list/write/log/cancellation behavior.

- [ ] **Step 2: Run failing tests**

Run:

```powershell
npx vitest run apps/api/src/task-repository.test.ts apps/api/src/task-cancellation-service.test.ts apps/api/src/admin-task-list-routes.test.ts
```

Expected before implementation: fail if target is missing or incomplete.

- [ ] **Step 3: Implement task repository**

Required behavior:

- `readTaskRecord(taskId)`
- `readTaskListPage(query)`
- `appendTaskLog(taskId, line)`
- `insertTaskRecord(task)`
- `writeTaskRecord(task)`

PostgreSQL rule:

- Task list must not return heavy `payload`, `result`, or full `logs`.
- Task detail may read heavy fields because the detail endpoint needs them.
- Log append and write must update one task by id.

- [ ] **Step 4: Wire task routes and cancellation**

Required behavior:

- `admin-task-list-routes` calls `readTaskListPage()`.
- task cancellation service reads/writes via task repository or injected task functions.
- remove unused old direct cancellation helpers from `server.ts` only if tests prove they are dead.

- [ ] **Step 5: Run task validation**

Run:

```powershell
npm run type-check -w @xinghuan/api
npx vitest run apps/api/src/task-repository.test.ts apps/api/src/task-cancellation-service.test.ts apps/api/src/admin-task-list-routes.test.ts
node scripts/verify-task-repository-boundary-contract.mjs
node scripts/verify-admin-task-records-repository-contract.mjs
npm run verify:admin-task-pagination
```

Expected: all commands pass and task list remains lightweight.

- [ ] **Step 6: Commit task batch**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean add apps/api/src/task-repository.ts apps/api/src/task-repository.test.ts apps/api/src/admin-task-list-routes.ts apps/api/src/admin-task-list-routes.test.ts apps/api/src/task-cancellation-service.ts apps/api/src/task-cancellation-service.test.ts apps/api/src/server.ts scripts/verify-task-repository-boundary-contract.mjs scripts/verify-admin-task-records-repository-contract.mjs docs/logbooks/daily/2026/2026-07/2026-07-05.md docs/records/architecture/2026-07-05-milestone-b-archive-migration-inventory.md
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean commit -m "refactor(api): migrate task repository boundary"
```

Expected: clean task-domain commit.

---

## Phase 7 - Usage Summary Repository And Service

### Task 7.1: Migrate Usage Summary Boundary

**Files:**

- Target: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/admin-usage-summary-repository.ts`
- Target: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/admin-usage-summary-service.ts`
- Tests:
  - `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/admin-usage-summary-repository.test.ts`
  - `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/admin-usage-summary-service.test.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/server.ts`
- Script: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/scripts/verify-admin-usage-summary-repository-contract.mjs`

- [ ] **Step 1: Compare old usage summary files**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean diff --no-index -- D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean\apps\api\src\admin-usage-summary-repository.ts D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b\apps\api\src\admin-usage-summary-repository.ts
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean diff --no-index -- D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean\apps\api\src\admin-usage-summary-service.ts D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b\apps\api\src\admin-usage-summary-service.ts
```

Expected: identify repository/service split.

- [ ] **Step 2: Run tests**

Run:

```powershell
npx vitest run apps/api/src/admin-usage-summary-repository.test.ts apps/api/src/admin-usage-summary-service.test.ts
```

Expected before implementation: fail if missing.

- [ ] **Step 3: Implement usage summary split**

Required behavior:

- Repository reads task/user/provider/model data needed for usage summary.
- Service composes response formatting without direct DB/file access.
- Heavy task fields are not selected unless required by summary calculations.

- [ ] **Step 4: Run validation**

Run:

```powershell
npm run type-check -w @xinghuan/api
npx vitest run apps/api/src/admin-usage-summary-repository.test.ts apps/api/src/admin-usage-summary-service.test.ts
node scripts/verify-admin-usage-summary-repository-contract.mjs
```

Expected: all commands pass.

- [ ] **Step 5: Commit usage summary batch**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean add apps/api/src/admin-usage-summary-repository.ts apps/api/src/admin-usage-summary-repository.test.ts apps/api/src/admin-usage-summary-service.ts apps/api/src/admin-usage-summary-service.test.ts apps/api/src/server.ts scripts/verify-admin-usage-summary-repository-contract.mjs docs/logbooks/daily/2026/2026-07/2026-07-05.md docs/records/architecture/2026-07-05-milestone-b-archive-migration-inventory.md
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean commit -m "refactor(api): migrate admin usage summary boundary"
```

Expected: clean usage-summary commit.

---

## Phase 8 - Environment Sync Local Boundary Deferral

### Task 8.1: Record Dedicated Follow-Up Instead Of Migrating Now

**Files:**

- Inspect only: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/environment-sync-local.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/docs/records/architecture/2026-07-05-milestone-b-archive-migration-inventory.md`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/docs/records/architecture/2026-07-05-migration-completeness-validation.md`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/docs/logbooks/daily/2026/2026-07/2026-07-05.md`

- [x] **Step 1: Classify the old environment sync local file**

Run:

```powershell
(Get-Content -LiteralPath 'D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b\apps\api\src\environment-sync-local.ts').Count
```

Observed:

```text
872
```

Decision:

- Do not migrate this file wholesale.
- The old file combines auth metadata, provider/model upsert, group permission policy sync, shared resource sync, public-resource workflow handling, and snapshot/apply orchestration.
- Migrating it inside the repository wave would create a large mixed-risk batch and make rollback unclear.

- [x] **Step 2: Record the deferral**

Record in architecture inventory and daily log:

```markdown
Environment-sync-local extraction is deferred to a dedicated follow-up plan. The current clean branch keeps the inline envsync local implementation and validates the existing environment sync service/smoke path for this migration wave.
```

- [ ] **Step 3: Validate current envsync behavior before release**

Run:

```powershell
node scripts/verify-environment-sync-service.mjs
npm run verify:environment-sync-smoke
```

Expected:

- Service contract passes locally.
- Smoke verifier either passes against the configured target or records a clear environment/runtime blocker. A failed live smoke blocks gray release unless the blocker is known to be target availability rather than branch behavior.

- [ ] **Step 4: Create a later dedicated envsync-local plan before code extraction**

When this deferred work resumes, write a separate plan under:

```text
docs/superpowers/plans/YYYY-MM-DD-environment-sync-local-boundary.md
```

That plan must split the old 872-line handler into at least these independent batches:

1. Snapshot read model boundary.
2. Local apply/upsert boundary.
3. Remote snapshot/apply client boundary.
4. Public resource/workflow sync policy boundary.
5. Permission/group policy sync validation.
6. Gray smoke and rollback record.

Expected: no envsync-local code extraction occurs in this migration plan.

---

## Phase 9 - Shared API/Worker Helper Completion

### Task 9.1: Compare And Complete Shared Helpers

**Files:**

- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/packages/shared/src/apimart-video-adapter.ts`
- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/packages/shared/src/audio-provider-adapter.ts`
- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/packages/shared/src/provider-request-body.ts`
- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/packages/shared/src/grsai-reference-images.ts`
- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/packages/shared/src/task-lifecycle.ts`
- API/Worker wrappers that import these helpers.

- [ ] **Step 1: Compare shared helper files**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean diff --no-index -- D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean\packages\shared\src\apimart-video-adapter.ts D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b\packages\shared\src\apimart-video-adapter.ts
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean diff --no-index -- D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean\packages\shared\src\task-lifecycle.ts D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b\packages\shared\src\task-lifecycle.ts
```

Expected:

- If clean already includes a helper, migrate only missing tests or missing edge behavior.
- Do not duplicate helpers back into API/Worker.

- [ ] **Step 2: Run shared tests**

Run:

```powershell
npx vitest run packages/shared/src/apimart-video-adapter.test.ts packages/shared/src/audio-provider-adapter.test.ts packages/shared/src/provider-request-body.test.ts packages/shared/src/grsai-reference-images.test.ts packages/shared/src/task-lifecycle.test.ts
```

Expected: pass after migration.

- [ ] **Step 3: Run package/export validation**

Run:

```powershell
npm run type-check
node scripts/verify-package-exports.mjs
node scripts/verify-apimart-video-adapter-contract.ts
node scripts/verify-provider-request-body-contract.ts
node scripts/verify-grsai-reference-images-contract.ts
```

Expected: all commands pass.

- [ ] **Step 4: Commit shared helper batch**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean add packages/shared apps/api/src/apimart-video-adapter.ts apps/worker/src/worker-apimart-video-adapter.ts apps/api/src/task-lifecycle.ts apps/worker/src/worker-task-lifecycle.ts scripts/verify-apimart-video-adapter-contract.ts scripts/verify-provider-request-body-contract.ts scripts/verify-grsai-reference-images-contract.ts docs/logbooks/daily/2026/2026-07/2026-07-05.md docs/records/architecture/2026-07-05-milestone-b-archive-migration-inventory.md
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean commit -m "refactor(shared): complete api worker helper migration"
```

Expected: shared-only commit plus minimal API/Worker import wrapper changes.

---

## Phase 10 - Remaining Structural Plan Completion Or Explicit Deferral

### Task 10.1: Update Structural Progress Board

**Files:**

- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/docs/records/architecture/2026-07-04-structural-improvement-execution-plan.md`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/docs/records/architecture/2026-07-05-migration-completeness-validation.md`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/docs/memory/current-state.md`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/docs/logbooks/daily/2026/2026-07/2026-07-05.md`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/docs/superpowers/plans/2026-07-05-milestone-b-archive-and-clean-migration-execution.md`

- [ ] **Step 1: Mark completed domains**

Update records with the exact commits produced in Phases 3-9.

Required rows:

- Provider repository: completed commit hash or explicit deferral.
- Settings repository: completed commit hash or explicit deferral.
- Admin repository: completed commit hash or explicit deferral.
- Task repository: completed commit hash or explicit deferral.
- Usage summary repository/service: completed commit hash or explicit deferral.
- Environment sync local: completed commit hash or explicit deferral.
- Shared helpers: completed commit hash or already completed reference.

- [ ] **Step 2: Decide F1 task realtime status**

If no separate realtime plan is approved, record:

```markdown
F1 task realtime mechanism remains deferred. No SSE or shared polling implementation is introduced in this migration line.
```

- [ ] **Step 3: Confirm ComfyUI status**

Record:

```markdown
ComfyUI feature development remains frozen. The archive branch preserves evidence, but no ComfyUI code is migrated as active feature work.
```

- [ ] **Step 4: Commit structural progress docs**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean add docs/records/architecture/2026-07-04-structural-improvement-execution-plan.md docs/records/architecture/2026-07-05-migration-completeness-validation.md docs/records/architecture/2026-07-05-milestone-b-archive-migration-inventory.md docs/memory/current-state.md docs/logbooks/daily/2026/2026-07/2026-07-05.md docs/superpowers/plans/2026-07-05-milestone-b-archive-and-clean-migration-execution.md
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean commit -m "docs: record repository migration completion status"
```

Expected: docs-only commit.

---

## Phase 11 - Full Validation And Repair Loop

### Task 11.1: Run Full Local Validation

**Files:** no intended edits unless validation fails.

- [ ] **Step 1: Run full CI**

Run:

```powershell
npm run ci
```

Expected: pass.

- [ ] **Step 2: Run API type check and hotspot checks**

Run:

```powershell
npm run type-check -w @xinghuan/api
npm run verify:file-hotspot-budgets
```

Expected:

- API type-check passes.
- `apps/api/src/server.ts` remains within hotspot budget.

- [ ] **Step 3: Run repository and environment contracts**

Run:

```powershell
npx vitest run apps/api/src/provider-repository.test.ts apps/api/src/settings-repository.test.ts
node scripts/verify-api-admin-provider-route-split-contract.mjs
node scripts/verify-api-admin-assistant-settings-route-split-contract.mjs
node scripts/verify-api-queue-settings-route-split-contract.mjs
node scripts/verify-api-system-settings-route-split-contract.mjs
node scripts/verify-admin-assistant-settings-save-contract.mjs
node scripts/verify-admin-audit-records-repository-contract.mjs
node scripts/verify-admin-announcement-records-repository-contract.mjs
node scripts/verify-admin-task-records-repository-contract.mjs
node scripts/verify-admin-usage-summary-repository-contract.mjs
node scripts/verify-task-repository-boundary-contract.mjs
node scripts/verify-environment-sync-service.mjs
npm run verify:environment-sync-smoke
```

Expected:

- Repository contracts pass.
- Environment sync service contract passes.
- Environment sync smoke passes against the configured target, or a live-target blocker is recorded before any release gate proceeds.

- [ ] **Step 4: Repair loop for failures**

If any command fails:

1. Do not continue to gray release.
2. Identify the smallest failing domain.
3. Fix only that domain.
4. Run the failing command again.
5. Run `npm run type-check -w @xinghuan/api`.
6. Add a daily log note with root cause and fix.
7. Commit the fix with a domain-specific message.

Allowed fix commit message examples:

```text
fix(api): repair provider repository migration regression
fix(api): repair environment sync service regression
fix(test): align repository contract verifier with clean boundary
```

### Task 11.2: Sync CodeGraph And Verify Cleanliness

**Files:** CodeGraph output only if the project generates tracked graph files.

- [ ] **Step 1: Run CodeGraph sync**

Run:

```powershell
npm run codegraph:sync
```

Expected: command succeeds.

- [ ] **Step 2: Confirm clean worktree**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean status --short
git -C D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean log --oneline -12
```

Expected:

- `status --short` empty, or only expected CodeGraph output that must be committed immediately.
- Latest commits show one-domain-at-a-time migration batches.

---

## Phase 12 - Gray Release Gate

### Task 12.1: Decide Whether To Release

**Entry gate:**

- All selected migration domains are completed or explicitly deferred.
- `npm run ci` passes.
- repository/environment sync contracts pass.
- CodeGraph sync passed.
- clean worktree is clean.
- ComfyUI remains frozen.

- [ ] **Step 1: Confirm current release facts**

Run:

```powershell
Get-Content -LiteralPath D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean\docs\logbooks\releases\current-release-index.md -TotalCount 80
Get-Content -LiteralPath D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean\ops\current\gray.md -TotalCount 80
Get-Content -LiteralPath D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean\ops\current\production.md -TotalCount 80
```

Expected:

- Gray currently records `v0.5.25` unless a later verified release changed it.
- Production currently records `v0.5.22` unless a later verified release changed it.

- [ ] **Step 2: Prepare gray release only after approval**

Use the existing project release scripts and runbooks from:

- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/docs/systems/observability-and-ops/release-flow-playbook.md`
- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/ops/README.md`

Expected: no gray deploy is performed until the release gate is explicitly satisfied.

---

## Execution Order

1. Phase 0: baseline safety check.
2. Phase 1: old worktree archive branch + archive commit + tag.
3. Phase 2: clean migration inventory.
4. Phase 3: provider repository.
5. Phase 4: settings repository.
6. Phase 5: admin repository.
7. Phase 6: task repository.
8. Phase 7: usage summary repository/service.
9. Phase 8: environment sync local deferral and current envsync validation.
10. Phase 9: shared helpers completion.
11. Phase 10: structural progress completion or deferral records.
12. Phase 11: full validation and repair loop.
13. Phase 12: gray release gate after explicit approval.

## Self-Review

- Spec coverage: The plan covers old worktree archive commit, selective analysis, migration, validation, repair, remaining structural work, ComfyUI freeze, and release gating.
- Placeholder scan: No task uses TBD/TODO/fill later language. Each task has commands and expected outcomes.
- Type consistency: Repository/domain names match existing old worktree files and clean migration targets.
- Risk control: No wholesale merge, no secret staging, no scratch staging, no ComfyUI feature continuation, no release before validation.
