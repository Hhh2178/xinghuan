# Phase E 灰度发布记录（2026-06-15）

## 目标

- 将 `Phase E` 的请求链路观测与系统观测项真实发布到灰度环境。
- 按当前 gate 在灰度环境完成最小可复用放行样本：
  - `npm run verify:release-preflight`
  - `npm run verify:request-chain-observability`
  - `npm run verify:system-observability`

## 本次灰度结论

- `Phase E` 已完成灰度发布。
- 当前灰度 active release：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260615-phase-e-observability-gray-r2`
- 当前生产 active release 仍保持：
  - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-prod-r2`
- 截至 `2026-06-15` 的真实状态应写为：
  - `Phase E` 已完成 gray 放行
  - `Phase E` production 待放行

## 发布包

- release：`20260615-phase-e-observability-gray-r2`
- 本机产物：
  - `dist-release/20260615-phase-e-observability-gray-r2.tar.gz`
- 本机 SHA256：
  - `19D366B0FE3710EAFF593EC4E36FEFEC565155712DE33B473DC4879C83973A0E`
- 服务器 SHA256：
  - `19d366b0fe3710eaff593ec4e36fefec565155712de33b473dc4879c83973a0e`

## 包内关键内容

本轮灰度包已确认包含：

- `x-request-id` 请求链路基线
- `/api/admin/system` 新增数据库目标与观测统计
- 后台系统页新增最小观测项
- release package 验证脚本：
  - `verify:release-preflight`
  - `verify:request-chain-observability`
  - `verify:system-observability`

## 服务器执行

### 发布路径

- 上传包：
  - `/tmp/20260615-phase-e-observability-gray-r2.tar.gz`
- release 目录：
  - `/opt/apps/xinghuan-canvas-next/releases/20260615-phase-e-observability-gray-r2`

### 执行步骤

1. `npm ci`
2. `node scripts/db-migrate.mjs`
3. 切换：
   - `ln -sfn /opt/apps/xinghuan-canvas-next/releases/20260615-phase-e-observability-gray-r2 /opt/apps/xinghuan-canvas-next/current`
4. 重启：
   - `sudo systemctl restart xinghuan-canvas-next.service`
   - `sudo systemctl restart xinghuan-canvas-next-worker.service`

### 迁移结果

- `{"ok":true,"applied":[],"skipped":14}`

## 上线后快照

gray current release 执行：

- `npm run verify:release-preflight`

结果：

- `currentReleaseTarget = /opt/apps/xinghuan-canvas-next/releases/20260615-phase-e-observability-gray-r2`
- `environment = gray`
- `database.name = xinghuan_canvas_gray`
- `api = active`
- `worker = active`

## 灰度验收

### 服务器本机通过项

- `npm run verify:release-preflight`
- `npm run verify:request-chain-observability`
- `npm run verify:system-observability`

灰度服务器本机关键结果：

- request-chain：
  - `ok = true`
  - 审计 `ip = 127.0.0.1`
- system observability：
  - `currentDatabase = xinghuan_canvas_gray`
  - `expectedDatabase = xinghuan_canvas_gray`
  - `targetMatched = true`
  - `tasks.total = 122`
  - `tasks.queued = 6`
  - `tasks.failedLast24h = 7`
  - `audits.total = 540`
  - `audits.sampled = 100`
  - `audits.withRequestId = 3`
  - `audits.requestIdCoveragePercent = 3`

### 公网灰度入口通过项

以：

- `XINGHUAN_VERIFY_BASE_URL=https://canvas-next.hhh2121.xyz`

执行通过：

- `npm run verify:request-chain-observability`
- `npm run verify:system-observability`

公网灰度关键结果：

- request-chain：
  - `ok = true`
  - 审计 `ip = 101.33.75.38`
- system observability：
  - `currentDatabase = xinghuan_canvas_gray`
  - `expectedDatabase = xinghuan_canvas_gray`
  - `targetMatched = true`
  - `tasks.total = 122`
  - `tasks.queued = 6`
  - `tasks.failedLast24h = 7`
  - `audits.total = 541`
  - `audits.sampled = 100`
  - `audits.withRequestId = 4`
  - `audits.requestIdCoveragePercent = 4`

### Header smoke

执行：

- `curl -i -H 'x-request-id: phase-e-gray-header-check' https://canvas-next.hhh2121.xyz/api/status`

结果：

- 响应头已保留：
  - `x-request-id: phase-e-gray-header-check`

## 重要观察

### 1. gray 数据库目标已与 production 不同

本轮 gray preflight 与系统观测返回：

- `currentDatabase = xinghuan_canvas_gray`
- `expectedDatabase = xinghuan_canvas_gray`

这说明当前 gray 已经对准 `xinghuan_canvas_gray`，不应再沿用旧文档里 `Phase D` 灰度的旧 release 状态。

### 2. requestId 覆盖率已可观测，但当前数值仍低

本轮 gray 已能稳定返回：

- `audits.requestIdCoveragePercent`

但当前公网灰度仅观察到：

- `4%`

这代表“已具备可观测性”，不代表“历史审计已完成高覆盖率补齐”。后续文档和发布结论不能夸大这一点。

### 3. 有一次重启后的瞬时探测失败

灰度切换后首轮 preflight 曾短暂出现：

- `ECONNREFUSED 127.0.0.1:18200`

后续重试通过，说明是服务重启窗口问题，不是 release 包内容缺失。

### 4. `gray-r2` 已补齐 preflight 自动识别，并完成真实 rollback 样本

本轮灰度已继续补发 `gray-r2`，将 `capture-release-preflight.mjs` 的自动识别逻辑一并带上。当前在灰度服务器上仅加载环境文件并设置：

- `XINGHUAN_VERIFY_BASE_URL=http://127.0.0.1:18200`

执行 `npm run verify:release-preflight` 已可自动返回：

- `currentReleaseLink = /opt/apps/xinghuan-canvas-next/current`
- `currentReleaseTarget = /opt/apps/xinghuan-canvas-next/releases/20260615-phase-e-observability-gray-r2`
- `services.api = active`
- `services.worker = active`

同时，本轮已完成真实 rollback 样本：

1. `gray-r2 -> gray-r1`
2. 在 `gray-r1` 上验证：
   - `npm run verify:request-chain-observability`
   - `npm run verify:system-observability`
   - `curl -i -H 'x-request-id: phase-e-gray-rollback-check' http://127.0.0.1:18200/api/status`
3. 再恢复：
   - `gray-r1 -> gray-r2`

结论：

- 应用链路回滚可执行，回滚后核心观测接口仍正常
- 旧版 `gray-r1` 的 preflight 仍返回 `currentReleaseTarget = null` 与 `services = null`
- 因此当前可复用的 preflight 与 rollback 基线应以 `gray-r2` 为准

## 当前遗留项

- 当前 gray / production rollback 样本都已补齐，仍待继续补：
  - 更长期的失败趋势与冲突统计

## 当前建议

下一步建议：

1. 保持 `gray-r2` 作为当前 rollback 与 preflight 基线
2. 以 `ops/phase-e-observability-production-rollback-2026-06-15.md` 作为 production rollback 样本基线
3. 继续提升 `requestId` 审计覆盖率
