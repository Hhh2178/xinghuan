# Admin Route Shell CSS Boundary v0.8.3 Production

- release: `20260728-admin-route-shell-v083-r16`
- version: `0.8.3`
- source commit: `d92ed239c653f7e068ab4848148617d4f7d4524f`
- archive SHA-256: `CC30DCC97A50AD9214FB4A248807129ED944F7E07E6DA058CBB40242032CC97A`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas`
- previous current: `20260728-node-chrome-css-v083-r15`
- rollback: `20260728-node-chrome-css-v083-r15`
- retentionApplyRun: `false`

## Scope

- Promote the tested Admin route-shell CSS boundary with unchanged generation, recovery, cancellation and persisted task behavior.
- Carry forward r15 node chrome, r14 Canvas shell, r13 ImageNode aggregation, r12 error-recovery CSS, r11 DrawingBoard persistence, r10 API normalization and all prior delivery gates.

## Verification

- Full CI passed with 206 test files, 815 passed and 4 skipped; Web/Admin builds, type-checks and Canvas assistant UI contract passed.
- Production strict runtime verification passed: current r16, API/Worker active, internal and public status matched version/environment, permission mode enforced and readiness true.
- Gray and Production used the same source commit and archive SHA-256.
- No paid Provider/Agent canary, retention apply or historical release deletion ran.
