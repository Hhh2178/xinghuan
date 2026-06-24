# Task Runtime State Machine And Provider Kernel Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前分散的任务状态、Provider 运行态、RunningHub 队列/轮询、后台观测与正式/灰度边界，收口为可追踪、可维护、可回退的统一任务执行内核。

**Architecture:** 本计划不把 RunningHub 当成孤立特例处理，而是先建立任务运行态语义，再让 RH、GRSAI、OpenAI 类 Provider 都通过统一状态接口进入任务系统。`xh_tasks` 继续作为当前快照表，新增事件账本记录状态演进；worker 只负责执行和写事件，API 负责派生统一视图，后台和画布只消费统一视图。

**Tech Stack:** TypeScript, Node.js worker, PostgreSQL, Redis queue, React admin/web, RunningHub worker adapter, shared task runtime contracts, release governance scripts, CodeGraph

---

## Why This Is Root Work

当前问题不是一个单点 RH bug，而是四类问题叠在一起：

- `status / runtimeStage / waitReason / queueHint / logs / provider raw status` 同时表达任务状态，但没有主次关系。
- 后台任务页不是实时观测面，页面可能停留在旧状态。
- RH 的本地排队、上游排队、远端运行、轮询超时、结果回填混在一条粗线里。
- 正式版和灰度版版本不同，且生产历史上仍存在共享数据库口径，排查结论容易被环境边界污染。

本计划的核心判断：

- 只修 `queueHint` 或前端刷新，只能改善观感。
- 只调 RH timeout，只能减少一部分失败。
- 要长期稳定，必须先建立统一状态机和事件账本，再治理 Provider 适配层。

## Target Model

### Task Snapshot

`xh_tasks` 继续保留当前快照，用于列表、查询和快速筛选。

快照中长期稳定的核心字段：

- `status`: 业务结果状态，只保留 `queued / running / succeeded / failed / cancelled`。
- `runtimeStage`: 当前执行阶段，用于解释任务为什么处在这个业务状态。
- `providerState`: 上游原始状态快照，用于排查，不直接驱动 UI。
- `failureCategory / providerDiagnostic / upstreamHttpStatus / upstreamResponseSnippet / cancelState`: 统一诊断字段。

### Task Events

新增事件账本，记录任务生命周期，不替代 `xh_tasks`，而是成为排障和状态派生依据。

推荐事件：

- `task_created`
- `task_queued`
- `task_claimed`
- `local_user_window_blocked`
- `provider_window_blocked`
- `provider_submit_started`
- `provider_submit_succeeded`
- `provider_queue_limited`
- `provider_polling`
- `provider_queued`
- `provider_running`
- `provider_succeeded`
- `provider_failed`
- `materialization_started`
- `materialization_succeeded`
- `task_cancel_requested`
- `task_cancelled`
- `task_failed`
- `task_succeeded`

### Display State

后台和画布不直接拼 `status + logs`，统一消费 API 派生出的展示态：

- `displayStatus`: 用户可见状态标签。
- `displayTone`: `muted / warning / success / danger`。
- `displayMessage`: 当前阶段一句话说明。
- `isActionable`: 当前是否可以取消、重试或查看结果。

## Consequences And Tradeoffs

### Positive Effects

- 后台、画布、worker 日志、RH 上游状态会使用同一套语义，减少“看起来互相打架”的状态。
- RH 不是特殊补丁路径，后续接入新协议时也能复用同一套 Provider 运行态接口。
- 任务失败可以回放事件，知道失败前是否经历过排队、重试、上游运行或本地取消。
- 正式版和灰度版差异会被纳入发布检查，不再靠人工记忆区分。

### Costs

- 会新增一张事件表和一组 runtime helper，短期代码量会上升。
- worker、API、后台、画布都要接入统一展示态，属于中等规模治理。
- 旧任务没有完整事件历史，只能从快照和日志兼容派生。

### Main Risks

- 如果一次性改太多 UI 和 worker 逻辑，容易把现有任务链路改坏。
- 如果事件账本写入失败影响主任务执行，会把观测系统变成业务风险。
- 如果不做兼容层，旧任务列表可能出现显示缺字段。

### Risk Controls

