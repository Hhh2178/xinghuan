# 2026-07-24 Canvas Supervision Failure Diagnostic Validation

## Scope And Boundary

- Branch: `feature/canvas-agent-runtime`
- Gray baseline: `v0.7.42`
- Candidate API/Web ran only at `127.0.0.1:18246` under `/tmp/xh-task6-candidate-20260724` on the Gray server.
- The candidate reused Gray's existing database, Worker, published frontend assistant Agent and model route only for controlled validation.
- Gray `current`, systemd, Nginx, configuration publications and release state were not changed.
- Production and GitHub were untouched.
- Test prompts, credentials, cookies, owner identity, Provider secrets and artifact URLs are excluded from this record.

## Implemented Contract

- `CanvasRunFailureDiagnostic` projects Run API errors, Worker task failures and event evidence into a shared bounded structure.
- Categories cover workflow, environment, input, capability, model, Provider, queue, budget, permission, cancellation, timeout and unknown failures.
- Canvas renders `发生了什么 / 可能原因 / 影响 / 怎么处理`, retryability, node location and collapsed technical identifiers.
- `让 AI 助手分析` opens the assistant, pre-fills a bounded request and attaches exactly one normalized diagnostic.
- The API strips sensitive object keys, bearer credentials and signed URLs before prompt construction.
- The assistant prompt requires observed facts, possible causes, affected steps and repair actions to remain distinct. It cannot claim an unobserved retry or mutation.

## Focused Verification

Commands passed:

```powershell
npx vitest run packages/shared/src/canvas-run-diagnostic.test.ts apps/web/src/components/canvas-agent/canvas-run-error-message.test.ts apps/web/src/components/canvas-agent/canvas-run-view-model.test.ts apps/web/src/components/canvas-agent/canvas-run-assistant-bridge.test.ts apps/web/src/components/canvas-assistant/assistant-failure-context.test.ts apps/api/src/assistant-workflow-context.test.ts apps/worker/src/canvas-run-coordinator.test.ts
npm run verify:canvas-supervision-diagnostic-contract
npm run verify:canvas-assistant-chat
npm run verify:canvas-assistant-ui-contract
npm run verify:member-admin-boundary
npm run type-check -w @xinghuan/web
npm run type-check -w @xinghuan/api
npm run type-check -w @xinghuan/worker
npm run build -w @xinghuan/shared
npm run build -w @xinghuan/api
npm run build -w @xinghuan/web
```

Focused result: 7 files, 51 tests passed. API, Web and Shared builds passed; API, Web and Worker type checks passed.

## Real Failed-Run And Assistant Validation

Harness: `scripts/run-canvas-supervision-diagnostic-real-validation.mjs`

The Harness used a disposable Workflow Region containing one real image generation node and one smart candidate selector. The image node generated one candidate; the selector intentionally required a valid multi-candidate set. This produced a real terminal failure without inventing an event or bypassing the Worker.

Run 1:

- Run ID: `canvas_run_38dd300b-d965-4dcf-8e16-a7593f9e8dc7`
- Final state: `failed`
- Stable code: `SMART_CANDIDATE_COUNT_INSUFFICIENT`
- Diagnostic: `input / 智能选择器候选不足`
- Failed node: `smart-candidate-selector`
- Event count: 7
- Frontend assistant mode: `agent`
- Assistant response length: 1330 characters
- Response referenced the failure facts, separated possible cause and proposed a repair.

Run 2, stricter exact-evidence variation:

- Run ID: `canvas_run_0b4db074-2b7a-4022-a8e1-efae4077dec3`
- Final state: `failed`
- Stable code: `SMART_CANDIDATE_COUNT_INSUFFICIENT`
- Diagnostic: `input / 智能选择器候选不足`
- Failed node: `smart-candidate-selector`
- Event count: 7
- Frontend assistant mode: `agent`
- Assistant response length: 1653 characters
- Response referenced both the exact stable code and `smart-candidate-selector`, separated likely cause and proposed applicable connection/generation repair steps.

Each run submitted one real image request. The Harness requires both `XINGHUAN_ALLOW_PAID_IMAGE_TEST=1` and `XINGHUAN_ALLOW_REAL_ASSISTANT_TEST=1`; no implicit paid call is possible. Disposable canvases were deleted in `finally` after evidence collection.

## Remaining Gate

- The interaction and API behavior were validated through the candidate build, but the new UI has not been deployed to Gray because release remains paused.
- Authenticated 1080p/2K screenshots for this exact failure surface remain part of Task 8 after the complete local candidate is ready.
