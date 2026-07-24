# Assistant And Supervision Governance Validation

## Scope

- Branch: `feature/canvas-agent-runtime`
- Baseline: Gray `v0.7.42`
- Environment: isolated local PostgreSQL and single-port API/Admin candidate
- Gray deployment: paused
- Production: untouched
- Visual matrix: PC `1920x1080` and `2560x1440` only

## Behavior

- `/admin/automation/assistants`, `/admin/automation/supervision` and `/admin/automation/activity` resolve as independent workspaces.
- Legacy `/admin/capabilities/admin-assistant` redirects to assistant governance.
- Frontend and backend assistant segments select distinct Agent definitions and route pools.
- Switching segments remounts Agent and pool editors, so a draft cannot flash or leak into the other assistant.
- Surface settings persisted at revision 2; an unsaved edit was discarded after refresh.
- Assistant governance exposes Gray/Production publication state read-only. No publication was changed.
- Supervision owns planner, concurrency, quality, candidate and recovery controls; activity owns Runs, approvals and audit.
- Provider/model workspace no longer renders assistant configuration.

## Automated Verification

- `npx vitest run apps/api/src/assistant-settings-domain.test.ts apps/api/src/agent-governance-repository.test.ts apps/admin/src/admin-assistant-governance-view-model.test.ts apps/admin/src/admin-agent-governance-purpose.test.ts`: 4 files, 25 tests passed.
- `npm run verify:admin-view-model-contract`: passed.
- `npm run verify:admin-assistant-settings-save-contract`: passed.
- `npm run verify:admin-assistant-chat`: passed.
- `npm run verify:admin-assistant-ui-contract`: passed.
- `npm run verify:agent-governance-contract`: passed.
- `npm run verify:member-admin-boundary`: passed.
- `npm run verify:canvas-assistant-chat`: passed.
- `npm run verify:video-upload-connect-admin-assistant-toggle`: passed.
- `npm run type-check`: passed for all workspaces.
- `npm run build -w @xinghuan/api`: passed.
- `npm run build -w @xinghuan/admin`: passed.
- `npm run verify:file-hotspot-budgets`: passed.
- `npm run verify:hotspot-watchlist-contract`: passed.
- `git diff --check`: passed; only existing Windows line-ending notices were emitted.

## Authenticated Browser Evidence

- `output/playwright/task4-assistants-backend-1920x1080.png`
- `output/playwright/task4-assistants-backend-2560x1440.png`
- `output/playwright/task4-supervision-1920x1080.png`
- `output/playwright/task4-supervision-2560x1440.png`
- Assistant dock remained open without obscuring navigation or governance controls.
- No text clipping or horizontal overflow was observed at either approved viewport.
- Browser console: 0 errors, 0 warnings.

## Boundary

This stage validates governance separation and configuration behavior. Real Assistant/Supervision model execution and shared run-failure diagnosis remain mandatory Tasks 6-8 gates and are not claimed here. No GitHub push, Gray deployment or Production write occurred.
