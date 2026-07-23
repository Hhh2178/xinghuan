# 文档总索引

这是无限画布 2.0 当前推荐的第一跳文档入口。

## 默认阅读顺序

1. `AGENTS.md`
2. `docs/INDEX.md`
3. `DESIGN.md`
4. `CONTEXT.md`
5. `docs/systems/README.md`
6. `README.md`
7. `MEMORY.md`
8. `ops/README.md`
9. `DEVLOG.md`

## 先判断你要找什么

### 领域词汇、跨系统不变量、架构决策

- 领域语言与实体边界：`CONTEXT.md`
- 架构决策索引：`docs/adr/README.md`
- Context / ADR 治理规范：`docs/governance/domain-context-and-adr-standard.md`
- 系统已实现事实仍以 `docs/systems/` 为准；`Proposed` ADR 不代表已经上线。

### 协作规则、入口顺序、归档规则

看 `docs/governance/`：

- `docs/governance/README.md`
- `docs/governance/engineering-guardrails.md`
- `docs/governance/hotspot-risk-scorecard.md`
- `docs/governance/hotspot-decomposition-workflow.md`
- `docs/governance/release-version-and-retention-policy.md`
- `docs/governance/collaboration-and-workflow.md`
- `docs/governance/codegraph-and-repo-navigation.md`
- `docs/governance/archive-policy.md`
- `docs/governance/domain-context-and-adr-standard.md`

### 系统地图、协议、接口、执行链路

看 `docs/systems/`：

- `docs/systems/runninghub/`
- `docs/systems/admin/`
- `docs/systems/api/`
- `docs/systems/worker/`
- `docs/systems/canvas/`
- `docs/systems/providers/`
- `docs/systems/auth-and-users/`
- `docs/systems/storage-and-data/`
- `docs/systems/observability-and-ops/`
- `docs/systems/harness/`
- `docs/systems/agent-runtime/`

### 长期有效的项目记忆

看 `docs/memory/README.md`，以及兼容入口 `MEMORY.md`。

### 逐日推进、发布与验证证据

看 `docs/logbooks/README.md`：

- `docs/logbooks/daily/`
- `docs/logbooks/releases/`
- `docs/logbooks/validations/`
- `docs/logbooks/incidents/`

### 当前状态与环境权威源

- 产品版本：根 `package.json`
- 非密环境拓扑：`config/environments.json`
- 当前部署状态：`ops/current/release-state.json`
- 状态校验：`npm run verify:authority-state`

### 专项设计、演进记录、历史方案

看 `docs/records/README.md`，以及已有的 `docs/superpowers/specs/`、`docs/superpowers/plans/`。

- 超级文件拆分台账：`docs/records/architecture/2026-06-24-hotspot-superfile-decomposition-ledger.md`
- `1200+` source 文件 watchlist 也统一记录在这份台账中
- ComfyUI 当前阶段封存：`docs/records/providers/2026-07-04-comfyui-phase-archive-v0525.md`
- 生成产物生命周期治理规格：`docs/superpowers/specs/2026-07-17-generation-artifact-lifecycle-governance.md`
- 生成库服务端权威实施计划：`docs/superpowers/plans/2026-07-17-generation-library-authority-migration.md`

### 权威源责任速查

| 内容 | 权威源 |
| --- | --- |
| 领域词汇与跨系统不变量 | `CONTEXT.md` |
| 当前系统实现 | `docs/systems/` |
| 架构选择及其理由 | `docs/adr/` |
| 实施步骤 | `docs/superpowers/plans/` |
| 当前部署状态 | `ops/current/release-state.json` |
| 执行与验证证据 | `docs/logbooks/` |

## 当前核心系统导航

### RunningHub

- 协议接入与后台建模：`docs/systems/runninghub/README.md`
- Workflow / App 区分：`docs/systems/runninghub/workflow-app-differences.md`
- 节点运行态与参数链路：`docs/systems/runninghub/node-runtime-flow.md`

### 后台 Admin

- 后台能力边界：`docs/systems/admin/README.md`
- 协议与信息架构：`docs/systems/admin/protocol-and-capabilities.md`
- 全项目设计总入口：`DESIGN.md`
- 后台视觉与交互规范：`docs/systems/admin/frontend-design/`
- 系统健康可视化：`docs/systems/admin/frontend-design/system-health-visualization-standard.md`

### API

- 前后端接口地图：`docs/systems/api/interface-map.md`
- 请求到任务的链路：`docs/systems/api/request-response-flow.md`

### Worker

- 执行链：`docs/systems/worker/execution-chain.md`
- 队列与并发：`docs/systems/worker/queue-and-concurrency.md`

### Canvas

- 节点与数据模型：`docs/systems/canvas/node-and-data-model.md`
- 项目与素材链路：`docs/systems/canvas/project-and-material-flow.md`
- 前台画布视觉规范：`docs/systems/canvas/frontend-design/`

### Providers

- 协议分层：`docs/systems/providers/protocol-layering.md`
- 请求体与文件策略：`docs/systems/providers/request-body-and-file-strategy.md`

### Auth 与 Users

- 会话与 CSRF：`docs/systems/auth-and-users/session-and-csrf.md`
- revision 与 ownership：`docs/systems/auth-and-users/revision-and-ownership-guard.md`
- 权限默认值与管理员边界：`docs/systems/auth-and-users/permissions-and-administrator-boundary.md`

### Storage 与 Data

- Postgres / Redis 边界：`docs/systems/storage-and-data/postgres-and-redis-boundaries.md`
- 素材与输出落库：`docs/systems/storage-and-data/material-and-output-storage.md`

### Observability 与 Ops

- release gate：`docs/systems/observability-and-ops/release-gates.md`
- gray / production 运维：`docs/systems/observability-and-ops/gray-and-production-operations.md`

### Harness

- 项目执行分层：`docs/systems/harness/README.md`
- workspace / verify / release 地图：`docs/systems/harness/workspace-verify-release-map.md`
- 子 harness 接入约定：`docs/systems/harness/subharness-convention.md`

### Agent Runtime

- 当前基线与迁移入口：`docs/systems/agent-runtime/README.md`
- Accepted 架构：`docs/adr/0003-canvas-agent-runtime-and-llm-routing.md`
- 目标规格：`docs/superpowers/specs/2026-07-22-canvas-agent-runtime-and-llm-routing.md`
- 体验重设计需求（对齐中）：`docs/superpowers/specs/2026-07-23-canvas-agent-experience-redesign-requirements.md`

## 与旧入口的关系

- `README.md`：当前状态摘要与入口跳转
- `AGENTS.md`：项目总纲、协作方式、治理规则
- `CONTEXT.md`：领域语言和跨系统不变量，不承接运行态与方案历史
- `MEMORY.md`：长期记忆兼容入口
- `DEVLOG.md`：旧台账兼容入口，后续逐步切到 `docs/logbooks/daily/`
- `ops/README.md`：当前运行态与放行材料入口
- `docs/project-atlas/README.md`：仍保留为兼容层总纲，但新的总导航以本文件为准
