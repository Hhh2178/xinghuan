# DrawingBoard Persistence Seam v0.8.3 Production

- release: `20260728-drawing-board-persistence-v083-r11`
- version: `0.8.3`
- source commit: `36d9205b15485658392d52d3da7f8d6f20b65494`
- archive SHA-256: `25DB58B9797D6466BF5EF1228359E8E8FE95CFF52C3A46FD6F5A8CFB94FAC808`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas`
- previous current: `20260728-api-model-import-seam-v083-r10`
- rollback: `20260728-api-model-import-seam-v083-r10`
- retentionApplyRun: `false`

## Scope

- Promote the tested DrawingBoard persistence boundary with unchanged node field names and runtime actions.
- Carry forward r10 API model-import normalization and all prior 0.8.3 generation delivery, materialization, retry, Worker dispatch and Agent readiness gates.

## Verification

- Focused DrawingBoard persistence tests and full CI passed with 201 test files, 809 passed and 4 skipped.
- Production strict runtime verification passed: current r11, API/Worker active, internal and public status matched version/environment, permission mode enforced and readiness true.
- Gray and Production used the same source commit and archive SHA-256.
- No paid Provider/Agent canary, retention apply or historical release deletion ran.
