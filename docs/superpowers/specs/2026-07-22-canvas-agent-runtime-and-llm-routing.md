# Canvas Agent Runtime 与 LLM 路由规格

## Status And Authority

- 状态：Accepted architecture，implementation in progress。
- 架构理由：`docs/adr/0003-canvas-agent-runtime-and-llm-routing.md`。
- 实施步骤：`docs/superpowers/plans/2026-07-22-canvas-agent-runtime-and-llm-routing-implementation.md`。
- 当前实现事实仍以 `docs/systems/` 和代码为准；本文描述目标能力与验收合同。

## Product Surfaces

### Floating Assistant

- 支持文本、粘贴/上传图片、节点、选中工作流和媒体上下文。
- 提供解释、知识问答、素材分析、计划预览和工作流草案。
- 默认只读；结构修改输出 Canvas Patch Proposal。
- 不沿用当前 `CanvasAssistant` 的视觉结构做增量修补；Phase 6 只复用必要协议，重新设计为紧凑的创作工作台。
- 入口固定为可随时打开的悬浮球，只承载对话、附件、知识引用和 Canvas Patch Proposal；不得再包含“托管”Tab、Canvas Run 控制或运行时间线。
- 过程状态使用受控事件（例如检索知识、校验拓扑、准备提案），不得渲染 Provider reasoning、`<think>`、analysis 或内部 context 文本。
- 桌面和窄屏都必须通过真实浏览器截图、交互和重叠检查。

### AI Supervision Entry And Panel

- 在画布顶部公告操作旁提供独立 AI 托管按钮；再次点击关闭面板。助手与托管可以独立开关并同时存在。
- 托管面板关闭后 Canvas Run 继续执行，重新打开后从 PostgreSQL/SSE 恢复，不依赖助手会话或节点 JSON。
- 监督面板展示 Run Plan、分组、拓扑、步骤、候选评分、路由、费用、审批和控制动作。
- 支持 start / pause / resume / cancel / retry / takeover。
- 旧 `canvas-agent` 节点只保留历史画布兼容与策略迁移，不再作为新建入口。

## Runtime Architecture

```text
Web/Admin -> Agent API -> Agent Orchestrator -> Tool Gateway
                          |                -> Knowledge Retriever
                          v
                    Canvas Run Kernel -> Redis queues -> Workers
                          |                                |
                          +------ PostgreSQL state <-------+
                          +------ Run Event -> SSE -> UI
```

### Runtime Module Responsibilities

- Workflow Compiler：读取 canvas revision、用户分组顺序、节点、连线和策略，输出不可变 Run Plan；它不提交生成任务。
- Canvas Run Kernel：解释 Run Plan、推进步骤状态、应用输入绑定和重试预算；它不直接调用外部 Provider。
- Agent Orchestrator：调度有界 LLM 角色任务并汇总结构化结果；它不能绕过 Policy Engine。
- Tool Gateway：执行 owner、permission、revision、budget 和 idempotency 校验后调用领域服务。
- Worker：消费队列并执行既有 Provider/RunningHub/ComfyUI 任务，不负责改变用户编排顺序。

## Domain Contracts

### Identity And Lifecycle

| Entity | Owns | May reference | Must not own |
|---|---|---|---|
| Assistant Conversation | 用户消息、最终回答、引用、提案 | Agent Run、Knowledge Snapshot、Canvas Patch Proposal | Canvas Run 状态、Provider reasoning |
| Agent Run | 角色任务、配置快照、工具调用、预算、审计 | Assistant Conversation、Canvas Run、Knowledge Snapshot | 浏览器 UI 状态、任意文件系统 |
| Canvas Run | revision、Run Plan、Step/Event、审批、终态 | Agent Run、配置版本、Knowledge Snapshot | 对话正文、草稿知识 |
| Knowledge Snapshot | 已发布节点/模型/文档投影与来源 | 配置版本、环境 publication | secrets、仓库目录、未批准文档 |

关闭 Assistant Conversation 或 AI 托管 UI 只改变本地可见性。Agent Run/Canvas Run 只能通过正式 cancel/terminal transition 结束。

### Canvas Run

- 锁定 owner、canvas、canvas revision、data snapshot、configuration snapshot、预算和终态。
- 一个 Run 包含有序 group plan 和 step plan；用户分组顺序是硬约束，组内按拓扑依赖执行。
- 运行开始后的画布修改不改变当前 Run Plan。

### Runtime Input Binding

