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

## 1. Hard Rules

- 不再在 `xinghuan-milestone-b` 继续开发。
- 不把 `xinghuan-milestone-b` 整体 merge 到 `xinghuan-integration-clean`。
- 不提交、不打印、不复制到文档任何真实密钥：`Tencent_Cloud_Server.pem`、`tencent_key_ascii.pem`、`*.pem`。
- 不把 `package.json`、`package-lock.json`、`eslint.config.js` 和迁移文档混在同一个 commit。
- 每批只解决一个主题：密钥忽略、工具链、共享模块、仓储边界、性能优化、发布链路不能混提交。
- 每批收口必须有四个证据：`git status --short`、相关测试/校验输出、daily log 或 release log、clean commit。
- 灰度和正式发布只能从 `xinghuan-integration-clean` 出发，发布前必须确认版本号和 release record。
- ComfyUI 功能开发从本计划开始暂停。允许的 ComfyUI 改动仅限崩溃修复、权限止血、灰度回滚记录、运行状态封存；不允许新增工作流能力、节点 UI、连接器架构或 Tailscale/隧道方案。

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

**Files:**

- `package.json`
- `package-lock.json`
- `eslint.config.js`
- `.prettierrc` if Prettier is kept
- `vitest.config.ts`
- `.githooks/pre-push`

- [ ] **Step 1: Finish A1 ESLint**

Run:

```powershell
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); JSON.parse(require('fs').readFileSync('package-lock.json','utf8')); console.log('json ok')"
npm run lint
```

Expected:

- JSON parses successfully.
- `npm run lint` exists and executes.
- Existing warnings are recorded, not silently ignored.

- [ ] **Step 2: Finish A2 Prettier decision**

Run:

```powershell
npm run | Select-String -Pattern 'format|prettier'
```

Expected:

- Either Prettier dependency and config exist and `npm run format:check` works.
- Or misleading format scripts are removed and the decision is recorded in daily log.

- [ ] **Step 3: Finish A3 Vitest baseline**

Run:

```powershell
npm run test
```

Expected:

- Test script exists.
- At least one stable baseline test runs.
- The test location convention is recorded in daily log.

- [ ] **Step 4: Finish A4 CI aggregation**

Run:

```powershell
npm run ci
```

Expected:

- `ci` runs type-check, build or targeted build, core verify scripts, and tests.
- Any deliberately excluded slow/live checks are named in the script or daily log.

- [ ] **Step 5: Commit tooling safety net**

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

- [ ] **Step 1: Complete B1 auth precise queries**

Run before implementation:

```powershell
npx vitest run apps/api/src/auth-repository.test.ts
```

Expected:

- Tests cover valid session, expired session, revoked session, disabled user.

Run after implementation:

```powershell
npm run type-check -w @xinghuan/api
npx vitest run apps/api/src/auth-repository.test.ts
node scripts/verify-auth-current-user-repository-contract.mjs
node scripts/verify-auth-login-precision-query-contract.mjs
```

Expected:

- `getCurrentUser` no longer requires full-table auth reads for ordinary session lookup.

- [ ] **Step 2: Complete B2 task list pagination and heavy-field stripping**

Run:

```powershell
npm run type-check -w @xinghuan/api
npx vitest run apps/api/src/task-repository.test.ts apps/api/src/admin-task-list-routes.test.ts
node scripts/verify-admin-task-pagination.mjs
```

Expected:

- Admin task list rows do not include `payload`, `result`, or `logs`.
- Detail endpoints may still return heavy fields where intentionally required.
- Pagination metadata is present and stable.

- [ ] **Step 3: Complete B3 Postgres pool tuning**

Run:

```powershell
Select-String -Path 'apps\api\src\*.ts' -Pattern 'PG_POOL|POSTGRES_POOL|max:'
npm run type-check -w @xinghuan/api
```

Expected:

- Pool size and timeout are configurable by environment.
- Defaults are documented and safe for gray.

- [ ] **Step 4: Commit backend read-path batch**

Run:

```powershell
git add apps/api/src scripts docs/logbooks/daily/2026/2026-07/2026-07-05.md
git commit -m "perf(api): complete backend read-path structural improvements"
```

### Task U3: Complete Phase 1 Api/Worker Deduplication

**Purpose:** 完成旧计划 C1/C2，降低 api 与 worker provider 行为漂移风险。

**Files:**

- `packages/shared/src/provider-request-body.ts`
- `packages/shared/src/grsai-reference-images.ts`
- `packages/shared/src/audio-provider-adapter.ts`
- `packages/shared/src/index.ts`
- `apps/api/src/*provider*.ts`
- `apps/worker/src/*provider*.ts`
- related tests and verify scripts

- [ ] **Step 1: Complete C1 byte-identical deduplication**

Run:

```powershell
npm run type-check
npx vitest run packages/shared/src/provider-request-body.test.ts packages/shared/src/grsai-reference-images.test.ts
```

Expected:

- Shared modules are imported by both api and worker.
- Byte-identical duplicate source files no longer exist in both apps.

- [ ] **Step 2: Complete C2 diverged adapter deduplication**

Run:

