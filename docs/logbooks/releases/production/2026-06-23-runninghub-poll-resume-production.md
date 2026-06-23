# RunningHub 节点恢复轮询 Production Release - 2026-06-23

## 发布目标

- 将已在 gray 验证通过的 RH 节点恢复轮询热修推进到 production。
- 保持 gray / production 同批版本一致，对外统一暴露 `v0.4.12`。

## 发布信息

- 环境：`production`
- 版本：`v0.4.12`
- release：`20260623-runninghub-poll-resume-prod-r1-v0412`
- 对应 gray release：`20260623-runninghub-poll-resume-gray-r1-v0412`
- 上一 production release：`20260619-runninghub-slot-sync-prod-r1-v040-local`

## Agent 已验证

### 发布执行

- 发布包：
  - `dist-release/20260623-runninghub-poll-resume-gray-r1-v0412.tar.gz`
- 生产服务器执行：
  - 上传到 `/tmp/20260623-runninghub-poll-resume-prod-r1-v0412.tar.gz`
  - 解包到 `/opt/apps/xinghuan-canvas/releases/20260623-runninghub-poll-resume-prod-r1-v0412`
  - `npm ci`
  - `npm run db:migrate`
    - `applied = ["016_runninghub_key_pool.sql"]`
  - 重启：
    - `xinghuan-canvas.service`
    - `xinghuan-canvas-worker.service`

### 生产运行态

- `readlink -f /opt/apps/xinghuan-canvas/current`
  - `/opt/apps/xinghuan-canvas/releases/20260623-runninghub-poll-resume-prod-r1-v0412`
- `systemctl is-active xinghuan-canvas.service`
  - `active`
- `systemctl is-active xinghuan-canvas-worker.service`
  - `active`
- `http://127.0.0.1:18100/api/status`
  - `version = 0.4.12`
  - `environment = production`
- `https://canvas.hhh2121.xyz/api/status`
  - `version = 0.4.12`
  - `environment = production`

### Production Preflight 快照

- `capturedAt = 2026-06-23T07:05:15.266Z`
- `currentReleaseTarget = /opt/apps/xinghuan-canvas/releases/20260623-runninghub-poll-resume-prod-r1-v0412`
- `database.name = xinghuan_canvas_next`
- `users = 8`
- `canvases = 8`
- `assets = 129`
- `tasks = 410`
- `sessions = 26`

## 待用户验收

- RH 真实业务任务在 production 是否稳定从 `45%` 继续轮询到完成并回填输出
- 画布上普通 RH 节点与输出素材节点的联动观感
- 与灰度对比后的业务体验确认

## 风险与残留问题

- production 当前 `canvas.env` 仍指向 `xinghuan_canvas_next`
- `XINGHUAN_EXPECTED_DATABASE_NAME` 当前也为 `xinghuan_canvas_next`
- 这说明正式环境当前仍沿用历史共享库口径，尚未切换到独立命名的 production 数据库

## 回滚信息

- `current` 回滚目标：
  - `/opt/apps/xinghuan-canvas/releases/20260619-runninghub-slot-sync-prod-r1-v040-local`
- 需要重启的服务：
  - `xinghuan-canvas.service`
  - `xinghuan-canvas-worker.service`
