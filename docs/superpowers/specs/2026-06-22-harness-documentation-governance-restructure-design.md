# Harness 文档治理与知识库重构设计

## 目标

为当前无限画布 2.0 harness 工程建立一套可持续维护的文档治理结构，解决以下问题：

- 主入口文件职责交叉，`AGENTS.md`、`MEMORY.md`、`DEVLOG.md`、`ops/README.md`、`docs/project-atlas/README.md` 同时承担“当前状态入口”职责。
- 项目系统边界、协议设计、接口传输链路和执行架构没有形成稳定的按系统导航，导致任务开始时容易“乱找乱做”。
- 长期记忆、逐日推进、运行态证据和专项设计混写在少量大文件中，检索成本不断升高。
- 历史记录保留方式不清晰，归档规则存在但没有收敛成统一的结构和模板。

本次采用“平衡重构”策略：

- 先建立新的信息架构、入口、索引、规则和模板。
- 保留旧主入口文件作为兼容层，但将其瘦身为摘要与跳转入口。
- 在阶段一首批迁移最容易导致协作混乱的系统知识。
- 后续在新结构稳定后，再推进到更深层的历史迁移和入口压缩。

## 设计范围

本设计覆盖：

- `AGENTS.md` 的角色重构
- 全局索引入口设计
- `docs/` 下新的治理、系统知识、记忆、台账、记录五层结构
- 阶段一的迁移顺序与首批系统知识包
- 命名、归档、维护与更新责任规则

本设计不直接覆盖：

- 一次性迁走所有历史文档
- 改写所有旧 `ops/*.md`、`DEVLOG.md` 和 `MEMORY.md` 正文
- 删除现有目录或大规模归档历史文件

## 方案选择

本轮已确认的选择：

- 主导航方式：按系统/领域组织
- 治理目录：不与业务系统并列，单独挂在总入口
- 迁移节奏：先建新结构，旧入口兼容，后续逐步迁移
- 阶段一力度：框架 + 入口收口 + 核心系统知识首批迁移

未采用的方案：

- 最小整理
  - 原因：只能缓解入口混乱，不能解决系统知识散落问题
- 一次性深度重构
  - 原因：改动面过大，短期会显著提高认知成本和出错风险

## 信息架构

### 1. 总纲层

保留并重构以下入口：

- `README.md`
  - 当前项目状态摘要
  - 当前版本 / gray / production / 主 release
  - 主入口链接
- `AGENTS.md`
  - 项目规划、作用、需求边界、协作方式、阅读顺序、治理规则、归档规则、CodeGraph 使用规范
- `docs/INDEX.md`
  - 新的第一跳全局索引

### 2. 治理层

新增：

- `docs/governance/`

建议文件：

- `README.md`
- `documentation-governance.md`
- `collaboration-and-workflow.md`
- `codegraph-and-repo-navigation.md`
- `archive-policy.md`
- `templates/`

职责：

- 只承接规则、流程、模板和维护方式
- 不承接业务系统说明
- 不承接逐日台账

### 3. 系统知识层

新增：

- `docs/systems/`

建议一级系统：

- `admin/`
- `canvas/`
- `api/`
- `worker/`
- `runninghub/`
- `providers/`
- `auth-and-users/`
- `storage-and-data/`
- `observability-and-ops/`

每个系统目录至少包含：

- `README.md`
  - 系统定位、边界、入口文件、相关依赖、阅读顺序

根据需要补充：

- `architecture.md`
- `protocol-and-capabilities.md`
- `interface-map.md`
- `request-response-flow.md`
- `execution-chain.md`
- `queue-and-concurrency.md`
- `catalog-and-entry-model.md`

### 4. 记忆与决策层

新增：

- `docs/memory/`

建议文件：

- `README.md`
- `current-state.md`
- `product-and-scope.md`
- `architecture-decisions.md`
- `deployment-state.md`
- `runninghub-memory.md`
- `provider-memory.md`

职责：

- 记录长期有效且跨会话仍成立的知识
- 按主题拆分，而不是按日期拆分
- 承接从 `MEMORY.md` 中迁出的长期稳定内容

### 5. 台账与证据层

新增：

- `docs/logbooks/`

建议结构：

```text
docs/logbooks/
  README.md
  daily/
    2026/
      2026-06/
  releases/
    gray/
    production/
  validations/
  incidents/
```

职责：

- `daily/`：逐日推进
- `releases/`：发布记录
- `validations/`：专项验收与验证
- `incidents/`：线上问题、回滚、事故与排障闭环

