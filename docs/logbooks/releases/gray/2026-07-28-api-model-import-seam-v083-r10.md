# API Model Import Seam v0.8.3 Gray

- release: `20260728-api-model-import-seam-v083-r10`
- version: `0.8.3`
- source commit: `693baac4b8234da82fdc4fa73e5e5d4bc57ee9c0`
- archive SHA-256: `E810006EA1129B4C81CF3E249B83919292B1F5108936ACE2348E374190A66079`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas-next`
- previous current: `20260728-toolbox-hotspot-seams-v083-r9`
- rollback: `20260728-toolbox-hotspot-seams-v083-r9`
- retentionApplyRun: `false`

## Scope

- Extract Provider model import merge/default normalization into `provider-model-import.ts`.
- Preserve stable model identity, input profile, parameter schema, advanced config and creation time on updates.
- Keep route authentication, persistence, audit and HTTP response assembly in `server.ts`.
- Carry forward r9 ToolboxParam seams and the 0.8.3 generation delivery, materialization, retry, Worker dispatch and Agent readiness gates.

## Verification

- Focused provider-model-import tests passed; full CI passed with 200 test files, 807 passed and 4 skipped.
- Release prepare, build, package and governance gates passed for 0.8.3.
- Gray strict runtime verification passed: current r10, API/Worker active, internal and public status matched version/environment, permission mode enforced and readiness true.
- No paid Provider/Agent canary, retention apply or historical release deletion ran.
