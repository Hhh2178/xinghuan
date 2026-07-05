# Structural Worktree Migration and Continuation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely migrate the structural-improvement成果 from the mistaken `xinghuan-milestone-b` worktree into the intended `xinghuan-integration-clean` worktree, then continue the roadmap/execution-plan work from a clean, auditable baseline.

**Architecture:** Treat `xinghuan-integration-clean` as the only active development target. Treat `xinghuan-milestone-b` as a read-only patch source. Migrate by small, independently verified batches: first protect secrets and stabilize tooling, then port low-risk committed batches, then port E1 repository work as new clean commits, and only then resume remaining roadmap phases.

**Tech Stack:** Git worktrees, npm workspaces, TypeScript, Vitest, project `verify:*` contract scripts, CodeGraph, existing docs under `docs/records/architecture/` and `docs/logbooks/`.

---

## Source Of Truth

Primary target worktree:

- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean`

Patch source only:

- `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b`

Audit record:

- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/docs/records/architecture/2026-07-05-worktree-migration-audit.md`

Original roadmap:

- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/docs/records/architecture/2026-07-04-structural-improvement-roadmap.md`

Original execution plan:

- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/docs/records/architecture/2026-07-04-structural-improvement-execution-plan.md`

## Hard Rules

- Do not continue coding in `xinghuan-milestone-b`.
- Do not merge `xinghuan-milestone-b` into `xinghuan-integration-clean`.
- Do not stage or print `Tencent_Cloud_Server.pem`, `tencent_key_ascii.pem`, or any `*.pem` file.
- Do not stage `.eslint-report.json`, temporary logs, or local planning scratch files unless a later task explicitly promotes them to docs.
- Every migrated batch must be independently verified and committed before the next batch starts.
- If a migrated patch conflicts with ComfyUI files in `xinghuan-integration-clean`, stop and re-plan that batch instead of forcing the old version over the new line.

---

## Phase M0 - Protect Clean Worktree And Freeze Source

### Task M0.1: Confirm PEM Ignore Rules

**Files:**
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/.gitignore`

- [ ] **Step 1: Verify ignore rules exist**

Run:

```powershell
Select-String -LiteralPath 'D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean\.gitignore' -Pattern '\*\.pem|Tencent_Cloud_Server\.pem|tencent_key_ascii\.pem'
```

Expected:

```text
*.pem
Tencent_Cloud_Server.pem
tencent_key_ascii.pem
```

- [ ] **Step 2: Verify key files are ignored**

Run:

```powershell
git status --short
```

Expected:

```text
Tencent_Cloud_Server.pem
tencent_key_ascii.pem
```

must not appear in status output.

- [ ] **Step 3: Commit ignore and audit docs only**

Run:

```powershell
git add .gitignore docs/records/architecture/2026-07-05-worktree-migration-audit.md docs/superpowers/plans/2026-07-05-structural-worktree-migration-and-continuation.md
git commit -m "docs: record structural worktree migration audit and plan"
```

Expected:

```text
[xinghuan-integration-clean ...] docs: record structural worktree migration audit and plan
```

Do not include `package.json`, `package-lock.json`, or `eslint.config.js` in this commit.

### Task M0.2: Mark `xinghuan-milestone-b` As Frozen

**Files:**
- Create: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/docs/records/architecture/2026-07-05-worktree-frozen-note.md`

- [ ] **Step 1: Add frozen note**

Create this file:

```markdown
# Worktree Frozen Note - 2026-07-05

This worktree is frozen after the migration audit.

- Path: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b`
- Branch: `xinghuan-milestone-b`
- Role after 2026-07-05: read-only patch source

Do not continue feature development or structural refactor work here.
Continue active work in:

`D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean`
```

- [ ] **Step 2: Do not commit this note unless explicitly requested**

Reason:

`xinghuan-milestone-b` is not the target branch. The note is local safety signage only unless we intentionally archive the mistaken worktree.

---

## Phase M1 - Stabilize Phase 0 Tooling In Clean Worktree

### Task M1.1: Audit Existing Tooling Changes

**Files:**
- Inspect: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/package.json`
- Inspect: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/package-lock.json`
- Inspect: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/eslint.config.js`

- [ ] **Step 1: Review current diff**

Run:

```powershell
git diff -- package.json package-lock.json
Get-Content -LiteralPath 'D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean\eslint.config.js'
```

Expected:

- `package.json` only adds ESLint-related devDependencies.
- `package-lock.json` only reflects those dependency additions.
- `eslint.config.js` is repo-local lint config and contains no secrets or machine paths.

- [ ] **Step 2: Verify install metadata**

Run:

```powershell
npm install --package-lock-only
git diff --check -- package.json package-lock.json eslint.config.js
```

Expected:

```text
```

No whitespace errors.

### Task M1.2: Verify Tooling Baseline

**Files:**
- Modify if needed: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/package.json`
- Modify if needed: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/eslint.config.js`

- [ ] **Step 1: Run lint command**

Run:

```powershell
npm run lint
```

Expected:

- Command exists.
- It does not fail because ESLint is missing.
- If it reports warnings, record warning count. Do not turn broad legacy warnings into errors in this batch.

- [ ] **Step 2: Run core type check**

Run:

```powershell
npm run type-check
```

Expected:

- Existing project type-check behavior remains unchanged by ESLint setup.

- [ ] **Step 3: Commit tooling baseline**

Run:

```powershell
git add package.json package-lock.json eslint.config.js
git commit -m "chore(tooling): restore eslint baseline in clean worktree"
```

Expected:

```text
[xinghuan-integration-clean ...] chore(tooling): restore eslint baseline in clean worktree
```

---

## Phase M2 - Port Low-Risk Committed Structural Batches

### Task M2.1: Port Icon Chunk Shrink

**Source commit:**

- `f21c171 perf(web): shrink lucide icon imports in canvas nodes`

**Files likely affected:**
- `apps/web/src/components/Canvas.tsx`
- `apps/web/src/components/Sidebar.tsx`
- `apps/web/src/components/nodes/PlaceholderNode.tsx`

- [ ] **Step 1: Inspect commit before applying**

Run from clean worktree:

```powershell
git show --stat f21c171
git show -- apps/web/src/components/Canvas.tsx apps/web/src/components/Sidebar.tsx apps/web/src/components/nodes/PlaceholderNode.tsx
```

Expected:

- Commit only replaces namespace lucide imports with explicit icon maps/imports.
- No ComfyUI behavior is changed.

- [ ] **Step 2: Apply without committing**

Run:

```powershell
git cherry-pick -n f21c171
```

Expected:

- No conflict, or conflicts only in icon import sections.

- [ ] **Step 3: Verify web build**

Run:

```powershell
npm run build -w @xinghuan/web
```

Expected:

- Web build passes.
- If chunk stats are printed, record `vendor-icons` size in daily log.

- [ ] **Step 4: Commit**

Run:

```powershell
git add apps/web/src/components/Canvas.tsx apps/web/src/components/Sidebar.tsx apps/web/src/components/nodes/PlaceholderNode.tsx
git commit -m "perf(web): shrink lucide icon imports"
```

### Task M2.2: Port Shared Provider Helper Refactor

**Source commits:**

- `2c7c0df refactor: move shared provider helpers into packages/shared`
- `652315c refactor: share audio provider adapter across api and worker`

**Files likely affected:**
- `packages/shared/src/provider-request-body.ts`
- `packages/shared/src/grsai-reference-images.ts`
- `packages/shared/src/audio-provider-adapter.ts`
- `packages/shared/src/index.ts`
- `packages/shared/package.json`
- `apps/api/src/provider-request-body.ts`
- `apps/api/src/grsai-reference-images.ts`
- `apps/api/src/audio-provider-adapter.ts`
- `apps/worker/src/worker-provider-request-body.ts`
- `apps/worker/src/grsai-reference-images.ts`
- `apps/worker/src/worker-audio-provider-adapter.ts`

- [ ] **Step 1: Inspect source commits**

Run:

```powershell
git show --stat 2c7c0df
git show --stat 652315c
```

Expected:

- Provider request body and GRSAI reference image duplicate files move to shared package.
- Audio provider adapter common logic moves to shared package.

- [ ] **Step 2: Apply first refactor without committing**

Run:

```powershell
git cherry-pick -n 2c7c0df
```

Expected:

- Resolve only import/export conflicts.
- Do not overwrite newer ComfyUI files.

- [ ] **Step 3: Verify first refactor**

Run:

```powershell
npm run type-check
node scripts/verify-task-payload-api.mjs
```

Expected:

- Type check passes.
- Existing task payload contract passes.

- [ ] **Step 4: Commit first refactor**

