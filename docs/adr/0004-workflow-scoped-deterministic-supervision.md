# ADR 0004: 工作流级确定性执行与有限 AI 托管

> **Status:** Accepted
> **Date:** 2026-07-23
> **Owners:** Canvas / API / Worker / Admin / Auth / Storage
> **Decision Scope:** Workflow Region / Workflow Run / Variables / Supervision / Assistant / Candidate Selection
> **Supersedes:** [ADR 0003](0003-canvas-agent-runtime-and-llm-routing.md)

## Context

ADR 0003 正确建立了服务端 Canvas Run、不可变快照、LLM 路由、质量评估和审计底座，但把产品职责扩大为 planner、manager、checker、recovery 与媒体理解角色组成的自由规划网络，并把角色、工具、知识和审批等内部实体暴露为十一项等权后台入口。Gray `v0.7.20` 证明该结构可运行，却不能回答用户要运行哪个工作流、变量从哪里输入、失败后允许做什么，也不能隔离同一画布中的多个工作流。

本阶段要先交付成熟工作流之上的可靠自动化，而不是让 AI 自由创建或改写工作流。AI 助手与 AI 托管也具有不同的用户目标和生命周期，不能继续共享产品身份。

## Decision

- 延续 PostgreSQL Canvas Run/Step/Event 权威、幂等命令、Worker 租约、不可变快照、LLM 路由、质量评估、恢复与审计账本。
- 执行边界从整个 Canvas 收敛为显式 Workflow Region，层级为 `Canvas -> Workflow Region -> Execution Group -> Node`。一个节点最多属于一个 workflow，MVP 禁止嵌套和重叠。
- 普通连线不得跨越 workflow 边界；跨边界数据只能经强类型 Workflow Input/Output 节点进入不可变 Run Input Snapshot。
- 工作流变量属于 workflow registry。`##变量名##` 是文本编辑语法，内部使用稳定 variable ID 与结构化 binding；同名变量仅在同一 workflow 内共享。
- 执行阶段顺序可由用户调整，但拓扑是硬约束。顺序、设置、变量值、模型解析结果和候选策略在 Run 开始时冻结。
- AI 托管只负责权威状态监测、受预算约束的失败恢复和显式候选选择门，不负责创建节点、修改连线、自由规划或选择未发布模型。
- 失败恢复按错误类别执行：暂时性错误退避重试；模型不可用走已发布兼容候选链；审核拒绝仅改写本次 Run 值并记录 diff；未知错误停止。
- 智能候选选择器是下游释放前的显式门。旧 `pick-from-set` 保持确定性索引语义；未选项和被裁剪分支分别记录 `not_selected` 与 `skipped_by_selection`。
- 托管设置按平台上限、workflow 默认、`owner + workflow ID` 记忆值、本次 Run snapshot 四层解析。active Run 不接受静默配置变更。
- AI 助手保持独立，只做问答、节点错误诊断和文本建议。悬浮球可拖动吸附，窗口邻接悬浮球并与托管面板几何避让。
- 节点能力注册表、安全模型投影和 LLM chat 资格校验继续作为代码权威。自由知识文档检索与工作流模板/patch proposal 停止进入新 MVP Run；历史数据只读兼容。
- Admin 改为面向运维任务的少量工作域：运行控制、模型与回退策略、质量/选择策略、Run 与审计。旧角色网络、自由工具和知识页面不再影响新 Run。

## Alternatives

- 延续多角色自由规划：能力上限高，但无法在早期证明边界、可预测性和实际价值，不采纳。
- 只修补现有 canvas-wide 托管面板：无法提供多个工作流隔离、变量快照和显式跨边界契约，不采纳。
- 完全回退到 `v0.7.19` 前端与数据库：会丢失已验证的运行权威、路由和安全渲染能力，并破坏前向 migration，不采纳。
- 让 AI 直接寻找任意兼容模型：无法保证发布、权限、预算和可审计性，不采纳。

## Consequences

### Positive

- AI 的职责可解释、可测试，并与成熟工作流的真实使用方式一致。
- 多 workflow 可以独立运行、恢复、计费和观察，外部画布编辑不污染 active Run。
- 用户能在运行前明确输入变量、阶段顺序、恢复预算和选择规则。
- 旧 v0.7.19/v0.7.20 的高价值底座继续复用，避免破坏性回退。

### Negative

- 需要前向增加 workflow、variable、binding、remembered settings 与 selection gate 数据模型。
- legacy canvas-scoped Run、Agent 配置和知识数据需要兼容读取期。
- rich-text token 编辑、区域几何和多 workflow 浏览器验证增加前端复杂度。

## Verification

- workflow 成员、边界连线、变量 AST、类型、revision 和 Run snapshot 合同测试。
- 多 workflow 并发、owner 隔离、断线恢复、幂等命令、预算和事件顺序测试。
- 错误分类、退避重试、发布模型解析、Provider/model 回退与审核改写测试。
- 候选屏障、人工/AI选择、低置信度接管和下游裁剪测试。
- 桌面与窄屏真实浏览器操控：悬浮拖动/吸附、面板避让、区域移动/缩放/调色、变量 token、阶段排序和设置记忆。
- 完整 Project/Workspace/Release Harness 与 Gray 实际回归；Production 只读确认未变。

## Migration And Rollback

- 不撤销 migration `026-035`，不删除 Gray 数据。旧字段和表停止新写入后保持兼容读取。
- 新 schema 只前向增加，旧 canvas-scoped Run 投影为 legacy workflow scope，不回写历史 snapshot。
- 新 Workflow Run 受 Gray feature flag 控制；关闭后只禁止新建，不中断已提交 Generation Task 的收口。
- 每阶段使用本地 checkpoint commit；Gray 失败时切回上一个 Gray release，不触碰 Production。