- 事件写入必须是 best-effort，不允许因为事件写失败导致任务失败。
- 第一阶段只新增事件与派生展示，不改变 worker 主执行行为。
- 所有新增字段必须支持缺省值，旧任务继续可读。
- 每个阶段都能独立提交和回退。

## File Map

### Shared Runtime Types

- Modify: `packages/shared/src/provider-generation-task.ts`
  增加 `runtimeStage / providerState / displayStatus / displayMessage` 类型。
- Modify: `packages/shared/src/index.ts`
  导出统一任务运行态类型。

### API Runtime Projection

- Create: `apps/api/src/task-runtime-events.ts`
  负责事件类型、事件写入、事件查询、best-effort 包装。
- Create: `apps/api/src/task-runtime-projection.ts`
  负责从 `xh_tasks.result` 和最近事件派生 `displayStatus / displayMessage / displayTone`。
- Modify: `apps/api/src/provider-generation-task-service.ts`
  查询任务状态时返回统一展示态。
- Modify: `apps/api/src/server.ts`
  后台任务列表和画布任务查询统一走 projection，不在路由里临时拼状态。
- Create: `apps/api/db/018_task_runtime_events.sql`
  新增任务事件账本表与索引。

### Worker Runtime Writer

- Create: `apps/worker/src/worker-runtime-events.ts`
  worker 侧事件写入 helper。
- Modify: `apps/worker/src/worker-task-store.ts`
  给 `updateTask / touchTaskRuntime / touchQueuedTaskRuntime` 增加可选 runtime patch 清理能力。
- Modify: `apps/worker/src/worker-deferred-requeue.ts`
  写入 `provider_window_blocked / provider_queue_limited` 事件。
- Modify: `apps/worker/src/worker-runninghub-client.ts`
  将 RH submit、poll、queued、running、success、timeout 统一输出 Provider runtime state。
- Modify: `apps/worker/src/worker.ts`
  只做 glue：接收 adapter state、写快照、写事件、收口成功/失败/取消。

### Admin And Canvas Display

- Modify: `apps/admin/src/admin-types.ts`
  增加任务展示态字段。
- Modify: `apps/admin/src/admin-view-model.ts`
  `statusText/taskTone` 优先使用后端 `displayStatus/displayTone`。
- Modify: `apps/admin/src/admin-task-panel.tsx`
  展示“等待 RH 窗口”“上游排队”“上游运行”“轮询超时”等细状态。
- Modify: `apps/admin/src/main.tsx`
  任务页开启低频自动刷新，默认 5 秒，只在任务 tab 或有未完成任务时运行。
- Modify: `apps/web/src/services/generation.ts`
  接收统一展示态，兼容旧字段。
- Modify: `apps/web/src/components/nodes/RunningHubNode.tsx`
  节点运行态使用统一展示态，不直接拼 `status / queueHint`。

### Environment Governance

- Modify: `ops/current/production.md`
  明确 production 数据库目标、共享库历史风险和隔离目标。
- Modify: `ops/current/gray.md`
  明确 gray 数据库目标。
- Create: `scripts/verify-release-database-boundary.mjs`
  检查 gray / production status 与数据库目标声明是否一致。
- Modify: `scripts/release/verify-gray-runtime.mjs`
  输出数据库目标检查结果。
- Modify: `scripts/release/verify-production-runtime.mjs`
  如当前脚本存在，则同步输出数据库目标检查结果；如不存在，本轮只补文档和独立 verify 脚本。

### Verification

- Create: `scripts/verify-task-runtime-state-contract.mjs`
  检查 shared 类型、projection、API、worker 接入点。
- Create: `scripts/verify-task-runtime-event-ledger-contract.mjs`
  检查 migration、event writer、best-effort 语义。
- Create: `scripts/verify-runninghub-runtime-state-contract.mjs`
  检查 RH submit/poll/queue/timeout 事件与 projection 映射。
- Modify: `scripts/verify-runninghub-queue-governance-contract.mjs`
  扩展到 runtime stage 和 display state。
- Modify: `scripts/verify-local-acceptance-chain.mjs`
  纳入任务运行态新 contract。

## Phased Execution

### Phase 1: 状态语义和展示态，不改变执行行为

目标：

