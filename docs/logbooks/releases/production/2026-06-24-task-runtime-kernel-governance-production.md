# Task Runtime Kernel Governance Production Release - 2026-06-24

## 发布目标

- 将 gray 已运行验证的 `v0.5.1` 任务运行态治理版本晋级到 production。
- 让 production 获得 gray 当前已验证的能力：
  - 公告中心与强提醒基础表结构
  - RunningHub 长任务 timeout governance
  - RunningHub runtime state / node progress 治理
  - GRSAI worker client 直测护栏
  - 统一任务 runtime event ledger 表结构

## 发布信息

- 环境：`production`
- 版本：`v0.5.1`
- release：`20260624-task-runtime-kernel-governance-prod-r1-v051`
- 晋级来源包：`dist-release/20260624-task-runtime-kernel-governance-gray-r1-v051.tar.gz`
- 对应 gray 运行态：
  - `/opt/apps/xinghuan-canvas-next/releases/20260624-task-runtime-kernel-governance-gray-r1-v051`
- 上一 production release：
  - `/opt/apps/xinghuan-canvas/releases/20260623-runninghub-grsai-worker-key-pool-prod-r1-v0413`

## 发布前回退锚点

- 代码回退目标：
  - `/opt/apps/xinghuan-canvas/releases/20260623-runninghub-grsai-worker-key-pool-prod-r1-v0413`
- 数据库备份：
  - `/opt/apps/xinghuan-canvas/shared/backups/xinghuan_canvas_next_before_v051_20260624_213115.dump`
- 数据库目标：
  - `current = xinghuan_canvas_next`
  - `expected = xinghuan_canvas_next`

## 执行过程

- 上传 production release 包：
  - `/tmp/20260624-task-runtime-kernel-governance-prod-r1-v051.tar.gz`
- 解包：
  - `/opt/apps/xinghuan-canvas/releases/20260624-task-runtime-kernel-governance-prod-r1-v051`
- release 内执行：
  - `npm ci`
  - `npm run db:migrate`
- 本次数据库迁移结果：
  - `applied = ["017_announcements.sql", "018_task_runtime_events.sql"]`
  - `skipped = 16`
- 切换：
  - `current -> /opt/apps/xinghuan-canvas/releases/20260624-task-runtime-kernel-governance-prod-r1-v051`
- 重启：
  - `xinghuan-canvas.service`
  - `xinghuan-canvas-worker.service`

## Production 运行态复核

- `readlink -f /opt/apps/xinghuan-canvas/current`
  - `/opt/apps/xinghuan-canvas/releases/20260624-task-runtime-kernel-governance-prod-r1-v051`
- `systemctl is-active xinghuan-canvas.service`
  - `active`
- `systemctl is-active xinghuan-canvas-worker.service`
  - `active`
- `http://127.0.0.1:18100/api/status`
  - `version = 0.5.1`
  - `environment = production`
  - `dataDir = /opt/apps/xinghuan-canvas/shared/data`
- `https://canvas.hhh2121.xyz/api/status`
  - `version = 0.5.1`
  - `environment = production`
  - `dataDir = /opt/apps/xinghuan-canvas/shared/data`
- production Redis 队列长度：
  - `xinghuan:tasks:prod:image = 0`
  - `xinghuan:tasks:prod:video = 0`
  - `xinghuan:tasks:prod:audio = 0`
- production worker 启动队列：
  - `image concurrency = 100`
  - `audio concurrency = 100`
  - `video concurrency = 100`

## Production 观测 Gate

- `npm run verify:system-observability`
  - `ok = true`
  - `database.current = xinghuan_canvas_next`
  - `database.expected = xinghuan_canvas_next`
  - `database.targetMatched = true`
- `npm run verify:request-chain-observability`
  - `ok = true`
  - requestId / audit chain 写入正常

## 已知观测风险

- `verify:system-observability` 显示 24h 历史失败任务仍偏多：
  - `failedLast24h = 56`
  - 这些失败属于晋级前 production 运行数据，不是本次切换启动失败。
- `verify:system-observability` 显示 24h revision conflict 偏多：
  - `totalLast24h = 8`
  - 需要后续独立排查画布并发写入或多端编辑冲突。
- production 当前仍沿用历史数据库口径：
  - `xinghuan_canvas_next`
  - 本次不切换 production 独立库命名。

## 待用户验收

- 正式页面视觉与入口交互体验。
- 公告中心与强提醒真实使用体验。
- RunningHub 多 Key 真实业务并发体验。
- RH 长任务完成回写、取消同步、输出素材节点消费体验。

## 回滚信息

- 代码回滚目标：
  - `/opt/apps/xinghuan-canvas/releases/20260623-runninghub-grsai-worker-key-pool-prod-r1-v0413`
- 回滚命令轮廓：
  - `ln -sfn /opt/apps/xinghuan-canvas/releases/20260623-runninghub-grsai-worker-key-pool-prod-r1-v0413 /opt/apps/xinghuan-canvas/current`
  - `sudo systemctl restart xinghuan-canvas.service`
  - `sudo systemctl restart xinghuan-canvas-worker.service`
- 数据库回退锚点：
  - `/opt/apps/xinghuan-canvas/shared/backups/xinghuan_canvas_next_before_v051_20260624_213115.dump`
- 注意：
  - 本次迁移新增公告与任务事件表；一般代码回退不需要恢复数据库。
  - 如出现数据写坏或迁移层异常，再评估是否使用数据库备份恢复。
