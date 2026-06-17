# API Navigation Atlas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为无限画布 2.0 建立一份可快速检索的核心 API 导航页，帮助 AI 和协作者快速找到接口入口、鉴权边界和排障起点。

**Architecture:** 在 `docs/project-atlas/` 下新增一份 `api-navigation.md`，按接口域分组列出高频 API、对应职责、实现入口和排查建议；同时把它接入总纲入口和文档治理索引。

**Tech Stack:** Markdown、`apps/api/src/server.ts` 路由实现、现有 `project-atlas` 总纲结构。

---

### Task 1: 提炼接口导航结构

**Files:**
- Create: `docs/project-atlas/api-navigation.md`

- [ ] **Step 1: 按接口域分组**

分组至少覆盖：
- 健康检查与状态
- 认证与会话
- 助手与聊天
- 文件与素材
- 资源库与生成库
- 画布与项目
- 外部生成代理
- 后台治理

- [ ] **Step 2: 为每组写清入口与边界**

每组至少说明：
- 典型路径
- 主要用途
- 是否需要登录 / 管理员权限
- 主要实现入口文件
- 排障第一跳

### Task 2: 接入主入口索引

**Files:**
- Modify: `docs/project-atlas/README.md`
- Modify: `docs/documentation-governance.md`
- Modify: `DEVLOG.md`

- [ ] **Step 1: 接到 project-atlas 总纲**

在 `README.md` 中加入 `api-navigation.md`。

- [ ] **Step 2: 接到治理规范**

在 `documentation-governance.md` 中把 API 导航页列入项目总纲层。

- [ ] **Step 3: 记录本轮推进**

在 `DEVLOG.md` 顶部记录：
- 为什么补这个索引
- 新索引负责什么
- 后续接口变化时要同步更新

### Task 3: 验证并提交

**Files:**
- Modify: `docs/project-atlas/api-navigation.md`

- [ ] **Step 1: 路由一致性检查**

Run: `rg -n "api-navigation" docs/project-atlas/README.md docs/documentation-governance.md DEVLOG.md`
Expected: 三处都能找到新入口

- [ ] **Step 2: 基础文档契约检查**

Run: `npm run verify:release-gate-docs-contract`
Expected: `ok = true`

- [ ] **Step 3: 提交**

Run: `git add docs/project-atlas/api-navigation.md docs/project-atlas/README.md docs/documentation-governance.md DEVLOG.md docs/superpowers/plans/2026-06-17-api-navigation-atlas.md && git commit -m "docs: add api navigation atlas"`
Expected: 形成单个文档提交