### 6. 项目记录库

新增：

- `docs/records/`

建议结构：

```text
docs/records/
  README.md
  runninghub/
  admin/
  canvas/
  worker/
  providers/
  auth/
  observability/
```

职责：

- 保存专题设计、方案沉淀、决策记录、功能演进材料
- 与 `docs/systems/` 的区别：
  - `systems/` 负责“现在系统如何工作”
  - `records/` 负责“这块系统是怎么演进到现在的”

## 主入口改造方案

### `AGENTS.md`

重构后保留以下板块：

- 项目定位
- 默认阅读顺序
- 系统地图概览
- 协作方式
- 文档治理规则
- 归档与清理规则
- CodeGraph / `rg` / 验证脚本等协作技巧使用规范

移出：

- 长篇运行历史
- 灰度/正式逐次发布流水
- 一次性验收细节

### `README.md`

保留：

- 当前版本
- 当前 gray/prod
- 当前主 release
- 当前高层阶段
- 入口跳转

不再承接：

- 大段系统知识
- 长篇 RH / Provider / Worker 细节

### `MEMORY.md`

改为：

- 当前记忆摘要
- 长期决策索引
- 当前关键边界与风险
- 跳转到 `docs/memory/*`

不再承接：

- 大量历史发布流水
- 与 `DEVLOG` 重复的逐日推进

### `DEVLOG.md`

阶段一继续保留，但转型为兼容入口：

- 顶部说明台账已迁移到 `docs/logbooks/`
- 保留最近若干关键记录索引
- 后续新增日常记录写入 `docs/logbooks/daily/`

### `ops/README.md`

聚焦：

- 当前运行态
- 当前值守入口
- 当前放行入口
- 历史归档跳转

不再继续承接全部历史运维正文。

## 阶段一首批迁移的系统知识包

### 1. RunningHub

优先原因：

- 当前最容易触发“乱找乱做”
- 同时涉及后台 catalog、前端节点、worker submit/query、workflow/app 区分、条目建模和上游协议

建议拆分：

- `docs/systems/runninghub/README.md`
- `docs/systems/runninghub/integration-architecture.md`
- `docs/systems/runninghub/catalog-and-entry-model.md`
- `docs/systems/runninghub/workflow-app-differences.md`
- `docs/systems/runninghub/node-runtime-flow.md`

### 2. 后台管理与协议

优先原因：

- 后台现在不仅是 UI，还承载 Provider 管理、模型管理、RH 工作台、AI 助手、系统设置、环境同步等能力
- 协议边界和页面边界容易被误解

建议拆分：

- `docs/systems/admin/README.md`
- `docs/systems/admin/architecture.md`
- `docs/systems/admin/protocol-and-capabilities.md`
- `docs/systems/admin/ui-and-information-architecture.md`

### 3. API / 前后端接口与传输链路

优先原因：

- 当前很多任务在前后端边界上反复猜接口、字段、传输方式、鉴权要求

建议拆分：

- `docs/systems/api/README.md`
- `docs/systems/api/architecture.md`
- `docs/systems/api/interface-map.md`
- `docs/systems/api/request-response-flow.md`

### 4. Worker 执行链路

优先原因：

- 当前生成、队列、并发、结果物料化、RunningHub 重试等问题都依赖 worker 理解

建议拆分：

- `docs/systems/worker/README.md`
- `docs/systems/worker/execution-chain.md`
- `docs/systems/worker/queue-and-concurrency.md`
- `docs/systems/worker/output-materialization.md`

## 命名与模板规则

### 目录命名

- 一级系统目录使用稳定英文 kebab 或语义清晰短语
- 避免临时性名字，如 `misc`、`other`、`new-docs`

### 文件命名

- 入口文件统一使用 `README.md`
- 专题文件使用语义化短名：
  - `architecture.md`
  - `interface-map.md`
  - `execution-chain.md`
- 避免继续新增日期型专题文件到系统知识目录
  - 日期型文件只进入 `logbooks/` 或 `records/`

### 台账命名

- 日常台账：
  - `docs/logbooks/daily/YYYY/YYYY-MM/YYYY-MM-DD.md`
- 发布记录：
  - `docs/logbooks/releases/gray/YYYY-MM-DD-<topic>.md`
  - `docs/logbooks/releases/production/YYYY-MM-DD-<topic>.md`
- 验证记录：
  - `docs/logbooks/validations/YYYY-MM-DD-<topic>.md`

## 迁移顺序

阶段一建议拆成 4 个批次：

