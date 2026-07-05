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
| Settings repository | `apps/api/src/settings-repository.ts`, settings route tests | Open | Migrate after provider | settings repository tests + assistant/task queue contracts |
| Admin repository | `apps/api/src/admin-repository.ts`, admin/audit tests | Open | Migrate after settings | admin repository tests + audit/task summary contracts |
| Task repository | `apps/api/src/task-repository.ts`, task cancellation tests | Partially covered by B2 | Migrate after admin | task repository tests + admin task pagination |
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
