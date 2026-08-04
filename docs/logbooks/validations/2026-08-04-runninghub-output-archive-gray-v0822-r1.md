# RunningHub Output Archive v0.8.22 Gray Validation

- release: `20260804-runninghub-output-archive-v0822-r1`
- environment: `gray`
- target: `ubuntu@101.33.75.38:728` (`old-server`)
- source commit: `8cf7f12`
- archive SHA-256: `cc6398232c36d5be39ee0f82eb1142a08cd2dec7f8279cb25fa0b2945aa53b59`

## Checks

- Runtime verifier: passed with `appServiceActive=true`, `workerServiceActive=true`, `expectedVersionMatched=true`, and `expectedEnvironmentMatched=true`.
- Internal and public status: `success=true`, `version=0.8.22`, `environment=gray`, `permissionMode=enforced`.
- Database migration `049_output_archive_jobs.sql` applied; rerun was idempotent.
- Full local CI: `247` test files and `936` tests passed or skipped as expected.

## Acceptance boundary

- Server-side archive queue and Worker runtime are deployed and healthy.
- Automatic browser download still requires a real RH task with local materialized outputs; no paid provider canary was run during release verification.
- 1920x1080 browser visual verification remains pending for the Gray operator.
- No Production deployment or data access was performed.
