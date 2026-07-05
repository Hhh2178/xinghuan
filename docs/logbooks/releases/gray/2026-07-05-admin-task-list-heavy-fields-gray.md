# 2026-07-05 Admin Task List Heavy Fields Gray Release

## 发布目标

- 将灰度 `GET /api/admin/tasks` 列表响应收口为轻量摘要。
- 列表项不再返回 `payload`、`result`、`logs` 三类重字段。
- 保留分页、状态过滤、能力过滤和任务详情/创建/重试/更新路径的完整记录能力。
- 继续保持 ComfyUI 功能冻结；本 release 不新增 ComfyUI 能力。

## 发布信息

- 环境：`gray`
- 版本：`v0.5.25`
- release：`20260705-admin-task-list-heavy-fields-gray-r1-v0525`
- 上一灰度 release：`20260704-comfyui-machine-first-gray-r1-v0525`
- 发布分支：`xinghuan-integration-clean`
- 关键代码 commit：`f9d7fff`
- 发布前 gate 修复：
  - `36b5e89` 修复 `AGENTS.md` 截断导致的工程治理 gate 失败。
  - `74c7f06` 恢复 `AGENTS.md` 当前 gray/production release 状态，避免入口状态漂移。

## Agent 已验证

### 本地代码与产物

- 已通过：
  - `npm run type-check -w @xinghuan/api`
  - `npx vitest run apps/api/src/admin-task-list-routes.test.ts apps/api/src/auth-repository.test.ts`
  - `npm run verify:file-hotspot-budgets`
  - `npm run ci`
  - `npm run release:gray:prepare -- --release=20260705-admin-task-list-heavy-fields-gray-r1-v0525 --verify="npx vitest run apps/api/src/admin-task-list-routes.test.ts"`
- gray 发布包：
  - `dist-release/20260705-admin-task-list-heavy-fields-gray-r1-v0525.tar.gz`
  - size：约 `1.56 MB`

### 远端部署与运行态

- 已执行：
  - `npm run release:gray:deploy -- --release=20260705-admin-task-list-heavy-fields-gray-r1-v0525 --archive=dist-release/20260705-admin-task-list-heavy-fields-gray-r1-v0525.tar.gz --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem`
  - `npm run release:gray:verify -- --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem --expected-version=0.5.25 --expected-environment=gray`
- 远端 current 指针：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260705-admin-task-list-heavy-fields-gray-r1-v0525`
- 服务状态：
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
- 运行态验证：
  - `https://canvas-next.hhh2121.xyz/api/status => version 0.5.25, environment gray`
  - `http://127.0.0.1:18200/api/status => version 0.5.25, environment gray`
- B2 live 验证：
  - 在服务器 release 目录加载 `/opt/apps/xinghuan-canvas-next/shared/canvas-next.env` 后执行：
    - `XINGHUAN_VERIFY_BASE_URL=http://127.0.0.1:18200 node scripts/verify-admin-task-pagination.mjs`
  - 结果：
    - page1 size <= 5
    - page2 page = 2
    - status filter passed
    - capability filter passed
    - task list rows did not leak `payload/result/logs`

## 风险与残留问题

- 本轮只修复 admin task list 响应体和灰度发布 gate，不推进 ComfyUI 功能。
- `task-repository.ts` 仍属于 E1 repository-boundary 后续批次，不在本 release 中迁移。
- B3 Postgres pool tuning、E1 剩余 repository boundary、F1 task realtime decision 仍在主计划中排队。
- Web/Admin build 仍有既有 chunk size warning；本轮未触碰前端 bundle 结构。

## 回滚信息

- 回滚目标：
  - `/opt/apps/xinghuan-canvas-next/releases/20260704-comfyui-machine-first-gray-r1-v0525`
- 需要重启：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
- 回滚后复查：
  - `https://canvas-next.hhh2121.xyz/api/status`
  - `http://127.0.0.1:18200/api/status`
