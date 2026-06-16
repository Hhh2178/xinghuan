# Phase E 长期观测治理第二批正式发布记录（2026-06-15）

## 目标

- 将 `Phase E` 第二批长期观测治理正式发布到 production。
- 在不引入新表和新后台交互的前提下，把当前读数推进到最小健康判断。

## 本次正式结论

- production 已完成实际发布。
- 当前 production active release：
  - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-governance-batch2-prod-r1`

## 发布包

- release：`20260615-phase-e-observability-governance-batch2-prod-r1`
- 本机产物：
  - `dist-release/20260615-phase-e-observability-governance-batch2-prod-r1.tar.gz`
- 本机 SHA256：
  - `E96722B1AA84CDE32F38FD745334E258EFEA29B03140AF78666663226321322E`
- 服务器 SHA256：
  - `e96722b1aa84cde32f38fd745334e258efea29b03140af78666663226321322e`

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

## 正式验收

### 本机 gate

- `npm run verify:release-preflight`
- `node scripts/verify-system-observability.mjs`
- `npm run verify:request-chain-observability`

关键结果：

- `environment = production`
- `currentReleaseTarget = /opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-governance-batch2-prod-r1`
- `tasks.health.status = warning`
- `tasks.health.summary = 24h 内出现失败任务，建议继续观察`
- `tasks.trend.failed24hDailyAverageBaseline = 1`
- `tasks.trend.failed24hVs7dDailyAverage = 4`
- `audits.coverageHealth.status = critical`
- `audits.conflicts.health.status = healthy`

### 公网 production gate

以：

- `XINGHUAN_VERIFY_BASE_URL=https://canvas.hhh2121.xyz`

执行通过：

- `node scripts/verify-system-observability.mjs`
- `npm run verify:request-chain-observability`

## 结论

- production 已完成长期观测治理第二批发布。
- 当前 production 已具备最小健康判断能力，后续重点转为告警闭环和覆盖率提升。
