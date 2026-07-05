# 2026-07-05 Postgres Pool Tuning Gray Release

## 发布目标

- 将 API / Worker 的 Postgres pool `max` 与 `connectionTimeoutMillis` 从硬编码改为环境变量可调。
- 保持灰度默认值不变：API `max=5`、Worker `max=3`、timeout `3000ms`。
- 继续保持 ComfyUI 功能冻结；本 release 不新增 ComfyUI 能力。

## 发布信息

- 环境：`gray`
- 版本：`v0.5.25`
- release：`20260705-postgres-pool-tuning-gray-r1-v0525`
- 上一灰度 release：`20260705-admin-task-list-heavy-fields-gray-r1-v0525`
- 发布分支：`xinghuan-integration-clean`
- 关键代码 commit：`2127368`
- 迁移完整性 gate：`8632915`

## Agent 已验证

### 本地代码与产物

- 已通过：
  - `npx vitest run packages/shared/src/postgres-pool-config.test.ts`
  - `npm run type-check -w @xinghuan/shared`
  - `npm run type-check -w @xinghuan/api`
  - `npm run type-check -w @xinghuan/worker`
  - `npm run verify:package-exports`
  - `npm run verify:file-hotspot-budgets`
  - `npm run ci`
  - `npm run codegraph:sync`
  - `npm run release:gray:prepare -- --release=20260705-postgres-pool-tuning-gray-r1-v0525 --verify="npx vitest run packages/shared/src/postgres-pool-config.test.ts" --verify="npm run type-check -w @xinghuan/api" --verify="npm run type-check -w @xinghuan/worker"`
- gray 发布包：
  - `dist-release/20260705-postgres-pool-tuning-gray-r1-v0525.tar.gz`
  - size：约 `1.56 MB`

### 远端部署与运行态

- 已执行：
  - `npm run release:gray:deploy -- --release=20260705-postgres-pool-tuning-gray-r1-v0525 --archive=dist-release/20260705-postgres-pool-tuning-gray-r1-v0525.tar.gz --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem`
  - `npm run release:gray:verify -- --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem --expected-version=0.5.25 --expected-environment=gray`
- 远端 current 指针：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260705-postgres-pool-tuning-gray-r1-v0525`
- 服务状态：
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
- 运行态验证：
  - `https://canvas-next.hhh2121.xyz/api/status => version 0.5.25, environment gray`
  - `http://127.0.0.1:18200/api/status => version 0.5.25, environment gray`
- 链路验证：
  - `XINGHUAN_VERIFY_BASE_URL=http://127.0.0.1:18200 node scripts/verify-admin-task-pagination.mjs`
  - `XINGHUAN_VERIFY_BASE_URL=http://127.0.0.1:18200 node scripts/verify-environment-sync-smoke.mjs`
  - `journalctl` 复查 API / Worker 重启后均通过 database target check。
  - Worker 日志显示验证任务可正常 received / claimed / succeeded。

## 风险与残留问题

- 本轮只发布 B3 Postgres pool tuning，不推进 ComfyUI 功能。
- 新增 env 覆盖项默认不设置，灰度运行行为保持原默认值：
  - `XINGHUAN_POSTGRES_POOL_MAX`
  - `XINGHUAN_POSTGRES_POOL_CONNECTION_TIMEOUT_MS`
  - `XINGHUAN_API_POSTGRES_POOL_MAX`
  - `XINGHUAN_API_POSTGRES_POOL_CONNECTION_TIMEOUT_MS`
  - `XINGHUAN_WORKER_POSTGRES_POOL_MAX`
  - `XINGHUAN_WORKER_POSTGRES_POOL_CONNECTION_TIMEOUT_MS`
- E1 剩余 repository boundary、F1 task realtime decision 仍在主计划中排队。
- Web/Admin build 仍有既有 chunk size warning；本轮未触碰前端 bundle 结构。

## 回滚信息

- 回滚目标：
  - `/opt/apps/xinghuan-canvas-next/releases/20260705-admin-task-list-heavy-fields-gray-r1-v0525`
- 需要重启：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
- 回滚后复查：
  - `https://canvas-next.hhh2121.xyz/api/status`
  - `http://127.0.0.1:18200/api/status`