Run:

```powershell
git add packages/shared apps/api apps/worker scripts
git commit -m "refactor(shared): move provider request helpers to shared package"
```

- [ ] **Step 5: Apply audio refactor**

Run:

```powershell
git cherry-pick -n 652315c
npm run type-check
```

Expected:

- Type check passes.

- [ ] **Step 6: Commit audio refactor**

Run:

```powershell
git add packages/shared apps/api apps/worker
git commit -m "refactor(shared): share audio provider adapter"
```

### Task M2.3: Port Tooling CI Commits Only If Not Already Covered

**Source commits:**

- `4cd571b`
- `00cc711`
- `03a6b08`
- `d5b75c0`

**Decision rule:**

If Phase M1 already produced an equivalent clean tooling commit, do not cherry-pick these commits directly. Instead, inspect and port only missing scripts/config.

- [ ] **Step 1: Compare scripts**

Run:

```powershell
git show 4cd571b -- package.json
git show 00cc711 -- package.json eslint.config.js
git show 03a6b08 -- package.json vitest.config.ts
git show d5b75c0 -- package.json .githooks/pre-push
```

Expected:

- Identify missing `test`, `ci`, or pre-push commands.

- [ ] **Step 2: Port missing pieces manually**

Only edit:

- `package.json`
- `vitest.config.ts`
- `.githooks/pre-push`
- `docs/logbooks/validations/*` if a validation record is needed

- [ ] **Step 3: Verify**

Run:

```powershell
npm run test
npm run ci
```

Expected:

- Commands run successfully, or any known pre-existing failure is documented before commit.

- [ ] **Step 4: Commit**

Run:

```powershell
git add package.json package-lock.json vitest.config.ts .githooks docs/logbooks/validations
git commit -m "chore(tooling): restore test and ci entrypoints"
```

---

## Phase M3 - Port E1 Repository Work In New Clean Batches

Do not cherry-pick the full dirty diff from `xinghuan-milestone-b`.

Each E1 task below must be ported as a fresh patch to `xinghuan-integration-clean`.

### Task M3.1: Port Auth Repository

**Source files:**
- `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/auth-repository.ts`
- `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/auth-repository.test.ts`
- `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/scripts/verify-auth-*.mjs`

**Target files:**
- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/auth-repository.ts`
- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/apps/api/src/auth-repository.test.ts`
- selected `scripts/verify-auth-*.mjs`
- minimal injection changes in `apps/api/src/server.ts`

- [ ] **Step 1: Copy source files as patch candidates**

Use `git diff --no-index` to inspect before copying:

```powershell
git diff --no-index -- D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean\apps\api\src\auth-repository.ts D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b\apps\api\src\auth-repository.ts
```

Expected:

- If target file does not exist, diff shows full file addition.

- [ ] **Step 2: Add tests first**

Copy `auth-repository.test.ts` and run:

```powershell
npx vitest run apps/api/src/auth-repository.test.ts
```

Expected:

- Initially fails if implementation is absent.

- [ ] **Step 3: Add implementation and minimal server injection**

Copy/adapt `auth-repository.ts`.
Update `server.ts` only for the auth paths needed by tests/contracts.

- [ ] **Step 4: Verify**

Run:

```powershell
npm run type-check -w @xinghuan/api
npx vitest run apps/api/src/auth-repository.test.ts
node scripts/verify-auth-current-user-repository-contract.mjs
node scripts/verify-auth-login-precision-query-contract.mjs
```

Expected:

