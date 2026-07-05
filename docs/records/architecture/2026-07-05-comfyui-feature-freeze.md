# ComfyUI Feature Freeze - 2026-07-05

## Decision

ComfyUI feature development is paused from this point forward.

This freeze protects the clean worktree migration and the unfinished structural-improvement work from being mixed with another broad ComfyUI redesign cycle.

## Current Sealed State

- Active worktree: `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean`
- Gray version recorded in active docs: `v0.5.25`
- Gray release: `20260704-comfyui-machine-first-gray-r1-v0525`
- Production version recorded in active docs: `v0.5.22`
- Production release: `20260702-envsync-admin-sections-prod-r1-v0522`

Current gray ComfyUI scope already recorded:

- Unified `comfyui` canvas node.
- Machine-first selection flow.
- Workflow selection scoped under the selected machine.
- Auto-height parameter display without internal node scroll.
- Public-route error translation for upload, prompt, history, and output-save stages.
- Connector harness verification path.

Primary release evidence:

- `docs/logbooks/releases/gray/2026-07-04-comfyui-machine-first-gray.md`

## Frozen Scope

The following ComfyUI work must not continue in this migration line:

- Canvas ComfyUI node visual redesign.
- Workflow parameter exposure editor expansion.
- Machine/workflow shared area expansion.
- Tailscale direct connection implementation.
- Reverse tunnel execution implementation.
- Connector pool scheduling and multi-machine runtime management.
- Workflow marketplace or shared workflow behavior changes.
- Preview or metadata editor expansion.

## Allowed Changes During Freeze

Only emergency or evidence-preserving changes are allowed:

- Crash fixes.
- Permission or security fixes.
- Gray rollback or version-alignment fixes.
- Connector heartbeat/runtime availability fixes.
- Documentation updates that record current state, known risks, or rollback evidence.

Every allowed exception must be a separate commit and must record:

- Why the exception was allowed.
- Files changed.
- Verification commands.
- Release impact.
- Rollback path.

## Resume Gate

ComfyUI work can resume only after all of the following are true:

- Clean worktree migration is complete.
- Structural/tooling baseline is committed.
- Current unfinished structural batches are complete or explicitly deferred with decision records.
- A new ComfyUI continuation plan is written and approved separately.
- The new plan includes its own gray verification checklist and rollback path.

## Verification At Freeze Time

Commands run before creating this record:

```powershell
git log --oneline --grep comfyui -12
Get-Content -LiteralPath 'docs\logbooks\releases\gray\2026-07-04-comfyui-machine-first-gray.md'
git status --short
git diff --name-only -- apps/web apps/admin apps/api apps/comfyui-connector | Select-String -Pattern 'comfy|Comfy'
```

Observed result:

- Recent ComfyUI commits and gray release evidence are present.
- No ComfyUI source files were dirty at freeze time.
- Existing dirty files were limited to tooling baseline work: `package.json`, `package-lock.json`, and `eslint.config.js`.
