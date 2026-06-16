# Phase E 正式环境回滚演练记录（2026-06-15）

## 目标

- 为 `Phase E` production 当前基线补齐真实 rollback 样本。
- 确认 production 可以执行：
  - `prod-r2 -> prod-r1`
  - 核心观测接口复验
  - `prod-r1 -> prod-r2`

## 演练范围

- 环境：production
- 服务目录：`/opt/apps/xinghuan-canvas`
- 回滚前 current：
  - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-prod-r2`
- 目标旧版：
  - `/opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-prod-r1`
- 恢复目标：
  - `/opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-prod-r2`

## 执行步骤

1. 记录当前 `current` 指针为 `prod-r2`
2. 切换：
   - `prod-r2 -> prod-r1`
3. 重启：
   - `xinghuan-canvas.service`
   - `xinghuan-canvas-worker.service`
4. 在 `prod-r1` 上验证：
   - `npm run verify:request-chain-observability`
   - `npm run verify:system-observability`
   - `npm run verify:release-preflight`
   - `curl -i -H 'x-request-id: phase-e-prod-rollback-check' http://127.0.0.1:18100/api/status`
5. 恢复：
   - `prod-r1 -> prod-r2`
6. 重启：
   - `xinghuan-canvas.service`
   - `xinghuan-canvas-worker.service`
7. 在 `prod-r2` 上复验：
   - `npm run verify:release-preflight`
   - `npm run verify:request-chain-observability`
   - `npm run verify:system-observability`
   - `curl -i -H 'x-request-id: phase-e-prod-rollback-public-check' https://canvas.hhh2121.xyz/api/status`

## prod-r1 回滚态结果

### current 指针

- `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-prod-r1`

### request-chain

- `ok = true`
- `requestId = phase-e-audit-1781511453581`
- `auditId = audit-1781511453729-csdw76`
- `ip = 127.0.0.1`

### system observability

- `ok = true`
- `currentDatabase = xinghuan_canvas_next`
- `expectedDatabase = xinghuan_canvas_next`
- `targetMatched = true`
- `tasks.total = 88`
- `tasks.queued = 5`
- `tasks.running = 0`
- `tasks.succeeded = 58`
- `tasks.failed = 8`
- `tasks.cancelled = 17`
- `tasks.failedLast24h = 5`
- `audits.total = 525`
- `audits.sampled = 100`
- `audits.withRequestId = 6`
- `audits.requestIdCoveragePercent = 6`

### preflight

`prod-r1` 当前仍存在旧版 preflight 自动识别缺口：

- `environment = unknown`
- `currentReleaseLink = null`
- `currentReleaseTarget = null`
- `services.api = null`
- `services.worker = null`

但核心运行态仍可验证：

- `apiStatus.environment = production`
- `database.name = xinghuan_canvas_next`
- `users = 7`
- `canvases = 2`
- `assets = 7`
- `tasks = 88`
- `sessions = 65`

### header smoke

执行：

- `curl -i -H 'x-request-id: phase-e-prod-rollback-check' http://127.0.0.1:18100/api/status`

结果：

- 响应头保留：
  - `x-request-id: phase-e-prod-rollback-check`

## 恢复到 prod-r2 后结果

### current 指针

- `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-prod-r2`

### preflight

- `ok = true`
- `environment = production`
- `currentReleaseLink = /opt/apps/xinghuan-canvas/current`
- `currentReleaseTarget = /opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-prod-r2`
- `services.api = active`
- `services.worker = active`
- `database.name = xinghuan_canvas_next`
- `users = 7`
- `canvases = 2`
- `assets = 7`
- `tasks = 88`
- `sessions = 67`

### request-chain

- `ok = true`
- `requestId = phase-e-audit-1781511541212`
- `auditId = audit-1781511541352-y8dtix`
- `ip = 127.0.0.1`

### system observability

- `ok = true`
- `currentDatabase = xinghuan_canvas_next`
- `expectedDatabase = xinghuan_canvas_next`
- `targetMatched = true`
- `tasks.total = 88`
- `tasks.queued = 5`
- `tasks.running = 0`
- `tasks.succeeded = 58`
- `tasks.failed = 8`
- `tasks.cancelled = 17`
- `tasks.failedLast24h = 5`
- `audits.total = 529`
- `audits.sampled = 100`
- `audits.withRequestId = 10`
- `audits.requestIdCoveragePercent = 10`

### 公网 header smoke

执行：

- `curl -i -H 'x-request-id: phase-e-prod-rollback-public-check' https://canvas.hhh2121.xyz/api/status`

结果：

- 响应头保留：
  - `x-request-id: phase-e-prod-rollback-public-check`

## 结论

- production rollback 演练已真实完成：
  - `prod-r2 -> prod-r1 -> prod-r2`
- 回滚后 production 核心链路可用：
  - `/api/status`
  - `verify:request-chain-observability`
  - `verify:system-observability`
- 旧版 `prod-r1` 仍缺：
  - preflight 自动识别 `currentReleaseTarget`
  - preflight 自动识别 `services.api / services.worker`
- 因此当前 production 可复用基线应保持：
  - 正常运行基线：`prod-r2`
  - rollback 可执行旧版样本：`prod-r1`

## 后续

- `Phase E` 当前已补齐：
  - gray rollback 样本
  - production rollback 样本
- 后续重点转为：
  - 长期失败趋势观测
  - revision conflict 统计
  - requestId 覆盖率持续提升
