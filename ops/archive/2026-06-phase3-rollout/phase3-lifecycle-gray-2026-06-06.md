# Phase 3 素材空间读取闭环与任务生命周期灰度发布记录

日期：2026-06-06
发布号：`20260606-2358-phase3-lifecycle-gray`

## 范围

- 素材空间读取闭环：资源库抽屉打开后静默轮询并响应资源变更事件。
- 后台任务取消 / 重试语义化。
- Worker 运行中任务取消保护。

## 发布结果

- `current` 已切到：
  - `/opt/apps/xinghuan-canvas-next/releases/20260606-2358-phase3-lifecycle-gray`
- 服务状态：
  - `xinghuan-canvas-next.service`: `active`
  - `xinghuan-canvas-next-worker.service`: `active`
  - `xinghuan-canvas-next-output-prune.timer`: 保持既有 `active (waiting)`

## 验收

- `curl -fsS http://127.0.0.1:18200/api/status`
  - 返回 `environment=gray`
- `npm run verify:task-lifecycle`
  - 返回 `ok=true`
  - 原任务：`task-1780727544407-1cszgy`
  - 重试任务：`task-1780727544427-72mbk8`
  - 原任务状态保持 `cancelled`
  - 重试任务在验收完成时已被 Worker 消费到 `running`
- `npm run verify:worker-output-materials`
  - 返回 `ok=true`
  - 任务：`task-1780727541467-w0fpn7`
  - 资源项：`res-1780727541745-9nva3d`
  - 文件：`/files/output/task_output_task-1780727541467-w0fpn7_1.png`

## 说明

- 本次灰度发布未修改 `internal-proxy-*` 相关服务或路由。
- `verify:task-lifecycle` 在灰度 Redis/Worker 可用时，重试任务可能很快进入 `running`；这符合当前异步任务系统行为。
