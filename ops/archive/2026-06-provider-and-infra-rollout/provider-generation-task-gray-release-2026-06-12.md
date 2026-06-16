# Provider 生成任务标准化灰度发布记录

日期：`2026-06-12`

灰度 release：

- `20260612-provider-task-standardization-gray-r1-aa5f499`

对应本地提交：

- `aa5f499 docs: add provider generation task rollout checklist`

上一灰度回滚点：

- `/opt/apps/xinghuan-canvas-next/releases/20260612-external-video-task-gray-r1`

## 发布目标

- 将 Provider 生成任务标准化链路推入灰度运行环境。
- 覆盖图片 / 视频 / 音频后台发布模型的统一任务化主线。
- 验证后台执行模式结构化配置和任务接口 smoke 正常。

## 本机前置验收

- `npm run build:single-port`
- `npm run verify:provider-generation-task-contract`
- `npm run verify:provider-generation-task-service`
- `npm run verify:provider-generation-worker`
- `npm run verify:provider-generation-web-task-consumption`
- `npm run verify:provider-generation-admin-contract`
- `node scripts/verify-admin-assistant-structured-analysis-contract.mjs`
- `node scripts/verify-admin-task-panel-contract.mjs`

结果：

- 全部通过

## 服务器动作

- 本机打包：
  - `npm run package:release -- 20260612-provider-task-standardization-gray-r1-aa5f499`
- 上传：
  - `/tmp/20260612-provider-task-standardization-gray-r1-aa5f499.tar.gz`
- 服务器解压：
  - `/opt/apps/xinghuan-canvas-next/releases/20260612-provider-task-standardization-gray-r1-aa5f499`
- 在 release 目录执行：
  - `npm ci`
  - `node scripts/db-migrate.mjs`
    - `applied=[]`
    - `skipped=7`
- 切换 `current`
- 重启：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`

## 灰度验收结果

- `readlink -f /opt/apps/xinghuan-canvas-next/current`
  - `/opt/apps/xinghuan-canvas-next/releases/20260612-provider-task-standardization-gray-r1-aa5f499`
- `systemctl is-active xinghuan-canvas-next.service`
  - `active`
- `systemctl is-active xinghuan-canvas-next-worker.service`
  - `active`
- `curl http://127.0.0.1:18200/api/status`
  - `environment=gray`
- 公网入口：
  - `https://canvas-next.hhh2121.xyz/` => `200 text/html`
  - `https://canvas-next.hhh2121.xyz/admin` => `200 text/html`
  - `https://canvas-next.hhh2121.xyz/api/status` => `200 application/json`
- 未登录任务接口：
  - `POST /api/proxy/external/image/task` => `AUTH_REQUIRED`
  - `POST /api/proxy/external/audio/task` => `AUTH_REQUIRED`
  - `POST /api/proxy/external/video/task` => `AUTH_REQUIRED`
- Redis：
  - `PING` => `PONG`
  - `LLEN xinghuan:tasks` => `0`

## 验收注意

- 页面类入口应使用真实 `GET` 验收。
- `HEAD /` 与 `HEAD /admin` 当前会返回 `404 JSON`，不应误判为灰度页面不可用。

## 验收边界

- 当前 release 包为运行时精简包，不包含本地这轮新增的 `scripts/verify-provider-generation-*.{ts,mjs}`。
- 因此服务器端本轮不直接复跑这些本地契约脚本，而采用：
  - 发布前本地完整验证矩阵
  - 发布后灰度服务活性
  - 公网入口 smoke
  - 未登录任务接口守卫
  - Redis 队列健康
  作为灰度验收组合。

## 当前结论

- Provider 生成任务标准化已成功进入灰度。
- 当前灰度具备图片 / 音频 / 视频后台发布模型的统一任务化入口。
- 后续若继续做深一层验收，应在灰度登录态下手动发起：
  - 一次图片任务
  - 一次音频任务
  - 一次视频任务
  以确认真实 `queued/running/succeeded` 与素材落库闭环。
