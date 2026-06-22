# RunningHub Slot Sync Release - 2026-06-19

## Release

- version: `v0.4.0`
- gray release: `20260619-runninghub-slot-sync-gray-r1-v040-local`
- production release: `20260619-runninghub-slot-sync-prod-r1-v040-local`

## Scope

- RH 后台条目新增“从运行目标同步输入槽”
- 运行目标返回真实 `nodeInfoList` 时，可自动补齐条目的：
  - `nodeId`
  - `fieldName`
  - `fieldType`
  - `options`
- 条目保存后，画布 RH 节点按后台条目自动展开可执行参数区

## Local Verification

- `node scripts/verify-runninghub-workflow-contract.mjs`
- `npm run build -w @xinghuan/admin`
- `npm run build -w @xinghuan/web`
- `npm run build -w @xinghuan/api`
- `npm run build:single-port`

## Gray Verification

- `/api/status`
  - `version = 0.4.0`
  - `environment = gray`
- `npm run verify:release-preflight`
- `npm run verify:request-chain-observability`
- `npm run verify:system-observability`

## Production Verification

- `/api/status`
  - `version = 0.4.0`
  - `environment = production`
- `npm run verify:release-preflight`
- `npm run verify:request-chain-observability`
- `npm run verify:system-observability`

## Operational Notes

- 当前同步能力依赖 RH 运行目标能返回 `nodeInfoList`
- 如果上游运行目标本身不返回 `nodeInfoList`，后台仍需人工补录字段
- 本轮不包含 migration
- release 目录的 `db:migrate` 依赖链缺口仍存在，后续带 migration 的发布前必须单独修补
