# 全链路读取性能优化与验收实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 系统性降低画布与 Admin 各业务域的首屏、切页、刷新和轮询延迟，同时消除重复请求、读取副作用、全量聚合读取、大 JSON 传输、权限目录重复重算和长期运行内存膨胀。

**Architecture:** 读取链路采用“路由级数据需求 + targeted repository + revision 快照 + 前端请求合并”的结构。GET 请求只读取已经准备好的投影；恢复、reconciliation、清理、迁移和审计落库从响应关键路径移出。性能优化按独立批次进入 Gray，每批使用同一真实规模数据集完成正确性、性能、内存和回滚验收后，才允许进入下一批。

**Tech Stack:** TypeScript, Node.js ESM, React, Zustand, PostgreSQL, Redis, Vitest, Node test runner, Playwright/Chromium, systemd, existing Harness and encrypted server release pipeline.

## Global Constraints

- 本计划批准前及执行期间，旧服务器到新服务器的数据迁移保持暂停。
- 未经用户重新明确授权，不部署 Gray/Production，不推送 GitHub，不重启运行中服务。
- 保留当前工作树中素材生命周期和迁移相关未提交改动，不覆盖、不回退、不夹带提交。
- 加密发布流程不改为运行时逐请求解密；开发仓库继续运行源码模式。
- 所有 GET 业务读取不得隐式执行恢复、清理、迁移、权限目录全量同步或配置写回。
- 管理员等级、owner 隔离、权限拒绝优先、revision 并发保护和审计完整性不得因缓存或异步化退化。
- 缓存必须有 revision 或明确失效事件；权限、用户、Provider、模型和 RH 目录不能只依赖长 TTL。
- 所有列表接口只返回列表展示字段；大型 payload、result、logs、配置正文和文件内容必须按详情读取。
- 不通过扩大 `max-old-space-size`、全局增加 PostgreSQL `work_mem` 或单纯扩容掩盖根因。
- PC 桌面端视觉验收使用 `1920x1080`；本计划不新增移动端专项布局。
- 每个实施批次独立提交、独立 Gray 验收、独立回滚，不把所有性能改造绑成一次大发布。
- 每个阶段都必须完成一次旧服务器 Gray 部署、真实数据验证、人工检查和问题修正；没有 Gray 证据不得进入下一阶段。
- Gray 阶段允许回退到上一阶段制品并重新调整，不能把未验证的多个阶段叠加部署。

## Target Budgets

以下预算同时要求功能正确、权限正确、响应体正确；只有速度达标但返回错误数据不算通过。

| 读取面 | Gray warm P95 | Gray cold P95 | 响应体预算 | 单次页面动作请求预算 |
| --- | ---: | ---: | ---: | ---: |
| 登录后 Admin 壳层摘要 | 300ms | 700ms | 100KB | 2 |
| 账号、用户组、会话单页 | 300ms | 700ms | 150KB | 每个活动子页 1-2 |
| Provider 列表 | 300ms | 700ms | 150KB | 1 |
| 模型目录 | 350ms | 800ms | 300KB | 1 |
| RH Catalog / RH 后台条目 | 300ms | 800ms | 400KB | 同 revision 1 |
| 工作流/画布列表 | 300ms | 700ms | 150KB | 1 |
| 资源库/生成库列表 | 400ms | 900ms | 500KB | 每个打开动作 1-2 |
| 后台任务列表，每页 20 条 | 500ms | 1,000ms | 200KB | 1 |
| 审计列表 | 500ms | 1,000ms | 250KB | 1 |
| 用量、费用、可靠性聚合 | 800ms | 1,500ms | 500KB | 每个活动分析页 1 |
| 系统健康 | 500ms | 1,000ms | 300KB | 手动刷新 1 |

运行态预算：

- Gray API 连续 6 小时 RSS 稳定，不允许单向无界增长；稳定目标 `<= 300MB`，6 小时净增长 `<= 20%`。
- Event loop delay P95 `<= 50ms`，P99 `<= 100ms`。
- 普通读取错误率 `< 0.5%`，超时率 `< 0.1%`。
- 同一个 query key 在 1 秒内只允许一个 in-flight 网络请求。
- 简单目录 GET 的 PostgreSQL 查询数 `<= 3`；复合分析 GET `<= 6`。
- 任务列表不得读取完整 `payload/result/logs`；任务详情允许按 ID 读取完整正文。

## Delivery Batches

