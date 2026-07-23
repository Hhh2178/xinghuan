# Canvas Agent Experience Phase 10 Local Verification

## Scope

- Baseline: Gray `v0.7.19` code commit `40953b4`.
- Candidate branch: `feature/canvas-agent-runtime` after local Phase 9 checkpoint `875771e`.
- Environment: local production build on `127.0.0.1:18200`, isolated loopback PostgreSQL database `xinghuan_agent_test_canvas`, and isolated loopback Redis.
- Excluded: GitHub push, Gray deployment, Production deployment, and Production mutation.

## Automated Verification

- Root Vitest after the final first-binding fix: `130` files passed, `1` skipped; `517` tests passed, `4` skipped.
- Complete workspace production build passed for all packages, Web and Admin.
- Project, Workspace and Release Harnesses passed, including workspace type-check, package exports, dependency security, architecture, Assistant, Admin, Canvas workflow and release-governance contracts.
- CodeGraph synchronized and reported the source index up to date.
- PostgreSQL migrations `001-040` passed against the isolated database.
- Four PostgreSQL lease, fairness and atomic-claim integration tests passed.
- API, Redis and Worker E2E passed persistent SSE, `Last-Event-ID` reconnect, settlement, pause/resume and cancel.

## Browser And Visual Evidence

- Viewport matrix passed at `1366x768`, `1440x900`, `1920x1080`, `800x1000` and `390x844` with exact document/body widths and no incoherent overlap.
- Browser review found the desktop shell still active at `800px`; extending the existing compact topbar and off-canvas Sidebar breakpoint to `900px` restored a full-width tablet Canvas.
- Desktop Assistant and Supervision rectangles had zero intersection. At `390x844`, the two `374x828` drawers remained mutually exclusive.
- Smart Candidate Selector retained image/manual/Top 1 and its edited note after cold reload.
- Workflow Region color remained opaque and revision-neutral; a real header drag moved the region and both members by `+60px/+40px`; resize, containment, geometry and color persisted after reload.
- A fresh one-node workflow proved the first `模板文本` click creates a valid `文本输入` binding and `##文本输入##` token without a second click or transient unknown-variable error.
- Variable value persistence, `引用 #1` node focus, stage parallel/skip persistence and owner+canvas+workflow remembered supervision settings all passed after cold reload.
- The final disposable Canvas was deleted through the visible two-step confirmation. The retained `恢复画布 1` remained selected and unchanged.

## Clean Runtime Evidence

- A fresh authenticated browser tab was opened after stable local server uptime.
- Console result: `0 errors / 0 warnings`.
- Dynamic requests for status, authentication, announcements, settings, models, permissions, Canvas, Runs and auto-save all returned `200`.
- Historical connection-refused entries from intentional build-time server restarts were excluded by using the fresh tab.

## Retained Evidence

- `output/playwright/phase10-local-smart-candidate-selector-1440x900.png`
- `output/playwright/phase10-local-workflow-region-color-1440x900.png`
- `output/playwright/phase10-local-workflow-region-moved-1440x900.png`
- `output/playwright/phase10-local-workflow-region-persisted-1440x900.png`
- `output/playwright/phase10-local-workflow-variable-first-bind-fixed-1440x900.png`
- `output/playwright/phase10-local-workflow-variable-reference-focus-1440x900.png`
- `output/playwright/phase10-local-workflow-stage-persisted-1440x900.png`
- `output/playwright/phase10-local-supervision-remembered-settings-1440x900.png`
- `output/playwright/phase10-local-clean-network-console-1440x900.png`

## Result

Phase 10 local behavior, visual, persistence, integration and Harness verification is complete. Gray and Production were not changed, and nothing was pushed. Phase 11 owns the patch release metadata, Gray-only deployment and authenticated Gray regression.
