# Agent Runtime 系统

## Current Implementation Status

内部 Agent Runtime、首批 `native_server` 节点的服务端托管执行、质量恢复和 Admin 治理均已落地；但面向全部 legacy browser 节点的服务端托管尚未完成实现。当前仍处于本地候选阶段，认证 UI 与 Gray 验收尚未完成。当前事实是：

- 画布助手已替换为全新的深色生产工作台 UI；会话、附件、编写器和消息投影分离，支持图片选择与剪贴板粘贴、节点/工作流/媒体上下文和内部 Agent SSE 响应。
- assistant 协议已使用 `agent | fallback`；聊天与 Provider 分析优先进入内部 Agent Orchestrator，未发布对应 LLM 路由或调用失败时使用受限本地 fallback。
- 整画布与分组执行仍由浏览器 runtime 驱动，各生成节点保留自己的观察/轮询逻辑。
- PostgreSQL 迁移 `026_canvas_agent_runtime.sql` 已定义 Canvas Run、Step、Event、Command、Task Attempt 和 Approval 权威表。
- `@xinghuan/agent-core` 已实现持久化画布快照编译、分组顺序与拓扑校验、输入绑定、运行/步骤/尝试/审批状态机和纯调度内核。
- API 已提供 owner-scoped Canvas Run 创建、读取、控制命令、事件游标读取和 `/events/stream` SSE 投影；创建只从数据库中的 canvas revision 编译 Plan，不接受客户端 Plan。
- Web 已新增 Canvas Run client、SSE projection、托管监督面板和 `canvas-agent` 节点。节点只保存 scope、policyRef 和 agentRunId 引用，运行计划、事件和状态不进入 Zustand 或节点 JSON。
- 新建运行默认关闭，只有 PostgreSQL 模式并显式设置 `XINGHUAN_CANVAS_RUNS_ENABLED=true` 时可用。
- Worker 已新增 feature-gated Canvas Run Coordinator，可持久化领取 image/video/audio/llm 与受治理 RunningHub 原生步骤、创建现有 Generation Task、复用能力队列并在页面关闭后继续推进。其他未迁移节点仍标记为 `legacy_browser`，因此尚不能声称任意旧画布都可完整后台托管。
- `text`、`text-split`、`upload`、`material-set`、`pick-from-set`、`relay` 与 `output` 已迁移为原生确定性步骤：Worker 在同一 PostgreSQL 事务内计算 output binding、解锁下游和写入 Run Event，不创建 `xh_tasks`、不占用 Provider 并发，也不执行浏览器代码或任意脚本。`text-split` 从 Shared 纯模块复用分镜、正则、编号、字符切块、清理、前后缀和手工 override 语义。
- `runninghub` 主节点已进入 Canvas Run：Worker 仅消费冻结的 catalog reference、字段标识和标量值，并在任务创建事务中重新读取启用的 RunningHub Provider、目录条目、目标和字段 contract。Canvas Run 的 `start` 门禁复用原 API 的 `assertCanUseRunningHubCatalogItem` 权限语义；字段不再匹配、Provider/目录被关闭或授权撤销时不得入队。上游媒体只绑定到目录声明的媒体字段，随后由 owner-scoped 上传 Adapter 转为 RunningHub fileName；浏览器 `appInfo`、任意 URL 和 Provider 原始响应不是执行权威。
- Workflow Compiler 已为 RunningHub 节点冻结无密钥的 catalog reference、目标、字段标识和字段值；`appInfo` 原始响应、浏览器素材来源标识和敏感键均不进入 Run Plan。此快照只是后续服务端重新校验目录的输入，不是对浏览器配置的信任或执行授权。
- Canvas Run generation 与 quality coordinator 都通过 PostgreSQL 持久化 owner round-robin cursor 领取工作：短事务先锁定对应 cursor，再选择下一位有 ready work 的 owner，提交时才推进 cursor；Redis 不参与公平决策。
- PostgreSQL migration `027_internal_agent_llm_routing.sql` 已定义 Agent Definition、配置版本/环境发布、Agent Run/Action、Tool Policy 和 LLM Pool/Version/Entry/Health/Decision。
- Agent Orchestrator 已执行 owner-scoped 有界角色任务，使用既有 Provider/Model Catalog 的 `chat` 模型 Adapter，并对每次路由、回退、健康结果和动作写审计账本。
- LLM Routing Pool 从 SQL 与纯领域路由两层拒绝非 `chat` 模型；图片、视频、音频生成模型仍由对应生成节点管理。
- 过冷却期的 `circuit_open` entry 会投影为 `half_open`，但必须取得 `xh_llm_route_entry_probe_leases` 的单探针 lease 才能实际调用。API Agent 在调用结束后释放；质量任务将 lease owner 持久化到质量上下文，并在评估结算时释放。
- Tool Gateway 只执行启动时固定注册且位于角色 allowlist 的工具，并在调用时重新验证 owner、canvas revision、budget 和 approval。
- 旧外部助手 bridge、session cache、登录、Cookie/CSRF、环境变量和协议类型已从活跃代码与 Harness 移除。
- Admin 已新增独立“智能体与自动化”工作域，提供角色、LLM 路由、工具、节点能力、知识、质量、恢复、运行、审批和动作审计稳定深链。
- Agent/LLM/Quality/Knowledge 配置使用 `draft -> review -> approved -> retired` 生命周期；Gray/Production publication 与版本状态分离，重新发布旧 approved 版本即为可审计回滚。
- Admin 路由模拟复用生产 `routeLlmCandidates`，模型写入同时校验启用 Provider、启用模型和 `chat` capability。
- 环境级 Agent、Canvas Run、质量评估和自动恢复 kill switch 已接入真实入口；数据库记录不存在时默认关闭，暂停和取消不受启动门禁阻断。
- 默认角色与 `public-canvas` 公开知识集合可幂等初始化为草稿，不自动批准、发布或选择任意模型。
- 悬浮助手只读取当前环境、`knowledgeProfile` 指定集合、`audience = public` 且 approved/active publication 的文档；internal 知识不进入普通用户上下文。Agent Run 只记录文档 key/version，模型 usage 只保存数值计数，Provider 错误在进入账本前脱敏。
- PostgreSQL migration `028_artifact_quality_and_recovery.sql` 已定义版本化图片/视频 Quality Profile、Evaluation、Selection 和 Generation Recovery Decision。
- 图片与视频理解分别使用 `image_understanding` / `video_understanding` 角色。路由条目发布时冻结模型输入能力与媒体传输方式，运行时不能因模型目录后续编辑而改变已有版本语义。
- 视频评估优先选择 `videoReference + gemini_file` 的原生完整视频候选。Worker 只解析当前 owner 的内部产物引用，经 Gemini Files API 流式上传、等待 Provider File `ACTIVE`、执行 `generateContent`，并尽力删除临时 Provider File；这里的 `fileUri` 是 Gemini 临时文件，不是本项目的产物 URL。
- 原生候选技术失败后，只有 Artifact 已带至少两个 owner-scoped 时间戳帧且路由候选支持 `sampled_frames` 时才降级；没有原生能力和已有帧证据时明确失败。运行时不调用 FFmpeg，也不把需要登录的内部 `/files/output/...` URL 直接交给 Provider。
- `remote_url` 是面向明确支持服务端拉取视频的 Provider 网关的后续传输能力，当前默认关闭。路由核心即使读到该 transport，也只默认启用 `gemini_file`；只有媒体访问网关已启用时才可显式将 `remote_url` 传入路由。启用前必须由独立媒体访问网关签发短期、单产物、只读 URL，并在服务端冻结 Provider、模型、TTL、MIME、大小、时长和审计快照；浏览器、节点 JSON 或 Agent 不能提交任意 URL。
- Gemini chat/video Worker 在执行期间轮询取消状态并将取消 signal 传给上传、Provider File 等待和 `generateContent`；已上传的临时 Provider File 清理不复用取消 signal。其他 Provider 目前仍以取消后丢弃迟到结果为边界。
- Selection 的 score/confidence 只从 owner-scoped Evaluation 账本读取，客户端不能提交评分；Selection 与下游 Step `input_binding` 在同一事务写入。
- Generation Recovery 按同配置重试、受控参数修复、Run Plan 中节点已有的生成模型备选、审批/停止推进；生成模型备选不进入 LLM Routing Pool。
- Evaluation、Selection 和 Recovery Decision 已提供 owner-scoped Step API；Canvas Run Quality Coordinator 已自动触发批次评估、路由技术回退、确定性选择和下游 output binding。

