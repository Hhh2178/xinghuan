# Phase E 长期观测治理第三批灰度发布记录（2026-06-15）

## 目标

- 将 `Phase E` 第三批长期观测治理发布到 gray。
- 在现有 task / audit 数据上补齐长窗口趋势、活动告警和最近 requestId 覆盖率。
- 修正 gray / production 共用的 gate 脚本默认目标，让本机 gate 默认跟随当前 env 端口。

## 本次灰度结论

- gray 已完成实际发布。
- 本轮 release 演进：
  - `20260615-phase-e-observability-governance-batch3-gray-r1`
    - 完成 Batch 3 payload 与 UI 上线
  - `20260615-phase-e-observability-governance-batch3-gray-r2`
    - 热修 gate 脚本默认目标，避免 production / gray 本机 gate 误打 `18200`
- 当前 gray active release：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260615-phase-e-observability-governance-batch3-gray-r2`

## 发布包

- release：`20260615-phase-e-observability-governance-batch3-gray-r2`
- 本机产物：
  - `dist-release/20260615-phase-e-observability-governance-batch3-gray-r2.tar.gz`
- 本机 SHA256：
  - `84530A2947442F5CB0AD17ECCA331C58BB798C8DA54D5765AD1E8FA0CF57222A`
- 服务器 SHA256：
  - `84530a2947442f5cb0ad17ecca331c58bb798c8da54d5765ad1e8fa0cf57222a`

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

## 灰度验收

### 本机 gate

在当前 release 目录 source gray env 后，直接执行通过：

- `npm run verify:release-preflight`
- `node scripts/verify-system-observability.mjs`
- `npm run verify:request-chain-observability`

关键结果：

- `environment = gray`
- `currentReleaseTarget = /opt/apps/xinghuan-canvas-next/releases/20260615-phase-e-observability-governance-batch3-gray-r2`
- `tasks.failedLast30d = 21`
- `tasks.trend.failed24hVs30dDailyAverage = 6`
- `tasks.trend.failed7dVs30dDailyAverage = 2`
- `audits.requestIdCoverageLast24hPercent = 61`
- `audits.requestIdCoverageLast7dPercent = 13`
- `alerts.activeCount = 3`
- `alerts.highestSeverity = critical`

当前活动告警：

- `task_failures = warning`
- `request_id_coverage = warning`
- `revision_conflicts = critical`

### 公网 gray gate

以：

- `XINGHUAN_VERIFY_BASE_URL=https://canvas-next.hhh2121.xyz`

执行通过：

- `node scripts/verify-system-observability.mjs`
- `npm run verify:request-chain-observability`

header smoke：

- `GET https://canvas-next.hhh2121.xyz/api/status`
- `x-request-id: phase-e-batch3-gray-r2-public-header-check`

## 结论

- gray 已完成长期观测治理第三批发布。
- 当前 gray 系统页现在不仅有健康判断，还能直接看到：
  - 30d 长窗口任务趋势
  - 近24h / 近7d requestId 覆盖率
  - 冲突 7d / 30d 总量和 delta
  - 当前活动告警及建议动作
- gray 当前的下一步重点不再是“把字段做出来”，而是：
  - 压低 conflict 活动
  - 继续提升 requestId 实际覆盖率

## 2026-06-16 补充

- 当前 gray release 已补做脚本热补丁：
  - `verify-system-observability.mjs`
  - `verify-request-chain-observability.mjs`
- 修复内容：
  - 不再遗留 `System Observability ...` / `Observability ...` 假 Provider
- 复验结果：
  - gray current 重新执行：
    - `node scripts/verify-system-observability.mjs`
    - `npm run verify:request-chain-observability`
  - `leakedProviders = 0`
- 独立记录：
  - `ops/phase-e-observability-script-cleanup-hotfix-2026-06-16.md`
