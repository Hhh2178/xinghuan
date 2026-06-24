# Api Worker Canvas Hotspot Decomposition Gray Release - 2026-06-24

## 发布目标

- 将 API / Worker / Canvas 三个高频热点入口继续从“大文件止血”推进到“真实职责下沉”。
- 把 `apps/worker/src/worker.ts` 的 media polling 与 deferred requeue 继续下沉到独立模块。
- 把 `apps/api/src/server.ts` 的后台 provider / assistant settings 路由分发层继续下沉到独立模块。
- 把 `apps/web/src/components/Canvas.tsx` 的发送流、选择菜单与批量重连交互 seam 下沉到可复用 hook。
- 以新版本 `v0.4.17` 完成一轮 gray 放行，为后续继续拆 `worker diagnostics / cancel sync / canvas sections / api system settings` 留出安全余量。

## 发布信息

- 环境：`gray`
- 版本：`v0.4.17`
- release：`20260624-api-worker-canvas-hotspot-decomposition-gray-r1-v0417`
- 上一灰度 release：`20260624-api-settings-decomposition-gray-r1-v0416`

## Agent 已验证

### 本地代码与 contract

- `npm run verify:worker-media-polling-split-contract`
- `npm run verify:worker-deferred-requeue-split-contract`
- `npm run type-check -w @xinghuan/worker`
- `npm run build -w @xinghuan/worker`
- `npm run verify:api-admin-provider-route-split-contract`
- `npm run verify:api-admin-assistant-settings-route-split-contract`
- `npm run type-check -w @xinghuan/api`
- `npm run build -w @xinghuan/api`
- `npm run verify:canvas-send-flow-split-contract`
- `npm run verify:canvas-interaction-seam-contract`
- `npm run type-check -w @xinghuan/web`
- `npm run build -w @xinghuan/web`
- `npm run verify:engineering-governance-contract`
- `npm run verify:file-hotspot-budgets`
- `npm run verify:hotspot-watchlist-contract`
- `node scripts/pre-commit-governance.mjs`
- `codegraph sync`

### 结构收口结果

- `apps/worker/src/worker.ts`
  - 当前主文件聚焦：任务主循环、运行态 glue、provider 调度编排
  - 本轮下沉到：
    - `apps/worker/src/worker-media-polling.ts`
    - `apps/worker/src/worker-deferred-requeue.ts`
- `apps/api/src/server.ts`
  - 当前主文件聚焦：应用启动、核心路由装配、少量剩余热点 handler
  - 本轮下沉到：
    - `apps/api/src/admin-provider-routes.ts`
    - `apps/api/src/admin-assistant-settings-routes.ts`
- `apps/web/src/components/Canvas.tsx`
  - 当前主文件聚焦：画布容器、节点编排、主要布局壳层
  - 本轮下沉到：
    - `apps/web/src/components/canvas/useCanvasSendFlow.ts`
    - `apps/web/src/components/canvas/useCanvasSelectionMenus.ts`
    - `apps/web/src/components/canvas/useCanvasBulkReconnect.ts`

## 本次实际放行证据

- prepare：
  - `npm run release:gray:prepare:runninghub -- --release=20260624-api-worker-canvas-hotspot-decomposition-gray-r1-v0417`
  - 归档包：`D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b\dist-release\20260624-api-worker-canvas-hotspot-decomposition-gray-r1-v0417.tar.gz`
  - 包大小：`5.39 MB`
  - 临时 staging：`C:\Users\Administrator\AppData\Local\Temp\xinghuan-release-lvEdEA`
- deploy：
  - `npm run release:gray:deploy -- --release=20260624-api-worker-canvas-hotspot-decomposition-gray-r1-v0417 --archive="D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b\dist-release\20260624-api-worker-canvas-hotspot-decomposition-gray-r1-v0417.tar.gz" --ssh-key="D:\codex\服务器\Tencent_Cloud_Server.pem"`
- verify：
  - `npm run release:gray:verify -- --ssh-key="D:\codex\服务器\Tencent_Cloud_Server.pem" --expected-version=0.4.17 --expected-environment=gray`
- 远端 current release：
  - `/opt/apps/xinghuan-canvas-next/releases/20260624-api-worker-canvas-hotspot-decomposition-gray-r1-v0417`
- 远端服务状态：
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
- 远端状态接口：
  - `https://canvas-next.hhh2121.xyz/api/status`
  - `http://127.0.0.1:18200/api/status`
  - 两者均返回：
    - `version = 0.4.17`
    - `environment = gray`
    - `dataDir = /opt/apps/xinghuan-canvas-next/shared/data`

## 本轮额外说明

- 第一次 gray prepare 不是构建失败，而是 release preset 里的两条 RH 契约脚本还在盯拆分前的文件边界：
  - `scripts/verify-runninghub-draft-and-summary-contract.mjs`
  - `scripts/verify-runninghub-output-reset-contract.mjs`
- 已将两条契约同步到拆分后的真实落点，并单独提交：
  - `3a5c1c6` `test: align runninghub release contracts after node split`
- 当前结论：这次阻塞来自校验脚本漂移，不是 RunningHub 业务链路回退。

## 待用户验收

### 视觉验收

- 画布与后台页面的视觉层、布局细节和交互观感继续由用户实机检查，不由 Agent 代替。

### 真实业务链路

- Canvas 发送链路、后台设置页操作体验、真实 RunningHub 任务链路与多任务切换体验由用户复核。

## 风险与残留问题

- 这只是 API / Worker / Canvas 热点的又一层真实下沉，不代表三个主文件已经完全健康。
- 下一步优先仍是：
  - `worker diagnostics / cancel sync`
  - `api system settings / queue settings / public proxy handlers`
  - `canvas sections / detail panes / runtime slices`

## 回滚信息

- `current` 回滚目标：
  - `/opt/apps/xinghuan-canvas-next/releases/20260624-api-settings-decomposition-gray-r1-v0416`
- 需要重启的服务：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
- 回滚后需复查的接口：
  - `/api/status`
  - `/api/admin/providers`
  - `/api/admin/assistant/settings`
  - `/api/proxy/runninghub/task/:id`
