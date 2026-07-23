# 无限画布 2.0 领域上下文

本文件是项目领域语言和跨系统不变量的权威入口。它回答“同一个词在本项目里是什么意思”，不记录当前版本、部署状态、单次事故或尚未生效的架构方案。

## 使用方式

- 开始涉及业务模型、数据归属或跨系统边界的工作前，先读本文件。
- 新增、改名或改变领域概念含义时，同轮更新本文件。
- “系统现在如何工作”写入 `docs/systems/`。
- “为什么选择某个架构方案”写入 `docs/adr/`。
- “准备如何实施”写入 `docs/superpowers/plans/`。
- “当天做了什么”写入 `docs/logbooks/`。

详细责任边界见 `docs/governance/domain-context-and-adr-standard.md`。

## 产品边界

无限画布 2.0 是面向组织内用户的节点式 AIGC 创作平台。用户在画布中组合输入、模型、执行和输出节点；平台负责项目持久化、任务执行、生成结果访问、资源管理、用户隔离与后台治理。

## 核心领域语言

### Canvas Project（画布项目）

属于单一用户的可编辑工作空间，包含节点、连线、分组和画布级元数据。画布项目保存创作状态，但不天然成为生成文件或资源元数据的权威源。

### Generation Task（生成任务）

一次可追踪的模型或外部工作流执行。任务记录请求、执行状态、归属用户和结果引用；任务结果不等同于已经登记到生成库或资源库。

### Model Pricing Version（模型价格版本）

某个模型在一段生效时间内的计费规则与单价。价格版本只追加、不原地改写；任务创建时锁定当时生效的版本，后续改价不重算历史任务。

### Task Cost Item（任务费用项）

一次生成任务对应的不可变费用快照与结算记录，包含当时的账号、用户组、Provider、模型、币种、数量、单价和计费原因。费用统计以费用项为权威源，不用当前目录或当前用户组实时重算历史。

### Generation Artifact（生成产物）

由生成任务产生、供用户短期查看和继续创作的图片、视频或音频。它具有明确 owner、来源任务、创建时间、生命周期状态和内容定位信息。产品默认的生成库可见期为三天；是否到期由服务端权威状态判断。

### Generation Library（生成库）

按当前用户展示 Generation Artifact 的短期视图。生成库不是画布节点扫描结果，也不是浏览器本地缓存；读取动作不得隐式承担登记、修复或删除职责。

### Resource Asset（资源素材）

用户明确上传、收藏、保存或从生成产物晋级得到的长期素材。Resource Asset 与 Generation Artifact 是不同生命周期的实体；保存到资源库后，不应继续受生成库三天可见期控制。

### Promotion（素材晋级）

将 Generation Artifact 明确保存为 Resource Asset 的领域动作。晋级必须可追踪、可幂等，并保留来源关系；它不是复制一条前端展示记录。

### Artifact Binary（产物文件）

图片、视频或音频的实际字节内容，可存放在本地文件系统或对象存储。文件存储负责字节，不单独决定 owner、业务状态、可见期或资源归属。

### Canvas Output Reference（画布输出引用）

保存在节点数据里的产物引用，用于在画布恢复输出和建立上下游关系。它是消费侧引用，不是 Generation Artifact 或 Artifact Binary 的唯一权威记录。

### Material Access（素材访问）

对生成产物和资源素材提供预览、下载、打开等稳定 URL 语义的访问边界。访问层必须校验用户归属，且不因一次 GET 请求改变业务状态。

### Canvas Run（画布运行）

一次基于特定 Canvas Project revision 和配置快照创建的服务端可恢复执行。它保存用户分组顺序、节点拓扑、步骤、预算和终态；运行开始后的画布编辑不隐式改变已有 Canvas Run。

### Agent Run（智能体运行）

一次由内部 Agent Runtime 执行的有界规划、监督或恢复过程。Agent Run 属于单一 owner，使用受控工具、预算、配置版本和审计记录，不等同于聊天消息或浏览器会话。

### Assistant Conversation（助手会话）

用户与悬浮 AI 助手之间的对话记录，负责问答、诊断、知识引用和工作流提案。Assistant Conversation 可以引用 Agent Run，但不等同于 Canvas Run，也不能成为画布执行状态的权威源。

### Knowledge Snapshot（知识快照）

面向一次 Agent Run 的不可变知识发布物，锁定节点能力注册表版本、模型目录投影、已批准知识文档、环境、受众和集合 allowlist。运行时只能查询 Knowledge Snapshot，不扫描仓库或任意文件目录。

### Canvas Patch Proposal（画布变更提案）

助手根据用户目标生成的结构化画布修改建议，包含基线 revision、节点/连线差异、验证结果和风险说明。提案在用户确认并创建新 revision 前不得改变 Canvas Project。

### LLM Routing Pool（LLM 路由池）

为 planner、图片理解、视频理解、检查和恢复等 Agent LLM 角色提供版本化候选顺序、健康、熔断和回退策略的配置。它不管理图片、视频或音频生成模型；这些生成模型仍由对应节点和 Provider Model Catalog 管理。

### Artifact Evaluation（产物评估）

对 Generation Artifact 的图片或视频质量、任务目标匹配和技术有效性形成的结构化评分与证据。评估不改变产物本身；将候选传给下游必须通过显式 Artifact Selection 或运行时输入绑定记录。

### Gray / Production（灰度 / 生产）

两个独立部署环境。Gray 用于发布前运行态验证，Production 承载正式业务。环境拓扑和当前版本分别以 `config/environments.json` 与 `ops/current/release-state.json` 为准。

## 跨系统不变量

- 所有用户数据必须有可验证的 owner；不能用展示层过滤代替服务端归属校验。
- 数据库元数据、文件字节和画布引用是不同职责，不得互相冒充唯一权威源。
- GET 读取保持只读；清理、修复、迁移和状态推进必须通过显式命令或受控服务执行。
- 短期生成产物和长期资源素材必须使用不同生命周期。
- 业务写入必须支持并发安全和幂等；不能依赖进程内变量或无锁 JSON 覆盖来维持正确性。
- Canvas Run、Agent Run、路由决策、质量选择和自动恢复必须可追踪到 owner、revision、配置版本和审计事件。
- Assistant Conversation、Agent Run、Canvas Run 和 Knowledge Snapshot 必须保持独立身份，并通过显式 ID 引用；关闭任一 UI 面板不得终止持久化运行。
- Agent 运行时输入选择默认不得静默修改 Canvas Project；结构性变化必须形成显式 proposal 并创建新 revision。
- 费用金额必须使用十进制定点语义；价格与归属历史必须来自任务费用快照，不得被当前配置反向改写。
- 当前实现与目标方案必须分开记录；Proposed ADR 不代表已经上线。

## 当前相关入口

- 当前实现：`docs/systems/storage-and-data/material-and-output-storage.md`
- 画布与素材链路：`docs/systems/canvas/project-and-material-flow.md`
- Worker 输出物料化：`docs/systems/worker/output-materialization.md`
- 架构决策索引：`docs/adr/README.md`
- 生成产物权威与生命周期提案：`docs/adr/0001-generation-artifact-authority-and-lifecycle.md`
- Canvas Agent Runtime 与 LLM 路由决定：`docs/adr/0003-canvas-agent-runtime-and-llm-routing.md`