- 支持 `single`、`many`、`first`、`last`、`best`、`top_k`、`threshold`、`diverse`、`merge`、`loop` 和 `reject`。
- 自动选择必须保存 source artifacts、selected artifacts、policy、reason、confidence 和 evaluator version。
- 改变连线、节点或持久参数必须走 proposal + approval。

### Agent Roles

| Role | Responsibility | Forbidden |
|---|---|---|
| planner | 解释目标并生成受约束计划 | 直接执行任意工具 |
| image-understanding | 图片理解与结构化评分 | 修改画布或选择最终路由 |
| video-understanding | 关键帧/时序理解与评分 | 修改画布或选择最终路由 |
| checker | 校验证据、Schema 和冲突 | 提交生成任务 |
| recovery | 失败分类与恢复提案 | 绕过预算和审批 |
| manager | 汇总角色输出并推进 Run Plan | 改变用户分组硬顺序 |

### LLM Routing Pool

- 只用于 Agent 的 LLM 角色，不管理图片、视频或音频生成模型。
- 每个池绑定 role/scenario/required capability tags/objective/version。
- 选择顺序：硬约束过滤 -> 管理员 priority -> 同级 weight/health/cost/latency -> decision snapshot。
- 路由条目状态：healthy / degraded / rate_limited / unavailable / circuit_open / half_open / draining / disabled。
- 技术失败可按 policy 重试和回退；质量不达标使用独立质量策略，不计入技术熔断。
- `video-understanding` 除 `video_understanding` 标签外，还必须满足输入传输硬约束；路由不能把只支持图片的视觉模型伪装为原生视频模型。

### Video Understanding Transport

- `native_video` 是首选策略，用完整视频判断运动连续性、节奏、镜头切换、时序缺陷和音画关系。
- Gemini 直连使用 Files API：Worker 从 owner-scoped Artifact Binary 上传，等待 Provider File 可用后调用 `generateContent`，完成后尽力删除临时 Provider File。
- `remote_url` 只用于后台明确标注可主动拉取 URL 的 Provider 网关，且当前默认关闭。路由核心默认只允许 `gemini_file`，不会仅因版本快照含有 `remote_url` 就选择外部 URL 交付；网关上线后必须显式传入该 transport。后续启用时只能由独立媒体访问网关签发单产物、只读、短期签名 URL；Provider、模型、TTL、MIME、大小、时长和签发审计必须冻结到路由与任务快照。内部鉴权 URL、永久公开 URL、任意客户端 URL和未经 owner 校验的 URL 均禁止外发。
- `sampled_frames` 是兼容策略，只消费上游节点、Provider 或工作流已经产生的 owner-scoped 时间戳帧；本项目不使用 FFmpeg 自动抽帧。
- 当前路由顺序为 Gemini Provider File 原生候选 -> 同传输策略技术回退 -> sampled-frame candidate -> 明确失败。后续启用 `remote_url` 后，才允许在已发布的 URL 传输候选间技术回退；切换输入策略必须写入 route decision、Agent Action 和 Evaluation sample snapshot。
- 模型目录维护 `videoReference` / `imageReference` 输入能力；Provider/模型高级配置维护 `gemini_file`、`remote_url` 或 `sampled_frames` 传输方式、大小/时长上限和临时文件 TTL。

### Failure And Recovery

- 分类：transient / provider / capability / input / parameter / policy / content / quality / unknown。
- 恢复顺序：同配置重试 -> 受控参数调整 -> 节点已有备选生成模型/方案 -> 用户审批或停止。
- LLM 子代理自身故障由 LLM Routing Pool 回退；生成任务备选仍由节点能力和节点配置解释。
- 每个 Run 限制 attempt、provider/model switch、quality regeneration、task count、cost 和 duration。

### Knowledge

- 节点事实唯一来源是 Node Capability Registry，覆盖端口、cardinality、连接规则、执行状态、允许动作、示例、常见错误和替代节点。
- 模型事实从 Provider Model Catalog 生成只读 Agent Model Projection，覆盖用途、输入能力、兼容节点、参数边界、成本/延迟/质量倾向、LLM 资格、发布和健康状态；不得维护第二份手写模型清单。
- 编辑型知识文档维护节点教程、工作流案例、公开错误诊断和使用规范，使用 draft -> review -> approved -> retired 与 Gray/Production publication。
- 发布构建生成不可变 Knowledge Snapshot，锁定 registry hash、model catalog revision、document publication IDs、environment、audience、collection allowlist 和来源摘要。
- 结构化节点/模型问题优先走 allowlisted 精确查询；教程与解释只走 publication 过滤后的受限混合检索，并限制 topK、token budget 和引用来源。
- Agent 永久禁止仓库扫描、任意文件读取、任意目录搜索和未发布文档访问。

