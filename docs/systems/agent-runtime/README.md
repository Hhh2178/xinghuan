# Agent Runtime 系统

## Current Implementation Status

内部 Agent Runtime、首批 `native_server` 节点的服务端托管执行、质量恢复和 Admin 治理均已落地；但面向全部 legacy browser 节点的服务端托管尚未完成实现。当前仍处于本地候选阶段，认证 UI 与 Gray 验收尚未完成。当前事实是：

> 2026-07-23 第二轮纠偏：Gray v0.7.20 的运行、路由、安全渲染、质量与审计底座保留，但多角色自由规划、canvas-wide 托管和十一项等权 Admin 产品面已判定不符合需求。新 Accepted 边界见 ADR 0004：以 Workflow Region、结构化变量、确定性阶段、有限恢复和显式候选门为核心。Phase 1-4 已在本地完成旧自由链退役、变量领域、Workflow Region 隔离和确定性阶段执行；尚未部署 Gray，记忆设置、恢复与候选选择仍不能冒充已上线能力。

- 画布助手已替换为全新的深色生产工作台 UI；会话、附件、编写器和消息投影分离，支持图片选择与剪贴板粘贴、节点/工作流/媒体上下文和内部 Agent SSE 响应。
- 浮动助手在存在活跃画布时默认附带受控的 `当前画布` 工作流卡片。该投影上限为 40 个节点和 80 条连线，包含组顺序、成员、连线、节点类型及已允许的模型/执行配置；Web 与 API 都移除 key、token、secret、cookie、password、authorization 等字段，避免把节点原始 JSON 或敏感参数发送给模型。
- assistant 协议已使用 `agent | fallback`；聊天与 Provider 分析优先进入内部 Agent Orchestrator，未发布对应 LLM 路由或调用失败时使用受限本地 fallback。
- Assistant Chat 成功与 fallback 结果统一投影为 `AssistantContent markdown-v1`；API 与 SSE 防御层会移除内部 reasoning，Canvas/Admin 通过同一安全 GFM renderer 渲染，禁止 raw HTML、危险 URL 和远程图片直出。
- 整画布与分组执行仍由浏览器 runtime 驱动，各生成节点保留自己的观察/轮询逻辑。
- PostgreSQL 迁移 `026_canvas_agent_runtime.sql` 已定义 Canvas Run、Step、Event、Command、Task Attempt 和 Approval 权威表。
- PostgreSQL 迁移 `036_workflow_input_snapshots.sql` 为 Canvas Run 增加独立 `input_snapshot`。当请求携带 `workflowId` 时，API 只从 authenticated owner 的持久化 Canvas `workflows[]` 读取变量定义和 draft value，校验成员、变量汇总节点数量及文本 source/binding 一致性，再冻结 workflow ID、revision、类型、值和来源。旧 canvas-scoped Run 映射为空对象。
- `@xinghuan/shared` 是 Workflow Variable 与 Workflow Region schema/parser/validation 的代码权威；Web 节点只编辑 top-level Canvas `workflows[]` 中的 registry、membership、input values、bindings 和视觉区域。
- migration `037_workflow_region_runs.sql` 前向增加 workflow identity、revision、subgraph hash 与 workflow run scope，并以 owner+canvas+workflow 的 partial unique index 阻止同一 workflow 多 active Run；不同 workflow 可并发。旧 canvas-scoped Run 继续兼容读取。
- `compileWorkflowSnapshotRunPlan` 只编译请求 workflow 的显式成员，拒绝缺失成员、不完整节点组、普通跨边界边和类型错误的 Workflow Input，并计算不包含位置、尺寸和颜色的 SHA-256 subgraph hash。服务端从 owner-scoped `xh_assets` 解析媒体输入，客户端 URL 不作为权限权威。
- Supervision Dock 从当前 Canvas `workflows[]` 提供顶层托管目标切换，并为每个 workflow 分别记住 Run ID。创建 Run 时携带 workflow ID，UI 展示 workflow revision，不再把它称为整张 Canvas 的计划。
- Workflow `stages[]` 由区域内普通 `groupBox` 和显式未分组成员投影，保存稳定 ID、名称、顺序、`serial|parallel` 与 skipped 状态。托管面板只允许在 Run 创建前编辑；逆转跨阶段拓扑依赖会立即拒绝并短暂高亮冲突边和端点，且不会把高亮写入 Canvas edge 数据。
- Workflow Compiler 将阶段名称、模式、顺序和 skipped 状态写入不可变 Run Plan 与 subgraph hash。连续且独立的 parallel 阶段形成同一 scheduling wave；拓扑依赖仍逐步门控，skipped 阶段不释放步骤。旧 Run 缺少阶段名称/模式时继续按 serial 兼容读取。
- `@xinghuan/agent-core` 已实现持久化画布快照编译、分组顺序与拓扑校验、输入绑定、运行/步骤/尝试/审批状态机和纯调度内核。
- API 已提供 owner-scoped Canvas Run 创建、读取、控制命令、事件游标读取和 `/events/stream` SSE 投影；创建只从数据库中的 canvas revision 编译 Plan，不接受客户端 Plan。
- Web 已新增 Canvas Run client、SSE projection 和独立托管监督面板。顶部公告旁的 `AI 托管` 入口独立控制该面板并投影活动/异常状态；悬浮助手只保留对话、附件、知识引用与提案。旧 `canvas-agent` 节点仍可渲染历史画布，但已退出新建目录，只保存 scope、policyRef 和 agentRunId 引用，运行计划、事件和状态不进入 Zustand 或节点 JSON。
- 新建运行默认关闭，只有 PostgreSQL 模式并显式设置 `XINGHUAN_CANVAS_RUNS_ENABLED=true` 时可用。
- Worker 已新增 feature-gated Canvas Run Coordinator，可持久化领取 image/video/audio/llm 与受治理 RunningHub 原生步骤、创建现有 Generation Task、复用能力队列并在页面关闭后继续推进。其他未迁移节点仍标记为 `legacy_browser`，因此尚不能声称任意旧画布都可完整后台托管。
- `text`、`text-split`、`upload`、`material-set`、`pick-from-set`、`relay` 与 `output` 已迁移为原生确定性步骤：Worker 在同一 PostgreSQL 事务内计算 output binding、解锁下游和写入 Run Event，不创建 `xh_tasks`、不占用 Provider 并发，也不执行浏览器代码或任意脚本。`text-split` 从 Shared 纯模块复用分镜、正则、编号、字符切块、清理、前后缀和手工 override 语义。
- `runninghub` 主节点已进入 Canvas Run：Worker 仅消费冻结的 catalog reference、字段标识和标量值，并在任务创建事务中重新读取启用的 RunningHub Provider、目录条目、目标和字段 contract。Canvas Run 的 `start` 门禁复用原 API 的 `assertCanUseRunningHubCatalogItem` 权限语义；字段不再匹配、Provider/目录被关闭或授权撤销时不得入队。上游媒体只绑定到目录声明的媒体字段，随后由 owner-scoped 上传 Adapter 转为 RunningHub fileName；浏览器 `appInfo`、任意 URL 和 Provider 原始响应不是执行权威。
- Workflow Compiler 已为 RunningHub 节点冻结无密钥的 catalog reference、目标、字段标识和字段值；`appInfo` 原始响应、浏览器素材来源标识和敏感键均不进入 Run Plan。此快照只是后续服务端重新校验目录的输入，不是对浏览器配置的信任或执行授权。
- Canvas Run generation 与 quality coordinator 都通过 PostgreSQL 持久化 owner round-robin cursor 领取工作：短事务先锁定对应 cursor，再选择下一位有 ready work 的 owner，提交时才推进 cursor；Redis 不参与公平决策。
- PostgreSQL migration `027_internal_agent_llm_routing.sql` 已定义 Agent Definition、配置版本/环境发布、Agent Run/Action、Tool Policy 和 LLM Pool/Version/Entry/Health/Decision。
- Agent Orchestrator 已执行 owner-scoped 有界角色任务，使用既有 Provider/Model Catalog 的 `chat` 模型 Adapter，并对每次路由、回退、健康结果和动作写审计账本。
- Agent Runtime Configuration resolver 只读取当前 environment 的 approved active publication；历史配置可兼容读取退役工具名，但新配置 create/clone/publish 会拒绝退役工具。Orchestrator 在创建新 Run 时再次剥离退役工具，只锁定节点/模型安全投影、有效工具、token/timeout/cost、审批/恢复/质量策略。平台工具 `deny` 只能继续收紧 allowlist；同一 owner/idempotency key 仍回放原 Run 与原 Knowledge Snapshot。
- LLM Routing Pool 从 SQL 与纯领域路由两层拒绝非 `chat` 模型；图片、视频、音频生成模型仍由对应生成节点管理。
- 过冷却期的 `circuit_open` entry 会投影为 `half_open`，但必须取得 `xh_llm_route_entry_probe_leases` 的单探针 lease 才能实际调用。API Agent 在调用结束后释放；质量任务将 lease owner 持久化到质量上下文，并在评估结算时释放。
- Tool Gateway 只执行启动时固定注册且位于角色 allowlist 的工具，并在调用时重新验证 owner、canvas revision、budget 和 approval；发布的 platform tool policy 还会约束每 Run 调用上限，以及是否必须满足 revision/budget 条件。
- 旧外部助手 bridge、session cache、登录、Cookie/CSRF、环境变量和协议类型已从活跃代码与 Harness 移除。
- Admin “智能体与自动化”工作域已收敛为 `运行控制`、`模型绑定`、`恢复与选择`、`运行与审计` 四个任务域。旧十一页深链只做兼容映射；自由知识 CMS、通用工具白名单和节点内部投影不再是一级产品入口。
- Agent/LLM/Quality/Knowledge 配置使用 `draft -> review -> approved -> retired` 生命周期；Gray/Production publication 与版本状态分离，重新发布旧 approved 版本即为可审计回滚。
- Agent 配置 create/clone/review/approve/publish 均重新校验 Pool、知识 collection audience/enabled 状态和 Quality Profile 引用；Admin 编辑器保存始终创建新草稿并显示结构化 diff。
- Admin 路由模拟复用生产 `routeLlmCandidates`，模型写入同时校验启用 Provider、启用模型和 `chat` capability。
- 环境级 Agent、Canvas Run、质量评估和自动恢复 kill switch 已接入真实入口；数据库记录不存在时默认关闭，暂停和取消不受启动门禁阻断。
- 默认有界角色可幂等初始化为草稿；不再新建 `canvas-manager` 或 `public-canvas` 自由知识集合，也不会自动批准、发布或选择任意模型。
- 每次 Agent 角色调用先创建或复用 owner-scoped、environment/audience-scoped 的不可变 Knowledge Snapshot，再创建 Agent Run 并写入 `knowledge_snapshot_id`。新快照只锁定节点目录与安全模型投影，`document_publications` 和 `workflow_template_refs` 为空；历史快照及其文档正文仍保持只读和可重放。模型 usage 只保存数值计数，Provider 错误在进入账本前脱敏。
- 自由知识集合、文档审核和发布 API 保留 GET 兼容读取；所有新写入统一返回 `410 AGENT_KNOWLEDGE_WRITES_RETIRED`。数据库 migration 与历史数据不回滚、不删除。
- Agent Model Projection 只投影模型/Provider 标识、协议、用途、输入能力、capability tags、参数 schema、兼容节点、成本/延迟/质量倾向、LLM 资格、启用与健康状态；不读取或保存 base URL、API key、raw advanced config。
- 新运行的固定工具目录仅开放运行控制、质量/选择/恢复以及 `knowledge.node.get`、`knowledge.model.get/search` 等安全事实查询。`knowledge.documents.search`、`canvas.workflow.inspect/search/validate`、`canvas.patch.propose` 已进入显式 retired catalog，仅保留历史名称和旧 Run 兼容实现，不能写入或发布到新配置。
- PostgreSQL migration `028_artifact_quality_and_recovery.sql` 已定义版本化图片/视频 Quality Profile、Evaluation、Selection 和 Generation Recovery Decision。
- 图片与视频理解分别使用 `image_understanding` / `video_understanding` 角色。路由条目发布时冻结模型输入能力与媒体传输方式，运行时不能因模型目录后续编辑而改变已有版本语义。
- 视频评估优先选择 `videoReference + gemini_file` 的原生完整视频候选。Worker 只解析当前 owner 的内部产物引用，经 Gemini Files API 流式上传、等待 Provider File `ACTIVE`、执行 `generateContent`，并尽力删除临时 Provider File；这里的 `fileUri` 是 Gemini 临时文件，不是本项目的产物 URL。
- 原生候选技术失败后，只有 Artifact 已带至少两个 owner-scoped 时间戳帧且路由候选支持 `sampled_frames` 时才降级；没有原生能力和已有帧证据时明确失败。运行时不调用 FFmpeg，也不把需要登录的内部 `/files/output/...` URL 直接交给 Provider。
- `remote_url` 是面向明确支持服务端拉取视频的 Provider 网关的后续传输能力，当前默认关闭。路由核心即使读到该 transport，也只默认启用 `gemini_file`；只有媒体访问网关已启用时才可显式将 `remote_url` 传入路由。启用前必须由独立媒体访问网关签发短期、单产物、只读 URL，并在服务端冻结 Provider、模型、TTL、MIME、大小、时长和审计快照；浏览器、节点 JSON 或 Agent 不能提交任意 URL。
- Gemini chat/video Worker 在执行期间轮询取消状态并将取消 signal 传给上传、Provider File 等待和 `generateContent`；已上传的临时 Provider File 清理不复用取消 signal。其他 Provider 目前仍以取消后丢弃迟到结果为边界。
- Selection 的 score/confidence 只从 owner-scoped Evaluation 账本读取，客户端不能提交评分；Selection 与下游 Step `input_binding` 在同一事务写入。
- Generation Recovery 按同配置重试、受控参数修复、Run Plan 中节点已有的生成模型备选、审批/停止推进；生成模型备选不进入 LLM Routing Pool。
- Evaluation、Selection 和 Recovery Decision 已提供 owner-scoped Step API；Canvas Run Quality Coordinator 已自动触发批次评估、路由技术回退、确定性选择和下游 output binding。

