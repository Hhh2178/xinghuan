# Phase E 长期观测治理第一批正式发布记录（2026-06-15）

## 目标

- 将 `Phase E` 的长期观测治理第一批能力正式发布到 production。
- 在不额外制造生产 conflict 样本的前提下，完成标准 gate 与 header smoke。

## 本次正式结论

- production 已完成实际发布。
- 当前 production active release：
  - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-governance-prod-r1`
- 当前 gray active release 保持：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260615-phase-e-observability-governance-gray-r1`

## 发布包

- release：`20260615-phase-e-observability-governance-prod-r1`
- 本机产物：
  - `dist-release/20260615-phase-e-observability-governance-prod-r1.tar.gz`
- 本机 SHA256：
  - `9729969139FA6DDC510C55CE6203618EA19667F84D0B8162C4014972300B2D24`
- 服务器 SHA256：
  - `9729969139fa6ddc510c55ce6203618ea19667f84d0b8162c4014972300b2d24`

## 本轮变更点

- `/api/admin/system` 新增：
  - `observability.tasks.failedLast1h`
  - `observability.tasks.failedLast24h`
  - `observability.tasks.failedLast7d`
  - `observability.audits.conflicts.totalLast24h`
  - `observability.audits.conflicts.canvasRevisionLast24h`
  - `observability.audits.conflicts.resourceRevisionLast24h`
  - `observability.audits.conflicts.adminSettingsRevisionLast24h`
- API 在 `409` revision conflict 时自动沉淀 observability audit。
- 后台系统只读面板新增失败窗口与 conflict 行。

## 服务器执行

### 发布路径

- 上传包：
  - `/tmp/20260615-phase-e-observability-governance-prod-r1.tar.gz`
- release 目录：
  - `/opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-governance-prod-r1`

### 执行步骤

1. `npm ci`
2. `node scripts/db-migrate.mjs`
3. 切换：
   - `ln -sfn /opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-governance-prod-r1 /opt/apps/xinghuan-canvas/current`
4. 重启：
   - `sudo systemctl restart xinghuan-canvas.service`
   - `sudo systemctl restart xinghuan-canvas-worker.service`

### 迁移结果

- `{"ok":true,"applied":[],"skipped":14}`

## 正式验收

### 本机 gate

- `npm run verify:release-preflight`
- `npm run verify:request-chain-observability`
- `npm run verify:system-observability`

关键结果：

- `environment = production`
- `currentReleaseTarget = /opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-governance-prod-r1`
- `database.name = xinghuan_canvas_next`
- `services.api = active`
- `services.worker = active`
- `tasks.total = 91`
- `tasks.queued = 5`
- `tasks.failedLast1h = 0`
- `tasks.failedLast24h = 5`
- `tasks.failedLast7d = 8`
- `audits.total = 533`
- `audits.withRequestId = 14`
- `audits.requestIdCoveragePercent = 14`
- `conflicts.totalLast24h = 0`

### 公网 production gate

以：

- `XINGHUAN_VERIFY_BASE_URL=https://canvas.hhh2121.xyz`

执行通过：

- `npm run verify:request-chain-observability`
- `npm run verify:system-observability`

公网关键结果：

- request-chain：
  - `ok = true`
  - 审计 `ip = 101.33.75.38`
- system observability：
  - `currentDatabase = xinghuan_canvas_next`
  - `expectedDatabase = xinghuan_canvas_next`
  - `targetMatched = true`
  - `tasks.failedLast24h = 5`
  - `tasks.failedLast7d = 8`
  - `audits.total = 534`
  - `audits.withRequestId = 15`
  - `audits.requestIdCoveragePercent = 15`
  - `conflicts.totalLast24h = 0`

### Header smoke

- production 本机：
  - `http://127.0.0.1:18100/api/status`
  - 响应头保留：
    - `x-request-id: phase-e-governance-prod-header-check`
- production 公网：
  - `https://canvas.hhh2121.xyz/api/status`
  - 响应头保留：
    - `x-request-id: phase-e-governance-prod-public-check`

## 边界说明

- 本轮 production 只执行标准 gate，没有额外制造 conflict 样本。
- conflict 累计能力已经在本地与 gray 实打验证，因此 production 以最小风险放行为准。

## 结论

- production 已完成长期观测治理第一批发布。
- 当前 production 运行态已能稳定返回失败窗口与 conflict 结构。
- `Phase E` 后续剩余项转为：
  - 趋势展示
  - 阈值/告警
  - `requestId` 覆盖率提升
