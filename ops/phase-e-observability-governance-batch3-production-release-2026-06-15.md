# Phase E 长期观测治理第三批正式发布记录（2026-06-15）

## 目标

- 将 `Phase E` 第三批长期观测治理正式发布到 production。
- 在 production 系统页补齐长窗口趋势、最近 requestId 覆盖率和活动告警。
- 修正 production 本机 gate 默认目标，让 source production env 后可直接执行，不再误打 gray。

## 本次正式结论

- production 已完成实际发布。
- 本轮 release 演进：
  - `20260615-phase-e-observability-governance-batch3-prod-r1`
    - 完成 Batch 3 payload 与 UI 上线
  - `20260615-phase-e-observability-governance-batch3-prod-r2`
    - 热修 gate 脚本默认目标，确保 production 本机 gate 默认命中 `18100`
- 当前 production active release：
  - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-governance-batch3-prod-r2`

## 发布包

- release：`20260615-phase-e-observability-governance-batch3-prod-r2`
- 本机产物：
  - `dist-release/20260615-phase-e-observability-governance-batch3-prod-r2.tar.gz`
- 本机 SHA256：
  - `9FC53582A914D52E18437A98CD3631F57DE89C01B657B6E838E6BC1857B29C98`
- 服务器 SHA256：
  - `9fc53582a914d52e18437a98cd3631f57de89c01b657b6e838e6bc1857b29c98`

## 本轮变更点

- `observability.tasks.failedLast30d`
- `observability.tasks.trend.failed30dDailyAverageBaseline`
- `observability.tasks.trend.failed24hVs30dDailyAverage`
- `observability.tasks.trend.failed7dVs30dDailyAverage`
- `observability.audits.sampledLast24h / sampledLast7d`
- `observability.audits.withRequestIdLast24h / withRequestIdLast7d`
- `observability.audits.requestIdCoverageLast24hPercent / requestIdCoverageLast7dPercent`
- `observability.audits.coverageTrend.*`
- `observability.audits.conflicts.totalLast7d / totalLast30d / trend`
- `observability.alerts`
- 新增 audit 补样：
  - `auth.admin_login`
  - `auth.admin_logout`
  - `system.read`
- `verify:release-preflight` / `verify:request-chain-observability` / `verify:system-observability`
  - 默认跟随 `XINGHUAN_API_HOST / XINGHUAN_API_PORT`

## 正式验收

### 本机 gate

在当前 release 目录 source production env 后，直接执行通过：

- `npm run verify:release-preflight`
- `node scripts/verify-system-observability.mjs`
- `npm run verify:request-chain-observability`

关键结果：

- `environment = production`
- `currentReleaseTarget = /opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-governance-batch3-prod-r2`
- `tasks.failedLast30d = 8`
- `tasks.trend.failed24hVs30dDailyAverage = 5`
- `tasks.trend.failed7dVs30dDailyAverage = 1`
- `audits.requestIdCoverageLast24hPercent = 64`
- `audits.requestIdCoverageLast7dPercent = 12`
- `alerts.activeCount = 2`
- `alerts.highestSeverity = warning`

当前活动告警：

- `task_failures = warning`
- `request_id_coverage = warning`

### 公网 production gate

以：

- `XINGHUAN_VERIFY_BASE_URL=https://canvas.hhh2121.xyz`

执行通过：

- `node scripts/verify-system-observability.mjs`
- `npm run verify:request-chain-observability`

header smoke：

- `GET https://canvas.hhh2121.xyz/api/status`
- `x-request-id: phase-e-batch3-prod-r2-public-header-check`

## 结论

- production 已完成长期观测治理第三批发布。
- 当前 production 系统页已经可以直接读到：
  - 30d 任务趋势
  - 近24h / 近7d requestId 覆盖率
  - 冲突长窗口趋势
  - 当前活动告警与建议动作
- 当前 production 的下一步重点转为：
  - 继续提升 requestId 实际覆盖率
  - 视需要把活动告警继续外送到通知通道

## 2026-06-16 补充

- 当前 production release 已补做脚本热补丁：
  - `verify-system-observability.mjs`
  - `verify-request-chain-observability.mjs`
- 修复内容：
  - 不再遗留 `System Observability ...` / `Observability ...` 假 Provider
- 复验结果：
  - production current 重新执行：
    - `node scripts/verify-system-observability.mjs`
    - `npm run verify:request-chain-observability`
  - `leakedProviders = 0`
- 独立记录：
  - `ops/phase-e-observability-script-cleanup-hotfix-2026-06-16.md`
