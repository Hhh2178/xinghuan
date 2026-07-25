# 2026-07-25 Assistant And Supervision Runtime Usability - Local Validation

## Scope

- Branch: `feature/canvas-agent-runtime`
- Baseline: Gray `v0.7.43`
- PC visual acceptance: one `1920x1080` viewport only
- GitHub push, Gray deployment and Production access: not performed

## Automated Gates

- `npx vitest run`: **730 passed, 4 skipped, 178 files passed, 1 skipped**.
- `npx vitest run packages/agent-core/src/workflow-compiler.test.ts packages/agent-core/src/index.test.ts`: **29 passed**.
- `npm run harness:verify:project`: passed.
- `npm run harness:verify:workspace`: passed, including CodeGraph sync and all workspace type-checks.
- `npm run harness:verify:release`: passed.
- Full type-check: passed for Admin, API, Web, Worker, Agent Core, Shared, UI and connector packages.
- Web production build: passed with `vite build --emptyOutDir=false` because the existing local Web dev process held a generated asset in `apps/web/dist`.
- Admin and ComfyUI production builds: passed.
- PostgreSQL Canvas Run integration: passed (4 tests, isolated database `xinghuan_agent_test_task11_20260725`).
- Local Canvas Run E2E: passed (SSE, task settlement, pause/resume and cancellation).

## Browser Acceptance

### Canvas

The isolated Web app rendered at `1920x1080` with the node catalog, Mini Map, AI Supervision and Canvas AI Assistant visible. Opening both panels produced non-overlapping rectangles:

```text
AI Supervision: x=1382, y=122, w=520, h=720
Canvas AI:      x=880,  y=187, w=430, h=720
```

The assistant remains draggable only within the free desktop region while supervision is open. Runtime, Plan and Events are exclusive supervision workspaces. The screenshot is stored at `output/playwright/task11-local-assistant-supervision-1920x1080.png`.

### Admin

The Admin app was served locally on `18320` and its API was routed through the isolated `18300 -> 18260` proxy (temporary process only). Login succeeded with the local test account. All six supervision workspaces mounted successfully:

- Overview
- Environment control
- Planner Agent
- Model routing
- Quality gates
- Failure recovery

Planner and recovery editors exposed the configured controls; routing showed the enabled chat-model selector and the quality editor showed media/threshold controls. The screenshot is stored at `output/playwright/task11-admin-supervision-1920x1080.png`.

The pre-existing `18200` API has no PostgreSQL connection and returns `AGENT_GOVERNANCE_POSTGRES_REQUIRED`; this is an environment limitation, not a product result. The isolated API with its temporary database was used for the acceptance.

### Assistant behavior

Canvas and Admin assistant endpoints accepted workflow/node context cards and returned the concise fallback contract when no published LLM route was available. Node references used the human display form (for example, `智能候选选择器 #ydhc`); raw IDs were not included in the brief response.

## Real Provider Workflow Gate

The paid image chain was attempted with the explicit `XINGHUAN_ALLOW_PAID_IMAGE_TEST=1` guard. Login succeeded, but the isolated catalog contained only local E2E chat models. The requested `grsai / nano-banana-fast` image model was unavailable and the run stopped before submission with:

```text
CANVAS_RUN_MODEL_UNAVAILABLE
```

No paid request was sent and no fabricated success was recorded. A Gray/real-provider acceptance remains required after an authorized image model is published to the isolated environment.

## Release Decision

Code and local behavior are ready for review. The batch is **not release-complete for real-provider image acceptance** because the authorized image model was not present in the local catalog. GitHub, Gray and Production remain untouched.
