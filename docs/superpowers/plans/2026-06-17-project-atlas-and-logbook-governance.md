# Project Atlas And Logbook Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立统一的项目总纲与分域手册，收紧 AGENTS/MEMORY/DEVLOG 的职责边界，并把台账维护规范正式纳入主入口。

**Architecture:** 采用“总纲入口 + 分域手册 + 主入口精简索引”的文档结构。`docs/project-atlas/README.md` 作为 AI 与协作者的第一跳索引；`AGENTS.md` 负责路由与协作规则；`MEMORY.md` 负责长期有效状态；`DEVLOG.md` 负责日推进台账。

**Tech Stack:** Markdown、Git worktree、CodeGraph、现有 `docs/` / `ops/` / `development/` 结构。

---

### Task 1: 落项目总纲目录

**Files:**
- Create: `docs/project-atlas/README.md`
- Create: `docs/project-atlas/architecture.md`
- Create: `docs/project-atlas/runtime-and-env.md`
- Create: `docs/project-atlas/interfaces-and-dataflow.md`
- Create: `docs/project-atlas/debugging-playbook.md`
- Create: `docs/project-atlas/logbook-maintenance.md`
- Create: `docs/project-atlas/document-routing-and-cleanliness.md`

- [ ] **Step 1: 定义总纲入口与阅读顺序**

写出 `README.md`，明确：
- 谁先看它
- 先读哪些分域手册
- 哪些文件负责当前状态、长期记忆、逐日台账、运维记录

- [ ] **Step 2: 拆出分域手册**

按结构、运行环境、接口/数据流、排障、台账维护、仓库清洁六个领域拆文档，避免再次把所有知识塞回 `MEMORY.md`。

- [ ] **Step 3: 自查总纲目录**

Run: `rg -n "project-atlas" README.md AGENTS.md MEMORY.md docs/documentation-governance.md`
Expected: 能看到主入口文件都已接入新总纲目录

### Task 2: 收紧主入口职责

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `MEMORY.md`
- Modify: `DEVLOG.md`

- [ ] **Step 1: 收紧 README**

把 `README.md` 调整为：
- 工作根入口
- 快速入口
- 当前高层状态

- [ ] **Step 2: 收紧 AGENTS**

把 `AGENTS.md` 调整为：
- 路由
- 协作规则
- 更新义务
- 默认查看顺序

- [ ] **Step 3: 收紧 MEMORY**

把 `MEMORY.md` 顶部调整为：
- 项目摘要
- 快速导航
- 当前运行态
- 当前长期判断

- [ ] **Step 4: 收紧 DEVLOG**

在 `DEVLOG.md` 顶部补充固定记录模板和台账分层说明，确保后续记录不再混入长期规范。

### Task 3: 把台账和清洁规则纳入主规范

**Files:**
- Modify: `docs/documentation-governance.md`
- Modify: `development/README.md`
- Modify: `ops/README.md`

- [ ] **Step 1: 把 project-atlas 纳入文档治理**

更新 `docs/documentation-governance.md`，明确：
- `project-atlas` 是总纲与分域手册层
- 架构 / 环境 / 接口 / 排障变化时必须同步更新
- 台账规则由 `docs/project-atlas/logbook-maintenance.md` 维护

- [ ] **Step 2: 把 development/ops 与新路由对齐**

确保 `development/README.md` 和 `ops/README.md` 都知道：
- 当前总纲入口在哪里
- 哪些信息不应该再散落到过程目录

- [ ] **Step 3: 路由一致性复核**

Run: `rg -n "project-atlas|logbook-maintenance" README.md AGENTS.md MEMORY.md docs/documentation-governance.md development/README.md ops/README.md`
Expected: 所有主入口都能找到新总纲或台账规范引用

### Task 4: 验证并提交

**Files:**
- Modify: `ops/doc-archive-governance-gray-release-2026-06-17.md`（如需补充）

- [ ] **Step 1: 复核工作树变更**

Run: `git status --short`
Expected: 只包含本轮文档与索引改动

- [ ] **Step 2: 同步 CodeGraph**

Run: `codegraph sync`
Expected: `Already up to date` 或同步完成

- [ ] **Step 3: 提交本轮改动**

Run: `git add README.md AGENTS.md MEMORY.md DEVLOG.md docs development ops && git commit -m "docs: add project atlas and logbook governance"`
Expected: 生成单个文档治理提交
