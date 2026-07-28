# Image Task Cancellation Compatibility v0.8.3 Gray

- release: `20260728-image-task-cancellation-v083-r18`
- version: `0.8.3`
- source commit: `565c1f20bb75be00a89b518cfa8ec4611d8bbf49`
- archive SHA-256: `3153FB017AB3E9BC1344CE8741F13A666D15C0F0AA1FDFB498D24F3A52817DA2`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas-next`
- previous current: `20260728-pose-output-runtime-v083-r17`
- rollback: `20260728-pose-output-runtime-v083-r17`
- retentionApplyRun: `false`

## Scope

- Make ImageNode cancellation collect the current, persisted and resumable task IDs through one deduplicated seam, so concurrent Provider returns cannot leave known tasks running or falsely terminate a task.
- Carry forward r17 PoseMaster output runtime and prior Canvas shell, node chrome, persistence, recovery and delivery hardening.

## Verification

- Full CI passed with 208 test files, 818 passed and 4 skipped; Web/Admin builds and type-checks passed.
- Release prepare, build, package and governance gates passed for 0.8.3.
- Gray strict runtime verification passed: current r18, API/Worker active, internal and public status matched version/environment, permission mode enforced and readiness true.
- Production strict runtime verification passed: current r18, API/Worker active, internal and public status matched version/environment, permission mode enforced and readiness true.
- Gray and Production use the same archive SHA-256 `3153FB017AB3E9BC1344CE8741F13A666D15C0F0AA1FDFB498D24F3A52817DA2`.
- No retention apply or historical release deletion ran.