- All commands pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add apps/api/src/auth-repository.ts apps/api/src/auth-repository.test.ts apps/api/src/server.ts scripts/verify-auth-*.mjs
git commit -m "refactor(api): introduce auth repository boundary"
```

### Task M3.2: Port Provider Repository

**Source files:**
- `provider-repository.ts`
- `provider-repository.test.ts`
- `scripts/verify-provider-repository-write-boundary-contract.mjs`

- [ ] **Step 1: Add provider repository tests**

Run:

```powershell
npx vitest run apps/api/src/provider-repository.test.ts
```

Expected:

- Fails before implementation is added.

- [ ] **Step 2: Add provider repository and server adapter**

Port:

- provider/model read helpers.
- provider/model write helpers.
- typed row boundaries.
- route-to-repository adapter.

Do not port unrelated environment-sync changes in this task.

- [ ] **Step 3: Verify**

Run:

```powershell
npm run type-check -w @xinghuan/api
npx vitest run apps/api/src/provider-repository.test.ts apps/api/src/admin-provider-routes.test.ts
node scripts/verify-provider-repository-write-boundary-contract.mjs
```

- [ ] **Step 4: Commit**

```powershell
git add apps/api/src/provider-repository.ts apps/api/src/provider-repository.test.ts apps/api/src/admin-provider-routes.ts apps/api/src/admin-provider-routes.test.ts apps/api/src/server.ts scripts/verify-provider-repository-write-boundary-contract.mjs
git commit -m "refactor(api): introduce provider repository boundary"
```

### Task M3.3: Port Settings And Admin Repositories

**Source files:**
- `settings-repository.ts`
- `settings-repository.test.ts`
- `admin-repository.ts`
- `admin-repository.test.ts`
- selected contract scripts for settings/admin announcements/audit/task records

- [ ] **Step 1: Port settings repository first**

Run:

```powershell
npx vitest run apps/api/src/settings-repository.test.ts
node scripts/verify-settings-repository-boundary-contract.mjs
```

- [ ] **Step 2: Commit settings repository**

```powershell
git add apps/api/src/settings-repository.ts apps/api/src/settings-repository.test.ts apps/api/src/server.ts scripts/verify-settings-repository-boundary-contract.mjs
git commit -m "refactor(api): introduce settings repository boundary"
```

- [ ] **Step 3: Port admin repository**

Run:

```powershell
npx vitest run apps/api/src/admin-repository.test.ts
node scripts/verify-admin-announcement-records-repository-contract.mjs
node scripts/verify-admin-audit-records-repository-contract.mjs
node scripts/verify-admin-task-records-repository-contract.mjs
```

- [ ] **Step 4: Commit admin repository**

```powershell
git add apps/api/src/admin-repository.ts apps/api/src/admin-repository.test.ts apps/api/src/server.ts scripts/verify-admin-*-repository-contract.mjs
git commit -m "refactor(api): introduce admin repository boundary"
```

### Task M3.4: Port Task And Usage Summary Repositories

**Source files:**
- `task-repository.ts`
- `task-repository.test.ts`
- `admin-usage-summary-repository.ts`
- `admin-usage-summary-repository.test.ts`
- `admin-usage-summary-service.ts`
- `admin-usage-summary-service.test.ts`
- `scripts/verify-task-repository-boundary-contract.mjs`
- `scripts/verify-admin-usage-summary-repository-contract.mjs`

- [ ] **Step 1: Port task repository without unfinished route test**

Do not blindly copy interrupted `admin-task-list-routes.test.ts`.

First port only:

- `task-repository.ts`
- `task-repository.test.ts`
- `verify-task-repository-boundary-contract.mjs`

Run:

```powershell
node scripts/verify-task-repository-boundary-contract.mjs
npm run type-check -w @xinghuan/api
npx vitest run apps/api/src/task-repository.test.ts
```

- [ ] **Step 2: Add route-level no-heavy-fields test**

Create a fresh route test in `xinghuan-integration-clean`, based on the interrupted test, but only after checking the current `admin-task-list-routes.ts`.

Expected behavior:

- GET `/api/admin/tasks` must not return `payload`, `result`, or `logs` in list items.
- Detail/read/update/retry paths may still return full task records where intended.

- [ ] **Step 3: Verify task pagination**

Run:

```powershell
node scripts/verify-admin-task-pagination.mjs
```

Expected:

- Passes after code is deployed to the target test runtime.
- If running only locally without deployed gray runtime, record that runtime verification is pending.

- [ ] **Step 4: Port usage summary repository/service**

Run:

```powershell
node scripts/verify-admin-usage-summary-repository-contract.mjs
npm run type-check -w @xinghuan/api
npx vitest run apps/api/src/admin-usage-summary-repository.test.ts apps/api/src/admin-usage-summary-service.test.ts apps/api/src/admin-audit-routes.test.ts
```

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/task-repository.ts apps/api/src/task-repository.test.ts apps/api/src/admin-task-list-routes.ts apps/api/src/admin-task-list-routes.test.ts apps/api/src/admin-usage-summary-repository.ts apps/api/src/admin-usage-summary-repository.test.ts apps/api/src/admin-usage-summary-service.ts apps/api/src/admin-usage-summary-service.test.ts apps/api/src/server.ts scripts/verify-task-repository-boundary-contract.mjs scripts/verify-admin-usage-summary-repository-contract.mjs
git commit -m "refactor(api): introduce task and usage summary repositories"
```

