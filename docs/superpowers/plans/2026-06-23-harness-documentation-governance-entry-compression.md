# Harness Documentation Governance Entry Compression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 再压一层主入口，把 `MEMORY.md`、`DEVLOG.md`、`ops/README.md` 从“仍然很长的兼容正文”进一步收口成“摘要 + 最近入口 + 历史索引”。

**Architecture:** 本轮不大规模删除历史正文，而是新建承接性的 recent/current 索引文件，把高频恢复路径从大文件正文中剥离出来。旧文件只保留：作用说明、阅读顺序、最近关键入口和历史索引说明。

**Tech Stack:** Markdown、Git、PowerShell、CodeGraph、ripgrep

---

### Task 1: 建立 recent/current 承接索引

**Files:**
- Create: `docs/memory/recent-release-index.md`
- Create: `docs/logbooks/daily/2026/2026-06/recent-highlights.md`
- Create: `docs/logbooks/releases/current-release-index.md`
- Modify: `docs/memory/README.md`
- Modify: `docs/logbooks/README.md`
- Test: `rg -n "recent-release-index|recent-highlights|current-release-index" docs/memory docs/logbooks`

- [ ] **Step 1: 为长期记忆补 recent release 索引**

```md
## 最近高频运行态

- 当前 gray
- 当前 production
- 当前关键版本跳转
```

- [ ] **Step 2: 为 2026-06 日志补最近摘要页**

```md
## 最近高频事项

- RunningHub
- 并发治理
- 发布与 gate
```

- [ ] **Step 3: 为发布目录补 current release 索引**

```md
## 当前 active release

- gray
- production
- 对应旧 ops 记录
```

### Task 2: 压缩 MEMORY.md

**Files:**
- Modify: `MEMORY.md`
- Test: `rg -n "recent-release-index|历史索引|主题正文|docs/memory/" MEMORY.md`

- [ ] **Step 1: 将 MEMORY 前部改成摘要 + 主题入口 + 最近 release 索引**

```md
## 当前推荐阅读

1. `docs/memory/current-state.md`
2. `docs/memory/deployment-state.md`
3. `docs/memory/recent-release-index.md`
```

- [ ] **Step 2: 将长历史正文改为“历史区说明”**

```md
## 历史索引说明

- 旧发布与阶段性长正文仍保留在本文件后部
- 后续逐步迁入 `docs/memory/` 与 `docs/logbooks/`
```

### Task 3: 压缩 DEVLOG.md 与 ops/README.md

**Files:**
- Modify: `DEVLOG.md`
- Modify: `ops/README.md`
- Test: `rg -n "recent-highlights|current-release-index|兼容入口|历史索引" DEVLOG.md ops/README.md`

- [ ] **Step 1: 给 DEVLOG 增加 recent highlights 第一跳**

```md
## 最近高频入口

- `docs/logbooks/daily/2026/2026-06/recent-highlights.md`
```

- [ ] **Step 2: 给 ops 增加 current release 第一跳**

```md
## 当前 release 第一跳

- `docs/logbooks/releases/current-release-index.md`
```

- [ ] **Step 3: 明确旧正文与旧运行态材料属于历史兼容区**

```md
## 历史索引说明

- 当前值守先看新的 current/recent 索引
- 旧正文仍保留作兼容层
```

### Task 4: 验证并提交

**Files:**
- Modify: `MEMORY.md`
- Modify: `DEVLOG.md`
- Modify: `ops/README.md`
- Modify: `docs/memory/*.md`
- Modify: `docs/logbooks/**/*.md`
- Modify: `docs/superpowers/plans/2026-06-23-harness-documentation-governance-entry-compression.md`

- [ ] **Step 1: 检查工作树**

Run: `git status --short`
Expected: 只出现本轮入口压缩文档。

- [ ] **Step 2: 同步 CodeGraph**

Run: `codegraph sync`
Expected: 输出成功。

- [ ] **Step 3: 提交**

```bash
git add MEMORY.md DEVLOG.md ops/README.md docs/memory docs/logbooks docs/superpowers/plans/2026-06-23-harness-documentation-governance-entry-compression.md
git commit -m "docs: compress governance entrypoints"
```

- [ ] **Step 4: 输出提交摘要**

Run: `git show --stat --oneline HEAD~0`
Expected: 能看到入口压缩相关索引和旧入口收口。
