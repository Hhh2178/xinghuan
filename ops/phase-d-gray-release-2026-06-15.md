# Phase D 灰度发布记录（2026-06-15）

## 目标

- 将 `Phase D` 的任务状态机、取消链路、后台任务分页与 worker 运行态补偿真实发布到灰度环境。
- 修复发布包与服务器验收脚本不一致的问题，让 gray current release 可以直接执行：
  - `npm run verify:release-preflight`
  - `npm run verify:phase-d`
  - `npm run verify:provider-generation-task-service`
  - `npm run verify:provider-generation-worker`

## 本次灰度结论

- `Phase D` 已完成灰度发布。
- 当前灰度 active release：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260615-phase-d-runtime-gray-r3`
- 当前生产 active release 仍保持：
  - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260615-phase-c-login-rate-limit-prod-r1`
- 因此截至 `2026-06-15` 的真实状态应写为：
  - `Phase D` 已完成 gray 放行
  - `Phase D` 尚未完成 production 放行

## 背景与阻塞修复

上线前先确认了两个真实阻塞项：

1. 旧灰度 current 仍停留在 `Phase C`
   - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260615-phase-c-login-rate-limit-gray-r1`
   - `apps/api/db/` 只到 `013_login_rate_limit.sql`

2. 旧发布包缺少服务器侧验收脚本
   - 旧 gray current 执行 `npm run verify:release-preflight` 失败：
     - `Cannot find module .../scripts/capture-release-preflight.mjs`
   - 第一版 `Phase D` gray 包虽然补进了 `capture-release-preflight.mjs`，但仍缺少：
     - `verify-task-cancellation-phase-d.mjs`
     - `verify-admin-task-pagination.mjs`
     - `verify-task-lifecycle.mjs`
     - `verify-provider-generation-task-service.mjs`
     - `verify-provider-generation-worker.mjs`
   - 同时这些脚本依赖的 `apps/api/src` / `apps/worker/src` 也必须进入 runtime package

本轮已把上述缺口收口到发布契约：

- `scripts/verify-release-package-contract.mjs`
- `scripts/package-release.mjs`

现在 release package 会强制包含：

- `scripts/capture-release-preflight.mjs`
- `scripts/verify-task-cancellation-phase-d.mjs`
- `scripts/verify-admin-task-pagination.mjs`
- `scripts/verify-task-lifecycle.mjs`
- `scripts/verify-provider-generation-task-service.mjs`
- `scripts/verify-provider-generation-worker.mjs`
- `apps/api/src`
- `apps/worker/src`

## 发布包演进

### `r1`

- release：`20260615-phase-d-runtime-gray-r1`
- 解决：
  - `capture-release-preflight.mjs` 缺失
- 结果：
  - `014_task_runtime_phase_d.sql` 成功进入 gray
  - gray preflight 首次恢复可执行
  - 但 gray 上 `verify:phase-d` / provider 验收脚本仍缺失

### `r2`

- release：`20260615-phase-d-runtime-gray-r2`
- 解决：
  - 把 `Phase D` 与 provider 验收脚本、以及所需 `apps/api/src` / `apps/worker/src` 一并纳入发布包
- 结果：
  - 服务器可执行 `verify:phase-d`
  - 暴露真实脚本问题：`verify-admin-task-pagination.mjs` 写入了不存在的 `providerId`，触发 PostgreSQL 外键约束

### `r3`

- release：`20260615-phase-d-runtime-gray-r3`
- 解决：
  - 去掉 `verify-admin-task-pagination.mjs` 中无效的 `providerId` 测试数据
- 结果：
  - gray `verify:phase-d` 恢复可通过
  - 本次灰度最终以 `r3` 作为 active release

## 服务器执行

### 发布路径

- 上传包：
  - `/tmp/20260615-phase-d-runtime-gray-r3.tar.gz`
- release 目录：
  - `/opt/apps/xinghuan-canvas-next/releases/20260615-phase-d-runtime-gray-r3`

### 执行步骤

1. `npm ci`
2. `node scripts/db-migrate.mjs`
3. 切换：
   - `ln -sfn /opt/apps/xinghuan-canvas-next/releases/20260615-phase-d-runtime-gray-r3 /opt/apps/xinghuan-canvas-next/current`
4. 重启：
   - `sudo systemctl restart xinghuan-canvas-next.service`
   - `sudo systemctl restart xinghuan-canvas-next-worker.service`

### 迁移结果

- `r1` 首次发布时：
  - `applied = ["014_task_runtime_phase_d.sql"]`
  - `skipped = 13`
- `r2 / r3` 重发时：
  - `applied = []`
  - `skipped = 14`

## 上线后快照

gray current release 执行：

- `npm run verify:release-preflight`

结果：

- `currentReleaseTarget = /opt/apps/xinghuan-canvas-next/releases/20260615-phase-d-runtime-gray-r3`
- `environment = gray`
- `currentDatabase = xinghuan_canvas_gray`
- `api = active`
- `worker = active`

状态接口：

- `http://127.0.0.1:18200/api/status`
- `https://canvas-next.hhh2121.xyz/api/status`

均返回：

- `environment = gray`

## 灰度验收

### 通过项

- `npm run verify:release-preflight`
- `npm run verify:provider-generation-task-service`
- `npm run verify:provider-generation-worker`
- `npm run verify:phase-d`

### `verify:phase-d` 的运行态说明

灰度 worker 默认会立即消费 `queued` 测试任务，因此取消样本存在一个真实竞态：

- 若 worker 抢先把任务跑到 `succeeded`
- 取消脚本会收到：
  - `任务当前状态为 succeeded，不可取消`

这不是 `Phase D` 业务逻辑错误，而是“取消样本任务”和“灰度 worker 正常消费”之间的运行态竞争。

本轮灰度验收采用的可复用做法是：

1. 暂停：
   - `sudo systemctl stop xinghuan-canvas-next-worker.service`
2. 执行：
   - `npm run verify:phase-d`
3. 再恢复：
   - `sudo systemctl start xinghuan-canvas-next-worker.service`

在该条件下，`verify:phase-d` 已完整通过：

- 取消语义通过
- 后台任务分页通过
- 任务重试/生命周期通过

恢复后再执行：

- `npm run verify:provider-generation-task-service`
- `npm run verify:provider-generation-worker`

也均通过。

## 当前遗留项

- `Phase D` 生产 release 仍未执行。
- 当前仍缺少以下更贴近真实业务的灰度样本沉淀：
  - 支持上游取消的真实 provider 样本
  - `upstream_attempt_failed` 的真实样本
  - stale reaper 命中样本的单独发布记录
- `verify-task-cancellation-phase-d.mjs` 如要长期作为“worker 运行中也稳定通过”的脚本，后续应改成：
  - 显式构造不会被 worker 立即完成的可取消任务
  - 或在脚本内自带更稳的运行态前置条件

## 当前建议

正式放行前，至少继续执行：

1. 生产 preflight 快照
2. 生产 release 打包与切换
3. 生产 `verify:release-preflight`
4. 生产精简版 `Phase D` 验收
5. 正式发布记录与主入口同步
