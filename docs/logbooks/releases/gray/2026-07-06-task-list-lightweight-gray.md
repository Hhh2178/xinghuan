# 2026-07-06 Task List Lightweight Gray Release

## 发布目标

- 将 clean worktree repository boundary 迁移成果推送到灰度。
- 修复 `v0.5.26` 灰度验证暴露的 admin task list repository 摘要泄漏问题。
- 确保 `GET /api/admin/tasks` 列表项在 repository 注入路径下也不会返回 `payload`、`result`、`logs`。
- 继续保持 ComfyUI 功能冻结；本 release 不新增 ComfyUI 能力。

## 发布信息

- 环境：`gray`
- 版本：`v0.5.27`
- release：`20260706-task-list-lightweight-gray-r1-v0527`
- 上一灰度 release：`20260705-repository-boundary-gray-r1-v0526`
- 发布分支：`xinghuan-integration-clean`
- 关键代码 commits：
  - `66f9a99` - task repository list summaries strip heavy fields at repository boundary
  - `0213987` - bump gray repair version to `v0.5.27`

## Agent 已验证

### 本地代码与产物

- 已通过：
  - `npx vitest run apps/api/src/task-repository.test.ts`
  - `npx vitest run apps/api/src/task-repository.test.ts apps/api/src/admin-task-list-routes.test.ts apps/api/src/task-cancellation-service.test.ts`
  - `npm run type-check -w @xinghuan/api`
  - `node scripts/verify-task-repository-boundary-contract.mjs`
  - `node scripts/verify-admin-task-records-repository-contract.mjs`
  - `npm run verify:file-hotspot-budgets`
  - `npm run build:single-port`
  - `node scripts/verify-release-version-alignment.mjs`
  - `npm run release:gray:prepare -- --release=20260706-task-list-lightweight-gray-r1-v0527 --verify="npx vitest run apps/api/src/task-repository.test.ts apps/api/src/admin-task-list-routes.test.ts" --verify="node scripts/verify-task-repository-boundary-contract.mjs" --verify="node scripts/verify-admin-task-records-repository-contract.mjs"`
- gray 发布包：
  - `dist-release/20260706-task-list-lightweight-gray-r1-v0527.tar.gz`
  - size：约 `1.6 MB`

### 远端部署与运行态

- 已执行：
  - `npm run release:gray:deploy -- --release=20260706-task-list-lightweight-gray-r1-v0527 --archive=dist-release/20260706-task-list-lightweight-gray-r1-v0527.tar.gz --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem`
  - `npm run release:gray:verify -- --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem --expected-version=0.5.27 --expected-environment=gray`
- 远端 current 指针：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260706-task-list-lightweight-gray-r1-v0527`
- 服务状态：
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
- 运行态验证：
  - `https://canvas-next.hhh2121.xyz/api/status => version 0.5.27, environment gray`
  - `http://127.0.0.1:18200/api/status => version 0.5.27, environment gray`
- 远端链路验证：
  - `set -a && . /opt/apps/xinghuan-canvas-next/shared/canvas-next.env && set +a && XINGHUAN_VERIFY_BASE_URL=http://127.0.0.1:18200 node scripts/verify-admin-task-pagination.mjs`
  - `set -a && . /opt/apps/xinghuan-canvas-next/shared/canvas-next.env && set +a && XINGHUAN_VERIFY_BASE_URL=http://127.0.0.1:18200 node scripts/verify-environment-sync-smoke.mjs`
  - `set -a && . /opt/apps/xinghuan-canvas-next/shared/canvas-next.env && set +a && node scripts/verify-auth-current-user-repository-contract.mjs && node scripts/verify-auth-login-precision-query-contract.mjs`

## 中间问题与处理

- `v0.5.26` 已部署但 live `verify:admin-task-pagination` 暴露 task list rows 仍含 `payload/result/logs`。
- 根因：任务列表 route 已有防护，但 repository 注入路径依赖外部 summarizer 清理字段；边界不够自洽。
- 修复：`task-repository.ts` 在 Postgres 与 file-backed list path 统一经过 `toSafeTaskListItem()`，即使 summarizer 返回完整 task-shaped object，也会剥离重字段。
- 验证误区：本机 `127.0.0.1:18200` 被 `wslrelay.exe` 占用，默认本地 `npm run verify:admin-task-pagination` 会命中本机/WSL 旧目标，不等同于服务器灰度。灰度放行必须在服务器 release 目录加载 `canvas-next.env` 后执行远端 verifier，或显式指定正确公网/隧道目标。

## 风险与残留问题

- 本轮只修复 task list repository 摘要安全边界并发布 clean repository wave 到 gray，不推进 ComfyUI 功能。
- `environment-sync-local` 抽取仍延期到专门计划。
- F1 task realtime mechanism 仍延期，后续优先 shared frontend polling。
- Web/Admin build 仍有既有 chunk size warning；本轮未触碰前端 bundle 结构。

## 回滚信息

- 回滚目标：
  - `/opt/apps/xinghuan-canvas-next/releases/20260705-repository-boundary-gray-r1-v0526`
- 需要重启：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
- 回滚后复查：
  - `https://canvas-next.hhh2121.xyz/api/status`
  - `http://127.0.0.1:18200/api/status`
