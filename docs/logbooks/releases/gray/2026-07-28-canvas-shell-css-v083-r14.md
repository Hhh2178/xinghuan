# Canvas Shell CSS Boundary v0.8.3 Gray

- release: `20260728-canvas-shell-css-v083-r14`
- version: `0.8.3`
- source commit: `5c56dc01fb84310cd280fd0043806c80df6e395b`
- archive SHA-256: `B2A02DAB368FD013046BB749AA13880B9FB7113E66A100317BD7FED1A1865733`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas-next`
- previous current: `20260728-image-result-aggregation-v083-r13`
- rollback: `20260728-image-result-aggregation-v083-r13`
- retentionApplyRun: `false`

## Scope

- Move the initial Canvas shell background, stacking and ReactFlow boundary into an explicit `canvas-shell.css` seam with a focused selector contract.
- Preserve the r13 ImageNode result aggregation, r12 error-recovery CSS, r11 DrawingBoard persistence, r10 API model-import normalization and all prior generation-delivery gates.

## Verification

- Full CI passed with 204 test files, 813 passed and 4 skipped; Web/Admin builds, type-checks and Canvas assistant UI contract passed.
- Release prepare, build, package and governance gates passed for 0.8.3.
- Gray strict runtime verification passed: current r14, API/Worker active, internal and public status matched version/environment, permission mode enforced and readiness true.
- No paid Provider/Agent canary, retention apply or historical release deletion ran.