本文不把 Accepted 目标架构冒充为当前能力。新目标和实施入口：

- ADR：`../../adr/0004-workflow-scoped-deterministic-supervision.md`
- Requirements：`../../superpowers/specs/2026-07-23-canvas-agent-experience-redesign-requirements.md`
- Plan：`../../superpowers/plans/2026-07-23-canvas-agent-experience-redesign-implementation.md`
- Audit：`../../records/architecture/2026-07-23-canvas-agent-v0719-audit-matrix.md`

## Current Code Entry Points

- 领域入口：`packages/agent-core/src/index.ts`
- Workflow Compiler：`packages/agent-core/src/workflow-compiler.ts`
- Workflow Stage 领域与 Web 规划：`packages/shared/src/workflow-stages.ts`、`apps/web/src/components/canvas-agent/workflowStagePlanning.ts`
- Canvas Run Kernel：`packages/agent-core/src/canvas-run-kernel.ts`
- 输入绑定：`packages/agent-core/src/artifact-binding.ts`
- 节点执行能力目录：`packages/agent-core/src/node-execution-capabilities.ts`
- 知识快照纯领域、模型投影、受限检索与工作流 proposal：`packages/agent-core/src/knowledge-snapshot.ts`
- 确定性节点运行器：`packages/agent-core/src/deterministic-node-runtime.ts`；共享文本分段算法：`packages/shared/src/text-split.ts`
- 数据迁移：`apps/api/db/026_canvas_agent_runtime.sql`
- Canvas Run repository/service/routes：`apps/api/src/canvas-run-repository.ts`、`canvas-run-service.ts`、`canvas-run-routes.ts`
- Task Attempt 与 Approval：`apps/api/src/task-attempt-repository.ts`、`agent-approval-repository.ts`
- Agent Orchestrator：`apps/api/src/agent-orchestrator.ts`
- Tool Gateway：`apps/api/src/agent-tool-gateway.ts`
- Agent Run repository：`apps/api/src/agent-run-repository.ts`
- Knowledge Snapshot migration/repository/tools：`apps/api/db/035_agent_knowledge_snapshots.sql`、`apps/api/src/agent-knowledge-snapshot-repository.ts`、`apps/api/src/agent-knowledge-tools.ts`
- LLM Routing core/repository：`packages/agent-core/src/llm-routing.ts`、`apps/api/src/llm-routing-repository.ts`
- Agent/LLM 数据迁移：`apps/api/db/027_internal_agent_llm_routing.sql`
- LLM 媒体输入快照迁移：`apps/api/db/031_llm_route_media_input_snapshots.sql`
- LLM half-open probe lease 迁移：`apps/api/db/033_llm_route_half_open_probe_leases.sql`
- Canvas Run 公平领取迁移与 helper：`apps/api/db/032_canvas_run_fair_dispatch.sql`、`apps/worker/src/canvas-run-dispatch-fairness.ts`
- 质量与恢复核心：`packages/agent-core/src/artifact-evaluation.ts`、`failure-recovery.ts`
- 质量 repository/service：`apps/api/src/artifact-quality-repository.ts`、`artifact-quality-service.ts`
- 恢复 repository/service：`apps/api/src/recovery-decision-repository.ts`、`generation-recovery-service.ts`
- 质量与恢复 API：`apps/api/src/quality-recovery-routes.ts`
- 质量与恢复迁移：`apps/api/db/028_artifact_quality_and_recovery.sql`
- Admin 治理迁移：`apps/api/db/029_agent_governance.sql`
- Admin 治理 repository/routes：`apps/api/src/agent-governance-repository.ts`、`admin-agent-governance-routes.ts`
- Admin 治理 workspace/client：`apps/admin/src/admin-agent-governance-workspace.tsx`、`admin-agent-governance-api.ts`
- 悬浮助手薄入口：`apps/web/src/components/CanvasAssistant.tsx`
- 助手工作台与会话：`apps/web/src/components/canvas-assistant/`
- 独立托管入口/controller：`apps/web/src/App.tsx`、`apps/web/src/components/canvas-agent/CanvasSupervisionDock.tsx`
- Canvas Agent 节点与监督投影：`apps/web/src/components/nodes/CanvasAgentNode.tsx`、`apps/web/src/components/canvas-agent/`
- Assistant API：`apps/api/src/server.ts`
- Assistant settings route：`apps/api/src/admin-assistant-settings-routes.ts`
- 浏览器画布运行：`apps/web/src/components/canvas/useCanvasRuntime.ts`
- 分组计划：`apps/web/src/components/canvas/groupExecutionManager.ts`
- 任务事件：`apps/api/src/task-runtime-events.ts`
- Provider/Model catalog：`apps/api/src/provider-model-catalog.ts`

