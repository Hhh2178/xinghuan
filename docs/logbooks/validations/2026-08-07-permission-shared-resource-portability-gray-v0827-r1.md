# 权限与公共资源可迁移性 Gray 验证 v0.8.27

- target: old-server Gray
- release: `20260807-permission-shared-resource-portability-v0827-r1`
- runtime: API/Worker active; internal and public status are `0.8.27 / gray / enforced`.
- permission readiness: `ready=true`, subjects `139`, rules `1195`, principals `5`, failures `0`.
- account probe: `zezhenhuiling01@xinghuan.local` logged in successfully; `/api/me/permissions` returned `200`, node resolution `ready`, denied node count `0`.
- shared resource probe: `/api/shared-resources/items` returned `200` with one visible Gray item and zero private `/files/input` or `/files/output` references.
- public asset migration gate: `readyForMigration=true`, total items `1`, missing `0`; the current Gray item is a non-local workflow/reference item, so no binary content route was required.
- local regression coverage: permission degraded-mode behavior, stable public content URLs, cross-user legacy asset serving, legacy asset materialization, and missing-file failure all passed.
- migration contract: six checks passed; public indexes/assets and user inputs are preserved while generated outputs and output archives are excluded.
- retention: dry-run and apply completed; five releases remain and current/rollback are protected.
- not executed: Production deployment, new-server deployment, production data migration, and visual acceptance.
