# Harness Documentation Governance Phase 2 and Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成文档治理后续阶段：把长期记忆拆成主题文件，把台账切流真正落地，并补齐第二批系统知识包与记录库入口。

**Architecture:** 本轮基于已完成的 Phase 1 骨架继续深化，不做大规模删除或历史迁移，而是通过“主题化副本 + 兼容入口 + 新索引”逐步切换。`MEMORY.md` 保留兼容入口，但长期内容转入 `docs/memory/`；`DEVLOG.md` 与 `ops/README.md` 保留兼容职责，但新增记录规范和索引迁到 `docs/logbooks/`；系统知识继续扩展到 Canvas、Providers、Auth、Storage、Observability 五个目录，并为 `docs/records/` 建立按领域落点。

**Tech Stack:** Markdown、Git、PowerShell、CodeGraph、ripgrep

---

### Task 1: 拆分长期记忆主题

**Files:**
- Create: `docs/memory/current-state.md`
- Create: `docs/memory/product-and-scope.md`
- Create: `docs/memory/architecture-decisions.md`
- Create: `docs/memory/deployment-state.md`
- Create: `docs/memory/runninghub-memory.md`
- Create: `docs/memory/provider-memory.md`
- Modify: `docs/memory/README.md`
- Modify: `MEMORY.md`
- Test: `rg -n "current-state|product-and-scope|architecture-decisions|deployment-state|runninghub-memory|provider-memory" docs/memory MEMORY.md`

- [ ] **Step 1: 从 `MEMORY.md` 提炼长期主题索引**

```md
## 长期主题

- 当前状态与阶段判断
- 产品范围与项目边界
- 架构决策
- 部署与运行环境
- RunningHub 长期记忆
- Provider 长期记忆
```

- [ ] **Step 2: 将长期内容分别写入主题文件**

```md
## 本文件负责什么

- 保留哪些长期判断
- 关联哪些系统目录
- 回到哪些兼容入口
```

- [ ] **Step 3: 收口 `MEMORY.md` 为摘要 + 索引**

```md
## 主题索引

- `docs/memory/current-state.md`
- `docs/memory/deployment-state.md`
- `docs/memory/runninghub-memory.md`
```

- [ ] **Step 4: 运行主题命中检查**

Run: `rg -n "current-state|product-and-scope|architecture-decisions|deployment-state|runninghub-memory|provider-memory" docs/memory MEMORY.md`
Expected: `docs/memory/` 与 `MEMORY.md` 都能命中新主题索引。

### Task 2: 将台账切流做实

**Files:**
- Create: `docs/logbooks/daily/2026/README.md`
- Create: `docs/logbooks/releases/README.md`
- Create: `docs/logbooks/validations/2026-06-23-harness-documentation-governance-phase1-and-phase2.md`
- Create: `docs/logbooks/releases/gray/2026-06-22-runninghub-release-index.md`
- Create: `docs/logbooks/releases/production/2026-06-19-runninghub-release-index.md`
- Modify: `docs/logbooks/README.md`
- Modify: `DEVLOG.md`
- Modify: `ops/README.md`
- Test: `rg -n "docs/logbooks|daily/2026|releases/README|validations|运行态材料" docs/logbooks DEVLOG.md ops/README.md`

- [ ] **Step 1: 为 daily 与 releases 建立上层索引**

```md
## 目录索引

- daily
- releases
- validations
- incidents
```

- [ ] **Step 2: 为现有 gray / production 运行态建立新目录索引文件**

