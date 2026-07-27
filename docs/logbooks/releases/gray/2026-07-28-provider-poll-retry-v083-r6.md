# Provider Catalog Poll Retry v0.8.3 Gray

- release: `20260728-provider-poll-retry-v083-r6`
- version: `0.8.3`
- source commit: `d067e468758c3d46e907170aef03cae2fbf2660d`
- archive SHA-256: `FD81820DB7340376599738CB1FBF276F4CDFA5CBACBBA51B3A46899C8809CCC1`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas-next`
- previous current: `20260728-provider-poll-retry-v083-r5`
- rollback: `20260728-provider-poll-retry-v083-r5`
- retentionApplyRun: `false`

## Scope

- Keep RunningHub App/Workflow catalog submission single-shot to preserve billing/idempotency semantics.
- Retry only transient query failures within the task timeout budget and persist sanitized retry/recovery heartbeat fields.
- Keep the same behavior for standard-model polling and final output materialization.

## Verification

- Focused client test proves one submission, two queries after a 503, successful output and retry/recovery heartbeat evidence.
- Full Vitest: 192 passed files, 793 passed tests, 1 skipped file, 4 skipped tests.
- All workspace type-checks passed; release build/package gates passed.
- Gray strict runtime verification passed: current r6, API/Worker active, version/environment matched.
- No paid Provider/Agent canary, retention apply or historical release deletion ran.