### Task M3.5: Port Environment Sync Local Boundary

**Source files:**
- `environment-sync-local.ts`
- `environment-sync-service.ts`
- `packages/shared/src/environment-sync.ts`
- environment sync verify scripts

- [ ] **Step 1: Port service/shared contract changes first**

Run:

```powershell
node scripts/verify-environment-sync-service.mjs
```

- [ ] **Step 2: Port local handler repository-boundary changes**

Run:

```powershell
node scripts/verify-environment-sync-local-repository-contract.mjs
npm run type-check -w @xinghuan/api
```

- [ ] **Step 3: Run smoke only against correct runtime**

Run:

```powershell
node scripts/verify-environment-sync-smoke.mjs
```

Expected:

- Only trust this result if `XINGHUAN_VERIFY_BASE_URL` points to the runtime built from `xinghuan-integration-clean`.

- [ ] **Step 4: Commit**

```powershell
git add apps/api/src/environment-sync-local.ts apps/api/src/environment-sync-service.ts apps/api/src/server.ts packages/shared/src/environment-sync.ts scripts/verify-environment-sync*.mjs
git commit -m "refactor(api): narrow environment sync repository boundaries"
```

---

## Phase M4 - Documentation And Release Hygiene

### Task M4.1: Restore Daily Logs In Clean Branch

**Files:**
- `docs/logbooks/daily/2026/2026-07/2026-07-05.md`
- `docs/logbooks/daily/2026/2026-07/recent-highlights.md`
- `docs/records/architecture/2026-07-04-structural-improvement-execution-plan.md`

- [ ] **Step 1: Create a clean 2026-07-05 daily log**

Use the milestone-b daily as source, but rewrite entries to reflect only batches actually migrated into clean branch.

- [ ] **Step 2: Update execution plan progress only after each migrated commit**

Do not copy milestone-b "已完成" progress wholesale.

- [ ] **Step 3: Commit docs**

```powershell
git add docs/logbooks/daily/2026/2026-07/2026-07-05.md docs/logbooks/daily/2026/2026-07/recent-highlights.md docs/records/architecture/2026-07-04-structural-improvement-execution-plan.md
git commit -m "docs: record migrated structural batches"
```

### Task M4.2: Release/Gray Verification Discipline

- [ ] **Step 1: Before gray deployment, confirm version state**

Run:

```powershell
Get-Content package.json | Select-String '"version"'
Get-Content packages/shared/src/index.ts | Select-String 'version'
```

- [ ] **Step 2: Deploy gray only from clean branch**

Do not deploy from `xinghuan-milestone-b`.

- [ ] **Step 3: Run targeted gray checks**

Run:

```powershell
node scripts/verify-admin-task-pagination.mjs
node scripts/verify-environment-sync-smoke.mjs
```

- [ ] **Step 4: Record release evidence**

Use existing release templates under:

- `docs/logbooks/releases/gray/`
- `docs/logbooks/validations/`

---

## Phase M5 - Continue Original Roadmap After Migration

Only resume original roadmap work after:

- `xinghuan-integration-clean` contains the migrated Phase 0/1/3/5 work that we choose to keep.
- Worktree is clean after commits.
- `npm run type-check` and selected contract/vitest checks pass.

Continuation priority:

1. Finish `Phase 3 / E1` repository boundaries still missing in clean branch.
2. Continue `Phase 5` by replacing fragile source-string verify scripts with behavior tests where feasible.
3. Re-evaluate `Phase 6 / F1` task SSE or shared polling only after task repository/list responses are stable.
4. Keep `Phase 2` server.ts and `Phase 4` frontend node work under hotspot-scorecard governance; do not mix them with repository migration commits.

---

## Self-Review

Spec coverage:

- Protect key files: covered by M0.1.
- Audit current worktree mismatch: covered by architecture audit and this plan.
- Migrate existing成果: covered by M2/M3.
- Maintain after migration: covered by M4.
- Continue future改造: covered by M5.

Placeholder scan:

- No `TBD`, `TODO`, or `implement later` placeholders are used as instructions.

Type consistency:

- The plan refers to existing project files and known source files from the audit.
- Repository migration is intentionally split by domain to avoid broad `server.ts` rewrites in one batch.
