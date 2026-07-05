# Milestone-B Archive Migration Inventory

Date: 2026-07-05

Source archive branch: `archive/xinghuan-milestone-b-wip-20260705`
Source archive tag: `archive/milestone-b-wip-20260705`
Source archive commit: `a60e689664b7c9eb36cfdb3d20edae406b7433f9`
Target branch: `xinghuan-integration-clean`

## Rules

- The archive branch is read-only evidence.
- Do not merge the archive branch.
- Migrate by rebuilding one domain at a time in the clean branch.
- ComfyUI remains frozen and excluded from feature continuation.
- Each migrated domain needs tests, verify output, docs, and a clean commit.
- Archive commit `a60e689` used `--no-verify` only to preserve WIP evidence blocked by source-size guards; this exception does not apply to clean-branch migration commits.

## Inventory

| Domain | Old files | Clean status | Decision | Validation |
| --- | --- | --- | --- | --- |
| Auth repository | `apps/api/src/auth-repository.ts`, tests, auth verify scripts | Partially present | Keep existing clean slices; migrate remaining admin-write slices only if needed | auth repository tests + auth verify scripts |
| Provider repository | `apps/api/src/provider-repository.ts`, route tests, provider verify scripts | Core repository, admin provider route wiring, and provider/model persistence helpers migrated in clean branch | Continue later with remaining RH catalog call-site migration and optional focused contract script | provider repository tests + provider route split contract |
| Settings repository | `apps/api/src/settings-repository.ts`, settings route tests | Migrated in clean branch with assistant/queue/system route wiring | Complete for current assistant and task-queue settings boundary; revisit only if broader system settings are added | settings repository tests + assistant/queue/system route contracts + assistant save contract |
| Admin repository | `apps/api/src/admin-repository.ts`, admin/audit tests | Lightweight admin summary, audit records, and announcement compatibility boundary migrated | Complete current admin summary/audit/announcement slice; leave task record ownership to Phase 6 task repository | admin repository tests + audit/announcement repository contracts |
| Task repository | `apps/api/src/task-repository.ts`, task cancellation tests | Task list/detail/write/log repository migrated locally | Complete local repository boundary; live `verify:admin-task-pagination` must rerun after gray deploy because it targets the current gray service by default | task repository tests + route injection test + task repository contracts + hotspot budget |
| Usage summary repository/service | `apps/api/src/admin-usage-summary-repository.ts`, `apps/api/src/admin-usage-summary-service.ts` | Open | Migrate after task | usage summary repository contract |
| Environment sync local | `apps/api/src/environment-sync-local.ts`, envsync verify scripts | Open | Migrate after repository boundaries | envsync local contract + envsync smoke |
| Shared API/Worker helpers | `packages/shared/src/*` | Partially present | Compare and migrate only missing helpers | shared helper tests + package export verify |
| ComfyUI | admin/web/api/connector files and ComfyUI plans/specs | Frozen | Archive only; no active feature migration | no active migration |
| Scratch/tool output | `.claude/`, temp logs, task/progress/findings | Excluded from archive commit | Do not migrate | no staged files |

## Archive Snapshot Notes

- `a60e689` contains a large WIP snapshot of repository, environment-sync, shared helper, verify script, governance, release log, and ComfyUI evidence.
- The old worktree still has untracked scratch files after archive commit: `.claude/`, `.eslint-report.json`, `findings.md`, `progress.md`, `task_plan.md`, `tmp-envsync-api.err.log`, and `tmp-envsync-api.out.log`.
- No forbidden secret or scratch path was included in the archive commit according to:

```powershell
git -C D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b diff-tree --no-commit-id --name-only -r HEAD | Select-String -Pattern 'pem|\.claude|eslint-report|task_plan|progress|findings|tmp-'
```

## Next Migration Order

1. Provider repository boundary.
2. Settings repository boundary.
3. Admin repository boundary.
4. Task repository boundary.
5. Usage summary repository/service boundary.
6. Environment sync local boundary.
7. Shared helper completion.
8. Full validation and repair loop.

## Completed Clean Migration Evidence

### Settings repository boundary

