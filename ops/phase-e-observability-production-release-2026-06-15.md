# Phase E 正式发布记录（2026-06-15）

## 目标

- 将 `Phase E` 的请求链路观测与系统观测项正式发布到 production 环境。
- 按当前 gate 在 production 环境完成最小可复用放行样本：
  - `npm run verify:release-preflight`
  - `npm run verify:request-chain-observability`
  - `npm run verify:system-observability`

## 本次正式结论

- `Phase E` 已完成正式发布。
- 当前生产 active release：
  - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-prod-r2`
- 当前灰度 active release：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260615-phase-e-observability-gray-r2`
- 截至 `2026-06-15` 的真实状态应写为：
  - `Phase E` 已完成 gray 放行
  - `Phase E` 已完成 production 放行

## 发布包

- release：`20260615-phase-e-observability-prod-r2`
- 本机产物：
  - `dist-release/20260615-phase-e-observability-prod-r2.tar.gz`
- 本机 SHA256：
  - `A10DF87060ACCD32E5285A4A2F082A2F4D4165EE41903D32065A2E18C71B0C5B`

## 包内关键内容

本轮 production 包已确认包含：

- `x-request-id` 请求链路基线
- `/api/admin/system` 数据库目标与观测统计
- 后台系统页最小观测项
- release package 验证脚本：
  - `verify:release-preflight`
  - `verify:request-chain-observability`
  - `verify:system-observability`

## 服务器执行

### 发布路径

- 上传包：
  - `/tmp/20260615-phase-e-observability-prod-r2.tar.gz`
- release 目录：
  - `/opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-prod-r2`

### 执行步骤

1. `npm ci`
2. 加载：
   - `/opt/apps/xinghuan-canvas/shared/canvas.env`
3. `node scripts/db-migrate.mjs`
4. 切换：
   - `ln -sfn /opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-prod-r2 /opt/apps/xinghuan-canvas/current`
5. 重启：
   - `sudo systemctl restart xinghuan-canvas.service`
   - `sudo systemctl restart xinghuan-canvas-worker.service`

### 迁移结果

- `{"ok":true,"applied":[],"skipped":14}`

## 上线后快照

production current release 执行：

- `npm run verify:release-preflight`

结果：

- `baseUrl = http://127.0.0.1:18100`
- `apiStatus.environment = production`
- `database.name = xinghuan_canvas_next`
- `users = 7`
- `canvases = 2`
- `assets = 7`
- `tasks = 88`
- `sessions = 59`

补充运行态确认：

- `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-prod-r2`
- `xinghuan-canvas.service = active`
- `xinghuan-canvas-worker.service = active`

## 正式验收

### 服务器本机通过项

- `npm run verify:release-preflight`
- `npm run verify:request-chain-observability`
- `npm run verify:system-observability`

production 服务器本机关键结果：

- request-chain：
  - `ok = true`
  - 审计 `ip = 127.0.0.1`
- system observability：
  - `currentDatabase = xinghuan_canvas_next`
  - `expectedDatabase = xinghuan_canvas_next`
  - `targetMatched = true`
  - `tasks.total = 88`
  - `tasks.queued = 5`
  - `tasks.running = 0`
  - `tasks.failedLast24h = 5`
  - `audits.total = 523`
  - `audits.sampled = 100`
  - `audits.withRequestId = 4`
  - `audits.requestIdCoveragePercent = 4`

### 公网 production 入口通过项

以：

- `XINGHUAN_VERIFY_BASE_URL=https://canvas.hhh2121.xyz`

执行通过：

- `npm run verify:request-chain-observability`
- `npm run verify:system-observability`

公网 production 关键结果：

- request-chain：
  - `ok = true`
  - 审计 `ip = 101.33.75.38`
- system observability：
  - `currentDatabase = xinghuan_canvas_next`
  - `expectedDatabase = xinghuan_canvas_next`
  - `targetMatched = true`
  - `tasks.total = 88`
  - `tasks.queued = 5`
  - `tasks.running = 0`
  - `tasks.failedLast24h = 5`
  - `audits.total = 523`
  - `audits.sampled = 100`
  - `audits.withRequestId = 4`
  - `audits.requestIdCoveragePercent = 4`

### Header smoke

执行：

- `curl -i -H 'x-request-id: phase-e-prod-public-header-check' https://canvas.hhh2121.xyz/api/status`

结果：

- 响应头已保留：
  - `x-request-id: phase-e-prod-public-header-check`

## 重要观察

### 1. `prod-r2` 已补齐 preflight 自动识别

此前 `prod-r1` 的 `verify:release-preflight` 仍无法自动识别：

- `currentReleaseLink`
- `currentReleaseTarget`
- `services.api`
- `services.worker`

本轮已通过 `prod-r2` 修复该问题。当前 production 本机执行：

- `XINGHUAN_VERIFY_BASE_URL=http://127.0.0.1:18100 npm run verify:release-preflight`

已返回：

- `currentReleaseLink = /opt/apps/xinghuan-canvas/current`
- `currentReleaseTarget = /opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-prod-r2`
- `services.api = active`
- `services.worker = active`

### 2. production requestId 覆盖率同样已可观测，但当前数值仍低

当前 production 返回：

- `audits.requestIdCoveragePercent = 4`

这说明当前只解决了“可观测”，没有解决“历史审计高覆盖率补齐”。后续如要把该指标作为质量门槛，需要先提升真实覆盖率。

## 当前遗留项

- `Phase E` 的 gray / production 放行与 rollback 样本已补齐，当前仍待继续推进：
  - 更长期的失败趋势与冲突统计

## 当前建议

下一步建议转到运维治理补强：

1. 以 `ops/phase-e-observability-production-rollback-2026-06-15.md` 作为 production rollback 样本基线
2. 提升 `requestId` 审计覆盖率
3. 把冲突统计与失败趋势纳入系统页或专项报表
