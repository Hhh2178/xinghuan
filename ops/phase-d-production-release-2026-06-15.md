# Phase D 正式发布记录（2026-06-15）

## 目标

- 将 `Phase D` 的任务状态机、取消链路、后台任务分页与 worker 运行态补偿正式发布到生产环境。
- 复用灰度中已经修正过的 release package 契约，确保 production current release 可以直接执行：
  - `npm run verify:release-preflight`
  - `npm run verify:phase-d`
  - `npm run verify:provider-generation-task-service`
  - `npm run verify:provider-generation-worker`

## 本次正式结论

- `Phase D` 已完成正式发布。
- 当前生产 active release：
  - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260615-phase-d-runtime-prod-r1`
- 当前灰度 active release：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260615-phase-d-runtime-gray-r3`
- 截至 `2026-06-15`，`Phase D` 的真实状态应写为：
  - 本地代码完成
  - gray 完成
  - production 完成

## 上线前基线

正式 current 在上线前仍停留在 `Phase C`：

- `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260615-phase-c-login-rate-limit-prod-r1`

生产服务状态：

- `xinghuan-canvas.service = active`
- `xinghuan-canvas-worker.service = active`

上线前 production current 执行：

- `npm run verify:release-preflight`

结果按预期失败：

- `Cannot find module .../scripts/capture-release-preflight.mjs`

这与灰度上线前表现一致，说明旧的 `Phase C` production release 同样缺少服务器验收脚本。

## 发布包

- release：`20260615-phase-d-runtime-prod-r1`
- 本机产物：
  - `dist-release/20260615-phase-d-runtime-prod-r1.tar.gz`

包内已确认包含：

- `scripts/capture-release-preflight.mjs`
- `scripts/verify-task-cancellation-phase-d.mjs`
- `scripts/verify-admin-task-pagination.mjs`
- `scripts/verify-task-lifecycle.mjs`
- `scripts/verify-provider-generation-task-service.mjs`
- `scripts/verify-provider-generation-worker.mjs`
- `apps/api/db/014_task_runtime_phase_d.sql`
- `apps/api/src`
- `apps/worker/src`

## 服务器执行

### 发布路径

- 上传包：
  - `/tmp/20260615-phase-d-runtime-prod-r1.tar.gz`
- release 目录：
  - `/opt/apps/xinghuan-canvas/releases/20260615-phase-d-runtime-prod-r1`

### 执行步骤

1. `npm ci`
2. `node scripts/db-migrate.mjs`
3. 切换：
   - `ln -sfn /opt/apps/xinghuan-canvas/releases/20260615-phase-d-runtime-prod-r1 /opt/apps/xinghuan-canvas/current`
4. 重启：
   - `sudo systemctl restart xinghuan-canvas.service`
   - `sudo systemctl restart xinghuan-canvas-worker.service`

### 迁移结果

- `applied = ["014_task_runtime_phase_d.sql"]`
- `skipped = 13`

## 上线后快照

production current 执行：

- `npm run verify:release-preflight`

结果：

- `currentReleaseTarget = /opt/apps/xinghuan-canvas/releases/20260615-phase-d-runtime-prod-r1`
- `environment = production`
- `currentDatabase = xinghuan_canvas_next`
- `api = active`
- `worker = active`

状态接口：

- `http://127.0.0.1:18100/api/status`
- `https://canvas.hhh2121.xyz/api/status`

均返回：

- `environment = production`

## 正式验收

生产环境执行并通过：

- `npm run verify:release-preflight`
- `npm run verify:phase-d`
- `npm run verify:provider-generation-task-service`
- `npm run verify:provider-generation-worker`

## 重要观察

### 1. `verify:phase-d` 已不再需要停 worker

灰度阶段原先的取消脚本会与常驻 worker 抢时序，可能导致测试任务先到 `succeeded`，随后取消失败。

本轮已修正：

- `scripts/verify-task-cancellation-phase-d.mjs`

现在它会创建一个：

- `status = queued`
- `payload.taskCapability = "chat"`

的任务。该任务不会进入 Redis worker 队列，但仍处于可取消状态，因此 production 上可以在 worker 常驻时稳定通过：

- 取消语义验证
- 后台任务分页验证
- 生命周期/重试验证

### 2. 生产数据库目标与既有文档口径不一致

本轮 production preflight 的真实返回为：

- `currentDatabase = xinghuan_canvas_next`

同时生产环境文件中的：

- `XINGHUAN_EXPECTED_DATABASE_NAME=xinghuan_canvas_next`

这说明当前生产与灰度并不是两套独立 PostgreSQL 数据库。

因此，历史文档里“灰度与生产已经拆分为独立 PostgreSQL 数据库”的表述需要修正为：

- 灰度和生产当前是两套 release 指针、两套端口、两套域名入口
- 但数据库目标仍未彻底拆分

## 当前遗留项

- `Phase D` 已完成发布，但 `Phase E` 仍未开始正式收口：
  - `requestId` 贯通
  - 系统观测面板
  - 更完整的任务/冲突/队列趋势观测
- 当前生产和灰度数据库目标仍不独立，这一点必须在后续文档与运维判断中继续保持真实表述。

## 当前建议

后续推进顺序建议改为：

1. 将 `Phase D` 标记为 gray / production 都已完成
2. 修正文档里关于“独立数据库已拆分”的失实口径
3. 进入 `Phase E`
4. 如要继续做真正的环境隔离，再把数据库目标拆分列为单独运维治理项
