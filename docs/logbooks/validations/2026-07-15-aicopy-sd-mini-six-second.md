# AICopy SD Mini Six-Second Validation

## Scope

- Environment: gray
- Candidate version: `v0.6.6`
- Model: `sd2-720p-mini`
- Duration: `6` seconds
- Prompt: `她跳桑巴舞`
- Input: one supplied portrait image in first-frame mode
- Production: unchanged at `v0.5.22`

## Offline Verification

- `npm run verify:aicopy-video-adapter-contract`: passed, including completed-without-URL fallback.
- `npm run verify:worker-output-materializer`: passed, including protected video download and non-serialization of credentials.
- `npm run verify:video-node-backend-inputs-contract`: passed.
- `npx vitest run apps/api/src/video-input-validation.test.ts`: 12 passed.
- `node scripts/verify-provider-generation-task-service.mjs`: passed.
- `node scripts/verify-worker-media-polling-split-contract.mjs`: passed.
- `npm run type-check --workspaces --if-present`: passed for all workspaces.
- `npm run build:single-port`: passed.
- `npm run verify:worker-output-materials`: deferred to gray because no local service was listening on `127.0.0.1:18200`.

## Gray Runtime

Pending deployment and one authorized paid task.

## Media Acceptance

Pending `ffprobe`, timeline extraction, audio-level check, and first-frame visual comparison.
