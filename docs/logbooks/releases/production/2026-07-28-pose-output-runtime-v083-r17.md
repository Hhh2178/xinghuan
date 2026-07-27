# PoseMaster Output Runtime Seam v0.8.3 Production

- release: `20260728-pose-output-runtime-v083-r17`
- version: `0.8.3`
- source commit: `6793f08b0bc5203d0a5cb1b8d72fb32e3a63387b`
- archive SHA-256: `8C4B3266D065543A91BB4D3BD0A81CCF34DC4393D5407AA2F5899C5CB0E0181F`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas`
- previous current: `20260728-admin-route-shell-v083-r16`
- rollback: `20260728-admin-route-shell-v083-r16`
- retentionApplyRun: `false`

## Scope

- Promote the tested PoseMaster output runtime seam with unchanged generation, recovery, cancellation and persisted task behavior.
- Carry forward r16 Admin route-shell, r15 node chrome, r14 Canvas shell, r13 ImageNode aggregation, r12 error-recovery CSS, r11 DrawingBoard persistence, r10 API normalization and all prior delivery gates.

## Verification

- Full CI passed with 207 test files, 817 passed and 4 skipped; Web/Admin builds and type-checks passed.
- Production strict runtime verification passed: current r17, API/Worker active, internal and public status matched version/environment, permission mode enforced and readiness true.
- Gray and Production used the same source commit and archive SHA-256.
- No paid Provider/Agent canary, retention apply or historical release deletion ran.
