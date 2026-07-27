# Node Chrome CSS Boundary v0.8.3 Production

- release: `20260728-node-chrome-css-v083-r15`
- version: `0.8.3`
- source commit: `5cf6b1f3808f7fc0f30866c647b91cbbb2269b77`
- archive SHA-256: `0AC0F40DA118B79FD93FAD1BCDB81C6E7B62913943CF9C3218AEB263C97F1427`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas`
- previous current: `20260728-canvas-shell-css-v083-r14`
- rollback: `20260728-canvas-shell-css-v083-r14`
- retentionApplyRun: `false`

## Scope

- Promote the tested node chrome CSS boundary with unchanged generation, recovery, cancellation and persisted task behavior.
- Carry forward r14 Canvas shell CSS, r13 ImageNode result aggregation, r12 error-recovery CSS, r11 DrawingBoard persistence, r10 API normalization and all prior delivery gates.

## Verification

- Full CI passed with 205 test files, 814 passed and 4 skipped; Web/Admin builds, type-checks and Canvas assistant UI contract passed.
- Production strict runtime verification passed: current r15, API/Worker active, internal and public status matched version/environment, permission mode enforced and readiness true.
- Gray and Production used the same source commit and archive SHA-256.
- No paid Provider/Agent canary, retention apply or historical release deletion ran.
