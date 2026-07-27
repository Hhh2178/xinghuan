# Error Recovery CSS Boundary v0.8.3 Gray

- release: `20260728-error-recovery-css-v083-r12`
- version: `0.8.3`
- source commit: `e15678e48b1ac9716af09d92b06c1f1b4489889e`
- archive SHA-256: `6CB3C2A940EFF173BE517124D7381B5A6A47F1EAA883900B037D36CA8CC2C264`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas-next`
- previous current: `20260728-drawing-board-persistence-v083-r11`
- rollback: `20260728-drawing-board-persistence-v083-r11`
- retentionApplyRun: `false`

## Scope

- Move workspace/node crash-recovery styles into `error-recovery.css` with an explicit entry import and narrow selector namespace.
- Keep error-boundary recovery controls and cascade order unchanged.
- Carry forward r11 DrawingBoard persistence, r10 API model-import normalization and all prior 0.8.3 generation delivery, materialization, retry, Worker dispatch and Agent readiness gates.

## Verification

- Focused error-recovery CSS contract passed; Web type-check/build and full CI passed with 202 test files, 810 passed and 4 skipped.
- Release prepare, build, package and governance gates passed for 0.8.3.
- Gray strict runtime verification passed: current r12, API/Worker active, internal and public status matched version/environment, permission mode enforced and readiness true.
- `verify:xinghuan-entry-ui` retains six pre-existing copy/stellar-layout failures; no new failure is attributable to this CSS boundary. No paid Provider/Agent canary, retention apply or historical release deletion ran.
