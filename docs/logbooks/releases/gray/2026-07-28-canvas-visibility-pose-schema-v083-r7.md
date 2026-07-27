# Canvas Visibility Evaluation and Pose Schema v0.8.3 Gray

- release: `20260728-canvas-visibility-pose-schema-v083-r7`
- version: `0.8.3`
- source commit: `602288e00b85b5f5ed85e5ad25ae9dc2461f78d5`
- archive SHA-256: `DDC4BC055CE1E9092E394785D1338F7442B5AEF315109B901835F6AA1EBF55B7`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas-next`
- previous current: `20260728-provider-poll-retry-v083-r6`
- rollback: `20260728-provider-poll-retry-v083-r6`
- retentionApplyRun: `false`

## Scope

- Record the large-canvas visibility evaluation and keep renderer-level virtualization disabled until grouped offscreen DOM, selection, cross-viewport edges, fit-view and runtime projection have real renderer evidence.
- Extract PoseMaster persisted field schema and option catalogs without changing persisted IDs, ordering or runtime behavior.
- Carry forward r6 provider catalog polling retry and recovery-heartbeat hardening.

## Verification

- Focused visibility and PoseMaster schema tests passed; all workspace type-checks passed.
- Full Vitest: 194 passed files, 797 passed tests, 1 skipped file, 4 skipped tests.
- Independent local Chrome/CDP Canvas smoke passed: 56/56 nodes rendered, 0 missing IDs, 0 class mismatches, 0 runtime errors and 0 network failures; no login or error boundary remained visible.
- Release prepare, build, package and governance gates passed for 0.8.3.
- Gray strict runtime verification passed: current r7, API/Worker active, version/environment matched on internal and public status endpoints.
- No paid Provider/Agent canary, retention apply or historical release deletion ran.
