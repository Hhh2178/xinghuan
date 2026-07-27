# Canvas Loading Performance v0.8.3 Production

- release: `20260728-canvas-loading-performance-v083-r4`
- version: `0.8.3`
- source commit: `7d64fd3fd848b9ea67da99e23f6c02d639d828c8`
- archive SHA-256: `6168E8EF569D5969F8C95513F09DE2CD0040A0EEA3417518D7DEB59ED3C29852`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas`
- previous current: `20260728-generation-materialization-stability-v083-r3`
- rollback: `20260728-generation-materialization-stability-v083-r3`
- retentionApplyRun: `false`

## Result

- Promoted the same archive after Gray strict runtime verification.
- Production current points to r4; API and Worker are active; internal/public status and version/environment checks passed.
- No database migration was needed beyond the existing 46 migrations; no retention command or historical release deletion ran.
- No paid Provider or Agent canary ran.
