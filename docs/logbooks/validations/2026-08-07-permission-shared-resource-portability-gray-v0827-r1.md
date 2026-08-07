# 权限与公共资源可迁移性 Gray 验证 v0.8.27

- targets: old-server Gray and new-server Gray
- release: `20260807-permission-shared-resource-portability-v0827-r1`
- runtime: API/Worker active on both targets; internal status is `0.8.27 / gray / enforced`. Old-server public status is healthy; new-server public HTTPS is healthy with direct `--resolve` to `43.131.246.222`, while normal DNS remains `ENOTFOUND`.
- permission readiness: `ready=true`, subjects `139`, rules `1195`, principals `5`, failures `0` on both Gray databases.
- account probe: `zezhenhuiling01@xinghuan.local` logged in successfully on both targets; `/api/me/permissions` returned `200`, node resolution `ready`, denied node count `0`.
- shared resource probe: old-server `/api/shared-resources/items` returned `200` with one visible item and zero private `/files/input` or `/files/output` references; new-server returned `200` with zero items because business data has not been migrated.
- public asset migration gate: old-server `readyForMigration=true`, total items `1`, missing `0`; new-server `readyForMigration=true`, total items `0`, missing `0`. The current Gray item is a non-local workflow/reference item, so no binary content route was required.
- local regression coverage: permission degraded-mode behavior, stable public content URLs, cross-user legacy asset serving, legacy asset materialization, and missing-file failure all passed.
- migration contract: six checks passed; public indexes/assets and user inputs are preserved while generated outputs and output archives are excluded.
- retention: dry-run and apply completed on both targets; five releases remain on each and current/rollback are protected.
- not executed: Production deployment, production data migration, and visual acceptance.
