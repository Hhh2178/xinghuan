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
- 新界面必须分离对话、附件、知识引用、运行计划、审批和托管状态，不能用伪进度、同权重卡片或遮挡画布的固定大面板。
- 桌面和窄屏都必须通过真实浏览器截图、交互和重叠检查。

### Canvas Agent Node And Supervision Panel

- Agent 节点保存监督范围、策略和 `agentRunId` 引用，不保存完整日志。
- 监督面板展示 Run Plan、分组、拓扑、步骤、候选评分、路由、费用、审批和控制动作。
- 支持 start / pause / resume / cancel / retry / takeover。

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

- Public Knowledge：面向普通用户的产品、节点、工作流与使用说明。
- Operational Knowledge：节点契约、模型能力、失败模式和恢复规则。
- Private Admin Knowledge：内部运维信息；不得进入普通用户上下文。
- 节点能力基础字段从代码契约提取，人工只维护说明、示例、常见失败和推荐连接。

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
