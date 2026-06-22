# 文档总索引

这是无限画布 2.0 当前推荐的第一跳文档入口。

## 默认阅读顺序

1. `AGENTS.md`
2. `docs/INDEX.md`
3. `docs/systems/README.md`
4. `README.md`
5. `MEMORY.md`
6. `ops/README.md`
7. `DEVLOG.md`

## 先判断你要找什么

### 协作规则、入口顺序、归档规则

看 `docs/governance/`：

- `docs/governance/README.md`
- `docs/governance/collaboration-and-workflow.md`
- `docs/governance/codegraph-and-repo-navigation.md`
- `docs/governance/archive-policy.md`

### 系统地图、协议、接口、执行链路

看 `docs/systems/`：

- `docs/systems/runninghub/`
- `docs/systems/admin/`
- `docs/systems/api/`
- `docs/systems/worker/`

### 长期有效的项目记忆

看 `docs/memory/README.md`，以及兼容入口 `MEMORY.md`。

### 逐日推进、发布与验证证据

看 `docs/logbooks/README.md`：

- `docs/logbooks/daily/`
- `docs/logbooks/releases/`
- `docs/logbooks/validations/`
- `docs/logbooks/incidents/`

### 专项设计、演进记录、历史方案

看 `docs/records/README.md`，以及已有的 `docs/superpowers/specs/`、`docs/superpowers/plans/`。

## 当前核心系统导航

### RunningHub

- 协议接入与后台建模：`docs/systems/runninghub/README.md`
- Workflow / App 区分：`docs/systems/runninghub/workflow-app-differences.md`
- 节点运行态与参数链路：`docs/systems/runninghub/node-runtime-flow.md`

### 后台 Admin

- 后台能力边界：`docs/systems/admin/README.md`
- 协议与信息架构：`docs/systems/admin/protocol-and-capabilities.md`

### API

- 前后端接口地图：`docs/systems/api/interface-map.md`
- 请求到任务的链路：`docs/systems/api/request-response-flow.md`

### Worker

- 执行链：`docs/systems/worker/execution-chain.md`
- 队列与并发：`docs/systems/worker/queue-and-concurrency.md`

## 与旧入口的关系

- `README.md`：当前状态摘要与入口跳转
- `AGENTS.md`：项目总纲、协作方式、治理规则
- `MEMORY.md`：长期记忆兼容入口
- `DEVLOG.md`：旧台账兼容入口，后续逐步切到 `docs/logbooks/daily/`
- `ops/README.md`：当前运行态与放行材料入口
- `docs/project-atlas/README.md`：仍保留为兼容层总纲，但新的总导航以本文件为准
