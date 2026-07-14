# 2026-07-14 Task List Lightweight Production Release

## 发布目标

- 将 `20260706-task-list-lightweight-gray-r1-v0527` 灰度已验证批次晋级到 production。
- 让 production 运行态与 gray 对齐到 `v0.5.27`。
- 将 clean repository boundary wave 与 task list repository lightweight repair 正式放量。

## 发布信息

- 环境：`production`
- 域名：`canvas.hhh2121.xyz`
- 端口：`127.0.0.1:18100`
- 版本：`v0.5.27`
- release：`20260714-task-list-lightweight-prod-r1-v0527`
- 上一 production release：`20260702-envsync-admin-sections-prod-r1-v0522`
- 来源 gray release：`20260706-task-list-lightweight-gray-r1-v0527`
- 发布分支：`xinghuan-integration-clean`
- 复用发布包：`dist-release/20260706-task-list-lightweight-gray-r1-v0527.tar.gz`
- 关键代码 commits：
  - `66f9a99` - task repository list summaries strip heavy fields at repository boundary
  - `0213987` - bump gray repair version to `v0.5.27`

## Agent 已验证

### 晋级前提

- 已复核灰度发布记录：
  - `../gray/2026-07-06-task-list-lightweight-gray.md`
- 已确认灰度运行态：
  - `https://canvas-next.hhh2121.xyz/api/status => version 0.5.27, environment gray`
- 已确认 production 晋级前运行态：
  - `https://canvas.hhh2121.xyz/api/status => version 0.5.22, environment production`

### 远端部署与运行态

- 已执行：
  - `npm run release:gray:deploy -- --release=20260714-task-list-lightweight-prod-r1-v0527 --archive=dist-release/20260706-task-list-lightweight-gray-r1-v0527.tar.gz --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem --remote-root=/opt/apps/xinghuan-canvas --shared-env-file=/opt/apps/xinghuan-canvas/shared/canvas.env --service=xinghuan-canvas.service --worker-service=xinghuan-canvas-worker.service`
  - `npm run release:gray:verify -- --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem --expected-version=0.5.27 --expected-environment=production --remote-root=/opt/apps/xinghuan-canvas --service=xinghuan-canvas.service --worker-service=xinghuan-canvas-worker.service --internal-status-url=http://127.0.0.1:18100/api/status --public-status-url=https://canvas.hhh2121.xyz/api/status`
- 远端 current 指针：
  - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260714-task-list-lightweight-prod-r1-v0527`
- 服务状态：
  - `xinghuan-canvas.service = active`
  - `xinghuan-canvas-worker.service = active`
- 运行态验证：
  - `https://canvas.hhh2121.xyz/api/status => version 0.5.27, environment production`
  - `http://127.0.0.1:18100/api/status => version 0.5.27, environment production`
- 数据目录：
  - `/opt/apps/xinghuan-canvas/shared/data`

## 影响

- Production 与 gray 当前都运行在 `v0.5.27`。
- admin task list repository summary 已在 production 仓储边界剥离 `payload`、`result`、`logs`。
- 当前主入口后续应统一以 `docs/logbooks/releases/current-release-index.md`、`ops/current/production.md` 与线上 `/api/status` 为准。

## 风险与残留问题

- 本轮是灰度验证通过后的正式晋级，不新增代码批次。
- `environment-sync-local` 抽取仍延期到专门批次。
- F1 task realtime mechanism 仍延期，后续优先 shared frontend polling。
- ComfyUI 功能开发继续冻结；本次 production 晋级不恢复该方向功能开发。

## 回滚信息

- 回滚目标：
  - `/opt/apps/xinghuan-canvas/releases/20260702-envsync-admin-sections-prod-r1-v0522`
- 需要重启：
  - `xinghuan-canvas.service`
  - `xinghuan-canvas-worker.service`
- 回滚后复查：
  - `https://canvas.hhh2121.xyz/api/status`
  - `http://127.0.0.1:18100/api/status`
