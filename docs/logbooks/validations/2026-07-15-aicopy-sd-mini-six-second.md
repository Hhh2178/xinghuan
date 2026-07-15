# AICopy SD Mini Six-Second Validation

## Scope

- Environment: gray
- Diagnostic version: `v0.6.6`
- Final candidate: `v0.6.8`
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

## Paid Gray Evidence

- Local task: `task-1784089885287-p19oq3`.
- Upstream task: `task_qemFeroHb6VFnn1wmIUPnfHjNDI6XUxw`.
- Upstream record: `SUCCESS`, action `generate`, model `sd2-720p-mini`.
- Persisted task payload: `duration=6`, `ratio=9:16`, `videoInputMode=first`, `modeType=image2video`, `images=1`, contract enabled, canonical SD bindings present.
- The image reference was visibly applied to identity, clothing, and pink background.
- Upstream completed but the local task continued polling. The existing paid output was recovered without resubmission and materialized at `/files/output/task_output_task-1784089885287-p19oq3_1.mp4`.

## Media Acceptance

- Input image: `941x1672`, vertical.
- Output: H.264, `1254x720`, 30 fps, `4.000000` seconds, 120 frames.
- Audio streams: `0`.
- Verdict: reference image passed; requested duration, ratio, and generated sound failed under the diagnostic runtime.

## Root Cause

- Both `apps/worker/src/worker-task-store.ts` and `apps/worker/src/worker.ts` protocol normalization omitted `aicopy`. The task-store boundary converted the persisted protocol to `openai` before adapter selection.
- The dedicated AICopy serializer, sanitized request summary, and AICopy completion fallback therefore did not run.
- Plugin source confirms all `sd2-1080p*` and `sd2-720p*` models use the same official request shape and return `/v1/videos/{task_id}/content?variant=video` when completed without an embedded URL.
- Authenticated read-only inspection of the real upstream task returned `status=completed`, no embedded video URL, and `200 video/mp4` from both `/content` variants.

## Final Validation

- Gray `v0.6.8` deployment completed; API and Worker are active and both public/internal status endpoints report `0.6.8 / gray`.
- Free long-running Worker mock passed with one submit, one poll, one authenticated content download, local output materialization, and final `succeeded` state.
- Captured mock request: `duration=6`, `modeType=image2video`, `ratio=9:16`, `enableSound=on`, `images=1`.
- Final local task: `task-1784097065594-z22i7n`.
- Final task completed automatically without manual recovery.
- Final output: H.264 `720x1254`, 30 fps, exactly `6.000000` seconds, 180 frames.
- Final audio: AAC stereo, 44.1 kHz, approximately 6.08 seconds; measured mean/max volume `-19.6 dB / -3.6 dB`.
- Visual acceptance: supplied identity, clothing, pink background, and samba movement were preserved.
- User acceptance: result confirmed normal on `2026-07-15`.
- Verdict: duration, vertical ratio, generated sound, first-frame reference, completion polling, authenticated download, and local materialization all passed.
- Paid-test gate is closed; do not submit further paid AICopy validation tasks for this batch.