本文不把 Accepted 目标架构冒充为当前能力。目标和实施入口：

- ADR：`../../adr/0003-canvas-agent-runtime-and-llm-routing.md`
- Spec：`../../superpowers/specs/2026-07-22-canvas-agent-runtime-and-llm-routing.md`
- Plan：`../../superpowers/plans/2026-07-22-canvas-agent-runtime-and-llm-routing-implementation.md`

## Current Code Entry Points

- 领域入口：`packages/agent-core/src/index.ts`
- Workflow Compiler：`packages/agent-core/src/workflow-compiler.ts`
- Canvas Run Kernel：`packages/agent-core/src/canvas-run-kernel.ts`
- 输入绑定：`packages/agent-core/src/artifact-binding.ts`
- 节点执行能力目录：`packages/agent-core/src/node-execution-capabilities.ts`
- 确定性节点运行器：`packages/agent-core/src/deterministic-node-runtime.ts`；共享文本分段算法：`packages/shared/src/text-split.ts`
- 数据迁移：`apps/api/db/026_canvas_agent_runtime.sql`
- Canvas Run repository/service/routes：`apps/api/src/canvas-run-repository.ts`、`canvas-run-service.ts`、`canvas-run-routes.ts`
- Task Attempt 与 Approval：`apps/api/src/task-attempt-repository.ts`、`agent-approval-repository.ts`
- Agent Orchestrator：`apps/api/src/agent-orchestrator.ts`
- Tool Gateway：`apps/api/src/agent-tool-gateway.ts`
- Agent Run repository：`apps/api/src/agent-run-repository.ts`
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

