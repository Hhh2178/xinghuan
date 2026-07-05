# Clean Worktree Migration And Maintenance Master Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前已完成但分散在不同 worktree 的改造成果，安全迁移并维护到唯一活跃分支 `xinghuan-integration-clean`，暂停并封存 ComfyUI 功能开发，同时固定后续结构改造、灰度/正式发布的执行链路。

**Architecture:** 以 `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean` 作为唯一开发与发布源；`xinghuan-milestone-b` 只作为只读补丁来源。所有迁移和继续改造按小批次执行，每批先审计、再迁移、再验证、再提交、再记录。

**Tech Stack:** Git worktrees, npm workspaces, TypeScript, Vitest, ESLint, project `verify:*` scripts, CodeGraph, gray/production release logbooks, existing harness, sealed ComfyUI records.

---

## 0. Source Of Truth

唯一活跃工作树：

- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean`

只读补丁来源：

- `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b`

服务器总入口：

- `D:/codex/服务器`

当前关键证据文档：

- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/docs/records/architecture/2026-07-05-worktree-migration-audit.md`
- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/docs/superpowers/plans/2026-07-05-structural-worktree-migration-and-continuation.md`
- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/docs/records/architecture/2026-07-04-structural-improvement-roadmap.md`
- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/docs/records/architecture/2026-07-04-structural-improvement-execution-plan.md`

## 0.1 2026-07-05 Revision

This revision changes the plan from "continue ComfyUI after migration" to "pause and seal ComfyUI, then finish or explicitly defer the non-ComfyUI structural plan."

Current decision:

- ComfyUI feature development is frozen and no longer part of this execution plan.
- The existing ComfyUI gray state remains sealed as release evidence, not as the next active feature line.
- Migration completeness is still required: already completed clean-branch成果 must remain, and unfinished non-ComfyUI batches from the structural plan must stay in the backlog with clear validation gates.
- Gray deployment for this plan should validate structural/runtime safety only; it must not be treated as a new ComfyUI feature rollout.

Current remaining execution target:

1. Keep the completed B2 task list pagination and heavy-field stripping batch intact, including its gray/live verification evidence.
2. Finish B3 Postgres pool tuning, or write a deferral record with safe gray defaults.
3. Continue E1 repository boundary skeleton one domain at a time, starting from the lowest-risk remaining domain.
4. Decide or defer F1 task realtime mechanism with a decision record.
5. Run migration-completeness validation before any later gray release.

## 1. Hard Rules

- 不再在 `xinghuan-milestone-b` 继续开发。
- 不把 `xinghuan-milestone-b` 整体 merge 到 `xinghuan-integration-clean`。
- 不提交、不打印、不复制到文档任何真实密钥：`Tencent_Cloud_Server.pem`、`tencent_key_ascii.pem`、`*.pem`。
- 不把 `package.json`、`package-lock.json`、`eslint.config.js` 和迁移文档混在同一个 commit。
- 每批只解决一个主题：密钥忽略、工具链、共享模块、仓储边界、性能优化、发布链路不能混提交。
- 每批收口必须有四个证据：`git status --short`、相关测试/校验输出、daily log 或 release log、clean commit。
- 灰度和正式发布只能从 `xinghuan-integration-clean` 出发，发布前必须确认版本号和 release record。
- ComfyUI 功能开发从本计划开始暂停。允许的 ComfyUI 改动仅限崩溃修复、权限止血、灰度回滚记录、运行状态封存；不允许新增工作流能力、节点 UI、连接器架构或 Tailscale/隧道方案。
- ComfyUI freeze is not a "pending feature task." Do not use this plan to resume ComfyUI, polish ComfyUI UI, add workflow parameter editors, or connect additional local machines.
- If a ComfyUI emergency exception is required, it must be a separate stop-the-line batch with its own validation, release impact, and rollback record.
- Any remaining structural batch may be completed or explicitly deferred, but it cannot disappear from the plan without a dated decision record.
- A batch is only considered migrated when the clean branch has code/docs, validation evidence, and a clean commit. "Exists in milestone-b" is not completion evidence.

---

## Phase S - Secret Ignore And Safety Baseline

### Task S1: Confirm Key Ignore Coverage

**Files:**

- Modify: `D:/codex/服务器/.gitignore`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/.gitignore`

- [ ] **Step 1: Confirm root-level ignore labels**

Run:

```powershell
Get-Content -LiteralPath 'D:\codex\服务器\.gitignore' | Select-String -Pattern '\*\.pem|Tencent_Cloud_Server\.pem|tencent_key_ascii\.pem'
```

Expected:

```text
*.pem
Tencent_Cloud_Server.pem
tencent_key_ascii.pem
```

- [ ] **Step 2: Confirm clean worktree ignore labels**

Run:

```powershell
Get-Content -LiteralPath 'D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean\.gitignore' | Select-String -Pattern '\*\.pem|Tencent_Cloud_Server\.pem|tencent_key_ascii\.pem'
git check-ignore -v Tencent_Cloud_Server.pem tencent_key_ascii.pem
git ls-files | Select-String -Pattern 'Tencent_Cloud_Server\.pem|tencent_key_ascii\.pem|\.pem$'
```

