# ADR 0003: Canvas Agent Runtime 与 LLM 路由池

> **Status:** Superseded
> **Date:** 2026-07-22
> **Owners:** Canvas / API / Worker / Admin / Auth / Storage
> **Decision Scope:** Canvas execution / Agent orchestration / LLM routing / Quality evaluation / Admin governance
> **Supersedes:** None
> **Superseded by:** [ADR 0004](0004-workflow-scoped-deterministic-supervision.md)

## Context

当前整画布与分组执行由浏览器 `useCanvasRuntime`、`runBus` 和各媒体节点的轮询逻辑共同驱动。任务可以在服务端继续执行，但页面关闭、网络中断或浏览器崩溃后，画布级执行顺序、重试和监督状态无法作为可靠权威恢复。

当前画布与后台助手通过 Hermes bridge 或本地 fallback 工作。Hermes 登录、会话、SSE 解析和回退集中在 API 热点入口中，且 Hermes session 不是多实例、多用户运行的权威状态。新的 Agent 需要直接理解画布拓扑、节点契约、模型目录、质量结果和任务事件，并在用户授权内执行、监督和恢复工作流。

模型路由需求只针对 Agent 使用的 LLM 角色。图片、视频和音频生成模型继续由对应生成节点和现有 Provider Model Catalog 管理，不能被通用 LLM 路由池接管。

## Decision

采用模块化单体控制面与事件驱动 Worker：

- PostgreSQL 保存 Canvas Run、Agent Run、步骤、尝试、事件、审批、配置版本、质量评估和路由决策等权威状态。
- Redis 只用于队列、租约、短期并发计数和事件投递，不作为业务终态权威源。
- Workflow Compiler 将 canvas revision、节点、连线、用户分组顺序和策略编译为不可变 Run Plan。
- Canvas Run Kernel 负责依赖、输入绑定、执行、暂停、恢复、取消、重试和终态收口。
- Agent Orchestrator 将 planner、image-understanding、video-understanding、checker 和 recovery 建模为有界角色任务。
- 子代理只接收允许的上下文和 Tool Gateway 白名单；每次调用具有输入/输出 Schema、预算、超时、幂等键和审计记录。
- LLM Routing Pool 只服务上述 LLM 角色，按能力硬过滤、管理员优先级、同级权重、健康与预算选择模型，并保存决策快照。
- 技术失败、质量不达标和输入契约错误分别处理；质量回退不能污染 Provider 技术健康统计。
- 视频质量评估采用传输能力感知的双路径：优先选择支持完整视频输入的 LLM。Gemini 直连由 Worker 上传 owner-scoped 文件并使用临时 Provider File URI；时间戳帧序列仅作为已有帧产物的兼容回退，不在运行时依赖 FFmpeg。对于显式声明可拉取远程 URL 的 Provider 网关，短期受控 URL 是保留的第三种传输能力而非 Gemini 的替代协议，当前默认关闭；启用前必须落地独立媒体访问网关、单产物短期签名、传输上限、审计快照和撤销策略。
- 批次输出到单项输入通过运行时 Artifact Binding 解决；默认不修改画布结构。结构修改形成 Canvas Patch Proposal，并在审批后生成新 revision。
- 悬浮 AI 助手与 AI 托管面板是两个独立产品入口：助手以悬浮球承载对话、诊断、知识引用和 Canvas Patch Proposal；托管入口位于画布顶部公告操作旁，只承载 Canvas Run 创建、执行、监管、审批和接管。两者可以引用同一 Agent Run/Canvas Run，但不能共享开关、Tab 身份或面板生命周期。
- Assistant Conversation、Agent Run、Canvas Run 和 Knowledge Snapshot 使用独立 ID 与生命周期。关闭助手或托管面板不终止持久化运行；浏览器只提交命令并订阅真实 Run Event，不保存运行权威状态。
- Agent 运行时不扫描仓库。节点能力注册表、Provider/模型目录投影和已批准知识文档在环境发布时形成不可变 Knowledge Snapshot；Agent Run 锁定快照 ID，并仅通过 allowlisted 精确查询或受限检索工具访问。
- Agent 配置采用 draft / review / published / retired 生命周期，运行开始时锁定配置版本快照，并复用现有 Gray / Production 环境发布治理。
- Hermes bridge、环境变量、session 和协议类型在内部 Agent Runtime 达到兼容门后移除，不保留为长期 fallback。