```md
## 当前索引记录

- 当前 release
- 对应旧 `ops/*.md`
- 说明旧材料仍是运行态证据
```

- [ ] **Step 3: 增加本轮治理验证记录**

```md
## 验证范围

- 主入口是否已切到新索引
- 长期记忆是否已主题化
- 系统知识是否已覆盖第二批目录
```

- [ ] **Step 4: 在 `DEVLOG.md` 和 `ops/README.md` 中强化切流规则**

Run: `rg -n "docs/logbooks|daily/2026|releases/README|validations|运行态材料" docs/logbooks DEVLOG.md ops/README.md`
Expected: `DEVLOG.md` 与 `ops/README.md` 都明确指向新的 logbooks 索引。

### Task 3: 扩展第二批系统知识包

**Files:**
- Create: `docs/systems/canvas/README.md`
- Create: `docs/systems/canvas/node-and-data-model.md`
- Create: `docs/systems/canvas/project-and-material-flow.md`
- Create: `docs/systems/providers/README.md`
- Create: `docs/systems/providers/protocol-layering.md`
- Create: `docs/systems/providers/request-body-and-file-strategy.md`
- Create: `docs/systems/auth-and-users/README.md`
- Create: `docs/systems/auth-and-users/session-and-csrf.md`
- Create: `docs/systems/auth-and-users/revision-and-ownership-guard.md`
- Create: `docs/systems/storage-and-data/README.md`
- Create: `docs/systems/storage-and-data/postgres-and-redis-boundaries.md`
- Create: `docs/systems/storage-and-data/material-and-output-storage.md`
- Create: `docs/systems/observability-and-ops/README.md`
- Create: `docs/systems/observability-and-ops/release-gates.md`
- Create: `docs/systems/observability-and-ops/gray-and-production-operations.md`
- Modify: `docs/systems/README.md`
- Modify: `docs/INDEX.md`
- Test: `rg -n "canvas|providers|auth-and-users|storage-and-data|observability-and-ops" docs/systems docs/INDEX.md`

- [ ] **Step 1: 为五个新增系统目录建立 README**

```md
## 系统定位

- 负责什么
- 关键代码入口
- 相关上下游
- 推荐阅读顺序
```

- [ ] **Step 2: 从 `project-atlas` 与已有文档提炼主题页**

```md
## 专题页

- Canvas：节点与数据模型、项目与素材流
- Providers：协议分层、请求体与文件策略
- Auth：会话/CSRF、revision/ownership
- Storage：Postgres/Redis 边界、素材与输出落库
- Observability：release gate、gray/prod 运维
```

- [ ] **Step 3: 更新总系统地图和总索引**

Run: `rg -n "canvas|providers|auth-and-users|storage-and-data|observability-and-ops" docs/systems docs/INDEX.md`
Expected: 新增五个系统目录已进入系统总览和总索引。

### Task 4: 建立记录库按领域落点

**Files:**
- Create: `docs/records/runninghub/README.md`
- Create: `docs/records/admin/README.md`
- Create: `docs/records/canvas/README.md`
- Create: `docs/records/worker/README.md`
- Create: `docs/records/providers/README.md`
- Create: `docs/records/auth/README.md`
- Create: `docs/records/observability/README.md`
- Modify: `docs/records/README.md`
- Test: `rg -n "runninghub|admin|canvas|worker|providers|auth|observability" docs/records`

- [ ] **Step 1: 给每个领域目录建立“存什么”的说明**

```md
## 收录范围

- 设计 spec
- 实施 plan
- 关键运维/发布记录
- 演进说明
```

- [ ] **Step 2: 为每个领域链接到已有 spec/plan/ops 材料**

```md
## 当前入口

- 相关 `docs/superpowers/specs/*`
- 相关 `docs/superpowers/plans/*`
- 相关 `ops/*`
```

- [ ] **Step 3: 运行记录库命中检查**

Run: `rg -n "runninghub|admin|canvas|worker|providers|auth|observability" docs/records`
Expected: 每个领域目录都存在且有入口说明。

### Task 5: 验证并提交后续阶段

**Files:**
- Modify: `MEMORY.md`
- Modify: `DEVLOG.md`
- Modify: `ops/README.md`
- Modify: `docs/INDEX.md`
- Modify: `docs/memory/*.md`
- Modify: `docs/logbooks/**/*.md`
- Modify: `docs/systems/**/*.md`
- Modify: `docs/records/**/*.md`
- Modify: `docs/superpowers/plans/2026-06-23-harness-documentation-governance-phase2-and-phase3.md`

- [ ] **Step 1: 检查工作树**

Run: `git status --short`
Expected: 只出现本轮文档变更。

- [ ] **Step 2: 同步 CodeGraph**

Run: `codegraph sync`
Expected: 输出成功。

- [ ] **Step 3: 运行最终命中检查**

Run: `rg -n "docs/memory|docs/logbooks|docs/systems/canvas|docs/systems/providers|docs/records/" AGENTS.md README.md MEMORY.md DEVLOG.md ops/README.md docs/INDEX.md`
Expected: 主入口和总索引都指向新的后续阶段成果。

- [ ] **Step 4: 提交**

```bash
git add MEMORY.md DEVLOG.md ops/README.md docs/INDEX.md docs/memory docs/logbooks docs/systems docs/records docs/superpowers/plans/2026-06-23-harness-documentation-governance-phase2-and-phase3.md
git commit -m "docs: continue harness governance migration"
```

- [ ] **Step 5: 输出提交摘要**

Run: `git show --stat --oneline HEAD~0`
Expected: 能看到长期记忆拆分、台账切流、第二批系统包和记录库入口都在同一提交。
