# Canvas Visibility Evaluation and Pose Schema v0.8.3 Production

- release: `20260728-canvas-visibility-pose-schema-v083-r7`
- version: `0.8.3`
- source commit: `602288e00b85b5f5ed85e5ad25ae9dc2461f78d5`
- archive SHA-256: `DDC4BC055CE1E9092E394785D1338F7442B5AEF315109B901835F6AA1EBF55B7`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas`
- previous current: `20260728-provider-poll-retry-v083-r6`
- rollback: `20260728-provider-poll-retry-v083-r6`
- retentionApplyRun: `false`

## Scope

- Promote the visibility evaluation record and PoseMaster persisted field-schema extraction with no persisted option-ID or runtime contract changes.
- Carry forward r6 provider polling retry and recovery-heartbeat hardening.

## Verification

- Full Vitest: 194 passed files, 797 passed tests, 1 skipped file, 4 skipped tests; all workspace type-checks passed.
- Release prepare, build, package and governance gates passed for 0.8.3.
- Production strict runtime verification passed: current r7, API/Worker active, version/environment matched on internal and public status endpoints.
- Independent local Chrome/CDP Canvas smoke passed with 56 rendered nodes and no runtime or network failures.
- No paid Provider/Agent canary, retention apply or historical release deletion ran.
