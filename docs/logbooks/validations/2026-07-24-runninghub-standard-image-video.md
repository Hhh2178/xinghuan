# 2026-07-24 RunningHub Standard Image And Video Validation

## Scope And Boundary

- Branch: `feature/canvas-agent-runtime`
- Gray baseline: `v0.7.42`
- Real calls used Gray Provider/model metadata and encrypted Key data only inside the Gray server.
- Candidate modules and generated files stayed under `/tmp/xh-rh-standard-task5-20260724`.
- No Gray release switch, service restart, database task write or configuration publication occurred.
- Production and GitHub were untouched.
- Secrets, Key IDs, previews, signed upstream URLs and owner identities are excluded from this record.

## TDD And Mocked Verification

- The standard-model Key dispatch test first failed because the personal default Key was selected and a missing eligible Key did not fail directly. After implementation, the suite selects only qualified keys, supports the legacy enterprise-note fallback, respects explicit false and preserves catalog target ordering.
- A real HTTP-200 RunningHub business error first exposed missing error classification. The regression now preserves the upstream error code and returns `FAILED` without leaking authorization or signed URLs.
- Focused result: 4 files, 15 tests passed.

Commands passed:

```powershell
npx vitest run apps/api/src/provider-generation-task-service.test.ts apps/worker/src/worker-runninghub-standard-adapter.test.ts apps/worker/src/worker-runninghub-standard-media.test.ts apps/worker/src/worker-runninghub-dispatch.test.ts
npm run verify:runninghub-standard-model-contract
npm run verify:runninghub-key-pool-contract
npm run verify:provider-generation-task-service
npm run verify:provider-generation-worker
npm run verify:worker-output-materializer
npm run verify:runninghub-workflow-contract
npm run type-check -w @xinghuan/api
npm run type-check -w @xinghuan/worker
npm run type-check -w @xinghuan/admin
npm run build -w @xinghuan/api
npm run build -w @xinghuan/worker
npm run build -w @xinghuan/admin
```

## Real Provider Verification

The final isolated Harness used the new Provider task service to freeze each task payload, asserted `runningHubExecutionMode=standard_model`, asserted the model path and required parameters, then drove media upload, the new adapter, polling and the shared output materializer.

Image:

- Internal task ID: `task5-rh-image-1784918569261`
- Model: `/rhart-image-n-g31-flash/image-to-image`
- Adapter: `runninghub-standard-image`
- Final state: `SUCCESS`
- Output count: 1
- Materialized URL: `/files/output/task_output_task5-rh-image-1784918569261_1.jpg`
- File: valid JPEG, 1024 x 1024, 592809 bytes
- Allowlisted upstream charge: `thirdPartyConsumeMoney=0.19`

Video:

- Internal task ID: `task5-rh-video-1784918585733`
- Model: `/rhart-video-g/image-to-video`
- Adapter: `runninghub-standard-video`
- Final state: `SUCCESS`
- Output count: 1
- Materialized URL: `/files/output/task_output_task5-rh-video-1784918585733_1.mp4`
- File: valid MP4, H.264 video + AAC audio, 960 x 960, 6.041667 seconds, 2252613 bytes
- Allowlisted upstream charge: `thirdPartyConsumeMoney=0.24`
- A frame extracted at 3 seconds was nonblank and showed a real camera push while preserving the generated subject.

Final run window: `2026-07-24T18:42:49.240Z` to `2026-07-24T18:45:59.867Z`.

## Diagnosed Attempts

- The Provider main Key returned an HTTP-200 business rejection stating that Standard Model API requires an Enterprise-Shared Key. No upstream task was created.
- With the enterprise-qualified pool Key, image execution succeeded.
- Video validation then reported missing `aspectRatio`, missing `resolution`, and `duration` below the minimum of 6 in separate pre-task responses. These attempts created no video task and incurred no video generation charge.
- The accepted real video request used `aspectRatio=16:9`, `resolution=720p`, and `duration=6`. The model retained the square source image ratio and produced 960 x 960 output; this behavior is recorded rather than presented as 16:9 output compliance.

## Remaining Runtime Notes

- Gray's enterprise Key is currently recognized by the legacy `企业级` note fallback. After this code is deployed, Admin should save the explicit `standardModelApi` property so future dispatch no longer depends on free text.
- The enabled Gray video model currently has an empty stored parameter Schema. The shared default video Schema preserved the explicit successful values in the Provider task payload, but Admin should still publish an accurate model-specific Schema for clear enums and validation.
- Full service/browser acceptance remains in Tasks 8-9 and cannot occur on Gray until the user lifts the deployment pause.
