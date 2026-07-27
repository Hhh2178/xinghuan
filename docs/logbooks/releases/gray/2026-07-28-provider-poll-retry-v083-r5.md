# Provider Poll Retry v0.8.3 Gray

- release: `20260728-provider-poll-retry-v083-r5`
- version: `0.8.3`
- source commit: `6533a364fa83b155e7ed23311499178f528e2247`
- archive SHA-256: `0D66745F2BE91A019928C5F7579EA2BA394C29F1854F7511D602CE076ED81C28`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas-next`
- previous current: `20260728-canvas-loading-performance-v083-r4`
- rollback: `20260728-canvas-loading-performance-v083-r4`
- retentionApplyRun: `false`

## Scope

- Keep RunningHub standard-model submission single-shot to preserve billing/idempotency semantics.
- Retry only transient standard-model polling failures within the existing deadline and persist sanitized retry/recovery heartbeat fields.

## Verification

- Focused adapter test covers 503 query recovery, one submission, two queries and sanitized heartbeat evidence.
- Full Vitest: 191 passed files, 792 passed tests, 1 skipped file, 4 skipped tests; all workspace type-checks passed.
- Gray strict runtime verification passed: current r5, API/Worker active, version/environment matched.
- No paid Provider/Agent canary, retention apply or historical release deletion ran.
