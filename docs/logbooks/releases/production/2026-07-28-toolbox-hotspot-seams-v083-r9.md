# Toolbox Hotspot Seams v0.8.3 Production

- release: `20260728-toolbox-hotspot-seams-v083-r9`
- version: `0.8.3`
- source commit: `9005a6cc006856fe0040313cd354ac03f3aa1352`
- archive SHA-256: `758D7E0D5455788D9B9BD18B9D9C64B24F7FFABD91B2984DD5C3076FCAF9ACD6`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas`
- previous current: `20260728-worker-dispatch-toolbox-schema-v083-r8`
- rollback: `20260728-worker-dispatch-toolbox-schema-v083-r8`
- retentionApplyRun: `false`

## Scope

- Promote the completed ToolboxParam seams without changing persisted fields, Provider calls or Canvas runtime action ownership.
- Carry forward r8 Worker dispatch, provider retry, materialization, Canvas visibility and PoseMaster schema hardening.

## Verification

- Focused ToolboxParam tests and all workspace type-checks passed; release prepare, build, package and governance gates passed for 0.8.3.
- Production strict runtime verification passed: current r9, API/Worker active, version/environment matched on internal and public status endpoints.
- No paid Provider/Agent canary, retention apply or historical release deletion ran.
