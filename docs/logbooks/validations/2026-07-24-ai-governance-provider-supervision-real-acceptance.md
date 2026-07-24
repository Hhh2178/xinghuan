# 2026-07-24 AI Governance, Provider And Supervision Real Acceptance

## Scope And Boundary

- Branch: `feature/canvas-agent-runtime`
- Gray baseline: `v0.7.42`
- Candidate API/Worker/Web: isolated loopback `127.0.0.1:18248` on the Gray server
- Candidate database: disposable `xinghuan_canvas_task7_20260724`
- Candidate Redis and files: isolated under `/tmp/xh-task7-candidate-20260724`
- Approved desktop viewports: `1920x1080` and `2560x1440`
- Formal Gray current release, systemd services, Nginx, shared database, shared Redis and release state were not changed.
- Production and GitHub were untouched. No secret, cookie, Key, signed URL, prompt containing user data or owner identity is recorded here.

## RunningHub Standard Models

The bounded real-provider evidence remains authoritative in `2026-07-24-runninghub-standard-image-video.md`:

- Image task `task5-rh-image-1784918569261`: `SUCCESS`, one materialized JPEG at `/files/output/task_output_task5-rh-image-1784918569261_1.jpg`, `1024x1024`.
- Video task `task5-rh-video-1784918585733`: `SUCCESS`, one materialized MP4 at `/files/output/task_output_task5-rh-video-1784918585733_1.mp4`, H.264/AAC, `960x960`, `6.041667s`.
- Both calls used the new RunningHub Standard Model adapter through the isolated Harness. The accepted request payloads, polling and output materialization were exercised against the real Provider.

## Real Supervision Failure And Visible Diagnosis

- Canvas: `canvas-1784930858847-y7e902`
- Canvas Run: `canvas_run_447d37d9-718c-4ef5-8dec-f6b95de2a797`
- First image step: succeeded against a real configured channel.
- Failed task: `task-bbf7abb9-6472-471a-b993-f08bf5d002f8`
- Failure: `provider / CANVAS_RUN_UNKNOWN_ERROR / 渠道拒绝了本次请求`
- Run event ledger: `15` events, including analysis start/completion, layer start/completion, dispatch, retry scheduling, step completion/failure and Run failure.
- Canvas showed the completed node and failed node in place. The supervision panel showed the frozen two-step plan, `1/2` progress, active failure, AI chain analysis, request estimate, serial constraint, retry state and event stream.
- The user-facing diagnostic separated `发生了什么`, `可能原因`, `影响` and `怎么处理`. `让 AI 助手分析` attached exactly one normalized diagnostic and produced a real streamed response of `2153` characters with observed facts, possible causes and repair/retry guidance.

## Frontend And Backend Assistant Separation

The real acceptance Harness exercised the published candidate configuration without changing formal Gray publication:

- Frontend Agent Run: `agent_run_b94a08ee-af32-4060-8c3c-feb88552ca14`
- Frontend purposes: `assistant-planner`, then `assistant-diagnosis`
- Frontend response length: `3308` characters
- Backend Agent Run: `agent_run_74d3b3e2-960e-424b-b275-0f2c18fb31a5`
- Backend purposes: `admin-assistant-planner`, then `admin-assistant-diagnosis`
- Backend response length: `3905` characters
- A member request to the Admin assistant returned `403`; backend task/audit context did not leak to the frontend role.
- The frontend assistant used current workflow/Run facts and explicitly rejected adding the retired `canvas-agent` node.

## Frozen Configuration Behavior

- Existing Run A: `canvas_run_24e127d9-f1c0-4afc-abd9-78cfc3f05efe`
- New Run B: `canvas_run_4106aa75-de59-4843-ad07-d9ec3c41bb49`
- Run A retained its original Agent/model/policy snapshot across the temporary candidate publication switch.
- Run B consumed the temporary configuration.
- The original cloned publication was restored after the check.
- This acceptance exposed an idempotency defect: planner analysis used only the prompt hash and could replay an earlier Agent Run after configuration changed. The key now includes owner, Canvas Run creation idempotency key and prompt. Focused regression: `1` file / `6` tests passed; the wider focused set passed `2` files / `20` tests before browser acceptance.

## Authenticated PC Visual Acceptance

Admin screenshots at both approved viewports:

- `output/playwright/task8/models-1920x1080.png`
- `output/playwright/task8/models-2560x1440.png`
- `output/playwright/task8/tasks-1920x1080.png`
- `output/playwright/task8/tasks-2560x1440.png`
- `output/playwright/task8/channel-health-1920x1080.png`
- `output/playwright/task8/channel-health-2560x1440.png`
- `output/playwright/task8/assistants-1920x1080.png`
- `output/playwright/task8/assistants-2560x1440.png`
- `output/playwright/task8/assistants-backend-1920x1080.png`
- `output/playwright/task8/assistants-backend-2560x1440.png`
- `output/playwright/task8/supervision-loaded-1920x1080.png`
- `output/playwright/task8/supervision-loaded-2560x1440.png`

Canvas failure and assistant screenshots:

- `output/playwright/task8/canvas-assistant-diagnosis-1920x1080.png`
- `output/playwright/task8/canvas-assistant-diagnosis-2560x1440.png`
- `output/playwright/task8/canvas-failure-panels-fixed-1920x1080.png`
- `output/playwright/task8/canvas-failure-panels-fixed-2560x1440.png`

Measured results:

- Document scroll width equaled viewport width on every accepted Admin and Canvas surface.
- No visible element crossed the viewport boundary and the application console remained at `0` errors / `0` warnings.
- The four failure terms each measured `64px` wide by `19px` high with `18px` line height, confirming a single line at both viewports.
- At `1920x1080`, Assistant bounds were `(880,344)-(1310,1064)` and supervision bounds were `(1382,122)-(1902,842)`.
- At `2560x1440`, Assistant bounds were `(880,344)-(1310,1064)` and supervision bounds were `(2022,122)-(2542,842)`.
- Assistant/supervision overlap area was `0` at both viewports. The Canvas minimap remained visible.

## Fresh Gates

Passed after the final diagnostic layout correction:

```text
npm run verify:canvas-supervision-diagnostic-contract
npx vitest run apps/api/src/canvas-run-agent-analysis-service.test.ts
npm run type-check --workspace @xinghuan/api
npm run type-check --workspace @xinghuan/web
npm run build --workspace @xinghuan/api
npm run build --workspace @xinghuan/web
git diff --check
```

## Decision

Task 8 has direct code, contract, real Agent, real Provider, immutable configuration and authenticated browser evidence. The candidate is suitable for Task 9 completion audit. Formal Gray deployment remains paused until explicit user approval, and the intermittent Provider recovery edge recorded in the Task 7 validation remains a visible residual risk.
