# RunningHub / Worker / Admin / Canvas Cross-Layer Audit - 2026-06-23

## 审查目标

- 记录当前已经确认的运行时 bug、架构热点与环境风险。
- 从“画布前端 → API → Worker → 后台 Admin → RunningHub 配置”的协作链继续检查跨层问题。
- 给出可执行的修正优先级，避免后续继续边跑边补。

## 审查范围

- 前端画布：
  - `apps/web/src/components/nodes/RunningHubNode.tsx`
  - `apps/web/src/services/generation.ts`
- 后台 Admin：
  - `apps/admin/src/admin-runninghub-workspace.tsx`
  - `apps/admin/src/admin-runninghub-item-editor.tsx`
- API：
  - `apps/api/src/server.ts`
  - `apps/api/src/runninghub-catalog.ts`
  - `apps/api/src/runninghub-execution-descriptor.ts`
- Worker：
  - `apps/worker/src/worker.ts`
  - `apps/worker/src/worker-grsai-image-client.ts`
- Shared：
  - `packages/shared/src/index.ts`
  - `packages/shared/src/provider-generation-task.ts`
  - `packages/shared/src/runninghub.ts`

## 已确认问题

### 1. RunningHub 多 Key 抢占仍存在竞争缺口

- 严重度：`P1`
- 位置：
  - [worker.ts](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/worker/src/worker.ts:535)
  - [worker.ts](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/worker/src/worker.ts:545)
  - [worker.ts](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/worker/src/worker.ts:551)
- 现状：
  - Worker 先 `selectExecutableRunningHubKey` 选出 Key，再对该 Key 做 Redis `incr` 占位。
  - 如果并发竞争发生，当前 Key 占位失败后直接返回 busy，不会继续尝试下一把仍有余量的 Key。
- 影响：
  - 多 Key 池会出现“有余量但提前排队/失败”。
  - 这会直接损伤用户对 Key 池机制的预期，也会让后台看起来“配置生效了，但业务体验没生效”。
- 建议：
  - 把“选 Key + 占位”做成同一模块里的可重试流程。
  - 单个 Key 抢占失败后继续尝试下一个可用 Key，直到所有 Key 都确实满载。

### 2. Production 仍与 gray 共库

- 严重度：`P1`
- 位置：
  - [ops/current/production.md](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/ops/current/production.md:15)
  - [docs/memory/current-state.md](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/docs/memory/current-state.md:18)
- 现状：
  - 当前 production `canvas.env` 与 `XINGHUAN_EXPECTED_DATABASE_NAME` 都仍是 `xinghuan_canvas_next`。
- 影响：
  - gray / production 数据互相污染。
  - 用户会感知到“正式内容回退”“灰度改动污染正式”“任务/素材/画布状态串位”。
- 建议：
  - 把 production 切到独立数据库与独立 Redis 队列命名。
  - 在 release gate 中把“production 不得指向 gray 库”升级成硬性阻断。

### 3. RunningHub 轮询成功分支缺少 JSON 容错归一化

- 严重度：`P2`
- 位置：
  - [worker.ts](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/worker/src/worker.ts:1220)
- 现状：
  - submit 分支对非法 JSON 有显式 `try/catch`。
  - poll 分支直接 `JSON.parse(pollText)`，若上游返回 200 但 body 非 JSON，会落成通用异常。
- 影响：
  - `failureCategory / providerDiagnostic / upstreamResponseSnippet` 会丢失精确口径。
  - 排障需要回日志猜，而不是直接看统一运行态。
- 建议：
  - 对 poll 分支补和 submit 一致的 JSON 保护。
  - 非 JSON success / gateway 页面也要继续映射到统一失败分类。

### 4. RunningHub Key 池归一化规则分散在三层

- 严重度：`P2`
- 位置：
  - [server.ts](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/server.ts:9034)
  - [worker.ts](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/worker/src/worker.ts:1683)
  - [admin-runninghub-workspace.tsx](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/admin/src/admin-runninghub-workspace.tsx:64)
- 现状：
  - API、Worker、Admin 都各自做了一遍 default Key / first item / enabled pool 的归一化。
- 影响：
  - 规则漂移后会出现“后台看起来是默认 A，实际 worker 却按 B 跑”的隐性问题。
- 建议：
  - 将 Key 池归一化下沉到 shared schema 或单一服务模块。
  - 前端只负责编辑状态，不再自带最终规则。

### 5. 核心热点文件已进入结构过载区

