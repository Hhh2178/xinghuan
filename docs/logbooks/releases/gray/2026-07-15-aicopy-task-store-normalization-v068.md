# v0.6.8 AICopy Task-Store Normalization Gray Release

## Release

- Version: `v0.6.8`
- Environment: gray only
- Release: `20260715-aicopy-task-store-normalization-v068`
- Production remains `v0.5.22`.

## Changes

- Preserve `aicopy` when the Worker task store hydrates Provider protocol from PostgreSQL.
- Preserve `aicopy` again at the Worker execution entry.
- Require both normalization boundaries in the Worker adapter regression.
- Retain authenticated final-content recovery, sanitized request summaries, and the free AICopy Worker mock from the preceding diagnostic releases.

## Verification

- Both Worker normalization regressions: passed.
- All workspace type checks and the single-port build: passed.
- AICopy contract, completed-without-URL fallback, and authenticated materializer checks: passed.
- Gray API and Worker are active; public and internal status endpoints report `0.6.8 / gray`.
- The free long-running Worker mock observed one submit, one poll, one authenticated content download, local output materialization, and final `succeeded` state.
- The mock captured `duration=6`, `metadata.modeType=image2video`, `metadata.ratio=9:16`, `metadata.enableSound=on`, and one image.
- The final authorized task advanced automatically from queued through completed to local `succeeded` without manual recovery.
- The final media is H.264 `720x1254`, 30 fps, exactly 6 seconds, with AAC stereo audio; the user confirmed the result is normal.

## Acceptance

- Gray accepted by the user on `2026-07-15`.
- No additional paid AICopy generation is required.
- Production was not modified and remains `v0.5.22`.
