# Worktree Migration Audit - 2026-07-05

## Purpose

This audit records the worktree mismatch discovered on 2026-07-05 and defines a safe migration strategy.

No code migration was performed as part of this audit.

## Worktrees

Intended active worktree:

- Path: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean`
- Branch: `xinghuan-integration-clean`
- HEAD at audit time: `df8671e296ab08d94b3fd85677c24e4a1af68264`

Mistaken worktree used for later structural work:

- Path: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b`
- Branch: `xinghuan-milestone-b`
- HEAD at audit time: `d5b75c005fb0a7620ef4b90bd39f81ac40374df4`

Common merge base:

- `1972cc29e511b2d7367c03aad3faa50f3150a8af`

## Key Finding

The later structural-improvement work was mostly performed in `xinghuan-milestone-b`, not in the intended `xinghuan-integration-clean` worktree.

The two branches are not simple alternatives of the same line:

- `xinghuan-integration-clean` contains the ComfyUI integration series, version alignment, gray release records, and current-entry alignment.
- `xinghuan-milestone-b` contains a separate structural/tooling line plus a very large uncommitted repository refactor set.

Therefore, the correct recovery path is not a blind merge. Migration must be done by selective patch/cherry-pick batches.

## Branch Divergence

`xinghuan-integration-clean` commits after merge base include:

- ComfyUI instance workflow registry.
- ComfyUI admin instance workspace.
- ComfyUI shared apps wired into canvas.
- ComfyUI tailnet connector workspace integration.
- ComfyUI execution and project harness.
- ComfyUI admin dashboard redesign and deployment records.
- ComfyUI workflow parser/runtime schema/governance editor/canvas consumption.
- Version records through `v0.5.23`, `0.5.24`, `v0.5.25` gray release entries.
- `docs(records): 新增结构改进与性能优化路线图及执行计划`.
- `docs: 统一当前 worktree 入口指向为 xinghuan-integration-clean`.

`xinghuan-milestone-b` commits after merge base include:

- `docs(records): 新增结构改进与性能优化路线图及执行计划`
- `docs(logbooks): 补充 2026-07-04 收口进展`
- `refactor: move shared provider helpers into packages/shared`
- `refactor: share audio provider adapter across api and worker`
- `docs: record apimart follow-up boundary`
- `perf(web): shrink lucide icon imports in canvas nodes`
- `chore(tooling): make prettier config explicit without repo-wide format scripts`
- `chore(tooling): make lint and formatting tooling workable`
- `test: add vitest baseline for shared queue settings`
- `chore(tooling): add ci aggregation and pre-push governance`

## Current Dirty State

### `xinghuan-milestone-b`

Tracked modified/deleted files at audit time:

- 64 tracked paths changed.
- Includes API/admin/web/worker/package/shared/scripts/docs/ops changes.
- Diff stat: 2594 insertions, 3937 deletions.
- Several legacy duplicate files are deleted from api/worker and shared replacements exist.

Untracked files include:

- New repository layer files: `admin-repository.ts`, `auth-repository.ts`, `provider-repository.ts`, `settings-repository.ts`, `task-repository.ts`, `admin-usage-summary-repository.ts`, `admin-usage-summary-service.ts`, `environment-sync-local.ts`, `server-shared.ts`.
- Many new tests for these repository/route/service boundaries.
- Many new contract scripts.
- Governance/logbook/superpowers/spec/plan documents.
- `.claude/` files, `.eslint-report.json`, temporary envsync logs.
- A partially added `apps/api/src/admin-task-list-routes.test.ts` from the interrupted turn.

Notable live verification observation:

- `scripts/verify-admin-task-pagination.mjs` failed against `http://127.0.0.1:18200` because live task list responses still included `payload`, `result`, and `logs`.
- This suggests either the gray runtime is not running the current repository list-summary code or route/runtime still needs a defense-in-depth strip before sending list responses.

### `xinghuan-integration-clean`

Tracked modified files at audit time:

- `package.json`
- `package-lock.json`

Untracked files:

- `eslint.config.js`
- `Tencent_Cloud_Server.pem`
- `tencent_key_ascii.pem`

Risk:

- `Tencent_Cloud_Server.pem` and `tencent_key_ascii.pem` are sensitive key files. They must not be committed, copied into docs, or printed.
- The package changes add ESLint-related dev dependencies and a generated lockfile update. These likely correspond to Phase 0/A1, but must be reviewed and staged separately.

## Migration Classification

### Candidate To Migrate First

Low-risk committed batches from `xinghuan-milestone-b`:

- Tooling commits:
  - `4cd571b`
  - `00cc711`
  - `03a6b08`
  - `d5b75c0`
- Frontend icon shrink:
  - `f21c171`
- Shared provider helper refactors:
  - `2c7c0df`
  - `652315c`
- Related docs:
  - `66c9075`
  - `cf8cf51`

These should still be reviewed against the newer ComfyUI line before cherry-pick.

### Candidate To Migrate Only As Patch Batches

Large uncommitted E1 repository refactor work in `xinghuan-milestone-b`:

- Auth repository.
- Provider repository.
- Settings repository.
- Admin repository.
- Task repository.
- Usage summary repository/service.
- Environment sync local/repository boundary.
- Contract scripts and tests.

Reason:

- This work is broad and was developed against the older `xinghuan-milestone-b` tree.
- It touches `server.ts`, admin routes, environment sync, provider/model/task paths, and tests.
- It must be ported in small batches onto `xinghuan-integration-clean`, with fresh verification after each batch.

### Do Not Migrate Blindly

- `.claude/`
- `.eslint-report.json`
- `tmp-envsync-api.*.log`
- `findings.md`, `progress.md`, `task_plan.md` unless explicitly needed as local planning artifacts.
- Sensitive key files from `xinghuan-integration-clean`.
- Any live deployment doc update that references stale version/environment state without rechecking current server state.

## Recommended Recovery Plan

1. Freeze `xinghuan-milestone-b`.
   - Do not continue coding there.
   - Treat it as a source-of-truth archive for candidate patches only.

2. Protect `xinghuan-integration-clean`.
   - Add or confirm ignore rules for `*.pem` and local key artifacts before any commit.
   - Do not stage key files.

3. Cleanly commit or discard the current `xinghuan-integration-clean` package/tooling changes.
   - If keeping ESLint Phase 0, stage only `package.json`, `package-lock.json`, and `eslint.config.js` after reviewing config.
   - Run the intended tooling verification before commit.

4. Migrate committed milestone-b batches one by one.
   - Prefer `git cherry-pick -n <commit>` or patch application with review.
   - After each batch: type-check/build/relevant contract/test, then commit.

5. Migrate uncommitted E1 repository work as new clean batches.
   - Start with the least coupled repository layer.
   - Do not carry the entire dirty diff.
   - Avoid mixing ComfyUI changes with structural repository changes.

6. Re-run gray-facing checks only after the corresponding code is actually present in `xinghuan-integration-clean` and deployed.
   - Especially `verify-admin-task-pagination.mjs`, because the live gray response currently contradicts the intended no-heavy-fields invariant.

## Immediate Next Step

Before any migration:

- Review `eslint.config.js` in `xinghuan-integration-clean`.
- Confirm whether the current `package.json` / `package-lock.json` changes are intended Phase 0/A1.
- Add/verify ignore coverage for PEM key files.
- Then create the first clean commit on `xinghuan-integration-clean`, or explicitly discard the package/tooling changes if they are not desired.