- 严重度：`P2`
- 位置：
  - [server.ts](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/server.ts) `11348` 行
  - [worker.ts](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/worker/src/worker.ts) `1935` 行
  - [RunningHubNode.tsx](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/web/src/components/nodes/RunningHubNode.tsx) `1436` 行
  - [admin-runninghub-workspace.tsx](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/admin/src/admin-runninghub-workspace.tsx) `828` 行
- 现状：
  - 这些文件都已经同时承载 orchestration + domain logic + UI / side effects。
- 影响：
  - 修改一点就要读很大上下文。
  - 回归面持续扩大，bug 修复越来越贵。
- 建议：
  - Worker 继续做第二阶段拆分。
  - API 把 RunningHub、任务、系统页拆成模块化 handler。
  - RH 节点和 RH 工作台进一步拆子 hooks / 子 section。

## 高概率跨层协作风险

### 6. RH 前端节点与 RH Tools 节点存在双实现漂移风险

- 严重度：`P2`
- 位置：
  - [RunningHubNode.tsx](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/web/src/components/nodes/RunningHubNode.tsx)
  - [RHToolsNode.tsx](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/web/src/components/nodes/RHToolsNode.tsx)
- 现状：
  - 两个节点都各自维护 `nodeInfoList` 拉取、字段显示、运行状态、提交逻辑、轮询/恢复逻辑。
- 风险：
  - 一边修了 displayLabel、进度、取消同步，另一边很容易滞后。
  - 用户看到的是“同属 RH，两个节点行为却不完全一致”。
- 建议：
  - 提取共享的 RH node runtime hook / helper。
  - 统一提交、轮询、结果清理、显示名策略。

### 7. `requestExample / responseExample` 分析链路与真实执行链路仍有断层

- 严重度：`P2`
- 位置：
  - [server.ts](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/server.ts:7636)
  - [admin-runninghub-workspace.tsx](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/admin/src/admin-runninghub-workspace.tsx:468)
  - [admin-runninghub-item-editor.tsx](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/admin/src/admin-runninghub-item-editor.tsx:645)
- 现状：
  - 后台分析已能从 `requestExample.nodeInfoList` 生成字段草案、从 `responseExample` 推断输出。
  - 但“分析结果被接受后，是否与后续真实运行目标返回的字段完全一致”仍缺少强校验。
- 风险：
  - 用户以为“后台分析完成 = 前端可执行”，但真实运行时字段仍可能漂移。
- 建议：
  - 增加“分析字段 vs 真实 fetchInfo 字段”的差异提示。
  - 在 RH 节点和后台编辑器里都暴露 drift 状态。

### 8. 取消链路虽然有统一字段，但双向同步仍未完全模块化

- 严重度：`P2`
- 位置：
  - [task-cancellation-service.ts](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/task-cancellation-service.ts:74)
  - [server.ts](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/server.ts:1231)
  - [worker.ts](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/worker/src/worker.ts:365)
- 现状：
  - API 侧取消入口、Worker 侧取消检测、统一 `cancelState` 已经有基础。
  - 但 provider 主动取消、后台取消、画布取消的同步路径仍散在多点。
- 风险：
  - 容易出现“后台显示取消了，但 provider 还在跑”或“provider 已取消，画布仍停在轮询”。
- 建议：
  - 按计划把 cancel sync 抽成单独 helper。
  - 统一本地取消、远端取消、结果回写的状态机。

### 10. RH 节点与 RH Tools 节点的“停止”更多是停本地轮询，不等于真实取消后端任务

- 严重度：`P1`
- 位置：
  - [RunningHubNode.tsx](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/web/src/components/nodes/RunningHubNode.tsx:1019)
  - [RHToolsNode.tsx](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/web/src/components/nodes/RHToolsNode.tsx:764)
  - [task-cancellation-service.ts](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/task-cancellation-service.ts:74)
- 现状：
  - 节点侧 `handleStop` 主要执行 `stopPoll()` + 本地状态回到 `idle`。
  - 当前这一步并不等于一定调用后端 `cancelTaskWithStrategy` 去取消真实任务。
- 影响：
  - 用户会看到“画布上停了”，但后台/Worker/上游可能还在跑。
  - 这会继续制造“任务已取消但资源仍生成”“后台状态与画布状态对不上”的错觉。
- 建议：
  - RH 节点和 RH Tools 节点统一接入真实 task cancel API。
  - “停止本地轮询”和“取消后端任务”要在 UI 上明确区分，避免语义混淆。

### 9. Shared 层对协作契约的承载还不够厚

