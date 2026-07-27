# Image Result Aggregation Seam v0.8.3 Gray

- release: `20260728-image-result-aggregation-v083-r13`
- version: `0.8.3`
- source commit: `9bcb4fa42a5aa782a8684bb8be0b4b8cb43fd1bd`
- archive SHA-256: `E1C806BD0D611C8B84F3E6F78C1CDA0D62C9F3AB2E8ACECBA24438C1355D619E`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas-next`
- previous current: `20260728-error-recovery-css-v083-r12`
- rollback: `20260728-error-recovery-css-v083-r12`
- retentionApplyRun: `false`

## Scope

- Extract ImageNode concurrent Provider result aggregation into a tested pure runtime seam.
- Preserve output order, deduplicate readable/remote URLs and task IDs, and retain the latest task ID for recovery/cancellation.
- Carry forward r12 error-recovery CSS, r11 DrawingBoard persistence, r10 API model-import normalization and all prior 0.8.3 generation delivery gates.

## Verification

- Focused image-node-runtime tests and full CI passed with 203 test files, 812 passed and 4 skipped.
- Release prepare, build, package and governance gates passed for 0.8.3.
- Gray strict runtime verification passed: current r13, API/Worker active, internal and public status matched version/environment, permission mode enforced and readiness true.
- No paid Provider/Agent canary, retention apply or historical release deletion ran.
