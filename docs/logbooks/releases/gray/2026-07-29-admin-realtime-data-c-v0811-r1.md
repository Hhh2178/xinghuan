# Admin Realtime Data C v0.8.11 Gray

- release: `20260729-admin-realtime-data-c-v0811-r1`
- version: `0.8.11`
- source branch: `release/admin-realtime-data-c-v0811`
- source commit: `982b756`
- archive SHA-256: `d653c95f93065129afdf692e342e9e207d8c850b353d77346c2aa165fb36a3ea`
- target: `old-server` / Gray
- result: runtime accepted, visual acceptance rejected
- superseded by: `20260729-admin-realtime-data-c-v0812-r1`
- retention apply: `false`

## Scope

- Added the presentation-only realtime/data workbench and migrated overview, tasks, system health, usage, costs, reliability, and audit without moving their data, polling, filter, task-action, ETag, or Inspector ownership.
- Preserved the existing anomaly-first system-health semantics, task lifecycle controls, cost CNY contract, usage drilldown, channel-health stale fallback, and seven raw audit columns.

## Verification

- Packaging, deployment, API/Worker runtime, public/internal status, permission readiness, remote preflight, request-chain observability, system observability, and environment-sync no-op smoke passed.
- Deployment applied 0 migrations and skipped 46 existing migrations.
- The authenticated `1920x1080` seven-route review rejected visual acceptance because the Tasks create command wrapped to two lines and the Reliability refresh command rendered as a white default button.

## Disposition

- This release was not accepted as the Admin C completion release.
- The two presentation regressions were fixed in `711f5b7` and released as `v0.8.12`.
- No Production deployment, billed canary, retention apply, or rollback was performed.
