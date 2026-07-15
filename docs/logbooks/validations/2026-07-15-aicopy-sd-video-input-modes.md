# AICopy SD Video Input Modes Validation

## Scope

- Release: `20260715-aicopy-sd-video-input-modes-v064`
- Version: `v0.6.4`
- Environment: gray only
- Provider: `custom-api-1782805467175`
- Model: `sd2-720p-fast`

## Offline Evidence

- Four universal modes: `reference`, `first`, `last`, `firstlast`.
- Count rules: `0..N`, exactly `1`, exactly `1`, exactly `2`.
- Video reference maximum is stored in `parameterSchema.referenceImages.max`; legacy `multiImage` no longer caps runtime input.
- Admin renders one `参考图模式` control and a `1..16` maximum selector for video models.
- AICopy request activation remains `provider.protocol=aicopy` plus literal model switch `aicopyRequestContractEnabled=true`.
- APIMart, generic OpenAI video, and disabled AICopy contracts remain isolated.

Passing commands:

```text
npm run verify:admin-video-reference-config
npm run verify:video-node-backend-inputs-contract
npm run verify:aicopy-video-adapter-contract
npm run verify:apimart-video-adapter-contract
npx vitest run apps/api/src/video-input-validation.test.ts
node scripts/verify-provider-generation-task-service.mjs
npm run type-check -w @xinghuan/model-core
npm run type-check -w @xinghuan/api
npm run type-check -w @xinghuan/worker
npm run type-check -w @xinghuan/web
npm run type-check -w @xinghuan/admin
npm run build:single-port
```

## Gray Runtime Evidence

- API service: active.
- Worker service: active.
- Internal and public status: `0.6.4 / gray`.
- Current release path: `/opt/apps/xinghuan-canvas-next/releases/20260715-aicopy-sd-video-input-modes-v064`.
- Production remained `0.5.22 / production`.
- Model configuration remained idempotent after API and Worker restart: `changed=false`, fingerprint `5e09dd6b982db5f0`.
- Public model catalog after authenticated read:
  - `maxReferenceImages=9`
  - `maxReferenceAudios=3`
  - `firstFrame=true`
  - `lastFrame=true`
  - `audioReference=true`
  - `defaultDuration=15`
- External video proxy smoke passed sync, APIMart async, generic async, and Agnes async branches.
- Worker video smoke passed real Redis enqueue, Worker claim, upstream request, and local output materialization.
- Canvas render smoke passed `49/49` registered nodes with no missing nodes, runtime errors, network failures, or error boundary.

## Controlled AICopy Generation

- Canvas task: `task-1784075136595-ecgtb5`.
- Sanitized queued payload:
  - `duration=15`
  - `ratio=9:16`
  - `videoInputMode=reference`
  - `modeType=text2video`
  - `images=0`
  - `audios=0`
  - `aicopyRequestContractEnabled=true`
  - fixed request binding `metadata.enableSound="on"`
- Current observation: local task remains `running`, `runtimeStage=polling`, upstream state reports `completed`, but no video URL has been returned yet.
- The completed media was later supplied manually as `content.mp4`; no additional paid generation was submitted during verification.
- `ffprobe` media evidence:
  - duration: `15.000000` seconds (pass)
  - video: H.264, `1254x720`, SAR `1:1`, DAR `209:120`, 30 fps (fail: landscape output, not requested `9:16`)
  - audio streams: `0` (fail: no generated sound)
- Gray PostgreSQL read-only evidence for this task confirms `ratio="9:16"`, `duration=15`, `modeType="text2video"`, `aicopyRequestContractEnabled=true`, the canonical `metadata.ratio` and `metadata.enableSound="on"` bindings, and an empty `fixedBody`.
- Current root-cause boundary: canvas selection, queued task persistence, model contract configuration, and deterministic adapter serialization all preserve the requested values. The output indicates that the upstream AICopy SD execution path did not apply the `metadata` ratio and sound controls, or expects a contract different from the supplied interface document. Wire-level request capture is not currently persisted, so this remains an upstream-boundary diagnosis rather than a proven vendor defect.
- Paid model retesting is frozen until the exact upstream request contract is confirmed from the provider or the plugin source implementation. Offline adapter and mock-upstream verification remain allowed.

## Test Harness Corrections

- Generic async verification now expects one signed reference URL instead of a duplicated historical input.
- Worker video verification now uses the real `/api/proxy/external/video/task` queue endpoint and paged status contract.
- Browser render verification recognizes that legacy ComfyUI node types migrate to the unified `comfyui` render type.