## Canvas Run API

- `POST /api/canvas-runs`：从当前 owner 的持久化 canvas revision 创建不可变 Run Plan；请求必须携带 `idempotencyKey`。
- `GET /api/canvas-runs/:runId`：读取当前 owner 的 Run。
- `POST /api/canvas-runs/:runId/start|pause|resume|cancel|retry`：写入带幂等键的控制命令、状态和 Run Event。
- `GET /api/canvas-runs/:runId/events?after=<sequence>`：按原子递增 sequence 增量读取事件。
- `GET /api/canvas-runs/:runId/events/stream`：将同一持久化事件账本投影为 SSE；断线重连只影响投影，PostgreSQL sequence 仍是权威顺序。

所有写入由 repository 事务保护。Canvas revision 在创建事务内再次校验；Run、Step、Attempt、Approval 和 Event 查询均以 authenticated owner 为约束。Redis 不保存这些对象的权威状态。

## Node Capability Maintenance

`packages/agent-core/src/node-execution-capabilities.ts` 是版本化 Node Capability Catalog 的代码权威入口。每个条目维护用户可见名称与用途、执行类别、是否可进入计划、真实 server runtime、输入/输出端口和 cardinality、推荐上下游、显式连接规则、用法示例、替代节点、模型/服务提示、常见失败码及 Agent 可执行动作。结构/控制节点保留在目录中，但只有 `CANVAS_RUN_EXECUTABLE_NODE_TYPES` 才是执行资格权威。`buildNodeCapabilityPromptContext` 只向受控诊断/恢复调用注入这一投影；Admin 不再直接暴露完整内部目录页。目录的 `native_server` 不是愿景标签：目前包含 image/video/audio/llm、`runninghub`，以及 `text`、`text-split`、`upload`、`material-set`、`pick-from-set`、`relay`、`output`。`runninghub-wallet`、`rh-tools`、`rh-toolbox`、ComfyUI 和其余 legacy 节点仍会在 Run start 时明确拒绝，不能被 Agent 假定为后台托管。