- 严重度：`P3`
- 位置：
  - [packages/shared/src/index.ts](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/packages/shared/src/index.ts)
  - [packages/shared/src/provider-generation-task.ts](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/packages/shared/src/provider-generation-task.ts)
  - [packages/shared/src/runninghub.ts](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/packages/shared/src/runninghub.ts)
- 现状：
  - 现在 shared 里已有统一失败与取消字段，但 Key 池归一化、RH 执行态、节点协作字段还主要散在 app 层。
- 风险：
  - 跨层字段协议更多靠“大家手动一致”，不是靠单一类型源。
- 建议：
  - 继续下沉：
    - RH Key 池 schema
    - RH 任务 runtime schema
    - analyze draft / execution draft 的共享类型

### 11. 后台分析出来的 `outputDraft / executionDraft` 还没有真正进入画布运行时

- 严重度：`P2`
- 位置：
  - [server.ts](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/server.ts:7720)
  - [runninghub-execution-descriptor.ts](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/runninghub-execution-descriptor.ts:98)
  - [runninghubCatalog.ts](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/web/src/services/runninghubCatalog.ts:167)
  - [RunningHubNode.tsx](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/web/src/components/nodes/RunningHubNode.tsx:1217)
- 现状：
  - 后端分析已经会生成 `outputDraft` 和 `executionDraft`。
  - 前端 catalog 也已经把 `execution`、`outputSchema` 拉到了本地对象。
  - 但 RH 节点实际运行时仍主要依赖硬编码的提交、轮询和结果提取逻辑，没有真正按后台分析出的执行规则驱动。
- 影响：
  - 后台分析面板看起来“很完整”，但前端并没有完全消费这些信息。
  - 后续若接更多变体协议，后台条目和前端执行行为容易再次分叉。
- 建议：
  - 明确区分“分析草案”与“前端已实际生效的执行规则”。
  - 分阶段将 RH 节点的 submit / poll / result mapping 迁移到 descriptor 驱动模式。

### 12. 统一运行态诊断字段已经进入后端，但前端消费仍偏薄

- 严重度：`P2`
- 位置：
  - [provider-generation-task-service.ts](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/provider-generation-task-service.ts:144)
  - [generation.ts](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/web/src/services/generation.ts:182)
- 现状：
  - 后端任务查询结果已经带 `failureCategory / providerDiagnostic / upstreamHttpStatus / cancelState`。
  - 前端 generation service 和多数节点 UI 仍主要消费 `status / error / urls`，没有把 richer 诊断完整透出。
- 影响：
  - 用户在画布上看到的仍可能只是“失败了”，看不到是否是鉴权、额度、上游网关、取消还是业务失败。
  - 后台与前台对同一任务的可解释性不一致。
- 建议：
  - 将统一运行态诊断作为前端任务状态卡和节点错误展示的一等字段。
  - 至少把 `failureCategory` 和 `providerDiagnostic` 接到节点 UI。

### 13. RH 手动运行目标 UI 仍偏“app-centric”，对 workflow 协作语义不够清晰

- 严重度：`P3`
- 位置：
  - [RunningHubNode.tsx](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/web/src/components/nodes/RunningHubNode.tsx:331)
  - [RunningHubNode.tsx](D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/web/src/components/nodes/RunningHubNode.tsx:1198)
- 现状：
  - 节点内部仍以 `webappId` 作为一部分本地状态名和手动输入入口，即使当前 target 可能是 workflow。
  - 运行时虽然已有 `targetType / workflowId / runTargetId` 归一化，但高级输入区对用户展示仍较混合。
- 影响：
  - 用户在后台和前台之间切换时，容易误以为当前字段只适用于 App。
  - 容易放大“后台条目类型正确，但节点手动补参语义不清”的协作成本。
- 建议：
  - 前端高级区改成更中性的“运行目标 ID / 类型”表达。
  - 仅在真正需要时再展开显示 app / workflow 特定字段。

## 审查结论

### 当前最优先

1. 修复 RunningHub 多 Key 抢占逻辑，防止有余量却提前 busy。
2. 规划并执行 production 独立数据库 / 队列切分。
3. 按既定计划推进 `worker.ts` 第二阶段收口。

### 第二优先级

1. 统一 RH / RH Tools 节点共享运行时逻辑。
2. 补齐 `requestExample / responseExample` 与真实 fetchInfo 之间的 drift 提示。
3. 抽离 cancel sync helper。

### 长期治理方向

1. 将 RunningHub Key 池和 runtime schema 更多下沉到 shared。
2. 把 `server.ts` 和 `worker.ts` 从“超级入口文件”逐步拆回模块化边界。
3. 将“后台看到的配置”和“真实运行时生效值”统一建成同一套只读诊断视图。
