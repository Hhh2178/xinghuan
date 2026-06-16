# Phase D Task Lifecycle And Admin Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Phase D 的任务状态机、取消链路、悬挂任务补偿和后台任务分页完整收口，并形成可复用的验收与运维结论。

**Architecture:** 以现有 `xh_tasks + Redis + Worker + ProviderGenerationTaskService` 为底座，补一层统一的任务取消服务和一层 worker 运行期 heartbeat/reaper 机制，让“本地取消”和“上游确认取消”被明确区分；同时把后台任务列表从全量读取改成分页查询和结构化过滤。

**Tech Stack:** TypeScript, React, Vite, Node.js, PostgreSQL, Redis, existing `apps/api`, `apps/worker`, `apps/admin`, `apps/web`, `packages/shared`.

---

## File Structure Map

- Modify: `apps/api/src/server.ts`
  - 接入任务分页接口、统一取消服务、任务查询参数解析。
- Create: `apps/api/src/task-cancellation-service.ts`
  - 统一处理本地取消、上游取消、取消结果元数据。
- Modify: `apps/api/src/provider-generation-task-service.ts`
  - 统一任务状态返回结构，补充取消/运行期元数据透传。
- Modify: `apps/worker/src/worker.ts`
  - 增加 heartbeat、运行中任务 stale reaper、状态补偿日志。
- Modify: `apps/admin/src/admin-types.ts`
  - 新增任务分页结构与取消元数据类型。
- Modify: `apps/admin/src/main.tsx`
  - 改为按页加载任务并支持过滤/翻页。
- Modify: `apps/admin/src/admin-task-panel.tsx`
  - 增加分页、过滤、取消结果语义显示。
- Modify: `apps/web/src/services/generation.ts`
  - 取消接口结果结构升级，前端能分辨 `local_only` 与 `upstream_confirmed`。
- Create: `apps/api/db/014_task_runtime_phase_d.sql`
  - 补 `xh_tasks` 的分页/运行态相关索引。
- Create: `scripts/verify-task-cancellation-phase-d.mjs`
  - 验证任务取消结果语义。
- Create: `scripts/verify-admin-task-pagination.mjs`
  - 验证后台任务分页与过滤。
- Modify: `package.json`
  - 注册新的 verify 命令。
- Modify: `DEVLOG.md`
- Modify: `MEMORY.md`
- Modify: `docs/production-multi-user-hardening-plan-2026-06-13.md`
- Modify: `ops/README.md`

## Task 1: 补 Phase D 数据与契约

