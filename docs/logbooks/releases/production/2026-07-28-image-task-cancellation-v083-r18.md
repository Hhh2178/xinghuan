# Image Task Cancellation Compatibility v0.8.3 Production

- release: `20260728-image-task-cancellation-v083-r18`
- version: `0.8.3`
- source commit: `565c1f20bb75be00a89b518cfa8ec4611d8bbf49`
- archive SHA-256: `3153FB017AB3E9BC1344CE8741F13A666D15C0F0AA1FDFB498D24F3A52817DA2`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas`
- previous current: `20260728-pose-output-runtime-v083-r17`
- rollback: `20260728-pose-output-runtime-v083-r17`
- retentionApplyRun: `false`

## Scope

- Promote the ImageNode cancellation task-ID collection seam from the accepted Gray archive to old-server Production.
- Preserve the r17 output runtime and all prior recovery, persistence, ReactFlow stacking and provider delivery hardening.

## Verification

- Full CI passed with 208 test files, 818 passed and 4 skipped.
- Production strict runtime verification passed: current r18, API/Worker active, internal and public status matched version/environment, permission mode enforced and readiness true.
- The same source commit and archive SHA-256 were used for Gray and Production.
- No retention apply or historical release deletion ran.
