# Provider 分类队列并发正式发布记录

日期：`2026-06-12`

正式 release：

- `20260612-provider-task-queue-concurrency-prod-r1-local`

上一正式回滚点：

- `/opt/apps/xinghuan-canvas/releases/20260612-video-upstream-json-guard-prod-r1`

## 发布目标

- 将灰度已验证通过的分类队列并发方案同步到正式环境。
- 让正式环境的图片 / 音频 / 视频任务不再共用单串行总队列。
- 让正式后台系统页具备分类并发调节能力。

## 本机前置验收

- 使用与灰度同一份代码与构建产物。
- 本机已通过：
  - `npm run build:single-port`
  - `npm run verify:provider-generation-task-service`
  - `npm run verify:provider-generation-worker`
  - `npm run verify:provider-generation-admin-contract`

## 服务器动作

- 本机打包：
  - `npm run package:release -- 20260612-provider-task-queue-concurrency-prod-r1-local`
- 上传：
  - `/tmp/20260612-provider-task-queue-concurrency-prod-r1-local.tar.gz`
- 服务器解压：
  - `/opt/apps/xinghuan-canvas/releases/20260612-provider-task-queue-concurrency-prod-r1-local`
- 在 release 目录执行：
  - `npm ci`
  - 加载 `/opt/apps/xinghuan-canvas/shared/canvas.env`
  - `node scripts/db-migrate.mjs`
    - 实际结果：
      - `applied=["008_task_queue_settings.sql"]`
      - `skipped=7`
- 切换 `current`
- 重启：
  - `xinghuan-canvas.service`
  - `xinghuan-canvas-worker.service`
  - `xinghuan-canvas-output-prune.timer`

## 正式验收结果

- `readlink -f /opt/apps/xinghuan-canvas/current`
  - `/opt/apps/xinghuan-canvas/releases/20260612-provider-task-queue-concurrency-prod-r1-local`
- `systemctl is-active xinghuan-canvas.service`
  - `active`
- `systemctl is-active xinghuan-canvas-worker.service`
  - `active`
- `systemctl is-active xinghuan-canvas-output-prune.timer`
  - `active`
- `curl http://127.0.0.1:18100/api/status`
  - `environment=production`
- `https://canvas.hhh2121.xyz/`
  - `200`
- `https://canvas.hhh2121.xyz/admin`
  - `200`
- `https://canvas.hhh2121.xyz/api/status`
  - `environment=production`
- Redis 分类队列：
  - `LLEN xinghuan:tasks:prod:image` => `0`
  - `LLEN xinghuan:tasks:prod:audio` => `0`
  - `LLEN xinghuan:tasks:prod:video` => `0`

## 当前结论

- 分类队列并发方案已经进入正式运行环境。
- 正式环境现在已具备：
  - 分类独立任务队列
  - 分类独立 Worker 并发槽位
  - 后台系统页分类并发调节
- 后续建议继续补做一次正式登录态的真实并发场景验收，确认用户实际发起“长视频 + 短音频”时，短音频能够先完成。