## Knowledge Snapshot

`apps/api/db/035_agent_knowledge_snapshots.sql` 是不可变快照权威。数据库 trigger 拒绝 update/delete；新 Agent Run 必须引用快照，历史 Run 因而不会随节点目录、模型目录或 publication 的后续变化漂移。相同 owner 与相同 canonical hash 会复用快照，Agent Run 幂等重放仍返回原 Run 和原快照。

新快照创建顺序是：读取无密钥节点目录 -> 从 `xh_models`/`xh_providers` 生成安全模型投影 -> 固定空的文档与 workflow-template 投影 -> canonicalize/hash -> 插入快照 -> 创建 Agent Run。Repository 仍支持通过显式兼容参数重建旧式快照，供历史验证和只读迁移使用；新 Orchestrator 永远传入 `includePublishedDocuments: false`。

## Admin Governance

- `/admin/automation/controls`：环境开关、活跃运行、异常路由和待审批。
- `/admin/automation/models`：有界角色、配置版本、LLM 路由、模拟、发布和回滚。
- `/admin/automation/policies`：质量门、有限恢复和候选选择策略。
- `/admin/automation/activity`：Run、审批、恢复决策和不可变动作账本。
- 旧 `/overview|roles|llm-routes|tools|nodes|knowledge|quality|recovery|runs|approvals|audit` 深链映射到上述四域，不再恢复十一项等权导航。