- 先让后台和画布看到一致状态。
- 不改变 RH 提交、轮询、重试、取消行为。

实施：

- 新增 shared runtime display 类型。
- 新增 `task-runtime-projection.ts`。
- API 返回 `displayStatus / displayMessage / displayTone`。
- Admin 任务页使用 display 字段。
- Admin 任务页增加自动刷新。

影响：

- 用户会更清楚地区分“本地排队”“等待 RH Key”“上游排队”“上游运行”。
- 旧任务仍可显示，因为 projection 必须兼容缺字段。

维护成本：

- 低到中。
- 主要新增一个 projection 文件，后续所有 UI 都复用它。

回退：

- 如果 UI 展示有误，可以只回退 Admin/Web 使用 display 字段的提交。
- API 继续返回额外字段，不破坏旧客户端。

验证：

- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/admin`
- `npm run type-check -w @xinghuan/web`
- `node scripts/verify-task-runtime-state-contract.mjs`

### Phase 2: 事件账本，先做可观测，不驱动业务

目标：

- 记录任务生命周期，补足排障证据。
- 事件写入失败不影响任务执行。

实施：

- 新增 `018_task_runtime_events.sql`。
- API 和 worker 增加 best-effort event writer。
- 在任务创建、领取、排队阻塞、提交成功、轮询、成功、失败、取消处写事件。

影响：

- 能追踪“为什么这个任务曾经显示为排队，后来又成功/失败”。
- 后续可以基于事件做任务详情时间线。

维护成本：

- 中。
- 后续新增 Provider 时需要补事件写入，但接口统一后成本可控。

回退：

- 事件表可以保留不用。
- 关闭 event writer 不影响 `xh_tasks` 主流程。

验证：

- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/worker`
- `node scripts/verify-task-runtime-event-ledger-contract.mjs`
- 手工 SQL 检查事件表有新增记录，且任务执行不依赖事件表。

### Phase 3: RunningHub Provider 状态标准化

目标：

- 把 RH 的本地等待、上游排队、上游运行、轮询超时从字符串日志改成标准 Provider runtime state。
- 修复成功/失败后 `waitReason / waitDetail / queueHint` 残留。

实施：

- `worker-runninghub-client.ts` 输出标准 provider state。
- `worker.ts` 成功/失败/取消收口时清理过期等待字段。
- `worker-deferred-requeue.ts` 对 `api queue limit reached` 写 `provider_queue_limited` 事件。
- RH timeout 不再只给一句 `轮询超时`，同时记录最近上游状态、最后一次 poll 时间和 upstream task id。

影响：

- 直接修复“任务已经成功/失败但仍带 queue limit 文案”的历史形态。
- 轮询超时排查会更准确。

维护成本：

- 中。
- RH adapter 会更规整，后续改 RH 协议更容易。

回退：

- 如果 RH 运行态映射有问题，可以回退 RH adapter 和 worker glue 提交。
- 不回退事件表和 API display 基础层。

验证：

- `npm run type-check -w @xinghuan/worker`
- `node scripts/verify-runninghub-runtime-state-contract.mjs`
- `node scripts/verify-runninghub-queue-governance-contract.mjs`
- `node scripts/verify-runninghub-dynamic-key-selection-contract.mjs`
- 使用 mock fetch 覆盖：提交成功、上游 queued、上游 running、成功、421 queue limit、timeout。

### Phase 4: RH timeout 和重试策略治理

目标：

- 降低“RH 后台已长时间执行，本地提前轮询超时”的概率。
- 不把所有任务无限等待。

实施：

- 默认 RH timeout 按条目类型拆分：
  - 普通短任务默认 20 分钟。
  - 视频 / 数字人 / 对口型类条目默认 60 分钟。
  - 后台 RH 条目允许显式配置 `pollTimeoutMs`。
- 当任务经历过 `provider_queue_limited` 后，下一次提交成功的 poll timeout 使用更宽松上限。
- timeout 失败前写最后一次上游状态和最近 poll 响应摘要。

影响：

- 长任务误失败会下降。
- 部分真实失败任务会更晚失败，所以后台需要展示“上游仍在运行/等待”。

维护成本：

- 中。
- 需要在 RH 条目治理里维护默认 timeout 规则。

回退：