| 批次 | 范围 | 放行条件 |
| --- | --- | --- |
| A | 基线、观测、无副作用检查、请求计数 | 旧服务器 Gray 只加观测，不改变业务响应 |
| B | Admin 路由级加载、Provider/模型、账号/组织/权限 | Gray 验证各页面只加载活动子页数据 |
| C | RH、画布、资源库、生成库、公共资源 | Gray 验证重复请求和读取时扫描归零 |
| D | 任务、审计、用量、费用、可靠性、系统健康 | Gray 验证大字段拆分和聚合查询预算 |
| E | 内存/FD、ZIP Worker、数据库与 6 小时 soak | Gray 验证无持续增长且后台任务不拖慢核心读取 |
| F | 全量回归、最终性能矩阵与发布准备 | Gray 完成完整业务验收，才具备 Production 评审资格 |

---

### Task 1: 冻结迁移与建立可重复性能基线

**Files:**
- Modify: `docs/superpowers/plans/2026-08-05-material-retention-and-production-migration.md`
- Create: `scripts/measure-read-performance.mjs`
- Create: `scripts/fixtures/read-performance-scenarios.json`
- Modify: `package.json`
- Create: `docs/logbooks/validations/2026-08-05-read-performance-baseline.md`

**Interfaces:**
- Produces: `npm run measure:read-performance -- --base-url=$env:XINGHUAN_GRAY_BASE_URL --scenario=all`
- Produces: JSON report fields `endpoint`, `phase`, `status`, `durationMs`, `responseBytes`, `requestCount`, `duplicateCount`.

- [ ] Record the migration and deployment freeze in the existing migration plan.
- [x] Add fixture scenarios for Admin shell, accounts, groups, sessions, providers, models, RH, tasks, analytics, system, canvas list, resources and generation library.
- [x] Implement a read-only measurement runner that never submits mutations and redacts cookies and response bodies from reports.
- [ ] Capture 10 cold and 50 warm samples per endpoint; record P50, P95, P99 and response bytes.
- [ ] Record old/new server process RSS, heap, event-loop delay, FD count, PostgreSQL connection count and Swap without restarting either service.
- [x] Store only aggregate metrics in the validation logbook; do not store credentials, cookies, database URLs or user content.
- [x] Run `node --check scripts/measure-read-performance.mjs` and the read-only local fixture.
- [ ] Commit only the baseline tooling and documentation after confirming unrelated dirty files are unstaged.

### Task 2: 请求级性能观测与查询预算

**Files:**
- Create: `apps/api/src/request-performance-observability.ts`
- Create: `apps/api/src/request-performance-observability.test.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/admin-system-response-adapter.ts`
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/admin-readonly-panels.tsx`
- Modify: `scripts/verify-request-chain-observability.mjs`

**Interfaces:**

```ts
export interface RequestPerformanceSample {
  routeId: string;
  durationMs: number;
  dbDurationMs: number;
  dbQueryCount: number;
  responseBytes: number;
  cacheState: "none" | "hit" | "miss" | "revalidated";
  statusCode: number;
}
```

- [x] Write failing unit tests for timing closure, query counting, response byte counting and redaction.
- [x] Add low-cardinality route IDs; never use task IDs, user IDs or URLs as metric labels.
- [ ] Instrument database timing at repository boundaries and response serialization at `sendT8` without logging payload content.
- [x] Add event-loop delay, RSS, heap, FD and active handle summaries to `/api/admin/system`.
- [x] Expose current request values and bounded short-window trend, not an unbounded in-process history.
- [ ] Extend the existing observability contract to reject missing route IDs and high-cardinality labels.
- [ ] Verify instrumentation overhead is under 3% against the local baseline.
- [ ] Commit `feat: add bounded read-path performance observability`.

### Task 3: Admin 前端查询协调器与路由级加载

**Files:**
- Create: `apps/admin/src/admin-query-client.ts`
- Create: `apps/admin/src/admin-query-client.test.ts`
- Modify: `apps/admin/src/admin-data-loaders.ts`
- Modify: `apps/admin/src/admin-data-loaders.test.ts`
- Modify: `apps/admin/src/main.tsx`
- Modify: `apps/admin/src/admin-view-model.ts`

**Interfaces:**

```ts
export interface AdminQueryOptions {
  maxAgeMs: number;
  force?: boolean;
  signal?: AbortSignal;
}

export function readAdminQuery<T>(
  key: readonly unknown[],
  loader: (signal: AbortSignal) => Promise<T>,
  options: AdminQueryOptions,
): Promise<T>;