所有治理写操作要求管理员、PostgreSQL 模式并追加后台审计。运行开关与配置 publication 是两层独立门禁；打开开关不会自动发布草稿，发布配置也不会自动打开环境。

## Update Triggers

- Phase 7 已实现 owner round-robin 领取；`npm run test:canvas-run-postgres-integration` 会先验证 `XINGHUAN_TEST_DATABASE_URL` 指向名称符合 `xinghuan_agent_test_*` 的隔离数据库，再执行全部迁移和真实 Coordinator/Task Store 并发验证。它覆盖 owner 轮转、过期 lease 接管、投递确认中断后的恢复和 `queued -> running` 原子领取；没有该环境变量时命令明确失败，常规 Vitest 只跳过该套测试。
- `npm run test:canvas-run-local-e2e` 用于 API、Redis、Worker 联合验收：调用方必须显式提供回环 API/Redis、隔离 PostgreSQL URL 和一次性管理员凭据。脚本只经 HTTP 建立本地 mock Provider、模型、画布和 Canvas Run，并以只读查询核验 Worker 结算；覆盖持久化 SSE、`Last-Event-ID` 重连、启动、暂停/恢复、取消和 `xh_tasks` 终态。它不会启动、连接或修改 Gray/Production。本机隔离环境已通过该流程。
- 已在本机隔离数据库执行该命令，全部迁移成功，真实集成组 4 项通过，覆盖公平 cursor、过期 lease 接管、投递恢复和重复 delivery 原子 claim。认证 UI 与 Gray 综合验收仍待完成；只有 `native_server` 节点可声明页面关闭后由服务端继续执行。
- 认证后的悬浮助手与托管面板验收步骤见 `authenticated-ui-acceptance.md`。该流程只允许隔离环境或 Gray 的一次性测试账号，不得把凭据、Cookie 或 Production 写操作纳入自动化。
- 每次更新必须同时运行 `npm run verify:agent-runtime-architecture-contract`。
