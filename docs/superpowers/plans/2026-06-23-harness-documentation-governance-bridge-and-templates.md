# Harness Documentation Governance Bridge and Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐治理模板，并把 `docs/project-atlas/` 中仍然高频引用的旧正文正式桥接到新的 `docs/systems/` 与 `docs/governance/` 目录，减少两套知识入口并行造成的心智分叉。

**Architecture:** 本轮不做大规模历史删除，而是采用“模板补齐 + 正文桥接 + 兼容入口声明”的方式，把旧 atlas 文档变成“兼容正文 + 指向新主入口”的状态。新的主题内容仍以 `docs/systems/`、`docs/governance/`、`docs/logbooks/` 为主。

**Tech Stack:** Markdown、Git、PowerShell、CodeGraph、ripgrep

---

### Task 1: 补齐治理模板体系

**Files:**
- Create: `docs/governance/templates/README.md`
- Create: `docs/governance/templates/daily-log-template.md`
- Create: `docs/governance/templates/release-record-template.md`
- Create: `docs/governance/templates/validation-record-template.md`
- Create: `docs/governance/templates/system-readme-template.md`
- Modify: `docs/governance/README.md`
- Test: `rg -n "templates|daily-log-template|release-record-template|validation-record-template|system-readme-template" docs/governance`

- [ ] **Step 1: 为治理目录增加模板索引**

```md
## 模板目录

- 日常台账模板
- 发布记录模板
- 验证记录模板
- 系统知识入口模板
```

- [ ] **Step 2: 为四类高频文档建立可直接复用模板**

```md
## 模板字段

- 目标
- 变更
- 验证
- 影响
- 风险
- 下一步
```

- [ ] **Step 3: 运行模板命中检查**

Run: `rg -n "templates|daily-log-template|release-record-template|validation-record-template|system-readme-template" docs/governance`
Expected: 模板目录与模板文件都可检索。

### Task 2: 为 atlas 旧正文增加桥接声明

**Files:**
- Modify: `docs/project-atlas/architecture.md`
- Modify: `docs/project-atlas/interfaces-and-dataflow.md`
- Modify: `docs/project-atlas/provider-protocol-and-request-body-design.md`
- Modify: `docs/project-atlas/worker-execution-chain.md`
- Modify: `docs/project-atlas/data-model-navigation.md`
- Modify: `docs/project-atlas/debugging-playbook.md`
- Modify: `docs/project-atlas/server-maintenance-and-healthchecks.md`
- Modify: `docs/project-atlas/document-routing-and-cleanliness.md`
- Test: `rg -n "兼容说明|新主入口|docs/systems|docs/governance|docs/logbooks" docs/project-atlas`

- [ ] **Step 1: 为 atlas 各主题文件增加新主入口说明**

```md
> 兼容说明：本页继续保留为旧正文，新的主入口见 `docs/systems/...` 或 `docs/governance/...`
```

- [ ] **Step 2: 让每个 atlas 文件明确指向对应新目录**

```md
## 当前主入口

- 新系统目录
- 新治理目录
- 新台账目录
```

- [ ] **Step 3: 运行桥接命中检查**

Run: `rg -n "兼容说明|新主入口|docs/systems|docs/governance|docs/logbooks" docs/project-atlas`
Expected: atlas 核心正文都已出现桥接说明。

### Task 3: 更新新目录中的“来源与兼容关系”

**Files:**
- Modify: `docs/systems/runninghub/README.md`
- Modify: `docs/systems/api/README.md`
- Modify: `docs/systems/worker/README.md`
- Modify: `docs/systems/providers/README.md`
- Modify: `docs/systems/storage-and-data/README.md`
- Modify: `docs/systems/observability-and-ops/README.md`
- Modify: `docs/governance/README.md`
- Test: `rg -n "兼容正文|project-atlas|来源" docs/systems docs/governance`

- [ ] **Step 1: 给新目录补“兼容正文来源”说明**

```md
## 兼容正文来源

- `docs/project-atlas/...`
```

- [ ] **Step 2: 标明后续更新应优先写入新目录**

```md
## 更新规则

- 新正文优先写这里
- 旧 atlas 只保留兼容层
```

- [ ] **Step 3: 运行来源命中检查**

Run: `rg -n "兼容正文|project-atlas|来源" docs/systems docs/governance`
Expected: 新目录能清楚告诉读者旧正文从哪来、以后写哪边。

### Task 4: 再压缩主入口的旧口径

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `MEMORY.md`
- Modify: `docs/project-atlas/README.md`
- Test: `rg -n "兼容层|docs/INDEX.md|docs/systems|docs/governance|docs/logbooks" AGENTS.md README.md MEMORY.md docs/project-atlas/README.md`

- [ ] **Step 1: 统一主入口对 atlas 的描述**

```md
- `docs/project-atlas/README.md`：兼容层总纲正文
```

- [ ] **Step 2: 强化新入口优先级**

Run: `rg -n "兼容层|docs/INDEX.md|docs/systems|docs/governance|docs/logbooks" AGENTS.md README.md MEMORY.md docs/project-atlas/README.md`
Expected: 旧主入口不再把 atlas 表述成主导航。

### Task 5: 验证并提交

**Files:**
- Modify: `docs/governance/**/*`
- Modify: `docs/project-atlas/*`
- Modify: `docs/systems/**/*`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `MEMORY.md`
- Modify: `docs/superpowers/plans/2026-06-23-harness-documentation-governance-bridge-and-templates.md`

- [ ] **Step 1: 检查工作树**

Run: `git status --short`
Expected: 只包含本轮文档桥接与模板文件。

- [ ] **Step 2: 同步 CodeGraph**

Run: `codegraph sync`
Expected: 输出成功。

- [ ] **Step 3: 提交**

```bash
git add AGENTS.md README.md MEMORY.md docs/governance docs/project-atlas docs/systems docs/superpowers/plans/2026-06-23-harness-documentation-governance-bridge-and-templates.md
git commit -m "docs: bridge atlas into governance structure"
```

- [ ] **Step 4: 输出提交摘要**

Run: `git show --stat --oneline HEAD~0`
Expected: 能看到模板体系、atlas 桥接声明和新目录来源说明。
