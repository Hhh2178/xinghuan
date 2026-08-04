# RunningHub Output Archive v0.8.22 Gray

- release: `20260804-runninghub-output-archive-v0822-r1`
- version: `0.8.22`
- environment: `gray`
- target: `old-server / ubuntu@101.33.75.38:728`
- source commit: `8cf7f12`
- archive SHA-256: `cc6398232c36d5be39ee0f82eb1142a08cd2dec7f8279cb25fa0b2945aa53b59`
- deployedAt: `2026-08-04`

## Scope

- Add owner-scoped asynchronous RunningHub output archive jobs and API routes.
- Add a Worker durable global lease with owner round-robin, stream-based ZIP store mode, heartbeat, cancellation, TTL cleanup, stale lease recovery and atomic `.part` rename.
- Add the RH node's optional “完成后自动下载 ZIP” switch with taskId de-duplication, ready polling and manual retry.
- Preserve the local drawer alignment fix and keep Production unchanged.

## Verification

- Full CI: `247 passed`, `1 skipped`; `936 passed`, `4 skipped`.
- Output archive Worker test: `1 passed`; API archive tests: `4 passed`.
- API/Web/Worker type-check and single-port build: passed.
- Release package contract and version alignment: passed; archive contains 214 entries and manifest contains 188 files.
- Runtime verifier: API/Worker active; internal and public status report `0.8.22 / gray / enforced`.
- Database migration: `049_output_archive_jobs.sql` applied successfully.
- Runtime packaging follow-up: `archiver` is loaded through Node `createRequire` for Node 22 ESM compatibility.

## Boundaries

- Production was not touched; it remains `v0.8.15`.
- Browser visual acceptance and a real RH multi-output download remain follow-up Gray acceptance items.
