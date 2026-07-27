# Canvas Shell CSS Boundary v0.8.3 Production

- release: `20260728-canvas-shell-css-v083-r14`
- version: `0.8.3`
- source commit: `5c56dc01fb84310cd280fd0043806c80df6e395b`
- archive SHA-256: `B2A02DAB368FD013046BB749AA13880B9FB7113E66A100317BD7FED1A1865733`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas`
- previous current: `20260728-image-result-aggregation-v083-r13`
- rollback: `20260728-image-result-aggregation-v083-r13`
- retentionApplyRun: `false`

## Scope

- Promote the tested Canvas shell CSS boundary with unchanged generation, recovery, cancellation and persisted task behavior.
- Carry forward r13 ImageNode result aggregation, r12 error-recovery CSS, r11 DrawingBoard persistence, r10 API model-import normalization and all prior 0.8.3 delivery gates.

## Verification

- Full CI passed with 204 test files, 813 passed and 4 skipped; Web/Admin builds, type-checks and Canvas assistant UI contract passed.
- Production strict runtime verification passed: current r14, API/Worker active, internal and public status matched version/environment, permission mode enforced and readiness true.
- Gray and Production used the same source commit and archive SHA-256.
- No paid Provider/Agent canary, retention apply or historical release deletion ran.