- Clean branch status: migrated.
- Purpose: remove assistant settings and task queue settings persistence details from `apps/api/src/server.ts`, and prevent settings routes from loading the full admin DB for narrow reads.
- Implementation:
  - Added `apps/api/src/settings-repository.ts`.
  - Added `apps/api/src/settings-repository.test.ts`.
  - `server.ts` now instantiates `createSettingsRepository()` and keeps only thin compatibility wrappers for existing call sites.
  - Assistant settings route reads through `readAssistantSettingsRecord()` instead of `readAdminDb()`.
  - Queue/system settings routes read providers through `providerRepository.readProviderRecords()` instead of loading the full admin DB only to compute effective RunningHub concurrency.
  - `scripts/verify-admin-assistant-settings-save-contract.mjs` now validates the repository-backed boundary rather than the old inline `server.ts` writer.
- Validation:
  - `npx vitest run apps/api/src/settings-repository.test.ts apps/api/src/provider-repository.test.ts`
  - `npm run type-check -w @xinghuan/api`
  - `node scripts/verify-admin-assistant-settings-save-contract.mjs`
  - `node scripts/verify-api-admin-assistant-settings-route-split-contract.mjs`
  - `node scripts/verify-api-queue-settings-route-split-contract.mjs`
  - `node scripts/verify-api-system-settings-route-split-contract.mjs`
  - `npm run verify:file-hotspot-budgets`
- Result: passed. `apps/api/src/server.ts` hotspot budget improved to `11595 / 11910`.

### Admin repository boundary

- Clean branch status: migrated lightweight slice.
- Purpose: avoid loading or rewriting the full admin DB for admin summary, audit list/append, and announcement compatibility paths where focused reads/writes are enough.
- Implementation:
  - Added `apps/api/src/admin-repository.ts`.
  - Added `apps/api/src/admin-repository.test.ts`.
  - `/api/admin/summary` now composes user/storage data with `adminRepository.readAdminSummary()`.
  - `appendAuditRecord()` delegates to `adminRepository.appendAuditRecord()`.
  - Admin audit list route receives `readAuditRecords(200)` and no longer needs full `readAdminDb()` for the basic audit list.
  - File-backed announcement read/write compatibility is delegated to `adminRepository`; Postgres announcement CRUD remains primarily owned by `announcement-store`.
  - Added repository contracts for audit and announcement records.
- Explicit non-scope:
  - Task detail/list/write records are not owned by this admin repository slice. They remain Phase 6 `task-repository` work.
  - Usage summary remains Phase 7 because it intentionally reads task payload/result for analytics.
- Validation:
  - `npx vitest run apps/api/src/admin-repository.test.ts apps/api/src/settings-repository.test.ts apps/api/src/provider-repository.test.ts`
  - `npm run type-check -w @xinghuan/api`
  - `node scripts/verify-admin-audit-records-repository-contract.mjs`
  - `node scripts/verify-admin-announcement-records-repository-contract.mjs`
  - `npm run verify:file-hotspot-budgets`
- Result: passed. `apps/api/src/server.ts` hotspot budget improved to `11560 / 11910`.

### Task repository boundary

- Clean branch status: migrated local repository boundary.
- Purpose: move task list/detail/write/log database and file-backed operations out of `server.ts`, while preserving the B2 invariant that task list responses do not include heavy `payload`, `result`, or `logs` fields.
- Implementation:
  - Added `apps/api/src/task-repository.ts`.
  - Added `apps/api/src/task-repository.test.ts`.
  - `admin-task-list-routes.ts` now accepts an injected `readTaskListPage()` and prefers it for `GET /api/admin/tasks`.
  - `server.ts` now instantiates `createTaskRepository()` and delegates `appendTaskLog()`, `readTaskRecord()`, `insertTaskRecord()`, and `writeTaskRecord()`.
  - `insertTaskRecord()` keeps runtime event emission in `server.ts` after repository insert so repository remains a storage boundary.
  - Added repository contracts for task list/read/write boundaries.
- Validation:
  - `npx vitest run apps/api/src/task-repository.test.ts apps/api/src/admin-task-list-routes.test.ts apps/api/src/admin-repository.test.ts`
  - `npm run type-check -w @xinghuan/api`
  - `node scripts/verify-task-repository-boundary-contract.mjs`
  - `node scripts/verify-admin-task-records-repository-contract.mjs`
  - `npm run verify:file-hotspot-budgets`
- Live validation note:
  - `npm run verify:admin-task-pagination` targets `http://127.0.0.1:18200` by default and currently reflects the already-running gray service, not this local un-deployed branch.
  - Re-run it after the next gray deployment package includes this commit.
- Result: local checks passed. `apps/api/src/server.ts` hotspot budget improved to `11471 / 11910`.