export function invalidateAdminQueries(prefix: readonly unknown[]): void;
```

- [ ] Write failing tests proving in-flight requests with the same key merge into one Promise.
- [ ] Write failing tests proving navigation aborts obsolete requests and stale responses cannot overwrite the active route.
- [ ] Replace workspace-level loading with active child-view loading; `/admin/organization/accounts` must not load sessions, and `/admin/analytics/costs` must not load audit rows.
- [ ] Keep shell bootstrap limited to authentication, summary and assistant display settings.
- [ ] Give Provider, model, user directory, RH and permission data revision-aware cache keys.
- [ ] Invalidate only affected keys after mutations instead of reloading the full workspace.
- [ ] Add loading, stale, empty and retry states per panel; one failed panel must not blank another workspace.
- [ ] Verify route transitions issue only the request set declared by `admin-view-model.ts`.
- [ ] Commit `refactor: load admin data by active route`.

### Task 4: Provider、平台与模型目录读取

**Files:**
- Modify: `apps/api/src/provider-repository.ts`
- Modify: `apps/api/src/provider-repository.test.ts`
- Modify: `apps/api/src/admin-provider-routes.ts`
- Create: `apps/api/src/admin-provider-routes.test.ts`
- Modify: `apps/admin/src/admin-api-client.ts`
- Modify: `apps/admin/src/admin-api-settings-panel.tsx`
- Modify: `apps/admin/src/admin-api-settings-panel.test.tsx`

**Interfaces:**
- Produces: lightweight Provider list without full model arrays, RH payloads or secret material.
- Produces: `GET /api/admin/models?providerId=&capability=&cursor=&limit=` with bounded projection.
- Produces: detail reads for Provider connection configuration and model advanced configuration.

- [ ] Add repository tests proving PostgreSQL Provider reads never call aggregate `readAdminDbPostgres()`.
- [ ] Split list and detail projections; API key previews and advanced config appear only where the active editor needs them.
- [ ] Add bounded model filtering by Provider and capability; preserve current display ordering.
- [ ] Make Provider and model list reads parallel only when the active view needs both.
- [ ] After create/update/reorder/delete, update the local snapshot or invalidate the exact list key.
- [ ] Preserve probe and fetch-model actions as explicit mutations with visible progress; they must not block unrelated list reads.
- [ ] Verify disabled Provider/model visibility, ordering, revision and administrator authorization remain unchanged.
- [ ] Commit `perf: target provider and model catalog reads`.

### Task 5: 账号、组织、会话与权限管理读取

**Files:**
- Create: `apps/api/src/admin-directory-read-repository.ts`
- Create: `apps/api/src/admin-directory-read-repository.test.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/admin-user-visibility.ts`
- Modify: `apps/api/src/admin-user-visibility.test.ts`
- Modify: `apps/admin/src/admin-data-loaders.ts`
- Modify: `apps/admin/src/admin-user-accounts-section.tsx`
- Modify: `apps/admin/src/admin-user-groups-section.tsx`
- Modify: `apps/admin/src/admin-user-sessions-section.tsx`
- Modify: `apps/admin/src/permission-platform/api.ts`

**Interfaces:**
- Produces: paged account summaries, independent group summaries and independent active-session summaries.
- Produces: permission subject snapshot with `revision` and `generatedAt`.

- [ ] Add failing tests proving the accounts route does not load sessions or full audit data.
- [ ] Query users, groups and sessions through separate targeted PostgreSQL reads.
- [ ] Keep root administrator invisibility in SQL/result projection and service policy; caching must be partitioned by administrator tier.
- [ ] Add server-side search, status/group filters and bounded page size for accounts and sessions.
- [ ] Cache permission subject snapshots by revision; user/group/provider/RH mutations mark the snapshot dirty.
- [ ] Replace GET-time full reconciliation with single-flight background reconciliation triggered at startup and after catalog mutations.
- [ ] Keep writes synchronous and revision protected; only the resulting snapshot rebuild is asynchronous.
- [ ] Verify revoked sessions disappear immediately and cannot be revived by a cached list.
- [ ] Commit `perf: isolate organization and permission reads`.

### Task 6: RunningHub 前后台目录与权限快照

**Files:**
- Modify: `apps/api/src/runninghub-catalog.ts`
- Modify: `apps/api/src/runninghub-catalog.test.ts`
- Modify: `apps/api/src/admin-runninghub-routes.ts`
- Modify: `apps/api/src/runninghub-permission-gate.ts`
- Modify: `apps/api/src/permissions/permission-reconciliation.ts`
- Modify: `apps/web/src/services/runninghubCatalog.ts`
- Create: `apps/web/src/stores/runninghubCatalog.ts`
- Create: `apps/web/src/stores/runninghubCatalog.test.ts`
- Modify: `apps/web/src/components/nodes/RunningHubNode.tsx`
- Modify: `apps/admin/src/admin-runninghub-workspace.tsx`

**Interfaces:**

```ts
export interface RunningHubCatalogSnapshot {
  revision: number;
  generatedAt: number;
  groups: RunningHubCatalogGroup[];
  items: RunningHubCatalogItem[];
}
```

- [ ] Write a frontend test mounting multiple RH nodes and assert one catalog request.
- [ ] Add a backend test proving catalog GET does not call reconciliation or aggregate admin DB reads.
- [ ] Build the catalog snapshot from targeted Provider/RH/group repositories.
- [ ] Use user/group permission revision as part of the public snapshot key; do not share restricted snapshots across users.
- [ ] Add ETag support and return `304` when revision is unchanged.
- [ ] Keep node selection, group folding, disabled-group hiding and runtime permission checks identical.
- [ ] Invalidate snapshots after RH item/group/key-pool/provider permission mutations.
- [ ] Verify an old canvas containing a newly denied RH item cannot execute it even when its local node still has cached metadata.
- [ ] Commit `perf: share revisioned runninghub catalog snapshots`.

### Task 7: 画布项目、模型目录与前台启动链路

**Files:**
- Create: `apps/api/src/canvas-list-repository.ts`
- Create: `apps/api/src/canvas-list-repository.test.ts`
- Modify: `apps/api/src/canvas-snapshot-recovery.ts`
- Modify: `apps/api/src/canvas-snapshot-recovery.test.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/web/src/stores/canvas.ts`
- Modify: `apps/web/src/stores/modelCatalog.ts`
- Modify: `apps/web/src/components/Sidebar.tsx`
- Modify: `apps/web/src/components/CanvasManager.tsx`
- Modify: `scripts/measure-canvas-performance.mjs`
- Modify: `scripts/verify-canvas-performance-budget.mjs`

**Interfaces:**
- Produces: metadata-only canvas list query.
- Produces: explicit startup/admin snapshot recovery command separate from list GET.
- Produces: shared in-flight Promise for canvas and model catalog stores.

- [ ] Write a failing API test proving canvas list GET performs zero snapshot file JSON parses when the migration marker is present.
- [ ] Move orphan snapshot discovery to startup recovery and explicit administrator recovery operations.
- [ ] During recovery, compare database IDs before reading snapshot bodies and skip known database-backed files.
- [ ] Add request merging, short freshness window and `force` refresh to the canvas store.
- [ ] Remove duplicate mount loads from Sidebar and CanvasManager; both subscribe to the same state.
- [ ] Apply the same in-flight/revision rule to the model catalog store.
- [ ] Verify create, rename, delete and active-canvas switching invalidate only the canvas list/detail involved.
- [ ] Run the existing canvas performance budget and add duplicate-request assertions.
- [ ] Commit `perf: separate canvas recovery from list loading`.

### Task 8: 资源库、生成库、公共资源与公告

**Files:**
- Modify: `apps/api/src/shared-resource-routes.ts`
- Modify: `apps/api/src/shared-resource-routes.test.ts`
- Modify: `apps/api/src/generation-artifact-routes.ts`
- Modify: `apps/api/src/generation-artifact-repository.ts`
- Modify: `apps/api/src/generation-artifact-lifecycle.test.ts`
- Modify: `apps/web/src/components/ResourceLibraryDrawer.tsx`
- Modify: `apps/web/src/components/GenerationLibraryDrawer.tsx`
- Modify: `apps/web/src/services/sharedResourceApi.ts`
- Modify: `apps/admin/src/admin-api-client.ts`
- Modify: `apps/admin/src/admin-public-resources-panel.tsx`
- Modify: `apps/admin/src/admin-announcement-panel.tsx`

**Interfaces:**
- Produces: paged metadata lists with category/count summaries.
- Produces: independent content/detail endpoints for preview and download.

- [ ] Add list projection tests proving file content and unrelated category bodies are not loaded.
- [ ] Add cursor/page limits for personal resources, shared resources and generation artifacts.
- [ ] Load category summaries and the active category page in parallel; avoid refetching all items when only selection changes.
- [ ] Coalesce drawer open/change events and replace global custom-event refetch storms with keyed invalidation.
- [ ] Keep promotion, owner isolation, revision conflict and physical-file deletion behavior unchanged.
- [ ] Add ETag/revision handling for shared categories and announcements.
- [ ] Verify deleted resources disappear immediately, shared binaries remain protected and generation retention status remains server authoritative.
- [ ] Commit `perf: paginate and cache material library reads`.

### Task 9: 后台任务列表、详情、日志与运行操作

**Files:**
- Modify: `apps/api/src/task-repository.ts`
- Modify: `apps/api/src/task-repository.test.ts`
- Modify: `apps/api/src/admin-task-list-routes.ts`
- Modify: `apps/api/src/admin-task-list-routes.test.ts`
- Modify: `apps/admin/src/admin-api-client.ts`
- Modify: `apps/admin/src/admin-task-panel.tsx`
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `scripts/verify-admin-task-pagination.mjs`

**Interfaces:**

```ts
export interface TaskListItem {
  id: string;
  title: string;
  status: TaskStatus;
  ownerSummary?: TaskOwnerSummary;
  executionSummary?: TaskExecutionSummary;
  logCount: number;
  latestLog?: string;
  createdAt: number;
  updatedAt: number;
}
```

- [ ] Write a failing repository test that rejects `select *` and rejects full `payload/result/logs` in the list CTE.
- [ ] Project only list columns, `jsonb_array_length(logs)` and the latest bounded log line.
- [ ] Add a dedicated task detail endpoint for full payload, result and paged logs.
- [ ] Replace deep offset paging with a stable cursor based on `updated_at`, `created_at` and `id`; keep temporary page compatibility for the current UI.
- [ ] Move task capability filtering to a generated/indexed expression only after query-plan evidence proves it is needed.
- [ ] Run read audit concurrently or through the bounded audit buffer; task reads must not wait for audit disk/database latency.
- [ ] Keep cancel, retry and recover-output actions synchronous, audited and idempotent.
- [ ] Verify 20-item list response stays under 200KB with a 20,000-task fixture containing large JSON bodies.
- [ ] Commit `perf: split task list summaries from task details`.

### Task 10: 审计、用量、费用与渠道健康分析

**Files:**
- Create: `apps/api/src/read-audit-buffer.ts`
- Create: `apps/api/src/read-audit-buffer.test.ts`
- Modify: `apps/api/src/admin-audit-routes.ts`
- Modify: `apps/api/src/admin-usage-summary-repository.ts`
- Modify: `apps/api/src/admin-usage-summary-repository.test.ts`
- Modify: `apps/api/src/admin-cost-analytics.ts`
- Modify: `apps/api/src/admin-cost-analytics.test.ts`
- Modify: `apps/api/src/channel-health-repository.ts`
- Modify: `apps/admin/src/admin-api-client.ts`
- Modify: `apps/admin/src/admin-readonly-panels.tsx`
- Modify: `apps/admin/src/admin-cost-dashboard.tsx`
- Modify: `apps/admin/src/admin-channel-health-dashboard.tsx`

**Interfaces:**
- Produces: bounded async audit queue with flush interval, max batch, max queue and failure counter.
- Produces: analytics endpoints that accept explicit range/filter and return aggregate rows only.

- [ ] Write queue tests for ordering, bounded memory, retry and shutdown flush.
- [ ] Keep mutation, permission and security audit synchronous; route ordinary read audit through the bounded buffer.
- [ ] Paginate audit rows and load account/group/provider filter options independently.
- [ ] Ensure usage summary reads successful task projections only and does not deserialize task result bodies.
- [ ] Verify cost analytics reads immutable cost items and channel health reads aggregate health records, not current full Provider objects.
- [ ] Add abort/debounce behavior for filter changes and prevent stale analytics responses from replacing newer filters.
- [ ] Add query-plan fixtures for 30-day range and representative filters.
- [ ] Verify audit loss counter remains zero during normal Gray soak; any nonzero value blocks release.
- [ ] Commit `perf: isolate analytics and buffer read audits`.

### Task 11: 系统健康、运行参数、环境同步与总览

**Files:**
- Modify: `apps/api/src/admin-system-routes.ts`
- Modify: `apps/api/src/admin-system-response-adapter.ts`
- Modify: `apps/api/src/admin-system-settings-routes.ts`
- Modify: `apps/api/src/admin-queue-settings-routes.ts`
- Modify: `apps/api/src/admin-repository.ts`
- Modify: `apps/api/src/admin-repository.test.ts`
- Modify: `apps/admin/src/use-admin-system-health.ts`
- Modify: `apps/admin/src/admin-readonly-panels.tsx`
- Modify: `apps/admin/src/admin-environment-sync-panel.tsx`
- Modify: `apps/admin/src/admin-overview-panel.tsx`

**Interfaces:**
- Produces: `/api/admin/system/health`, `/api/admin/system/runtime-settings` and existing compatibility projection.
- Produces: summary counts from SQL aggregates, not full arrays.

- [ ] Add tests proving Admin summary uses database counts and never loads all tasks, providers, models or audit rows.
- [ ] Split system health reads from runtime settings so opening settings does not collect expensive 30-day health series.
- [ ] Bound health history by requested range and downsample server-side.
- [ ] Keep queue settings and material lifecycle settings revision-protected and independently saveable.
- [ ] Make environment-sync preview an explicit action; do not fetch remote environment state on every system workspace mount.
- [ ] Preserve configured/effective value distinction and Worker readiness semantics.
- [ ] Verify manual refresh issues one request and auto-refresh never overlaps an in-flight request.
- [ ] Commit `perf: separate system health and settings reads`.

### Task 12: ComfyUI、智能体与自动化工作区读取

**Files:**
- Modify: `apps/admin/src/admin-comfyui-instances-panel.tsx`
- Modify: `apps/admin/src/admin-agent-governance-api.ts`
- Modify: `apps/admin/src/admin-agent-governance-workspace.tsx`
- Modify: `apps/admin/src/admin-assistant-governance-workspace.tsx`
- Modify: `apps/api/src/admin-agent-governance-routes.ts`
- Modify: `apps/api/src/agent-governance-repository.ts`
- Modify: `apps/api/src/agent-run-repository.ts`
- Modify: `apps/api/src/agent-approval-repository.ts`

**Interfaces:**
- Produces: list summaries for ComfyUI instances, Agent Runs and approvals; details load by selected ID.

- [ ] Load ComfyUI instance summaries first and fetch workflow drafts only after an instance is selected.
- [ ] Do not poll capabilities or connection tests unless the user explicitly starts the action.
- [ ] Split Agent runtime activity list from full run event/action payloads.
- [ ] Load assistants, supervision and activity as independent route queries.
- [ ] Preserve publication environment boundaries, approval reasons and Production confirmation rules.
- [ ] Verify a failed governance endpoint leaves a retryable error boundary and does not trigger fallback writes.
- [ ] Commit `perf: load governance details on demand`.

### Task 13: 聚合读取退场、内存与文件句柄治理

**Files:**
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/admin-repository.ts`
- Modify: `apps/api/src/provider-repository.ts`
- Modify: `apps/api/src/task-repository.ts`
- Modify: `apps/api/src/settings-repository.ts`
- Create: `scripts/verify-targeted-read-repositories.mjs`
- Create: `scripts/measure-api-memory-soak.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: contract that fails when PostgreSQL hot GET routes call `readAdminDbPostgres()`.
- Produces: soak report with RSS, heap used, external memory, FD, active handles, event-loop delay and endpoint latency.

- [ ] Inventory every `readAdminDb()` caller and classify it as file compatibility, export/migration, mutation transaction or hot GET.
- [ ] Migrate every PostgreSQL hot GET to targeted repositories; retain aggregate reads only for file mode, controlled export and migration.
- [ ] Add a static contract preventing new hot-route aggregate reads.
- [ ] Audit streams, keep-alive sockets, EventSource connections, file watchers, timers and archive handles for deterministic close behavior.
- [ ] Capture heap snapshots only in a controlled Gray diagnostic window and compare retained object classes after repeated RH/task/canvas loads.
- [ ] Add bounded cache sizes and eviction counters; no cache may retain full task payload/result/log arrays.
- [ ] Run 6-hour mixed-route soak with periodic task and catalog updates.
- [ ] Commit `perf: retire aggregate postgres reads from hot paths`.

### Task 14: ZIP 归档、Worker 与后台任务资源隔离

**Files:**
- Modify: `apps/api/src/output-archive-repository.ts`
- Modify: `apps/api/src/output-archive-repository.test.ts`
- Modify: `apps/worker/src/output-archive-worker.ts`
- Modify: `apps/worker/src/output-archive-worker.test.ts`
- Modify: `docs/systems/worker/output-archive.md`
- Modify: `docs/systems/worker/queue-and-concurrency.md`
- Create: `scripts/verify-output-archive-load-isolation.mjs`

**Interfaces:**
- Produces: archive queue concurrency `1` per host by default, bounded pending queue and explicit backpressure result.
- Produces: streaming archive creation without whole-file buffers in API memory.

- [ ] Verify archive creation runs in Worker or an isolated process, never synchronously in the API event loop.
- [ ] Stream file reads and archive writes; close every handle on success, failure and cancellation.
- [ ] Add per-job input bytes, file count, timeout and temporary-disk quotas.
- [ ] Add FIFO scheduling with owner fairness and prevent duplicate active jobs for the same task and owner.
- [ ] Keep archive status polling cheap and stop polling after terminal state.
- [ ] Load test one active archive plus the full read scenario; core endpoint P95 may degrade by at most 15%.
- [ ] Commit `perf: isolate output archive resource usage`.

### Task 15: PostgreSQL 查询、索引与数据冷热分层

**Files:**
- Create: `scripts/capture-read-query-plans.mjs`
- Create: `docs/logbooks/validations/read-query-plan-baseline.json`
- Modify: `apps/api/src/task-repository.ts`
- Modify: relevant SQL migration only when evidence requires a new index or generated column.
- Modify: `docs/systems/storage-and-data/postgres-and-redis-boundaries.md`

**Interfaces:**
- Produces: sanitized `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` reports with literals removed.

- [ ] Enable or verify `pg_stat_statements` in Gray through the authorized runbook; do not change Production first.
- [ ] Capture call count, mean, P95-equivalent observations and total time for the targeted GET queries.
- [ ] Add indexes only for demonstrated sequential scans, repeated sort spill or high-cost filter expressions.
- [ ] Avoid global `work_mem` changes; use query redesign or transaction-local settings only with evidence.
- [ ] Evaluate moving historical task payload/result/logs to a cold table or object store while keeping immutable task metadata hot.
- [ ] Keep audit retention and task metadata retention separate from material retention.
- [ ] Run `VACUUM (ANALYZE)` only through the approved maintenance procedure and record before/after plans.
- [ ] Commit schema changes separately from application query changes.

### Task 16: 自动化正确性与端到端回归

**Files:**
- Create: `scripts/verify-read-path-no-side-effects.mjs`
- Create: `scripts/verify-admin-route-request-matrix.mjs`
- Create: `scripts/verify-read-cache-authorization.mjs`
- Modify: `package.json`
- Modify: `docs/systems/harness/README.md`

**Interfaces:**
- Produces: route/request matrix with allowed endpoints per UI route.
- Produces: before/after database/file checks proving GET side-effect freedom.

- [ ] Verify GET canvas list does not create, restore, delete or rewrite snapshots.
- [ ] Verify GET RH catalog does not mutate permission subjects.
- [ ] Verify cached data never crosses owner, user group, administrator tier or environment boundaries.
- [ ] Verify mutation invalidation is immediate for user disable, session revoke, Provider disable, model disable, RH deny and resource delete.
- [ ] Verify auth expiry cancels cached reads and returns to login without exposing prior administrator data.
- [ ] Verify browser back/forward navigation restores route state without refetch storms.
- [ ] Verify all existing focused security, revision, owner isolation and lifecycle tests remain green.
- [ ] Add the new contracts to project/workspace/release Harness maps.
- [ ] Commit `test: enforce read-path performance and isolation contracts`.

### Task 17: Gray 压力、6 小时 Soak 与人工验收

**Files:**
- Create: `docs/logbooks/validations/2026-08-05-read-performance-gray.md`
- Modify: `ops/current/release-state.json` only during an authorized deployment.
- Modify: matching Gray projection and release logbook only during an authorized deployment.

- [ ] 为阶段 A、B、C、D、E、F 分别生成独立 Gray release ID、release logbook 和 validation logbook；每个阶段只包含已经完成的任务。
- [ ] 每个阶段先完成本地 focused tests、type-check 和 Harness，再构建唯一加密 Gray artifact。
- [ ] 每个阶段只部署旧服务器 Gray；新服务器、两台 Production 和迁移计划保持不变。
- [ ] 阶段 A 只验证观测、请求计数、无副作用和原有响应等价性。
- [ ] 阶段 B 验证 Admin 壳层、Provider、模型、账号、用户组、会话和权限边界。
- [ ] 阶段 C 验证 RH、画布、资源库、生成库、公共资源、权限失效和删除保护。
- [ ] 阶段 D 验证任务、详情、日志、审计、用量、费用、可靠性和系统健康。
- [ ] 阶段 E 注入 ZIP 任务并运行内存、FD、数据库和 Worker 隔离测试。
- [ ] 阶段 F 加载不低于当前 Production 规模的脱敏数据：至少 20,000 tasks、100 canvases 及代表性 RH/resource/user 记录。
- [ ] 每个阶段都运行 cold、warm、10-user 和 30-user 场景；阶段 E/F 额外运行 6 小时 soak。
- [ ] 每个阶段都记录 RSS、heap、FD、event-loop delay、DB connections、请求数、响应体和 per-route P95。
- [ ] 每个阶段都在 `1920x1080` 人工检查 loading、stale、retry、分页、筛选、切页和内容不跳动。
- [ ] 每个阶段都用 root、secondary administrator 和 member 会话验证数据隔离。
- [ ] 阶段失败时只回退当前阶段到上一阶段 Gray release，修正后重新执行该阶段，不允许带病进入下一阶段。
- [ ] 任一阶段出现预算不达标、审计丢失、权限泄露、旧响应被覆盖、请求风暴或持续内存增长，均阻止阶段晋级。

### Task 17A: 阶段 Gray 晋级门

**Files:**
- Create: `scripts/verify-gray-stage-gate.mjs`
- Create: `docs/logbooks/validations/2026-08-05-gray-stage-gate-template.md`
- Modify: `package.json`

- [x] 接受 `--stage=A|B|C|D|E|F`、`--release=<release-id>` 和 `--base-url=$env:XINGHUAN_OLD_GRAY_BASE_URL`。
- [x] 校验当前 Gray release 与期望阶段 artifact 完全一致，并拒绝 Production URL。
- [ ] 聚合本阶段必测 endpoint、浏览器场景、权限场景和运行态预算。
- [x] 输出 `PASS`、`HOLD` 或 `ROLLBACK_REQUIRED`，不自动修改服务器状态。
- [ ] 只有人工确认 `PASS` 后才允许执行下一阶段部署。
- [ ] 为每个阶段保留调优记录：现象、证据、修改、重新验证结果和是否改变预算。
- [ ] Commit `test: add per-stage gray performance gate`.

### Task 18: Production 晋级、迁移再评估与回滚

**Files:**
- Modify: release/validation/current-state documentation only after explicit authorization.
- Do not modify migration state until user explicitly re-enables it.

- [ ] Present the Gray report and unresolved risks to the user before any Production action.
- [ ] Reuse the exact Gray-verified encrypted artifact for Production; do not rebuild.
- [ ] Promote one server at a time and observe at least 30 minutes before the next target.
- [ ] Keep the previous release ID as rollback target and verify rollback readiness before switching.
- [ ] Repeat the critical read matrix and 60-minute runtime observation after Production promotion.
- [ ] Reassess old-to-new data migration only after both code performance and real-data scale tests pass.
- [ ] Require a new explicit user instruction before reactivating or recreating the migration automation.
- [ ] Push GitHub only after local/Gray/Production records are consistent and the user authorizes release completion.

## Acceptance Matrix

| Domain | Functional acceptance | Performance acceptance | Isolation acceptance |
| --- | --- | --- | --- |
| Admin shell | Summary and assistant settings correct | Within shell budget | No business-domain preload |
| Accounts | Search/filter/paging and mutations correct | Account page budget | Root invisibility preserved |
| Groups | Membership and policy counts correct | Group page budget | Revision conflicts preserved |
| Sessions | Revoke and current-session display correct | Session page budget | Revoked session never cached back |
| Providers | Order, enable state and probe correct | Provider budget | Secrets absent from list/cache |
| Models | Capability/order/test correct | Model budget | Provider boundary preserved |
| RH | Groups, folding, keys and catalog correct | RH budget, one request | Deny enforced on list and run |
| Canvas | List/create/rename/delete correct | Canvas budget, one request | No GET recovery side effect |
| Resources | Categories/items/delete correct | Resource budget | Owner/shared-file protection |
| Generation library | Visibility/promotion/delete correct | Generation budget | Expiry remains server-authoritative |
| Tasks | Filters/actions/details/logs correct | Task list budget | Full bodies detail-only |
| Audit | Records complete and ordered | Audit budget | Zero buffered audit loss |
| Usage/cost | Aggregates match source records | Analytics budget | No raw task body exposure |
| Reliability | Filters/trends correct | Analytics budget | No Provider secret/config exposure |
| System | Health/settings effective values correct | System budget | No overlapping refresh |
| ComfyUI/Agent | Lists and selected details correct | On-demand detail budget | Environment/publication boundaries |
| ZIP archive | FIFO, cancel, download correct | Read P95 degradation <= 15% | Owner isolation and quotas |

## Mandatory Verification Commands

```text
npm run type-check
npm test
npm run measure:read-performance -- --base-url=$env:XINGHUAN_GRAY_BASE_URL --scenario=all
npm run verify:request-chain-observability
npm run verify:system-observability
npm run verify:admin-task-pagination
npm run verify:canvas-performance-budget
npm run verify:phase-a-hardening-contract
npm run verify:multi-user-isolation
npm run verify:member-admin-boundary
npm run verify:admin-session-governance
npm run verify:resource-revision-conflict
npm run verify:canvas-revision-conflict
npm run verify:read-path-no-side-effects
npm run verify:admin-route-request-matrix
npm run verify:read-cache-authorization
npm run harness:verify:project
npm run harness:verify:workspace
npm run harness:verify:release
```

## Stop Conditions

- 任何缓存造成跨用户、跨管理员等级、跨环境或跨权限 revision 的数据泄露。
- 任一 GET 仍执行文件恢复、权限全量写回、迁移、清理或同步审计阻塞。
- Gray API RSS 连续增长且 6 小时内没有进入稳定区间。
- 任务列表仍携带完整 payload/result/logs，或 20 条响应超过 200KB。
- ZIP 归档使核心读取 P95 增长超过 15%。
- canonical state、运行服务器版本或数据库目标与文档不一致。
- 当前未提交素材生命周期改动与性能改动发生无法安全拆分的同文件冲突。
- 用户尚未重新授权服务器部署、Production 晋级、GitHub 推送或数据迁移。

## Self-Review Result

- 覆盖范围：画布、RH、Provider/平台、模型、账号、用户组、会话、权限、任务、审计、用量、费用、可靠性、系统健康、运行参数、环境同步、资源库、生成库、公告、ComfyUI、Agent/自动化、ZIP、数据库、内存与 FD。
- 每个业务域均包含 targeted read、前端请求治理、正确性验收、性能预算和隔离验收。
- 数据迁移、服务器改动、部署和 GitHub 推送均设置为显式用户授权门。
- 未把加密封装作为主要性能根因；运行时验证仍包含制品一致性检查。