Expected:

```text
.gitignore:*.pem
.gitignore:Tencent_Cloud_Server.pem
.gitignore:tencent_key_ascii.pem
```

The `git ls-files` command must print nothing.

- [ ] **Step 3: Commit only ignore/audit/plan docs**

Run:

```powershell
git status --short
git add .gitignore docs/records/architecture/2026-07-05-worktree-migration-audit.md docs/superpowers/plans/2026-07-05-structural-worktree-migration-and-continuation.md docs/superpowers/plans/2026-07-05-clean-worktree-migration-maintenance-master-plan.md
git commit -m "docs: record clean worktree migration and maintenance plan"
```

Expected:

```text
[xinghuan-integration-clean ...] docs: record clean worktree migration and maintenance plan
```

Do not stage:

```text
package.json
package-lock.json
eslint.config.js
Tencent_Cloud_Server.pem
tencent_key_ascii.pem
```

---

## Phase M - Migrate Existing成果

Status note:

- This phase records the original migration path from the mistaken worktree.
- The low-risk batches that were actually kept have already been rebuilt as clean commits and are reflected in Phase U.
- Do not repeat a Phase M task if the matching Phase U task already has a clean commit.
- Use Phase V to audit whether anything valuable still exists only in `xinghuan-milestone-b`.

### Task M1: Tooling Baseline

**Purpose:** 先把中断前的 ESLint/工具链改动变成可验证、可回退的独立批次，避免后续迁移时 npm 命令继续处在不可信状态。

**Files:**

- Inspect/Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/package.json`
- Inspect/Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/package-lock.json`
- Inspect/Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean/eslint.config.js`

- [ ] **Step 1: Validate JSON and lockfile**

Run:

```powershell
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); JSON.parse(require('fs').readFileSync('package-lock.json','utf8')); console.log('json ok')"
git diff --check -- package.json package-lock.json eslint.config.js
```

Expected:

```text
json ok
```

`git diff --check` must print no whitespace errors.

- [ ] **Step 2: Inspect dependency intent**

Run:

```powershell
git diff -- package.json package-lock.json
Get-Content -LiteralPath 'eslint.config.js'
```

Expected:

- `package.json` only adds lint-related devDependencies unless this batch explicitly expands scope.
- `package-lock.json` only follows the dependency graph.
- `eslint.config.js` contains no machine path and no secret.

- [ ] **Step 3: Verify tooling**

Run:

```powershell
npm run lint
npm run type-check
```

Expected:

- `npm run lint` can execute.
- Existing warnings are recorded but do not block this batch unless configured as errors.
- `npm run type-check` remains green or any pre-existing failure is documented before commit.

- [ ] **Step 4: Commit tooling baseline**

Run:

```powershell
git add package.json package-lock.json eslint.config.js
git commit -m "chore(tooling): restore lint baseline in clean worktree"
```

### Task M2: Migrate Low-Risk Committed Batches

**Purpose:** 把 `xinghuan-milestone-b` 中已经形成 commit 且风险较低的成果迁移过来，先拿收益明确、冲突小的部分。

**Candidate commits:**

- `f21c171 perf(web): shrink lucide icon imports in canvas nodes`
- `2c7c0df refactor: move shared provider helpers into packages/shared`
- `652315c refactor: share audio provider adapter across api and worker`

- [ ] **Step 1: Inspect each commit**

Run:

```powershell
git show --stat f21c171
git show --stat 2c7c0df
git show --stat 652315c
```

Expected:

- Icon shrink touches only icon import/mapping behavior.
- Shared provider refactors do not overwrite newer ComfyUI code.
- Any conflict with `xinghuan-integration-clean` stops this task and triggers a manual patch plan.

- [ ] **Step 2: Apply one commit at a time**

Run:

```powershell
git cherry-pick -n f21c171
npm run build -w @xinghuan/web
git add apps/web
git commit -m "perf(web): shrink lucide icon imports"
```

Then repeat for provider helper commits:

```powershell
git cherry-pick -n 2c7c0df
npm run type-check
git add packages/shared apps/api apps/worker
git commit -m "refactor(shared): move provider helpers into shared package"

