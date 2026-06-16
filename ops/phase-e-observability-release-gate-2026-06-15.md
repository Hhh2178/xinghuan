# Phase E 可观测性与放行 Gate（2026-06-15）

## 目的

本文件用于把 `Phase E` 当前需要固定执行的 gray / production 放行 gate 收口成单一入口，避免后续继续只翻零散发布记录判断是否可放行。

当前范围只覆盖：

- `x-request-id` 请求链路基线
- `/api/admin/system` 最小系统观测项
- release package 中关键 verify 脚本完整性

它不是单独替代发布记录的证明；真实发布仍以当次 gray / production release 记录为准。

补充：

- `2026-06-16` 已对 current release 验收脚本补做热补丁，修复 `Observability` / `System Observability` 假 Provider 残留问题。
- 记录见：
  - `ops/phase-e-observability-script-cleanup-hotfix-2026-06-16.md`

## Gray Gate

gray current release 切换后，至少执行：

1. `npm run verify:release-preflight`
2. `npm run verify:request-chain-observability`
3. `npm run verify:system-observability`

说明：

- 当命令在对应 release 目录内、且已 source 对应 env 文件时，当前脚本会默认跟随 `XINGHUAN_API_HOST / XINGHUAN_API_PORT`。
- 如果在其它 shell 环境中执行，再显式传 `XINGHUAN_VERIFY_BASE_URL`。

人工核对：

- `curl -i http://127.0.0.1:18200/api/status` 返回 `x-request-id`
- 管理员登录后 `/api/admin/system` 返回：
  - `database.currentDatabase`
  - `database.expectedDatabase`
  - `database.targetMatched`
  - `observability.tasks`
  - `observability.audits.requestIdCoveragePercent`

## Production Gate

production current release 切换后，至少执行：

1. `npm run verify:release-preflight`
2. `npm run verify:request-chain-observability`
3. `npm run verify:system-observability`

说明：

- 当前脚本已修正为默认跟随 production env 中的 `18100` 端口，不再默认误打 gray `18200`。
- 如果不在 release 目录内 source env 执行，必须显式传 `XINGHUAN_VERIFY_BASE_URL`。

人工核对：

- `curl -i http://127.0.0.1:18100/api/status` 返回 `x-request-id`
- 管理员登录后 `/api/admin/system` 返回：
  - `database.currentDatabase`
  - `database.expectedDatabase`
  - `database.targetMatched`
  - `observability.tasks`
  - `observability.audits.requestIdCoveragePercent`

## Rollback Gate

如果 gray 或 production 任一 gate 失败，不进入“验收通过”表述，先执行 rollback 判断：

1. `current` 是否可回指上一 release
2. 回指后 `/api/status` 是否恢复
3. 回指后 `/api/admin/system` 是否恢复基本可读
4. 回滚后是否仍能回写 `x-request-id`

只有这些 rollback 条件明确可执行，后续才能把本轮 gate 继续写成长期可复用模板。

## 与其他文档的关系

- 当前运行态入口：`ops/README.md`
- 生产验收清单：`ops/production-acceptance-checklist.md`
- Phase E 设计：`docs/superpowers/specs/2026-06-15-phase-e-system-observability-and-release-gates.md`

## 当前真实状态

截至 `2026-06-15`，当前真实状态为：

- gray 已完成实际放行：
  - release：`20260615-phase-e-observability-governance-batch3-gray-r2`
  - 发布记录：
    - `ops/phase-e-observability-gray-release-2026-06-15.md`
    - `ops/phase-e-observability-governance-gray-release-2026-06-15.md`
    - `ops/phase-e-observability-governance-batch2-gray-release-2026-06-15.md`
    - `ops/phase-e-observability-governance-batch3-gray-release-2026-06-15.md`
- production 已完成实际放行：
  - release：`20260615-phase-e-observability-governance-batch3-prod-r2`
  - 发布记录：
    - `ops/phase-e-observability-production-release-2026-06-15.md`
    - `ops/phase-e-observability-governance-production-release-2026-06-15.md`
    - `ops/phase-e-observability-governance-batch2-production-release-2026-06-15.md`
    - `ops/phase-e-observability-governance-batch3-production-release-2026-06-15.md`
- gray rollback 样本已完成：
  - 记录收口在 `ops/phase-e-observability-gray-release-2026-06-15.md`
- production rollback 样本已完成：
  - `ops/phase-e-observability-production-rollback-2026-06-15.md`
- 长期观测治理第一批已完成：
  - `failedLast1h / failedLast24h / failedLast7d`
  - `observability.audits.conflicts.*`
  - `409 revision conflict -> observability audit`
- 长期观测治理第二批已完成：
  - `tasks.health`
  - `tasks.trend.failed24hVs7dDailyAverage`
  - `audits.coverageHealth`
  - `audits.conflicts.health`
- 长期观测治理第三批已完成：
  - `tasks.failedLast30d`
  - `tasks.trend.failed24hVs30dDailyAverage`
  - `tasks.trend.failed7dVs30dDailyAverage`
  - `audits.sampledLast24h / sampledLast7d`
  - `audits.requestIdCoverageLast24hPercent / requestIdCoverageLast7dPercent`
  - `audits.conflicts.totalLast7d / totalLast30d / trend`
  - `observability.alerts`
  - `auth.admin_login / auth.admin_logout / system.read` audit 补样
- `2026-06-16` 热补丁已完成：
  - `verify-system-observability` 不再创建测试 Provider
  - `verify-request-chain-observability` 创建后自动删除测试 Provider
  - gray / production current 复验后 `leakedProviders = 0`
- 当前仍待后续补齐：
  - 外部通知闭环
  - `requestId` 实际覆盖率提升
