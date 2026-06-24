# Top Three Hotspot Refactor Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 先收掉当前最要紧的三个热点入口：`worker.ts`、`server.ts`、`Canvas.tsx`，在时间有限的前提下优先降低运行态风险、入口复杂度和前端交互主瓶颈，而不是继续平均分散精力到所有大文件。

**Architecture:** 本计划遵循“先关键运行态入口，后交互画布核心”的顺序。`worker.ts` 和 `server.ts` 按后端编排入口型治理，优先继续把运行态 glue 与 handler 边界下沉；`Canvas.tsx` 按交互画布型治理，优先切 `runtime hooks / interaction sections / overlay panels`，缩小重渲染和主文件职责面。

**Tech Stack:** TypeScript, Node.js worker runtime, Express-style API server, React canvas UI, CodeGraph, repository governance docs, contract scripts

---

### Task 1: 继续拆 `apps/worker/src/worker.ts`

**Files:**
- Modify: `apps/worker/src/worker.ts`
- Create or Modify: `apps/worker/src/worker-cancel-sync.ts`
- Create or Modify: `apps/worker/src/worker-failure-glue.ts`
- Modify: `apps/worker/src/worker-runtime-diagnostics.ts`
- Create or Modify: `scripts/verify-worker-cancel-sync-split-contract.mjs`
- Create or Modify: `scripts/verify-worker-failure-glue-split-contract.mjs`
- Test:
  - `npm run type-check -w @xinghuan/worker`
  - `npm run build -w @xinghuan/worker`
  - `node scripts/verify-file-hotspot-budgets.mjs`

- [ ] **Step 1: 用 CodeGraph / 现有日志确认 `worker.ts` 里仍留在主文件的 cancel 和 failure glue 边界**

本轮只继续收：
- 取消同步相关逻辑
- 统一失败口径拼接逻辑

不重写：
- provider 执行链
- queue controller
- 已下沉的 `task-store` / `dispatch` / `client`

- [ ] **Step 2: 抽出 `cancel-sync` helper**

目标：
- 让主文件不再直接承载“取消状态检查 + 状态回写保护 + 取消后丢弃结果/错误”的 glue

- [ ] **Step 3: 抽出 `failure glue` helper**

目标：
- 让主文件不再直接承载重复的 `failureCategory / providerDiagnostic / upstreamHttpStatus / upstreamResponseSnippet` 拼装与回写

- [ ] **Step 4: 为新边界补 contract**

至少保护：
- `worker.ts` 已改为接线层
- `cancel-sync` 逻辑不再回流主文件
- `failure glue` 不再回流主文件

- [ ] **Step 5: 运行验证**