## Alternatives

- 继续使用 Hermes：接入成本低，但保留外部会话、协议、运行权威和多用户隔离问题，不采纳。
- 只扩展浏览器运行循环：改动较小，但无法可靠支持断线恢复、租约接管和多实例，不采纳。
- 为每个子代理建立独立微服务：隔离明确，但当前规模下会显著增加部署、事务、版本和观测复杂度，不采纳。
- 让管理者 Agent 自由选择工具和模型：灵活，但无法证明权限、预算、幂等和可回滚性，不采纳。
- 建立覆盖所有生成模型的统一路由池：表面统一，但会破坏节点自身的能力、参数和用户选择语义，不采纳。

## Consequences

### Positive

- 页面关闭后画布运行仍可继续、恢复和审计。
- 用户分组顺序与拓扑成为确定性运行约束。
- 多子代理具有明确职责、权限、预算和失败边界。
- LLM 选择、回退、熔断和质量判断可以在 Admin 中治理和解释。
- 质量筛选、输入数量调节和失败恢复进入正式运行记录。

### Negative

- 需要新增数据库实体、队列、服务模块、Admin 工作域和较大迁移面。
- legacy browser runtime 与服务端内核会在迁移期并存，需要能力开关和双路径契约。
- 媒体理解会增加上传、存储、成本和延迟，必须配置输入传输、文件清理、预算和停止条件。
- Agent 配置、知识与节点能力需要持续版本化维护。

## Verification

- `npm run verify:agent-runtime-architecture-contract`
- `npm run verify:domain-context-and-adr-contract`
- Workflow Compiler 的分组顺序、拓扑、循环、revision 和 input cardinality 行为测试。
- ownership、幂等、暂停/恢复、Worker 租约接管和 Run Event 顺序测试。
- LLM 路由模拟、熔断、技术回退、质量回退、预算和权限测试。
- 图片/视频候选评估与 single-input 下游绑定端到端测试。
- Gemini Provider File 上传、处理等待、原生视频理解、临时文件清理，以及无原生能力时的帧序列回退测试。
- Admin 配置 revision、发布、回滚、kill switch 和审计测试。
- 双入口独立开关、Assistant Content 安全 Markdown、reasoning 隔离、Knowledge Snapshot 发布边界和 Admin 配置到运行时快照的合同测试。
- Gray 断线恢复、多用户并发、费用上限和长时间托管验证。

## 2026-07-23 Clarification

本次澄清收紧原文“共用内部 Agent Runtime”的含义：共用的是服务端基础设施和显式引用，不是同一个前端工作台。它同时把受控知识发布物确认为运行时唯一知识入口，避免把仓库检索误当成产品知识库。

## Migration And Rollback

- 第一阶段保留 legacy browser runtime，并为服务端 Canvas Run 增加独立 feature gate。
- 按节点能力逐类迁移；未支持的节点继续 legacy 路径，不能被 Agent 假定为可托管。
- 内部 Agent Runtime 先提供只读对话和计划预览，再接执行工具。
- Hermes 仅在内部接口达到兼容门前存在；移除批次必须同时清理协议、配置、环境变量和验证脚本。
- 每个 Agent 配置发布保留上一版本，可回滚配置而不回写运行中快照。
- Canvas Run 可全局切换为只读或禁止新建；已有 Generation Task 仍按现有任务生命周期收口。