`packages/agent-core/src/node-execution-capabilities.ts` 是版本化 Node Capability Catalog 的代码权威入口。每个条目维护用户可见名称与用途、执行类别、是否可进入计划、真实 server runtime、输入/输出端口和 cardinality、推荐上下游、模型/服务提示、常见失败码及 Agent 可执行动作。`buildNodeCapabilityPromptContext` 只向 planner/manager/checker/recovery 注入这一受控投影；Admin `/admin/automation/nodes` 读取同一目录。目录的 `native_server` 不是愿景标签：目前包含 image/video/audio/llm、`runninghub`，以及 `text`、`text-split`、`upload`、`material-set`、`pick-from-set`、`relay`、`output`。`runninghub-wallet`、`rh-tools`、`rh-toolbox`、ComfyUI 和其余 legacy 节点仍会在 Run start 时明确拒绝，不能被 Agent 假定为后台托管。

## Admin Governance

- `/admin/automation/overview`：环境开关、活跃运行、异常路由和待审批。
- `/admin/automation/roles`：Agent 定义、配置草稿、审核与环境发布。
- `/admin/automation/llm-routes`：仅 LLM 路由池、健康、模拟、发布和回滚。
- `/admin/automation/tools|nodes|knowledge|quality|recovery`：工具策略、节点能力、知识、质量和恢复。
- `/admin/automation/runs|approvals|audit`：运行、审批和不可变动作账本。

所有治理写操作要求管理员、PostgreSQL 模式并追加后台审计。运行开关与配置 publication 是两层独立门禁；打开开关不会自动发布草稿，发布配置也不会自动打开环境。

## Update Triggers

- Phase 7 已实现 owner round-robin 领取；`npm run test:canvas-run-postgres-integration` 会先验证 `XINGHUAN_TEST_DATABASE_URL` 指向名称符合 `xinghuan_agent_test_*` 的隔离数据库，再执行全部迁移和真实 Coordinator/Task Store 并发验证。它覆盖 owner 轮转、过期 lease 接管、投递确认中断后的恢复和 `queued -> running` 原子领取；没有该环境变量时命令明确失败，常规 Vitest 只跳过该套测试。
- `npm run test:canvas-run-local-e2e` 用于 API、Redis、Worker 联合验收：调用方必须显式提供回环 API/Redis、隔离 PostgreSQL URL 和一次性管理员凭据。脚本只经 HTTP 建立本地 mock Provider、模型、画布和 Canvas Run，并以只读查询核验 Worker 结算；覆盖持久化 SSE、`Last-Event-ID` 重连、启动、暂停/恢复、取消和 `xh_tasks` 终态。它不会启动、连接或修改 Gray/Production。本机隔离环境已通过该流程。
- 已在本机隔离数据库执行该命令，全部迁移成功，真实集成组 4 项通过，覆盖公平 cursor、过期 lease 接管、投递恢复和重复 delivery 原子 claim。认证 UI 与 Gray 综合验收仍待完成；只有 `native_server` 节点可声明页面关闭后由服务端继续执行。
- 认证后的悬浮助手与托管面板验收步骤见 `authenticated-ui-acceptance.md`。该流程只允许隔离环境或 Gray 的一次性测试账号，不得把凭据、Cookie 或 Production 写操作纳入自动化。
- 每次更新必须同时运行 `npm run verify:agent-runtime-architecture-contract`。
