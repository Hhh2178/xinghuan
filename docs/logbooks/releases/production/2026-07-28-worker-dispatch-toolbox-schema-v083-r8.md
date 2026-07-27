# Worker Dispatch and Toolbox Schema v0.8.3 Production

- release: `20260728-worker-dispatch-toolbox-schema-v083-r8`
- version: `0.8.3`
- source commit: `33550541d50b524ded943cade3d82e05fb9f5b5b`
- archive SHA-256: `E844E0FF55403F72DCC7A98A09A66EC5938787965E0A71C84D4C872A7541D612`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas`
- previous current: `20260728-canvas-visibility-pose-schema-v083-r7`
- rollback: `20260728-canvas-visibility-pose-schema-v083-r7`
- retentionApplyRun: `false`

## Scope

- Promote the operation dispatch seam and ToolboxParam schema extraction with unchanged Provider submission and persisted option contracts.
- Carry forward r7 visibility evaluation, PoseMaster schema extraction, provider poll retry and materialization stability.

## Verification

- Full Vitest: 196 passed files, 801 passed tests, 1 skipped file, 4 skipped tests; all workspace type-checks passed.
- Release prepare, build, package and governance gates passed for 0.8.3.
- Production strict runtime verification passed: current r8, API/Worker active, version/environment matched on internal and public status endpoints.
- No paid Provider/Agent canary, retention apply or historical release deletion ran.
