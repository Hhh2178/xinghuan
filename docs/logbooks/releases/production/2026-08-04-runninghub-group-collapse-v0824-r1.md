# RunningHub 分组折叠 v0.8.24 Production

- release: `20260804-runninghub-group-collapse-v0824-r1`
- version: `0.8.24`
- environment: `production`
- target: `old-server / ubuntu@101.33.75.38:728`
- source commit: `6db6647`
- archive SHA-256: `53c884f3111004ef1034a2472ed34a2968992b37fbd193a8647837c79d7043e8`
- deployedAt: `2026-08-04`
- promotedFromGray: `true`

## Scope

- Promote the Gray-verified RH grouped selector collapse behavior to Production using the exact same sealed artifact.
- No Production-specific code or rebuild was introduced.

## Verification

- Production database migration: `applied=[047_administrator_tier.sql, 048_runninghub_catalog_groups.sql, 049_output_archive_jobs.sql]`, `skipped=46`.
- Runtime verifier passed: API/Worker active; internal/public status `0.8.24 / production / enforced`; permission readiness passed.
- Production retention dry-run/apply: passed; five releases retained and both current/rollback anchors preserved.

## Boundaries

- No billed Agent or Provider canary was run.