Run:
- `npm run type-check -w @xinghuan/worker`
- `npm run build -w @xinghuan/worker`
- `node scripts/verify-file-hotspot-budgets.mjs`

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src scripts docs/logbooks/daily docs/records/architecture docs/systems/worker
git commit -m "refactor: split worker cancel sync and failure glue"
```

### Task 2: 继续拆 `apps/api/src/server.ts`

**Files:**
- Modify: `apps/api/src/server.ts`
- Create or Modify: `apps/api/src/admin-system-settings-routes.ts`
- Create or Modify: `apps/api/src/admin-queue-settings-routes.ts`
- Create or Modify: `apps/api/src/api-response-adapters.ts`
- Create or Modify: `scripts/verify-api-system-settings-route-split-contract.mjs`
- Create or Modify: `scripts/verify-api-queue-settings-route-split-contract.mjs`
- Test:
  - `npm run type-check -w @xinghuan/api`
  - `node scripts/verify-file-hotspot-budgets.mjs`

- [ ] **Step 1: 用 CodeGraph 标出 `server.ts` 中 system settings / queue settings 的 handler 块**

本轮只收：
- system settings 相关 handler
- queue settings 相关 handler
- 必要的 response adapter

不主动碰：
- 大块任务主链
- 与当前批次无关的 provider 路由

- [ ] **Step 2: 先抽 `system settings` 路由分发层**

目标：
- `server.ts` 继续向入口装配层收口

- [ ] **Step 3: 再抽 `queue settings` 路由分发层**

目标：
- 把配置和状态类 handler 继续从主入口里拉出去

- [ ] **Step 4: 如有重复响应拼接，再补 `request-response adapter`**

原则：
- 只抽重复且稳定的适配层
- 不做无关大重构

- [ ] **Step 5: 为新边界补 contract**

至少保护：
- `server.ts` 保留入口装配
- `system settings / queue settings` 不再直接堆在主文件里

- [ ] **Step 6: 运行验证**

Run:
- `npm run type-check -w @xinghuan/api`
- `node scripts/verify-file-hotspot-budgets.mjs`

- [ ] **Step 7: Commit**

```bash
git add apps/api/src scripts docs/logbooks/daily docs/records/architecture docs/systems/api
git commit -m "refactor: split api system and queue settings routes"
```

### Task 3: 启动 `apps/web/src/components/Canvas.tsx` 第一批拆分

**Files:**
- Modify: `apps/web/src/components/Canvas.tsx`
- Create or Modify: `apps/web/src/components/canvas/useCanvasRuntime.ts`
- Create or Modify: `apps/web/src/components/canvas/useCanvasViewportHotkeys.ts`
- Create or Modify: `apps/web/src/components/canvas/CanvasOverlayLayer.tsx`
- Create or Modify: `scripts/verify-canvas-runtime-split-contract.mjs`
- Create or Modify: `scripts/verify-canvas-overlay-split-contract.mjs`
- Test:
  - `npm run type-check -w @xinghuan/web`
  - `npm run build -w @xinghuan/web`
  - `node scripts/verify-hotspot-watchlist-contract.mjs`

- [ ] **Step 1: 先标定 `Canvas.tsx` 的第一批只拆哪三层**

本轮只优先做：
- `runtime hook`
- `viewport / keyboard interaction hook`
- `overlay layer`

不试图一轮收完整个 `Canvas.tsx`

- [ ] **Step 2: 抽 `runtime hook`**

目标：
- 收掉项目读写、持久化或运行态订阅里最稳定的一层 glue
- 缩小主组件状态与副作用面

- [ ] **Step 3: 抽 `viewport / keyboard interaction hook`**

目标：
- 把视口移动、键盘交互、选择相关的一部分行为从主文件拿走

- [ ] **Step 4: 抽 `overlay layer`**

目标：
- 把 cut mode / 临时 SVG overlay / 编辑 overlay 这类视觉层从主文件分离

- [ ] **Step 5: 为 `Canvas` 新边界补 contract**

至少保护：
- runtime hook 已独立
- overlay layer 已独立
- 主文件仍保留高层组装和主画布壳

- [ ] **Step 6: 运行验证**

Run:
- `npm run type-check -w @xinghuan/web`
- `npm run build -w @xinghuan/web`
- `node scripts/verify-hotspot-watchlist-contract.mjs`

- [ ] **Step 7: Commit**

```bash
git add apps/web/src scripts docs/logbooks/daily docs/records/architecture docs/systems/canvas
git commit -m "refactor: split canvas runtime and overlay seams"
```

### Task 4: 将其他热点固化为后续 backlog

**Files:**
- Modify: `docs/records/architecture/2026-06-24-hotspot-superfile-decomposition-ledger.md`
- Modify: `docs/logbooks/daily/2026/2026-06/2026-06-24.md`
- Test: `node scripts/verify-hotspot-watchlist-contract.mjs`

- [ ] **Step 1: 只登记，不展开实现**

后续 backlog 保持为：
- `PoseMasterNode.tsx`
- `ToolboxParamNode.tsx`
- `ImageEditModal.tsx`
- `DrawingBoardNode.tsx`
- `ImageNode.tsx`
- `PortraitMasterNode.tsx`
- `VideoNode.tsx`
- `LLMNode.tsx`
- `OutputNode.tsx`
- `portraitMasterOptions.ts`

- [ ] **Step 2: 为每个 backlog 只写下一步最小拆分边界**

不写大而空的“后续优化”，至少写：
- 下一层拆什么
- 落到 `section / hook / helper / service / registry` 的哪一种

- [ ] **Step 3: Run verification**

Run: `node scripts/verify-hotspot-watchlist-contract.mjs`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/records/architecture/2026-06-24-hotspot-superfile-decomposition-ledger.md docs/logbooks/daily/2026/2026-06/2026-06-24.md
git commit -m "docs: register deferred hotspot backlog"
```
