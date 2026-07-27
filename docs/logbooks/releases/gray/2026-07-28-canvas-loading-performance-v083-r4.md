# Canvas Loading Performance v0.8.3 Gray

- release: `20260728-canvas-loading-performance-v083-r4`
- version: `0.8.3`
- source commit: `7d64fd3fd848b9ea67da99e23f6c02d639d828c8`
- archive SHA-256: `6168E8EF569D5969F8C95513F09DE2CD0040A0EEA3417518D7DEB59ED3C29852`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas-next`
- previous current: `20260728-generation-materialization-stability-v083-r3`
- rollback: `20260728-generation-materialization-stability-v083-r3`
- retentionApplyRun: `false`

## Scope

- Move Workspace preload behind authentication and idle scheduling.
- Add deterministic 0/50/100/200-node browser measurements and a repeatable performance budget gate.
- Batch rapid node data patches per animation frame while preserving offscreen canvas ownership and untouched node identity.

## Verification

- Full Vitest: 191 passed files, 791 passed tests, 1 skipped file, 4 skipped tests.
- Single-port build, Web type-check, lazy-import recovery, hotspot and release package gates passed.
- Gray deploy and strict runtime verification passed: current r4, API and Worker active, version/environment matched.
- Gray browser node smoke was deliberately skipped because the configured local verification credentials were rejected; no fixture canvas was created and no Provider was called.
- No retention command or historical release deletion ran; no paid Provider or Agent canary ran.
