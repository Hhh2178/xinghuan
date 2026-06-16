# Phase E 长期观测治理第一批灰度发布记录（2026-06-15）

## 目标

- 将 `Phase E` 的长期观测治理第一批能力发布到 gray。
- 确认 `/api/admin/system` 的新增失败窗口与 revision conflict 统计不只是 schema，而是 gray 上可真实累计。

## 本次灰度结论

- gray 已完成实际发布。
- 当前 gray active release：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260615-phase-e-observability-governance-gray-r1`
- 当前 production active release 保持：
  - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-governance-prod-r1`

## 发布包

- release：`20260615-phase-e-observability-governance-gray-r1`
- 本机产物：
  - `dist-release/20260615-phase-e-observability-governance-gray-r1.tar.gz`
- 本机 SHA256：
  - `BD6CBCE9FA614EC16D27FE64360E4DD08E3540F1145152C60ED58BAFB3AB99A2`
- 服务器 SHA256：
  - `bd6cbce9fa614ec16d27fe64360e4dd08e3540f1145152c60ed58bafb3ab99a2`

## 本轮变更点

- `/api/admin/system` 新增：
  - `observability.tasks.failedLast1h`
  - `observability.tasks.failedLast24h`
  - `observability.tasks.failedLast7d`
  - `observability.audits.conflicts.totalLast24h`
  - `observability.audits.conflicts.canvasRevisionLast24h`
  - `observability.audits.conflicts.resourceRevisionLast24h`
  - `observability.audits.conflicts.adminSettingsRevisionLast24h`
- API 在 `409` revision conflict 时自动沉淀 observability audit：
  - `conflict.canvas_revision`
  - `conflict.resource_revision`
  - `conflict.admin_settings_revision`
- 后台系统只读面板新增失败窗口与 conflict 行。

## 服务器执行

### 发布路径

- 上传包：
  - `/tmp/20260615-phase-e-observability-governance-gray-r1.tar.gz`
- release 目录：
  - `/opt/apps/xinghuan-canvas-next/releases/20260615-phase-e-observability-governance-gray-r1`

### 执行步骤

1. `npm ci`
2. `node scripts/db-migrate.mjs`
3. 切换：
   - `ln -sfn /opt/apps/xinghuan-canvas-next/releases/20260615-phase-e-observability-governance-gray-r1 /opt/apps/xinghuan-canvas-next/current`
4. 重启：
   - `sudo systemctl restart xinghuan-canvas-next.service`
   - `sudo systemctl restart xinghuan-canvas-next-worker.service`

### 迁移结果

- `{"ok":true,"applied":[],"skipped":14}`

## 灰度验收

### 本机 gate

- `npm run verify:release-preflight`
- `npm run verify:request-chain-observability`
- `npm run verify:system-observability`

关键结果：

- `environment = gray`
- `currentReleaseTarget = /opt/apps/xinghuan-canvas-next/releases/20260615-phase-e-observability-governance-gray-r1`
- `database.name = xinghuan_canvas_gray`
- `services.api = active`
- `services.worker = active`
- `tasks.total = 122`
- `tasks.queued = 6`
- `tasks.failedLast1h = 0`
- `tasks.failedLast24h = 7`
- `tasks.failedLast7d = 21`
- `audits.total = 545`
- `audits.withRequestId = 8`
- `audits.requestIdCoveragePercent = 8`

### conflict 实打验证

为确认新增观测字段在 gray 不只是空返回，本轮额外执行：

- `verify-admin-settings-revision-conflict`
- `verify-canvas-revision-conflict`
- `verify-resource-revision-conflict`

结果：

- `staleAssistantWriteStatus = 409`
- `staleSystemWriteStatus = 409`
- `staleWriteError = CANVAS_REVISION_CONFLICT`
- `staleCategoryWriteStatus = 409`
- `staleItemWriteStatus = 409`
- `staleItemDeleteStatus = 409`

随后再次执行 `verify:system-observability`，gray 返回：

- `audits.total = 556`
- `audits.withRequestId = 19`
- `audits.requestIdCoveragePercent = 19`
- `conflicts.totalLast24h = 6`
- `canvasRevisionLast24h = 1`
- `resourceRevisionLast24h = 3`
- `adminSettingsRevisionLast24h = 2`

### 公网 gray gate

以：

- `XINGHUAN_VERIFY_BASE_URL=https://canvas-next.hhh2121.xyz`

执行通过：

- `npm run verify:request-chain-observability`
- `npm run verify:system-observability`

公网关键结果：

- request-chain：
  - `ok = true`
  - 审计 `ip = 101.33.75.38`
- system observability：
  - `currentDatabase = xinghuan_canvas_gray`
  - `expectedDatabase = xinghuan_canvas_gray`
  - `targetMatched = true`
  - `tasks.failedLast24h = 7`
  - `tasks.failedLast7d = 21`
  - `audits.total = 558`
  - `audits.withRequestId = 21`
  - `audits.requestIdCoveragePercent = 21`
  - `conflicts.totalLast24h = 6`

### Header smoke

- gray 本机：
  - `http://127.0.0.1:18200/api/status`
  - 响应头保留：
    - `x-request-id: phase-e-governance-gray-header-check`
- gray 公网：
  - `https://canvas-next.hhh2121.xyz/api/status`
  - 响应头保留：
    - `x-request-id: phase-e-governance-gray-public-check`

## 结论

- gray 已完成长期观测治理第一批发布。
- 新增失败窗口与 conflict 统计已在 gray 实际累计，不是空 schema。
- gray 当前后续重点转为：
  - 趋势展示
  - 阈值/告警
  - `requestId` 覆盖率提升
