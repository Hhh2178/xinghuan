# RunningHub 默认 Key 优先与灰度迁移链路 Gray Release - 2026-06-23

## 发布目标

- 发布 RunningHub 单默认 Key 优先调度能力，并确保默认 Key 在并发占满后回退到其他启用 Key。
- 确认 RH Key 池在 provider 级覆盖 `workflow` 与 `AI 应用` 两条运行链路。
- 修补 gray 发布时 migration 未自动执行的问题，避免新字段只存在于代码、不存在于灰度数据库。

## 发布信息

- 环境：`gray`
- 版本：`v0.4.11`
- release：`20260623-runninghub-default-key-migrate-gray-r1-v0411`
- 上一灰度 release：`20260623-runninghub-key-pool-progress-gray-r1-v0410`

## Agent 已验证

### 本地代码与产物

- `npm install --package-lock-only`
- `npm run release:gray:prepare:runninghub -- --release=20260623-runninghub-default-key-migrate-gray-r1-v0411`
- prepare 结果应覆盖：
  - `build:single-port`
  - `verify-release-version-alignment`
  - `verify-release-package-contract`
  - `verify-runninghub-draft-and-summary-contract`
  - `verify-runninghub-output-reset-contract`
  - `verify-runninghub-worker-and-label-contract`
  - `verify-runninghub-admin-empty-input-contract`
  - `verify-runninghub-key-pool-contract`
  - `verify-runninghub-node-progress-contract`
  - `verify-gray-release-prepare-contract`
- 本轮关键实现：
  - RH Key 池新增 `isDefault`
  - 服务端与 Worker 统一做“仅允许一个默认 Key”的归一化
  - RH 可用 Key 选择顺序改为“默认 Key 优先，其他可用 Key 兜底”
  - gray 部署脚本在切换 release 前先加载 `shared/canvas-next.env` 并执行 `npm run db:migrate`

### 灰度数据库与运行态

- gray 数据库已确认存在：
  - `xh_providers.rh_key_pool`
  - migration `016_runninghub_key_pool.sql`
- 发布后需验证：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260623-runninghub-default-key-migrate-gray-r1-v0411`
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
  - `http://127.0.0.1:18200/api/status`
    - `version = 0.4.11`
    - `environment = gray`
  - `https://canvas-next.hhh2121.xyz/api/status`
    - `version = 0.4.11`
    - `environment = gray`

## 待用户验收

### 真实业务链路

- 在 RH 工作流与 RH AI 应用中分别验证 Key 池是否共用同一套 provider 级配置。
- 验证默认 Key 会优先吃到任务；当默认 Key 并发占满后，任务是否自动切换到其他启用 Key。
- 验证多个 Key 都占满后，任务是否进入排队而不是错误失败。

### 视觉与交互

- RH 工作台 Key 池默认 Key 标识、按钮状态与文案观感。
- RH 节点与后台工作台在灰度页面上的最终视觉效果。

## 风险与残留问题

- 这轮已经修补 gray migration 链路，但生产环境若未来复用同类发布脚本，也需要沿用相同的共享环境加载方式。
- 默认 Key 优先策略已在代码与运行态层验证，真实限流与三方平台行为仍需用户用实际 Key 池确认。

## 回滚信息

- `current` 回滚目标：`/opt/apps/xinghuan-canvas-next/releases/20260623-runninghub-key-pool-progress-gray-r1-v0410`
- 需要重启的服务：`xinghuan-canvas-next.service`、`xinghuan-canvas-next-worker.service`
- 回滚后需复查的接口：`/api/status`