### 批次 1：框架与入口

- 新建 `docs/INDEX.md`
- 新建 `docs/governance/`
- 新建 `docs/systems/`
- 新建 `docs/memory/`
- 新建 `docs/logbooks/`
- 新建 `docs/records/`
- 重写 `AGENTS.md` 结构

### 批次 2：主入口瘦身与跳转

- `README.md`
- `MEMORY.md`
- `DEVLOG.md`
- `ops/README.md`

目标：

- 先变成“摘要 + 跳转入口”
- 暂不大规模删除旧内容

### 批次 3：首批系统知识迁移

- RunningHub
- Admin
- API / 前后端接口
- Worker

原则：

- 优先从现有 `project-atlas`、`documentation-governance`、`MEMORY`、`ops`、相关 specs/plans 中提炼
- 不为追求完美一次性迁全
- 先形成“可用导航”和“稳定知识包”

### 批次 4：台账开始切流

- 新增日常推进记录开始写入 `docs/logbooks/daily/`
- 旧 `DEVLOG.md` 只保留索引和最近摘要
- 新增发布记录优先进入 `docs/logbooks/releases/` 或在阶段一暂继续写 `ops/*.md`，但必须双向索引

## 维护机制

### 写文档前的分类规则

任何新文档先判断属于哪一类：

- 当前状态
- 治理规则
- 系统知识
- 长期记忆
- 逐日台账
- 发布/验收证据
- 专项设计/方案记录

如果没有先分类，不允许直接新增文件。

### 更新责任矩阵

#### 做系统功能时

至少检查：

- 对应 `docs/systems/<system>/`
- 对应 `docs/records/<system>/`
- 如有长期影响，再更新 `docs/memory/*`

#### 发布时

至少更新：

- `README.md`
- `MEMORY.md`
- `ops/README.md`
- `docs/logbooks/releases/*`

#### 日常推进时

至少更新：

- `docs/logbooks/daily/*`

#### 规则或协作方式变化时

至少更新：

- `AGENTS.md`
- `docs/governance/*`

### CodeGraph 使用规范

新增到 `AGENTS.md` 与 `docs/governance/codegraph-and-repo-navigation.md`：

- 开始理解仓库前优先：
  - `codegraph status`
  - 无索引则 `codegraph init -i`
- 修改完成后：
  - `codegraph sync`
- 优先使用场景：
  - 找系统边界
  - 找调用链
  - 找影响面
  - 恢复仓库上下文
- 回退使用：
  - 精确文本检索仍优先 `rg`

## 成功标准

阶段一完成后，应满足：

1. 看 `AGENTS.md` 就能知道：
   - 项目定位
   - 阅读顺序
   - 协作方式
   - 文件治理规则
   - CodeGraph 使用方式

2. 看 `docs/INDEX.md` 就能知道：
   - 项目有哪些系统
   - 每个系统主入口在哪
   - 协议、接口、执行链路去哪看

3. 看系统知识目录就能快速找到：
   - RunningHub 设计
   - 后台协议与能力边界
   - API/前后端接口链路
   - Worker 执行与并发机制

4. 后续新增台账不再继续堆在单个 `DEVLOG.md` 中。

5. 团队在开始任务时，默认先走“总纲 -> 索引 -> 系统知识 -> 代码”路径，而不是直接全文乱搜。

## 风险与控制

### 风险 1：新结构搭好了，但旧入口仍然更大更显眼

控制：

- 阶段一必须同步瘦身主入口
- 旧文件顶部明确标注“正文已迁移 / 新入口在哪”

### 风险 2：迁移过多导致本轮范围失控

控制：

- 只迁 4 个核心系统知识包
- 其他系统后续批次再迁

### 风险 3：按系统拆后，跨系统内容难找

控制：

- `docs/INDEX.md` 负责跨系统导航
- 每个系统 README 都列“相关系统”和“下一跳”

### 风险 4：后续继续乱写到旧文件

控制：

- 在 `AGENTS.md` 和治理目录中加入硬规则
- 新增文档前必须先分类

## 推荐的后续阶段

阶段一稳定后，再进入阶段二深度重构：

- 将旧 `MEMORY.md` 长文进一步压缩
- 将 `DEVLOG.md` 历史分批迁入 `docs/logbooks/daily/`
- 将 `ops` 历史发布记录进一步归档
- 扩展剩余系统知识包：
  - `canvas`
  - `providers`
  - `auth-and-users`
  - `storage-and-data`
  - `observability-and-ops`