git cherry-pick -n 652315c
npm run type-check
git add packages/shared apps/api apps/worker
git commit -m "refactor(shared): share audio provider adapter"
```

- [ ] **Step 3: Update daily log**

Modify:

```text
docs/logbooks/daily/2026/2026-07/2026-07-05.md
docs/logbooks/daily/2026/2026-07/recent-highlights.md
```

Record:

- migrated commit id
- files touched
- verification commands
- remaining risk

### Task M3: Rebuild E1 Repository Work As Fresh Clean Batches

**Purpose:** `xinghuan-milestone-b` 中未提交的 E1 仓储层改造很大，不能整体搬。必须按领域重新做成 clean branch 上的新批次。

**Batch order:**

1. Auth repository
2. Provider repository
3. Settings repository
4. Admin repository
5. Task repository and no-heavy-fields task list
6. Usage summary repository/service
7. Environment sync local boundary

- [ ] **Step 1: For each repository, inspect source first**

Run pattern:

```powershell
git diff --no-index -- D:\codex\无限画布2.0-worktrees\xinghuan-integration-clean\apps\api\src\auth-repository.ts D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b\apps\api\src\auth-repository.ts
```

Expected:

- Understand source behavior before copying.
- If target file does not exist, review full proposed addition.

- [ ] **Step 2: Add tests before implementation**

Run pattern:

```powershell
npx vitest run apps/api/src/auth-repository.test.ts
```

Expected:

- Test fails before implementation when the repository does not exist.
- Test passes after implementation.

- [ ] **Step 3: Verify each repository batch**

Run minimum checks:

```powershell
npm run type-check -w @xinghuan/api
npx vitest run apps/api/src/<repository-name>.test.ts
node scripts/verify-<domain>-repository-*.mjs
```

Expected:

- All relevant checks pass.
- `server.ts` only receives minimal dependency injection/adapter changes.

- [ ] **Step 4: Commit each repository independently**

Commit message pattern:

```powershell
git commit -m "refactor(api): introduce <domain> repository boundary"
```

Examples:

```powershell
git commit -m "refactor(api): introduce auth repository boundary"
git commit -m "refactor(api): introduce provider repository boundary"
git commit -m "refactor(api): introduce task repository boundary"
```

---

## Phase C - ComfyUI Freeze And Seal

### Task C1: Seal Current ComfyUI State

**Purpose:** 暂停 ComfyUI 功能相关开发，把当前灰度状态、已知问题、接口边界和恢复条件封存成可追溯记录，避免后续结构迁移时继续扩大 ComfyUI 改造面。

**Files to use as truth:**

- `docs/logbooks/releases/gray/2026-07-04-comfyui-machine-first-gray.md`
- `docs/records/architecture/*comfyui*`
- `apps/web/src/components/nodes/*Comfy*`
- `apps/admin/src/*comfy*`
- `apps/api/src/*comfy*`
- `apps/comfyui-connector/*`
- `docs/superpowers/plans/2026-07-02-comfyui-tailnet-instance-pool.md`

- [ ] **Step 1: Confirm current sealed state**

Run:

```powershell
git log --oneline --grep comfyui -12
Get-Content -LiteralPath 'docs\logbooks\releases\gray\2026-07-04-comfyui-machine-first-gray.md'
git status --short
```

Expected:

- Current gray version is `v0.5.25`.
- Production version remains `v0.5.22` unless a separate formal promotion happens.
- Worktree status contains no unexpected ComfyUI source edits for this freeze task.

- [ ] **Step 2: Create or update freeze record**

Create or modify:

```text
docs/records/architecture/2026-07-05-comfyui-feature-freeze.md
```

Required content:

```markdown
# ComfyUI Feature Freeze - 2026-07-05

## Decision

ComfyUI feature development is paused.

## Frozen Scope

- Canvas ComfyUI node visual redesign
- Workflow parameter exposure editor
- Machine/workflow shared area expansion
- Tailscale direct connection and reverse tunnel execution design
- Connector pool scheduling and multi-machine runtime management

## Allowed Changes During Freeze

- Crash fixes
- Permission/security fixes
- Gray rollback or version alignment fixes
- Documentation updates that record current state

## Resume Gate

ComfyUI work can resume only after:

- Clean worktree migration is complete.
- Structural/tooling baseline is committed.
- Current unfinished structural batches are either complete or explicitly deferred.
- A new ComfyUI continuation plan is approved.
```

Expected:

- The freeze record explains what is paused and what emergency changes remain allowed.
- The record contains no secrets and no local token values.

- [ ] **Step 3: Verify no ComfyUI feature files are staged**

Run:

```powershell
git diff --name-only -- apps/web apps/admin apps/api apps/comfyui-connector | Select-String -Pattern 'comfy|Comfy'
git diff --cached --name-only | Select-String -Pattern 'comfy|Comfy'
```

Expected:

- No ComfyUI source file appears unless the only change is an approved freeze/rollback fix.

- [ ] **Step 4: Commit freeze docs only**

Run:

```powershell
git add docs/records/architecture/2026-07-05-comfyui-feature-freeze.md docs/superpowers/plans/2026-07-05-clean-worktree-migration-maintenance-master-plan.md
git commit -m "docs: freeze comfyui feature development"
```

Expected:

```text
[xinghuan-integration-clean ...] docs: freeze comfyui feature development
```

### Task C2: Emergency-Only ComfyUI Guardrail

**Purpose:** 冻结期间如果必须修 ComfyUI，只允许止血型改动，且必须独立成批、独立校验、独立记录。

- [ ] **Step 1: Classify the requested change before editing**

Allowed categories:

- crash fix
- permission/security fix
- gray runtime rollback/version alignment fix
- connector heartbeat/runtime availability fix

Blocked categories:

- broad node UI redesign
- new tunnel architecture
- new workflow marketplace behavior
- preview/metadata editor expansion
- workflow parameter editor expansion
- multi-machine scheduling enhancement

- [ ] **Step 2: Run minimal ComfyUI emergency validation**

Run:

```powershell
npm run type-check
npm run build -w @xinghuan/web
npm run build -w @xinghuan/admin
```

Expected:

- Builds pass.
- If the fix touches API or connector runtime, also run the matching existing `verify:comfyui*` or connector harness command listed in the release/freeze record.

- [ ] **Step 3: Record the emergency exception**

Modify:

```text
docs/logbooks/daily/2026/2026-07/2026-07-05.md
docs/records/architecture/2026-07-05-comfyui-feature-freeze.md
```

Record:

- why the exception was allowed
- files changed
- validation commands
- release impact
- rollback path

---

## Phase U - Unfinished Structural Plan Completion

This phase carries forward the unfinished parts of `docs/records/architecture/2026-07-04-structural-improvement-execution-plan.md`.

The old plan currently lists these batches as not complete:

- A1 ESLint
- A2 Prettier
- A3 Vitest
- A4 CI aggregation
- B1 auth precise queries
- B2 task list pagination and heavy-field stripping
- B3 Postgres pool tuning
- C1 byte-identical api/worker deduplication
- C2 diverged adapter deduplication
- D1 lucide icon shrink
- E1 repository boundary skeleton
- F1 task status SSE or shared polling

### Task U1: Complete Phase 0 Tooling Safety Net

**Purpose:** 先把工具链补齐，让后续迁移和结构改造都有可重复校验入口。

Status:

- Completed in commit `53f8ee8`.
- `npm run lint`, `npm run test`, `npm run type-check`, and `npm run ci` passed for the committed baseline.
- Root format scripts were intentionally removed instead of introducing a repo-wide Prettier failure baseline.

**Files:**

- `package.json`
- `package-lock.json`
- `eslint.config.js`
- `.prettierrc` if Prettier is kept
- `vitest.config.ts`
- `.githooks/pre-push`

- [x] **Step 1: Finish A1 ESLint**

Run:

```powershell
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); JSON.parse(require('fs').readFileSync('package-lock.json','utf8')); console.log('json ok')"
npm run lint
```

Expected:

- JSON parses successfully.
- `npm run lint` exists and executes.
- Existing warnings are recorded, not silently ignored.

- [x] **Step 2: Finish A2 Prettier decision**

Run:

```powershell
npm run | Select-String -Pattern 'format|prettier'
```

Expected:

- Either Prettier dependency and config exist and `npm run format:check` works.
- Or misleading format scripts are removed and the decision is recorded in daily log.

- [x] **Step 3: Finish A3 Vitest baseline**

Run:

```powershell
npm run test
```

Expected:

- Test script exists.
- At least one stable baseline test runs.
- The test location convention is recorded in daily log.

- [x] **Step 4: Finish A4 CI aggregation**

Run:

```powershell
npm run ci
```

Expected:

- `ci` runs type-check, build or targeted build, core verify scripts, and tests.
- Any deliberately excluded slow/live checks are named in the script or daily log.

- [x] **Step 5: Commit tooling safety net**

Run:

```powershell
git add package.json package-lock.json eslint.config.js vitest.config.ts .prettierrc .githooks docs/logbooks/daily/2026/2026-07/2026-07-05.md
git commit -m "chore(tooling): complete structural safety net"
```

### Task U2: Complete Phase 6 Backend Read-Path Work

**Purpose:** 完成旧计划 B1/B2/B3，降低鉴权和任务列表读取热路径负载。

**Files:**

- `apps/api/src/server.ts`
- `apps/api/src/auth-repository.ts`
- `apps/api/src/task-repository.ts`
- `apps/api/src/admin-task-list-routes.ts`
- related tests under `apps/api/src/*.test.ts`
- related scripts under `scripts/verify-*.mjs`

- [x] **Step 1: Complete B1 auth current-user precise queries**

Status:

- Completed in commit `9e27bc7`.
- Current-user lookup is now delegated to `createAuthCurrentUserRepository`.
- Postgres current-user path uses targeted session and user queries instead of full auth-db reads.
- Login email lookup remains intentionally deferred to the broader E1 auth repository boundary.

Validation already recorded:

```powershell
npx vitest run apps/api/src/auth-repository.test.ts
npm run type-check -w @xinghuan/api
npm run verify:auth-current-user-repository-contract
npm run verify:auth-login-precision-query-contract
npm run verify:file-hotspot-budgets
npm run ci
```

- [ ] **Step 2: Complete or defer B1 login email lookup extraction**

Decision needed before marking B1 fully closed:

- Preferred path: include login email lookup in the later E1 auth repository expansion.
- Acceptable deferral: write a dated note in this plan and daily log explaining that current-user hot path is fixed and login path is tracked by `verify:auth-login-precision-query-contract`.

Run if implementing now:

```powershell
npm run type-check -w @xinghuan/api
npx vitest run apps/api/src/auth-repository.test.ts
npm run verify:auth-login-precision-query-contract
```

Expected:

- Login lookup does not reintroduce full-table auth reads on ordinary login.
- Existing login behavior remains unchanged.

- [x] **Step 3: Complete B2 task list pagination and heavy-field stripping**

Status:

- Local implementation completed in this batch.
- `GET /api/admin/tasks` now returns list summaries without `payload`, `result`, or `logs`.
- Postgres list SQL no longer selects `t.payload`, `t.result`, or `t.logs`.
- `scripts/verify-admin-task-pagination.mjs` now asserts no heavy fields and validates capability filtering without relying on hidden fields.
- Gray/live validation completed in release `20260705-admin-task-list-heavy-fields-gray-r1-v0525`.

Run before implementation:

```powershell
npm run type-check -w @xinghuan/api
npx vitest run apps/api/src/task-repository.test.ts apps/api/src/admin-task-list-routes.test.ts
node scripts/verify-admin-task-pagination.mjs
```

Expected:

- Existing failures identify whether route code, repository code, or verify-script expectations are stale.

Run after implementation:

```powershell
npm run type-check -w @xinghuan/api
npx vitest run apps/api/src/task-repository.test.ts apps/api/src/admin-task-list-routes.test.ts
node scripts/verify-admin-task-pagination.mjs
npm run verify:file-hotspot-budgets
```

Expected:

- Admin task list rows do not include `payload`, `result`, or `logs`.
- Detail endpoints may still return heavy fields where intentionally required.
- Pagination metadata is present and stable.
- `server.ts` stays within hotspot budget, or the budget change is reviewed before commit.

Gray/live verification already completed:

```powershell
npm run release:gray:prepare -- --release=20260705-admin-task-list-heavy-fields-gray-r1-v0525 --verify="npx vitest run apps/api/src/admin-task-list-routes.test.ts"
npm run release:gray:deploy -- --release=20260705-admin-task-list-heavy-fields-gray-r1-v0525 --archive=dist-release/20260705-admin-task-list-heavy-fields-gray-r1-v0525.tar.gz --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem
npm run release:gray:verify -- --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem --expected-version=0.5.25 --expected-environment=gray
ssh -i D:\codex\服务器\Tencent_Cloud_Server.pem -p 728 ubuntu@101.33.75.38 "set -a; . /opt/apps/xinghuan-canvas-next/shared/canvas-next.env; set +a; cd /opt/apps/xinghuan-canvas-next/current; XINGHUAN_VERIFY_BASE_URL=http://127.0.0.1:18200 node scripts/verify-admin-task-pagination.mjs"
```

Observed result:

- Gray release `20260705-admin-task-list-heavy-fields-gray-r1-v0525` passed.
- Live admin task pagination verification passed.
- Task list rows did not leak `payload`, `result`, or `logs`.

- [x] **Step 4: Complete or defer B3 Postgres pool tuning**

Status:

- Implemented a shared `resolvePostgresPoolConfig` helper in `packages/shared`.
- API pool keeps safe gray defaults: `max=5`, `connectionTimeoutMillis=3000`.
- Worker pools keep safe gray defaults: `max=3`, `connectionTimeoutMillis=3000`.
- Shared overrides:
  - `XINGHUAN_POSTGRES_POOL_MAX`
  - `XINGHUAN_POSTGRES_POOL_CONNECTION_TIMEOUT_MS`
- API-specific overrides:
  - `XINGHUAN_API_POSTGRES_POOL_MAX`
  - `XINGHUAN_API_POSTGRES_POOL_CONNECTION_TIMEOUT_MS`
- Worker-specific overrides:
  - `XINGHUAN_WORKER_POSTGRES_POOL_MAX`
  - `XINGHUAN_WORKER_POSTGRES_POOL_CONNECTION_TIMEOUT_MS`
- Service-specific overrides take precedence over shared overrides.
- Invalid values fall back to defaults; unsafe max values are clamped to `1..50`.

Run:

```powershell
Select-String -Path 'apps\api\src\*.ts' -Pattern 'PG_POOL|POSTGRES_POOL|max:'
npm run type-check -w @xinghuan/api
npm run type-check -w @xinghuan/worker
npx vitest run packages/shared/src/postgres-pool-config.test.ts
```

Expected:

- Pool size and timeout are configurable by environment.
- Defaults are documented and safe for gray.

If deferred:

- Create `docs/records/architecture/2026-07-05-postgres-pool-tuning-deferral.md`.
- Record current default behavior, why it is safe enough for the next gray validation, and what metric should trigger tuning.

- [ ] **Step 5: Commit backend read-path batch**

Run:

```powershell
git add apps/api/src scripts docs/logbooks/daily/2026/2026-07/2026-07-05.md
git commit -m "perf(api): complete task list read-path improvements"
```

### Task U3: Complete Phase 1 Api/Worker Deduplication

**Purpose:** 完成旧计划 C1/C2，降低 api 与 worker provider 行为漂移风险。

Status:

- Completed in commit `7966bd1`.
- Node-only shared helpers are exported through controlled `@xinghuan/shared/node/*` subpaths.
- Browser-facing shared root export remains free of Node built-ins.

**Files:**

- `packages/shared/src/provider-request-body.ts`
- `packages/shared/src/grsai-reference-images.ts`
- `packages/shared/src/audio-provider-adapter.ts`
- `packages/shared/src/index.ts`
- `apps/api/src/*provider*.ts`
- `apps/worker/src/*provider*.ts`
- related tests and verify scripts

- [x] **Step 1: Complete C1 byte-identical deduplication**

Run:

```powershell
npm run type-check
npx vitest run packages/shared/src/provider-request-body.test.ts packages/shared/src/grsai-reference-images.test.ts
```

Expected:

- Shared modules are imported by both api and worker.
- Byte-identical duplicate source files no longer exist in both apps.

- [x] **Step 2: Complete C2 diverged adapter deduplication**

Run:

```powershell
npm run type-check
npx vitest run packages/shared/src/audio-provider-adapter.test.ts
```

Expected:

- Common adapter logic lives in shared package.
- App-specific differences are explicit parameters or thin wrappers.

- [x] **Step 3: Commit deduplication batch**

Run:

```powershell
git add packages/shared apps/api apps/worker docs/logbooks/daily/2026/2026-07/2026-07-05.md
git commit -m "refactor(shared): complete api worker provider deduplication"
```

### Task U4: Complete Phase 6 Frontend Icon Shrink

**Purpose:** 完成旧计划 D1，修复 lucide namespace import 导致的图标包过大问题。

Status:

- Completed in commit `619fcdd`.
- `vendor-icons` decreased from about `588.54 kB` to about `58.80 kB`.

**Files:**

- `apps/web/src/components/Canvas.tsx`
- `apps/web/src/components/Sidebar.tsx`
- `apps/web/src/components/nodes/PlaceholderNode.tsx`

- [x] **Step 1: Verify no namespace icon imports remain**

Run:

```powershell
Select-String -Path 'apps\web\src\components\Canvas.tsx','apps\web\src\components\Sidebar.tsx','apps\web\src\components\nodes\PlaceholderNode.tsx' -Pattern 'import \* as .*lucide-react'
```

Expected:

- No matches.

- [x] **Step 2: Build web**

Run:

```powershell
npm run build -w @xinghuan/web
```

Expected:

- Web build passes.
- Build output or validation record notes icon chunk size if available.

- [x] **Step 3: Commit frontend icon batch**

Run:

```powershell
git add apps/web/src/components/Canvas.tsx apps/web/src/components/Sidebar.tsx apps/web/src/components/nodes/PlaceholderNode.tsx docs/logbooks/daily/2026/2026-07/2026-07-05.md
git commit -m "perf(web): complete icon import shrink"
```

### Task U5: Complete Phase 3 Repository Boundary Skeleton

**Purpose:** 完成旧计划 E1，将 E1 仓储边界从错误 worktree 迁移成 clean branch 上的可验证分批成果。

**Files:**

- `apps/api/src/auth-repository.ts`
- `apps/api/src/provider-repository.ts`
- `apps/api/src/settings-repository.ts`
- `apps/api/src/admin-repository.ts`
- `apps/api/src/task-repository.ts`
- `apps/api/src/admin-usage-summary-repository.ts`
- `apps/api/src/admin-usage-summary-service.ts`
- `apps/api/src/environment-sync-local.ts`
- matching `*.test.ts`
- matching `scripts/verify-*-repository-*.mjs`

- [x] **Step 1: Land the first auth current-user repository slice**

Status:

- Completed in commit `9e27bc7`.
- This is a narrow E1 slice, not the full E1 repository boundary.
- It covers current-user lookup only; broader auth login/admin auth repository work remains open.

- [ ] **Step 2: Migrate the remaining repositories one domain at a time**

Run pattern per domain:

```powershell
npm run type-check -w @xinghuan/api
npx vitest run apps/api/src/<domain>-repository.test.ts
node scripts/verify-<domain>-repository-*.mjs
```

Expected:

- Each domain has its own commit.
- `server.ts` changes remain adapter-level, not a broad rewrite.
- If a domain is deferred, create a dated decision record instead of leaving the plan ambiguous.

- [ ] **Step 3: Verify repository boundary after all selected domains**

Run:

```powershell
npm run type-check -w @xinghuan/api
npx vitest run apps/api/src/auth-repository.test.ts apps/api/src/provider-repository.test.ts apps/api/src/settings-repository.test.ts apps/api/src/admin-repository.test.ts apps/api/src/task-repository.test.ts
```

Expected:

- Repository tests pass.
- No interrupted or half-written test file is copied from `xinghuan-milestone-b`.
- Each repository either has implementation evidence in `xinghuan-integration-clean` or an explicit deferral record.

- [ ] **Step 4: Commit repository boundary summary docs**

Run:

```powershell
git add docs/records/architecture/2026-07-04-structural-improvement-execution-plan.md docs/logbooks/daily/2026/2026-07/2026-07-05.md
git commit -m "docs: record repository boundary migration progress"
```

Remaining E1 checklist:

- Auth login lookup extraction: open, should extend the existing auth repository rather than add another ad-hoc helper.
- Provider repository boundary: open.
- Settings repository boundary: open.
- Admin repository boundary: open.
- Task repository boundary: partly coupled with B2, open until list/detail split is verified.
- Usage summary repository/service: open.
- Environment sync local boundary: open unless separately deferred.

### Task U6: Defer Or Design Phase 6 Task Realtime Mechanism

**Purpose:** 旧计划 F1 改动面大，不在迁移期间直接做；先明确是延期、SSE、还是共享轮询。

**Entry conditions:**

- `git status --short` clean
- Phase S committed
- Phase M1 committed
- selected M2/M3 batches committed or explicitly deferred
- daily log updated

- [x] **Step 1: Write a separate F1 decision record**

Create:

```text
docs/records/architecture/2026-07-05-task-realtime-mechanism-decision.md
```

Required content:

- current per-node polling behavior
- expected request reduction target
- option A: task SSE
- option B: shared frontend polling
- chosen next step or explicit deferral reason

- [x] **Step 2: Verify no runtime mechanism change is mixed into migration**

Run:

```powershell
git diff --name-only | Select-String -Pattern 'SSE|poll|Polling|task-status|TaskStatus'
```

Expected:

- No task realtime source change appears in migration commits unless F1 has a separate approved plan.

- [x] **Step 3: Commit F1 decision only**

Run:

```powershell
git add docs/records/architecture/2026-07-05-task-realtime-mechanism-decision.md docs/logbooks/daily/2026/2026-07/2026-07-05.md
git commit -m "docs: decide task realtime mechanism follow-up"
```

---

## Phase V - Migration Completeness Validation

### Task V1: Verify No Required成果 Is Still Only In The Old Worktree

**Purpose:** 在灰度前确认本轮要保留的改造成果没有只停留在 `xinghuan-milestone-b`，也没有因为 ComfyUI freeze 被误删或误混。

**Scope:** This is a read-only audit unless it discovers a missing required batch.

- [x] **Step 1: Confirm branch and cleanliness**

Run:

```powershell
git branch --show-current
git status --short
git log --oneline -10
```

Expected:

```text
xinghuan-integration-clean
```

`git status --short` must be empty before release. If docs were updated by this audit, commit them first.

- [x] **Step 2: Confirm completed clean-branch commits exist**

Run:

```powershell
git log --oneline --grep "structural safety net" -1
git log --oneline --grep "icon import shrink" -1
git log --oneline --grep "provider deduplication" -1
git log --oneline --grep "auth current user" -1
```

Expected:

- Tooling, icon shrink, provider deduplication, and auth current-user batches all appear in `xinghuan-integration-clean`.

- [x] **Step 3: Compare remaining planned files against the frozen source worktree**

Run:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b status --short
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b diff --name-only
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b ls-files --others --exclude-standard
```

Expected:

- Any useful non-ComfyUI file found only in `xinghuan-milestone-b` is classified as one of:
  - migrated
  - intentionally deferred with decision record
  - discarded as local scratch/temp
  - blocked pending a new plan

Do not copy files during this step.

- [x] **Step 4: Run structural validation set**

Run:

```powershell
npm run type-check
npm run ci
npm run verify:file-hotspot-budgets
npm run codegraph:sync
```

Expected:

- All commands pass before gray release.
- If a command fails, write a validation record and fix or explicitly defer release.

- [x] **Step 5: Update status documents**

Modify only facts that changed:

```text
docs/memory/current-state.md
docs/memory/deployment-state.md
docs/records/architecture/2026-07-04-structural-improvement-execution-plan.md
docs/logbooks/daily/2026/2026-07/2026-07-05.md
docs/logbooks/daily/2026/2026-07/recent-highlights.md
```

Required result:

- Other Codex windows should read `xinghuan-integration-clean`, gray `v0.5.25`, production `v0.5.22`, ComfyUI frozen, and remaining structural batches accurately.

- [ ] **Step 6: Commit validation docs**

Run:

```powershell
git add docs/memory/current-state.md docs/memory/deployment-state.md docs/records/architecture/2026-07-04-structural-improvement-execution-plan.md docs/logbooks/daily/2026/2026-07/2026-07-05.md docs/logbooks/daily/2026/2026-07/recent-highlights.md docs/superpowers/plans/2026-07-05-clean-worktree-migration-maintenance-master-plan.md
git commit -m "docs: update clean migration status and validation gates"
```

---

## Phase R - Release And Maintenance Chain

### Task R1: Fixed Gray Release Procedure

**Purpose:** 避免再次出现把正式版推到灰度、版本号回退、灰度/正式来源混乱的问题。

Entry gate:

- ComfyUI remains frozen.
- Phase V has passed or produced explicit deferral records.
- B2/B3/E1/F1 are either completed or intentionally deferred with dated records.
- Worktree is clean and the release source is `xinghuan-integration-clean`.

- [ ] **Step 1: Confirm source branch and version**

Run:

```powershell
git branch --show-current
node -p "require('./package.json').version"
git log --oneline -5
```

Expected:

```text
xinghuan-integration-clean
```

The version must match the intended gray release version.

- [ ] **Step 2: Confirm clean worktree**

Run:

```powershell
git status --short
```

Expected:

```text
```

- [ ] **Step 3: Deploy gray from clean branch only**

Use existing gray deploy script/runbook. Before deploying, record:

- commit id
- version
- release id
- target domain `canvas-next.hhh2121.xyz`
- target port `127.0.0.1:18200`

- [ ] **Step 4: Verify gray**

Run targeted checks:

```powershell
node scripts/verify-admin-task-pagination.mjs
node scripts/verify-environment-sync-smoke.mjs
npm run type-check
```

Expected:

- Gray API responds from the new release.
- No task list heavy fields in list response after that batch is actually implemented.
- Any failure must be documented in release log with root cause and fix.

### Task R2: Fixed Production Promotion Procedure

**Purpose:** 正式版只能从已验证的灰度 commit 推进，不能从本地随机 HEAD 或旧 release 推进。

- [ ] **Step 1: Confirm gray commit to promote**

Run:

```powershell
git rev-parse HEAD
```

Compare with gray release record.

- [ ] **Step 2: Confirm production current version**

Read:

```text
docs/memory/deployment-state.md
docs/logbooks/releases/current-release-index.md
```

Expected:

- Production current version is explicitly recorded.
- Promotion target version is newer or intentionally equal with a hotfix reason.

- [ ] **Step 3: Promote production**

Record:

- source gray release id
- target production release id
- production domain `canvas.hhh2121.xyz`
- production port `127.0.0.1:18100`
- rollback target

- [ ] **Step 4: Write release record**

Create or update:

```text
docs/logbooks/releases/production/YYYY-MM-DD-<release-name>.md
docs/logbooks/releases/current-release-index.md
docs/memory/deployment-state.md
```

---

## Phase A - Audit And Progress Accounting

### Task A1: Update Progress Ledger After Every Batch

**Purpose:** 防止别的窗口读取旧文档时显示 `v0.5.1`、Phase 3 未完成等严重不符状态。

**Files:**

- `docs/memory/current-state.md`
- `docs/memory/deployment-state.md`
- `docs/memory/recent-release-index.md`
- `docs/logbooks/daily/2026/2026-07/recent-highlights.md`
- `docs/logbooks/releases/current-release-index.md`
- relevant `docs/records/architecture/*.md`

- [ ] **Step 1: Update only facts that changed**

For each completed batch, record:

- date
- branch
- commit id
- verification commands
- release status
- remaining risk

- [ ] **Step 2: Do not rewrite historical records**

Historical June logs and old release records stay as archive.

- [ ] **Step 3: Sync codegraph**

Run:

```powershell
npm run codegraph:sync
```

Expected:

- CodeGraph updates successfully, or the failure is recorded with command output summary.

---

## Execution Order

1. Keep ComfyUI frozen. Do not resume ComfyUI feature work in this plan.
2. Confirm Phase S, Phase C, Phase U1, Phase U3, Phase U4, and B1 current-user slice remain committed in `xinghuan-integration-clean`.
3. Treat B2 task list pagination/heavy-field stripping as completed and gray-verified; do not reopen it unless a regression is reproduced.
4. Execute or explicitly defer B3 Postgres pool tuning.
5. Continue E1 repository boundaries one domain at a time, starting with the lowest-risk remaining domain and keeping `server.ts` within hotspot budget.
6. Write the F1 task realtime decision or deferral record before attempting realtime implementation.
7. Run Phase V migration-completeness validation before the next release wave.
8. Use Phase R for gray/production deployment only after Phase V passes or produces explicit deferral records.
9. Use Phase A after every commit or release so other windows read the right state.

## Current Progress Snapshot

As of 2026-07-05 after B2 gray rollout:

- Secret ignore coverage in clean worktree: present.
- Secret ignore coverage in server root `.gitignore`: explicit entries added by this plan batch.
- Correct active worktree: `xinghuan-integration-clean`.
- Mistaken worktree: `xinghuan-milestone-b`, frozen as patch source.
- Current gray version recorded in active docs: `v0.5.25`.
- Current production version recorded in active docs: `v0.5.22`.
- Migration status: audit complete; clean worktree execution is in progress through small committed batches.
- ComfyUI status: feature development paused and freeze record committed; only emergency fixes or evidence-preserving documentation are allowed.
- Completed or committed batches:
  - Phase S secret ignore and migration plan baseline.
  - Phase C ComfyUI feature freeze record.
  - Phase U1/M1 tooling safety net.
  - Phase U4/D1 frontend icon import shrink.
  - Phase U3/C1-C2 API/Worker provider deduplication.
  - Phase U2/B1 auth current-user precise query.
  - Phase U2/B2 admin task list pagination and heavy-field stripping, including gray/live verification.
- Unfinished structural plan items still to carry forward:
  - B1 login email lookup extraction remains deferred to the broader E1 auth repository batch.
  - B3 Postgres pool tuning.
  - E1 repository boundary skeleton.
  - F1 task realtime mechanism decision or deferral.
- Required before the next gray release wave: run Phase V migration-completeness validation and ensure every unfinished batch is either completed or explicitly deferred.
- Main blocker before further feature work: complete or explicitly defer the remaining backend/repository/realtime structural batches. ComfyUI feature work remains blocked until a separate continuation plan is approved after this structural line is clean.

## Self-Review

Spec coverage:

- Key ignore request is covered in Phase S.
- Existing成果 migration is covered in Phase M.
- ComfyUI pause and seal request is covered in Phase C.
- Previously unfinished structural plan work is covered in Phase U.
- Maintenance and release continuation are covered in Phase R and Phase A.
- Worktree confusion is prevented by source-of-truth and hard rules.

Placeholder scan:

- The plan contains no unresolved placeholder instructions.

Type consistency:

- All paths use the current clean worktree unless explicitly marked as read-only source.
- Release environments use the existing project naming: gray `canvas-next.hhh2121.xyz`, production `canvas.hhh2121.xyz`.
