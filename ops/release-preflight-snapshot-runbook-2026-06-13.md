# 发布前快照与回滚基线 Runbook（2026-06-13）

## 目标

- 在灰度放行或正式放行前，先生成一份标准化快照。
- 把“当前 release 指针、数据库目标、核心数据量、服务状态、状态接口”固定成统一证据。
- 为后续回滚判断提供最小必需基线。

## 标准脚本

- 脚本：`scripts/capture-release-preflight.mjs`
- package 入口：`npm run verify:release-preflight`

## 采集内容

- `GET /api/status`
- 当前环境标签
- 当前 release 软链接目标
- API / Worker 服务状态
- 当前数据库名
- 核心表计数：
  - `xh_users`
  - `xh_canvases`
  - `xh_assets`
  - `xh_tasks`
  - `xh_sessions`

## 灰度执行示例

```bash
cd /opt/apps/xinghuan-canvas-next/current
set -a
source /opt/apps/xinghuan-canvas-next/shared/canvas-next.env
set +a
export XINGHUAN_VERIFY_BASE_URL=https://canvas-next.hhh2121.xyz
export XINGHUAN_ENV_LABEL=gray
export XINGHUAN_RELEASE_CURRENT_LINK=/opt/apps/xinghuan-canvas-next/current
export XINGHUAN_API_SERVICE_NAME=xinghuan-canvas-next.service
export XINGHUAN_WORKER_SERVICE_NAME=xinghuan-canvas-next-worker.service
npm run verify:release-preflight
```

## 生产执行示例

```bash
cd /opt/apps/xinghuan-canvas/current
set -a
source /opt/apps/xinghuan-canvas/shared/canvas.env
set +a
export XINGHUAN_VERIFY_BASE_URL=https://canvas.hhh2121.xyz
export XINGHUAN_ENV_LABEL=production
export XINGHUAN_RELEASE_CURRENT_LINK=/opt/apps/xinghuan-canvas/current
export XINGHUAN_API_SERVICE_NAME=xinghuan-canvas.service
export XINGHUAN_WORKER_SERVICE_NAME=xinghuan-canvas-worker.service
npm run verify:release-preflight
```

## 放行前要求

- 快照必须先于正式切换生成。
- 快照结果要写入本次发布记录。
- 若快照中的数据库名、release 指针、服务状态与预期不一致，禁止继续放行。
- 若上线后出现用户数据异常，先对比“上线前快照”和“异常后快照”再决定是否回滚。

## 当前建议

- 灰度和正式都把这份快照作为每次发版的固定前置步骤。
- 后续可以继续把快照结果自动落盘到 `ops/` 或服务器 release 目录下的 `acceptance/` 子目录。
