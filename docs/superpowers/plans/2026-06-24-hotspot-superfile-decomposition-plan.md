# Hotspot Superfile Decomposition Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不打断当前业务链路和 gray / production 发布能力的前提下，持续拆薄当前四个热点超级文件，避免后续功能继续把 `server.ts`、`worker.ts`、`RunningHubNode.tsx` 和后台 RH 工作台重新堆成不可维护的大入口。

**Architecture:** 以“主入口薄壳化 + 子模块承载职责 + 合同脚本保边界”的方式推进，而不是整文件重写。每个热点文件都先定义明确的可下沉模块，再用小批次切割；每次切割都要求同时补 contract、系统文档和日志记录，确保拆分不是一次性动作，而是纳入常规工程节奏。

**Tech Stack:** TypeScript, React, Node.js, worker runtime, RunningHub protocol chain, CodeGraph, RTK, repository governance docs

---

### Task 1: 为四个热点文件建立固定拆分台账

**Files:**
- Modify: `docs/governance/engineering-guardrails.md`
- Modify: `docs/records/README.md`
- Create: `docs/records/architecture/2026-06-24-hotspot-superfile-decomposition-ledger.md`
- Test: `rtk read docs/records/architecture/2026-06-24-hotspot-superfile-decomposition-ledger.md --max-lines 220`

- [ ] **Step 1: 新建热点拆分台账**

台账至少覆盖：
- `apps/api/src/server.ts`
- `apps/worker/src/worker.ts`
- `apps/web/src/components/nodes/RunningHubNode.tsx`
- `apps/admin/src/admin-runninghub-workspace.tsx`

每个热点文件记录：
- 当前主要职责
- 已拆出的子模块
- 下一批应该拆出的职责
- 当前 contract / verify 脚本
- 当前风险

- [ ] **Step 2: 把台账入口写回 records 总索引**

让后续协作者能从 `docs/records/README.md` 直接找到这份拆分台账，而不是继续凭记忆乱找。

- [ ] **Step 3: 在工程护栏里声明“预算 + 台账”双要求**

要求：
- 热点文件不仅要有预算，还要有拆分台账入口
- 后续调整预算时必须同步更新台账

- [ ] **Step 4: Commit**

```bash
git add docs/governance/engineering-guardrails.md docs/records/README.md docs/records/architecture/2026-06-24-hotspot-superfile-decomposition-ledger.md
git commit -m "docs: add hotspot decomposition ledger"
```

### Task 2: 拆 API 与 Worker 主入口的第二批边界

**Files:**
- Modify: `apps/api/src/server.ts`
- Modify: `apps/worker/src/worker.ts`
- Create or Modify: 对应 `handler` / `client` / `dispatch` / `diagnostics` 子模块
- Test:
  - `npm run type-check -w @xinghuan/api`
  - `npm run type-check -w @xinghuan/worker`
  - `node scripts/verify-file-hotspot-budgets.mjs`

- [ ] **Step 1: 先用 CodeGraph 列出 `server.ts` 和 `worker.ts` 当前仍混杂的职责块**

至少标出：
- `server.ts` 中仍未拆出的 RunningHub / task / system handlers
- `worker.ts` 中仍未拆出的 dispatch / cancel-sync / unified diagnostics

- [ ] **Step 2: 每次只下沉一个职责块到单独模块**

原则：
- `server.ts` 保持路由装配与请求编排
- `worker.ts` 保持任务编排 glue
- 不做大面积重写

- [ ] **Step 3: 每切一批都补 contract 或更新现有脚本**

目的：
- 防止拆分以后又悄悄把逻辑堆回主入口

- [ ] **Step 4: 运行验证**

Run:
- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/worker`
- `node scripts/verify-file-hotspot-budgets.mjs`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src apps/worker/src scripts
git commit -m "refactor: continue splitting api and worker hotspots"
```

### Task 3: 拆 RunningHubNode 与后台 RH 工作台

**Files:**
- Modify: `apps/web/src/components/nodes/RunningHubNode.tsx`
- Modify: `apps/admin/src/admin-runninghub-workspace.tsx`
- Create or Modify:
  - `apps/web/src/components/nodes/runninghub/*`
  - `apps/admin/src/runninghub-workspace/*`
- Test:
  - `npm run build -w @xinghuan/web`
  - `npm run build -w @xinghuan/admin`
  - `node scripts/verify-file-hotspot-budgets.mjs`

- [ ] **Step 1: 将 UI 壳、请求逻辑、运行态显示、表单区块拆成独立 section / hook / helper**

原则：
- 节点组件保留组合层
- 工作台页面保留布局与组装层

- [ ] **Step 2: 为关键结构补静态 contract**

至少保护：
- RH 节点进度条 / 参数区 / 输出区结构
- RH 工作台的 key 管理区 / 协议编辑区 / 分析区边界

- [ ] **Step 3: 跑构建与热点预算**

Run:
- `npm run build -w @xinghuan/web`
- `npm run build -w @xinghuan/admin`
- `node scripts/verify-file-hotspot-budgets.mjs`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src apps/admin/src scripts
git commit -m "refactor: continue splitting runninghub web and admin hotspots"
```

### Task 4: 把拆分节奏纳入发布与治理闭环

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/governance/documentation-governance-standard.md`
- Modify: `docs/logbooks/daily/<current-date>.md`
- Test: `node scripts/verify-engineering-governance-contract.mjs`

- [ ] **Step 1: 明确“预算只是止血线，不是完成线”**

- [ ] **Step 2: 每轮拆分完成后写入 daily / release 记录**

至少写：
- 拆了哪个热点
- 下沉到了哪些文件
- 哪些 contract 保护住了新边界

- [ ] **Step 3: 跑治理 contract**

Run: `node scripts/verify-engineering-governance-contract.mjs`

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md docs/governance/documentation-governance-standard.md docs/logbooks/daily
git commit -m "docs: close hotspot decomposition governance loop"
```