```powershell
npm run type-check
npx vitest run packages/shared/src/audio-provider-adapter.test.ts
```

Expected:

- Common adapter logic lives in shared package.
- App-specific differences are explicit parameters or thin wrappers.

- [ ] **Step 3: Commit deduplication batch**

Run:

```powershell
git add packages/shared apps/api apps/worker docs/logbooks/daily/2026/2026-07/2026-07-05.md
git commit -m "refactor(shared): complete api worker provider deduplication"
```

### Task U4: Complete Phase 6 Frontend Icon Shrink

**Purpose:** 完成旧计划 D1，修复 lucide namespace import 导致的图标包过大问题。

**Files:**

- `apps/web/src/components/Canvas.tsx`
- `apps/web/src/components/Sidebar.tsx`
- `apps/web/src/components/nodes/PlaceholderNode.tsx`

- [ ] **Step 1: Verify no namespace icon imports remain**

Run:

```powershell
Select-String -Path 'apps\web\src\components\Canvas.tsx','apps\web\src\components\Sidebar.tsx','apps\web\src\components\nodes\PlaceholderNode.tsx' -Pattern 'import \* as .*lucide-react'
```

Expected:

- No matches.

- [ ] **Step 2: Build web**

Run:

```powershell
npm run build -w @xinghuan/web
```

Expected:

- Web build passes.
- Build output or validation record notes icon chunk size if available.

- [ ] **Step 3: Commit frontend icon batch**

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

- [ ] **Step 1: Migrate repositories one domain at a time**

Run pattern per domain:

```powershell
npm run type-check -w @xinghuan/api
npx vitest run apps/api/src/<domain>-repository.test.ts
node scripts/verify-<domain>-repository-*.mjs
```

Expected:

- Each domain has its own commit.
- `server.ts` changes remain adapter-level, not a broad rewrite.

- [ ] **Step 2: Verify repository boundary after all selected domains**

Run:

```powershell
npm run type-check -w @xinghuan/api
npx vitest run apps/api/src/auth-repository.test.ts apps/api/src/provider-repository.test.ts apps/api/src/settings-repository.test.ts apps/api/src/admin-repository.test.ts apps/api/src/task-repository.test.ts
```

Expected:

- Repository tests pass.
- No interrupted or half-written test file is copied from `xinghuan-milestone-b`.

- [ ] **Step 3: Commit repository boundary summary docs**

Run:

```powershell
git add docs/records/architecture/2026-07-04-structural-improvement-execution-plan.md docs/logbooks/daily/2026/2026-07/2026-07-05.md
git commit -m "docs: record repository boundary migration progress"
```

### Task U6: Defer Or Design Phase 6 Task Realtime Mechanism

**Purpose:** 旧计划 F1 改动面大，不在迁移期间直接做；先明确是延期、SSE、还是共享轮询。

**Entry conditions:**

- `git status --short` clean
- Phase S committed
- Phase M1 committed
- selected M2/M3 batches committed or explicitly deferred
- daily log updated

- [ ] **Step 1: Write a separate F1 decision record**

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

- [ ] **Step 2: Verify no runtime mechanism change is mixed into migration**

Run:

```powershell
git diff --name-only | Select-String -Pattern 'SSE|poll|Polling|task-status|TaskStatus'
```

Expected:

- No task realtime source change appears in migration commits unless F1 has a separate approved plan.

- [ ] **Step 3: Commit F1 decision only**

Run:

```powershell
git add docs/records/architecture/2026-07-05-task-realtime-mechanism-decision.md docs/logbooks/daily/2026/2026-07/2026-07-05.md
git commit -m "docs: decide task realtime mechanism follow-up"
```

---

## Phase R - Release And Maintenance Chain

### Task R1: Fixed Gray Release Procedure

**Purpose:** 避免再次出现把正式版推到灰度、版本号回退、灰度/正式来源混乱的问题。

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

1. Finish Phase S and commit ignore/audit/plan docs.
2. Finish Phase C and commit the ComfyUI freeze record before new feature work continues.
3. Finish Phase M1 and commit tooling baseline.
4. Migrate M2 low-risk committed batches one at a time.
5. Rebuild M3 E1 repository work domain by domain.
6. Complete Phase U unfinished structural batches, or explicitly defer a batch with a decision record.
7. Use Phase R for every gray/production deployment.
8. Use Phase A after every commit or release so other windows read the right state.

## Current Progress Snapshot

As of 2026-07-05:

- Secret ignore coverage in clean worktree: present.
- Secret ignore coverage in server root `.gitignore`: explicit entries added by this plan batch.
- Correct active worktree: `xinghuan-integration-clean`.
- Mistaken worktree: `xinghuan-milestone-b`, frozen as patch source.
- Current gray version recorded in active docs: `v0.5.25`.
- Current production version recorded in active docs: `v0.5.22`.
- Migration status: audit complete, execution not yet complete.
- ComfyUI status: feature development paused; freeze record must be committed before any non-emergency ComfyUI source change.
- Unfinished structural plan items still to carry forward: A1-A4, B1-B3, C1-C2, D1, E1, F1.
- Main blocker before further feature work: commit Phase S, commit Phase C freeze record, then stabilize tooling Phase M1.

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