### Assistant Content Contract

- 最终正文使用版本化 `markdown-v1` 内容类型；支持 GFM 标题、列表、表格、引用、代码和安全链接。
- 禁止 raw HTML、`javascript:` URL、事件属性和默认外部图片；标题层级限制在面板语义内。
- Provider Adapter 将 reasoning 与 final answer 分离，API/SSE 对跨 chunk `<think>` 等内部标记做状态化过滤，前端保留防御性清理。
- Canvas 与 Admin 共用规范化和安全渲染实现，不维护两套 Markdown policy。
- 正文不低于 14/22px，元数据不低于 12/18px；代码块、表格和长链接在窄面板内可滚动或换行。

## Persistence

目标表族：

- `xh_canvas_runs`, `xh_canvas_run_steps`, `xh_canvas_run_events`
- `xh_agent_definitions`, `xh_agent_configuration_versions`, `xh_agent_runs`, `xh_agent_actions`, `xh_agent_approvals`
- `xh_llm_route_pools`, `xh_llm_route_pool_versions`, `xh_llm_route_entries`, `xh_llm_route_decisions`
- `xh_task_attempts`, `xh_artifact_evaluations`, `xh_artifact_selections`
- `xh_agent_knowledge_collections`, `xh_agent_knowledge_documents`, `xh_agent_knowledge_publications`

所有用户运行实体必须具有可验证 owner；配置与知识实体必须具有 revision、状态和审计 actor。

## Admin Workspace

新增一级工作域“智能体与自动化”，包含：

- 运行总览与全局 kill switches。
- Agent 角色与 LLM 模型路由。
- LLM 路由池列表、编辑、模拟、版本、Gray 发布与回滚。
- Tool Gateway 权限和用户组策略。
- 节点能力库、知识库、编排策略、质量策略和恢复策略。
- Canvas Run 记录、执行图、时间线、Agent Action、审批与费用。
- 质量选择准确率、回退成功率、误选率和人工接管率。

Admin UI 必须复用现有深色工业控制台、紧凑表格、Inspector、Drawer、revision 冲突和稳定深链，不使用同权重卡片堆砌复杂治理页面。

所有关键配置必须通过结构化控件编辑，不能要求管理员编辑原始 JSON。角色配置至少覆盖提示词、角色说明、LLM Pool、知识集合、工具 allowlist、token、timeout、预算、审批和恢复策略；路由池至少覆盖多候选、优先级、权重、能力、传输、成本、健康、重试和熔断；知识至少覆盖 Markdown 编辑/预览、受众、版本、发布、引用完整性和索引状态。保存总是创建不可变草稿版本，运行时只解析并锁定已发布配置。

## Security Invariants

- Agent 永久禁止读取 Provider Key、执行 Shell、部署、修改后台配置或访问其他 owner 数据。
- Tool Gateway 必须在服务端重新校验 owner、permission、revision、budget 和 idempotency。
- 上传媒体使用现有素材访问边界；模型上下文只获取授权后的引用或受控字节。
- 原生视频上传必须从 authenticated owner 的 Artifact Binary 解析路径；不得让 Agent 提交文件系统路径、上传端点、鉴权头或 Provider File URI。
- 公开、运行和私有知识在检索前过滤，不能依赖提示词要求模型自行忽略私有内容。

## Acceptance Criteria

- 页面关闭后 Canvas Run 继续并可恢复现场。
- 用户分组顺序与组内拓扑在服务端确定性执行。
- 批次候选可按质量策略选择并绑定 single-input 下游。
- LLM 路由池可以模拟、发布、熔断、回退、解释和回滚。
- 技术失败与质量失败分别统计和恢复。
- 所有 Agent 动作、选择、路由、审批和费用可追踪。
- 多用户并发无上下文串线，预算和权限失败会停止而非自动绕过。
- 助手与托管入口可独立开关、可并存，关闭面板不影响 Canvas Run。
- Markdown 无原始标记、危险 HTML/URL 或 reasoning 泄漏，所有目标视口满足字体与溢出约束。
- Agent Run 只能读取已发布 Knowledge Snapshot；未批准文档、内部受众和仓库文件不可检索。
- Admin 关键字段可结构化编辑，保存/审核/发布后的运行时快照可证明生效；非 chat 生成模型在创建、审核、发布和选择四层均被拒绝。