**Files:**
- Create: `apps/api/db/014_task_runtime_phase_d.sql`
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/web/src/services/generation.ts`

- [ ] 定义任务分页返回结构：
  - `TaskListPage { items, total, page, pageSize, hasMore }`
- [ ] 定义取消结果结构：
  - `cancelScope: "local_only" | "upstream_confirmed" | "upstream_attempt_failed"`
  - `upstreamSupported`
  - `upstreamAttempted`
  - `message`
- [ ] 新增任务查询索引：
  - `xh_tasks(status, updated_at desc)`
  - `xh_tasks(created_at desc)`
  - `xh_tasks(provider_id, created_at desc)`

## Task 2: 统一 API 任务取消服务

**Files:**
- Create: `apps/api/src/task-cancellation-service.ts`
- Modify: `apps/api/src/server.ts`

- [ ] 抽出统一取消服务，依赖：
  - `readTaskRecord`
  - `writeTaskRecord`
  - `appendTaskLog`
  - `readAdminDb`
  - `providerPlainApiKey`
  - `normalizeProviderProtocol`
- [ ] 统一支持两类取消：
  - 本地取消：更新 `xh_tasks.status = cancelled`
  - 上游取消：当模型高级配置存在 `cancelPathTemplate` / `cancelMethod` 时尝试请求上游
- [ ] 标准化取消结果：
  - 无上游取消能力 => `cancelScope = local_only`
  - 上游取消成功 => `cancelScope = upstream_confirmed`
  - 上游取消尝试失败 => `cancelScope = upstream_attempt_failed`
- [ ] `/api/proxy/generation/cancel` 改为真实读取任务并调用统一取消服务，不再写死 `upstream:false`
- [ ] `/api/admin/tasks/:id` 的 `action=cancel` 改为复用同一条取消服务

## Task 3: 统一任务状态返回与失败原因

**Files:**
- Modify: `apps/api/src/provider-generation-task-service.ts`

- [ ] 对 `readProviderGenerationTaskStatus(...)` 增加结构化字段：
  - `cancelScope`
  - `upstreamSupported`
  - `upstreamAttempted`
  - `upstreamCancelledAt`
  - `heartbeatAt`
  - `failureReason`
- [ ] 失败时优先返回：
  - `result.failureReason`
  - `result.error`
  - `最后一条失败日志`
- [ ] 取消时返回真实取消说明，不再默认显示成“上游已终止”

## Task 4: Worker Heartbeat 与 Reaper

**Files:**
- Modify: `apps/worker/src/worker.ts`

- [ ] 增加运行期 heartbeat 更新函数：
  - 仅更新 `result.heartbeatAt`
  - 可选更新 `result.upstreamTaskId`
  - 可选更新 `result.upstreamStatus`
  - 刷新 `updated_at`
- [ ] 在长轮询路径补 heartbeat：
  - `GRSAI`
  - `APIMart image`
  - `APIMart video`
  - `ModelScope image`
- [ ] 增加 stale running task reaper：
  - 周期扫描 `status = running`
  - 若 `updated_at` 超过阈值仍无 heartbeat，则标记为 `failed`
  - `failureReason = worker_stalled_or_upstream_timeout`
  - 日志写清 worker、阈值与时间戳

## Task 5: 后台任务分页与过滤

**Files:**
- Modify: `apps/api/src/server.ts`
- Modify: `apps/admin/src/main.tsx`
- Modify: `apps/admin/src/admin-task-panel.tsx`

- [ ] `/api/admin/tasks` GET 支持：
  - `page`
  - `pageSize`
  - `status`
  - `providerId`
  - `capability`
- [ ] PostgreSQL 走 SQL 分页，file-mode 走内存切片分页
- [ ] 后台任务页增加：
  - 页码切换
  - 页大小切换
  - 当前筛选条件保留
  - 明确的取消状态说明

## Task 6: 验收脚本

**Files:**
- Create: `scripts/verify-task-cancellation-phase-d.mjs`
- Create: `scripts/verify-admin-task-pagination.mjs`
- Modify: `package.json`

- [ ] 取消语义脚本验证：
  - 创建任务
  - 执行取消
  - 断言 `cancelScope` / `upstreamSupported` / `message`
- [ ] 分页脚本验证：
  - 批量创建任务
  - 请求 `page=1&pageSize=5`
  - 请求 `page=2&pageSize=5`
  - 断言 `items.length <= pageSize`
  - 断言 `total`、`hasMore`、过滤生效

## Task 7: 文档与发布

**Files:**
- Modify: `DEVLOG.md`
- Modify: `MEMORY.md`
- Modify: `docs/production-multi-user-hardening-plan-2026-06-13.md`
- Modify: `ops/README.md`

- [ ] 记录本地验收
- [ ] 记录灰度发布与回滚点
- [ ] 记录生产发布与最终结论

## 实施边界

- 本轮不新增新的任务状态枚举，仍使用：
  - `queued`
  - `running`
  - `succeeded`
  - `failed`
  - `cancelled`
- 本轮不承诺所有第三方都具备上游真实取消能力。
- 当第三方不支持取消时，系统必须明确标记为 `local_only`，而不是伪装成上游取消成功。

## 验收命令

- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/admin`
- `npm run type-check -w @xinghuan/web`
- `npm run type-check -w @xinghuan/worker`
- `npm run build:single-port`
- `node scripts/verify-task-cancellation-phase-d.mjs`
- `node scripts/verify-admin-task-pagination.mjs`
- `node scripts/verify-task-lifecycle.mjs`

## 预期交付结果

- 任务取消不再只有“本地假取消”一种语义。
- 长轮询任务具备 heartbeat，悬挂运行任务会被补偿回收。
- 后台任务页支持分页与筛选，不再一次性全量拉取全部任务。
- Phase D 完成后，可进入新的整体检测报告与 Phase E 规划。
