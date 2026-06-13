# Provider 分类队列并发灰度发布记录

日期：`2026-06-12`

灰度 release：

- `20260612-provider-task-queue-concurrency-gray-r2-local`

上一灰度回滚点：

- `/opt/apps/xinghuan-canvas-next/releases/20260612-provider-task-standardization-gray-r1-aa5f499`

## 发布目标

- 将图片 / 音频 / 视频的单总队列串行消费改造成分类独立队列消费。
- 默认让 `image / audio / video` 各自支持最高 `4` 个并发槽位。
- 在后台系统页提供分类并发调控入口与分类队列状态展示。

## 本机前置验收

- `node scripts/verify-provider-generation-task-service.mjs`
- `node scripts/verify-provider-generation-worker.mjs`
- `node scripts/verify-provider-generation-admin-contract.mjs`
- `npm run verify:provider-generation-task-service`
- `npm run verify:provider-generation-worker`
- `npm run verify:provider-generation-admin-contract`
- `npm run build:single-port`

结果：

- 全部通过

## 服务器动作

- 本机打包：
  - `npm run package:release -- 20260612-provider-task-queue-concurrency-gray-r2-local`
- 上传：
  - `/tmp/20260612-provider-task-queue-concurrency-gray-r2-local.tar.gz`
- 服务器解压：
  - `/opt/apps/xinghuan-canvas-next/releases/20260612-provider-task-queue-concurrency-gray-r2-local`
- 在 release 目录执行：
  - `npm ci`
  - `node scripts/db-migrate.mjs`
    - 实际结果：
      - `applied=["008_task_queue_settings.sql"]`
      - `skipped=7`
- 切换 `current`
- 重启：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`

## 灰度验收项

- `readlink -f /opt/apps/xinghuan-canvas-next/current`
  - `/opt/apps/xinghuan-canvas-next/releases/20260612-provider-task-queue-concurrency-gray-r2-local`
- `systemctl is-active xinghuan-canvas-next.service`
  - `active`
- `systemctl is-active xinghuan-canvas-next-worker.service`
  - `active`
- `curl http://127.0.0.1:18200/api/status`
  - `environment=gray`
- `https://canvas-next.hhh2121.xyz/`
  - `200`
- `https://canvas-next.hhh2121.xyz/admin`
  - `200`
- `https://canvas-next.hhh2121.xyz/api/status`
  - `environment=gray`
- Redis 侧查看：
  - `LLEN xinghuan:tasks:image` => `0`
  - `LLEN xinghuan:tasks:audio` => `0`
  - `LLEN xinghuan:tasks:video` => `0`

## 重点验收场景

- 先提交一个长视频任务，再提交一个短音频任务。
- 预期结果：
  - 音频不会被视频串行堵住
  - 音频任务可以先完成并返回
  - 视频任务继续在自己的队列内执行

## 当前结论

- 本地代码和契约已经完成。
- 这版已经成功进入灰度运行环境。
- 当前灰度已具备：
  - 分类独立任务队列
  - 每类默认 `4` 并发槽位
  - 后台系统页分类并发调节入口
- 下一步应在登录态下做真实并发场景验收：
  - 先发长视频
  - 再发短音频
  - 确认音频不再被视频堵住
