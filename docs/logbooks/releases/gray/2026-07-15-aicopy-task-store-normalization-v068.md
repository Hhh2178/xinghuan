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
- All workspace type checks: pending final build.
- AICopy contract and authenticated materializer checks: passed in the preceding candidate and will be rerun by release preparation.
- Gray runtime and free Worker mock: pending deployment.
