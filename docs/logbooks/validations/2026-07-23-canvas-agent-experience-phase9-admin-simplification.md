# Canvas Agent Experience Phase 9 Admin Simplification Validation

## Scope

- Baseline: Gray `v0.7.19` code commit `40953b4`.
- Candidate branch: `feature/canvas-agent-runtime`.
- Environment: local production Admin build at `http://127.0.0.1:18200` with authenticated read fixtures.
- Excluded: GitHub push, Gray or Production deployment, and any Admin mutation against fixture-backed data.

## Product Boundary

- The Admin remains organized around four task domains: runtime controls, purpose/model bindings, recovery/selection policies, and run/audit evidence.
- Active model governance exposes five fixed purposes: Assistant diagnosis, generation recovery, image evaluation, video evaluation and candidate selection.
- Arbitrary role creation and raw `planner/manager/checker` selection are absent. New LLM pools can be created only from bounded purpose templates.
- Non-MVP definitions are visible as read-only history and do not enter active editors or new Canvas AI Runs.
- New Assistant conversations are pinned to `assistant-planner` in Admin presentation, server normalization and runtime invocation. Recovery editing is pinned to `generation-recovery`.
- Publication copy states that changes affect only future Runs. Older approved versions are labeled as rollback candidates; rollback and Production publication require confirmation.

## Browser Evidence

- Desktop `1440x900`: Controls, Models, Policies and Activity rendered without overlap or clipped labels.
- Tablet `800x1000`: Activity rendered with `documentWidth=800` and `bodyWidth=800`.
- Mobile `390x844`: Models list and editor stacked correctly with `documentWidth=390` and `bodyWidth=390`.
- Browser review exposed one shared rail-grid defect: text-only fixed-purpose buttons occupied the 18px icon column. The final `:only-child` span rule makes those labels span the full row while retaining icon navigation layout.
- The final Activity navigation reported `0 errors / 0 warnings`. Earlier login `401` entries belonged to an incorrect fixture fill and were not present in the clean final navigation.

## Editing And Lifecycle Evidence

- Editing `maxTokens` from `8000` to `9000` produced a structured `maxTokens` draft diff and enabled Save. Save was not clicked.
- Choosing an older approved Gray version displayed `确认回滚 Gray 至此版本？该操作会切换后续新 Run 使用的配置。`; the dialog was dismissed and no publication changed.
- No save, publish, rollback, approve, reject or runtime-control mutation was performed against the GET-only fixtures.
- The local real governance API returned the expected `AGENT_GOVERNANCE_POSTGRES_REQUIRED`; real persistence and publication behavior remain assigned to Gray.

## Automated Verification

- Contracts: Agent governance, Canvas Assistant chat and Admin view model passed.
- Type-check and build: Admin and API passed.
- Governance: file hotspot budgets, hotspot watchlist and documentation entry contracts passed.
- Repository: `git diff --check` passed and CodeGraph synchronized all final source changes.

## Retained Evidence

- `output/playwright/phase9-admin-controls-1440x900.png`
- `output/playwright/phase9-admin-models-fixed-1440x900.png`
- `output/playwright/phase9-admin-policies-1440x900.png`
- `output/playwright/phase9-admin-activity-1440x900.png`
- `output/playwright/phase9-admin-activity-800x1000.png`
- `output/playwright/phase9-admin-models-390x844.png`
- `output/playwright/phase9-admin-models-editor-390x844.png`

## Tooling Boundaries

- The in-app browser could not initialize because of `Cannot redefine property: process`; standalone Playwright CLI exercised the same local production build.
- The first dialog-dismiss command preceded modal creation; the subsequent ordered interaction verified and dismissed the confirmation without mutation.
- The local Windows PowerShell lacked the expected SHA-256 `HashData` and `AesGcm` APIs during account-fixture preparation. That path was stopped and no account data changed.

## Result

Phase 9 is complete. Behavior, visual evidence and automated gates support the simplified fixed-purpose Admin model. Gray and Production were untouched, and nothing was pushed.
