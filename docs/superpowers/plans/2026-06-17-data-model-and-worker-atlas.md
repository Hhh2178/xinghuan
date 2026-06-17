# Data Model And Worker Atlas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为当前项目补齐后台数据模型导航页和 Worker 执行链导航页，让 AI 与维护者能快速定位表结构、迁移批次、任务状态流和排障入口。

**Architecture:** 在 `docs/project-atlas/` 下新增两份文档：`data-model-navigation.md` 和 `worker-execution-chain.md`。前者按数据域汇总主要表和迁移来源，后者按任务生命周期解释 API -> Redis -> Worker -> 输出落库的执行链。

**Tech Stack:** Markdown、`apps/api/db/*.sql`、`apps/api/src/server.ts`、`apps/worker/src/worker.ts`。

---

### Task 1: 落数据模型导航

**Files:**
- Create: `docs/project-atlas/data-model-navigation.md`

- [ ] **Step 1: 迁移批次分组**

按现有迁移文件整理：
- admin / provider / model
- canvas / resource
- assistant / queue settings
- revision / session / login attempts
- task runtime

- [ ] **Step 2: 表结构按数据域汇总**

至少覆盖：
- 用户 / 会话 / 登录限流
- Provider / 模型 / 后台设置
- 画布 / 资源 / 生成库
- 任务 / 审计 / 观测

### Task 2: 落 Worker 执行链导航

**Files:**
- Create: `docs/project-atlas/worker-execution-chain.md`

- [ ] **Step 1: 解释 Worker 启动与队列初始化**

说明：
- 环境变量
- Redis / Postgres 校验
- 任务队列设置读取
- capability 队列拆分

- [ ] **Step 2: 解释单任务执行链**

说明：
- 接收任务
- 读取任务和 Provider / Model
- 状态推进
- 上游调用
- 输出素材落库
- 失败 / 取消 / stale task 回收

### Task 3: 接总纲与日志

**Files:**
- Modify: `docs/project-atlas/README.md`
- Modify: `docs/documentation-governance.md`
- Modify: `DEVLOG.md`

- [ ] **Step 1: project-atlas 索引接入**

把两份新文档加到总纲入口。

- [ ] **Step 2: 文档治理接入**

把两份新文档加到项目总纲层。

- [ ] **Step 3: DEVLOG 记录**

记录本轮为什么补这两份导航，以及后续何时需要同步更新。

### Task 4: 验证并提交

**Files:**
- Modify: `docs/project-atlas/data-model-navigation.md`
- Modify: `docs/project-atlas/worker-execution-chain.md`

- [ ] **Step 1: 路由检查**

Run: `rg -n "data-model-navigation|worker-execution-chain" docs/project-atlas/README.md docs/documentation-governance.md DEVLOG.md`
Expected: 三处都可找到

- [ ] **Step 2: 文档契约检查**

Run: `npm run verify:release-gate-docs-contract`
Expected: `ok = true`

- [ ] **Step 3: 提交**

Run: `git add docs/project-atlas/data-model-navigation.md docs/project-atlas/worker-execution-chain.md docs/project-atlas/README.md docs/documentation-governance.md DEVLOG.md docs/superpowers/plans/2026-06-17-data-model-and-worker-atlas.md && git commit -m "docs: add data model and worker atlas"`
Expected: 形成单独文档提交