- 可以只回退 timeout 默认值，不影响状态机和事件账本。

验证：

- `npm run type-check -w @xinghuan/worker`
- `node scripts/verify-runninghub-runtime-state-contract.mjs`
- 新增 mock timeout contract，验证短任务和长任务不同 timeout。

### Phase 5: 正式/灰度边界治理

目标：

- 让正式版和灰度版的运行态、数据库目标、队列目标可被脚本确认。
- 避免继续出现“截图说正式，数据却可能混到灰度历史口径”的排查噪音。

实施：

- 补 `verify-release-database-boundary.mjs`。
- release verify 输出 `environment / dataDir / databaseName / expectedDatabaseName`。
- 文档明确当前历史共享库风险和拆分目标。
- 后续生产切换前，先出独立数据库迁移方案，不在本计划内直接搬库。

影响：

- 发布和排障可信度上升。
- 数据库隔离属于高风险运维动作，本计划先做检测和记录，不直接搬迁生产数据。

维护成本：

- 低。
- 发布脚本多一条检查。

回退：

- 文档和 verify 脚本可单独回退。
- 不触碰生产数据。

验证：

- `node scripts/verify-release-database-boundary.mjs --environment=gray`
- `node scripts/verify-release-database-boundary.mjs --environment=production`
- `npm run verify:current-release-entry-consistency`

## Release Strategy

### Gray First

所有阶段先进入 gray。

Agent 验证范围：

- type-check
- contract scripts
- mock task lifecycle
- release package boundary
- service active
- `/api/status`
- 数据库目标检查

用户验收范围：

- 后台任务页状态是否容易理解。
- 画布节点状态是否符合真实体验。
- RH 真实长任务是否仍出现误失败。
- 取消/重试是否符合直觉。

### Production After Gray

Production 不直接接收未观察过的状态机改动。

推荐 gate：

- gray 至少完成一轮 RH 真实任务验收。
- 后台任务页状态无明显误导。
- 至少确认一个经历上游排队的 RH 任务能最终成功或清晰失败。
- production 当前数据库边界风险已在发布记录中明确。

## Rollback Strategy

- Phase 1 回退：回退 UI display 消费和 API projection 返回，不影响任务执行。
- Phase 2 回退：关闭 event writer，保留事件表。
- Phase 3 回退：回退 RH adapter 状态标准化，恢复旧 worker 行为。
- Phase 4 回退：恢复 RH timeout 默认值。
- Phase 5 回退：回退 verify 脚本和文档，不影响运行态。

任何阶段不得通过删除历史任务、清空 Redis 或直接改生产任务结果来“修复观感”。

## Acceptance Checklist

- 后台任务列表不再只显示粗粒度 `运行中`，能区分等待窗口、上游排队、上游运行、完成、失败。
- 成功或失败后的任务不再残留旧的 `api queue limit reached` 作为当前状态提示。
- RH 轮询超时失败会保留 upstream task id、最后状态、最后 poll 摘要。
- 画布 RH 节点和后台任务页对同一任务的状态解释一致。
- 正式版和灰度版的当前 release、版本号、数据库目标可以由脚本输出。
- 新增事件写入失败不会导致任务失败。

## Non-Goals

- 本计划不直接迁移 production 数据库。
- 本计划不重写 Redis 队列系统。
- 本计划不把所有 Provider 一次性重构完。
- 本计划不做完整任务详情时间线 UI，事件表先用于排障和后续扩展。
- 本计划不改变用户素材库和生成库数据结构。

## Recommended Commit Boundaries

1. `docs: add task runtime governance plan`
2. `feat: add task runtime display projection`
3. `feat: add task runtime event ledger`
4. `fix: normalize runninghub runtime state`
5. `fix: tune runninghub polling timeout governance`
6. `chore: add release database boundary checks`
7. `docs: record task runtime governance gray candidate`

## First Implementation Batch

第一批只做 Phase 1。

原因：

- 它能先解决用户最直接看到的“状态显示不一致”。
- 它不改变 worker 执行行为，风险最低。
- 它为 Phase 2 和 Phase 3 建立统一返回结构。

第一批完成后再决定是否立刻进入 Phase 2/3，而不是一次性把任务内核全部改完。
