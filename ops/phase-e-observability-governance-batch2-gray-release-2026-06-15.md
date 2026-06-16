# Phase E 长期观测治理第二批灰度发布记录（2026-06-15）

## 目标

- 将 `Phase E` 第二批长期观测治理发布到 gray。
- 在现有 task/audit 数据上补上健康判断和短窗口趋势，不新增表结构。

## 本次灰度结论

- gray 已完成实际发布。
- 当前 gray active release：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260615-phase-e-observability-governance-batch2-gray-r1`

## 发布包

- release：`20260615-phase-e-observability-governance-batch2-gray-r1`
- 本机产物：
  - `dist-release/20260615-phase-e-observability-governance-batch2-gray-r1.tar.gz`
- 本机 SHA256：
  - `725C0E31051FC21AF0481B578935F7273D582D3B942CA112EAE22D4EDF6BC4EE`
- 服务器 SHA256：
  - `725c0e31051fc21af0481b578935f7273d582d3b942ca112eae22d4edf6bc4ee`

## 本轮变更点

- `observability.tasks.health`
- `observability.tasks.trend.failed24hDailyAverageBaseline`
- `observability.tasks.trend.failed24hVs7dDailyAverage`
- `observability.audits.coverageHealth`
- `observability.audits.conflicts.health`
- 后台系统页新增：
  - `任务健康`
  - `24h 失败 vs 7d 日均`
  - `请求ID健康`
  - `冲突健康`

## 灰度验收

### 本机 gate

- `npm run verify:release-preflight`
- `node scripts/verify-system-observability.mjs`
- `npm run verify:request-chain-observability`

关键结果：

- `environment = gray`
- `currentReleaseTarget = /opt/apps/xinghuan-canvas-next/releases/20260615-phase-e-observability-governance-batch2-gray-r1`
- `tasks.health.status = warning`
- `tasks.health.summary = 24h 内出现失败任务，建议继续观察`
- `tasks.trend.failed24hDailyAverageBaseline = 3`
- `tasks.trend.failed24hVs7dDailyAverage = 4`
- `audits.coverageHealth.status = critical`
- `audits.conflicts.health.status = critical`

### 公网 gray gate

以：

- `XINGHUAN_VERIFY_BASE_URL=https://canvas-next.hhh2121.xyz`

执行通过：

- `node scripts/verify-system-observability.mjs`
- `npm run verify:request-chain-observability`

## 结论

- gray 已完成长期观测治理第二批发布。
- 现在 gray 不只返回观测值，也会直接给出最小健康判断和短窗口趋势。
