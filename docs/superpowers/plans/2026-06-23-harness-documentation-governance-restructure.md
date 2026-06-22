# Harness Documentation Governance Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立新的 harness 文档治理骨架、总入口与四个核心系统知识包，让项目协作默认从“总纲 -> 索引 -> 系统知识 -> 代码”进入，而不是继续依赖旧入口全文搜索。

**Architecture:** 本轮采用“兼容层 + 新骨架”的 Phase 1 落地方式。保留 `README.md`、`AGENTS.md`、`MEMORY.md`、`DEVLOG.md`、`ops/README.md` 作为摘要与跳转入口，同时在 `docs/` 下建立治理、系统、记忆、台账、记录五层结构，并先迁移 RunningHub、Admin、API、Worker 四个高频系统的可用知识入口。

**Tech Stack:** Markdown、Git、PowerShell、CodeGraph、ripgrep

---

### Task 1: 建立新文档骨架与全局索引

**Files:**
- Create: `docs/INDEX.md`
- Create: `docs/governance/README.md`
- Create: `docs/systems/README.md`
- Create: `docs/memory/README.md`
- Create: `docs/logbooks/README.md`
- Create: `docs/logbooks/daily/2026/2026-06/README.md`
- Create: `docs/logbooks/releases/gray/README.md`
- Create: `docs/logbooks/releases/production/README.md`
- Create: `docs/logbooks/validations/README.md`
- Create: `docs/logbooks/incidents/README.md`
- Create: `docs/records/README.md`
- Test: `rg -n "docs/INDEX.md|docs/governance|docs/systems|docs/memory|docs/logbooks|docs/records" README.md AGENTS.md MEMORY.md DEVLOG.md ops/README.md`

- [ ] **Step 1: 创建全局索引与五层目录入口**

```md
# 文档总索引

## 先从这里判断要去哪

- 协作规则与治理：`docs/governance/`
- 系统地图与专题知识：`docs/systems/`
- 长期记忆：`docs/memory/`
- 台账与发布证据：`docs/logbooks/`
- 设计、方案与演进记录：`docs/records/`
```

- [ ] **Step 2: 为各层目录补职责说明和进入规则**

```md
## 这一层放什么

- 允许写入：
- 不允许写入：
- 推荐阅读顺序：
- 与旧入口文件的关系：
```

- [ ] **Step 3: 为 logbooks 建立按日期和按类型的落点目录**

```text
docs/logbooks/
  daily/2026/2026-06/
  releases/gray/
  releases/production/
  validations/
  incidents/
```

- [ ] **Step 4: 运行索引可见性检查**

Run: `rg -n "docs/INDEX.md|docs/governance|docs/systems|docs/memory|docs/logbooks|docs/records" README.md AGENTS.md MEMORY.md DEVLOG.md ops/README.md`
Expected: 至少命中后续改造后的入口跳转，说明新骨架已经被旧入口引用。

### Task 2: 落治理规则与协作导航

**Files:**
- Create: `docs/governance/collaboration-and-workflow.md`
- Create: `docs/governance/codegraph-and-repo-navigation.md`
- Create: `docs/governance/archive-policy.md`
- Modify: `AGENTS.md`
- Test: `rg -n "docs/governance|CodeGraph|归档|阅读顺序|协作方式" AGENTS.md docs/governance/*.md`

- [ ] **Step 1: 拆出协作工作流说明**

```md
## 默认协作路径

1. 先看 `AGENTS.md`
2. 再看 `docs/INDEX.md`
3. 按系统进入 `docs/systems/<system>/`
4. 需要长期上下文时看 `docs/memory/`
5. 需要逐次证据时看 `docs/logbooks/` 与 `ops/`
```

- [ ] **Step 2: 拆出 CodeGraph 与仓库导航规则**

```md
## CodeGraph 优先规则

- 开始前先跑：`codegraph status`
- 找调用链、影响面、系统边界时先用 CodeGraph
- 精确文本定位再回退 `rg`
- 改动完成后执行：`codegraph sync`
```

- [ ] **Step 3: 拆出归档政策与新增文档分类规则**

```md
## 新增文档前先分类

- 治理规则
- 系统知识
- 长期记忆
- 逐日台账
- 发布/验证证据
- 设计与演进记录
```

- [ ] **Step 4: 将 `AGENTS.md` 改成项目总纲与治理入口**

```md
## 阅读顺序

1. `AGENTS.md`
2. `docs/INDEX.md`
3. `docs/systems/README.md`
4. `README.md`
5. `MEMORY.md`
6. `ops/README.md`
```

- [ ] **Step 5: 运行治理规则命中检查**

Run: `rg -n "docs/governance|CodeGraph|归档|阅读顺序|协作方式" AGENTS.md docs/governance/*.md`
Expected: `AGENTS.md` 与治理目录同时命中新规则，不再只有单一旧入口描述。

### Task 3: 迁入四个核心系统知识入口

**Files:**
- Create: `docs/systems/runninghub/README.md`
- Create: `docs/systems/runninghub/integration-architecture.md`
- Create: `docs/systems/runninghub/catalog-and-entry-model.md`
- Create: `docs/systems/runninghub/workflow-app-differences.md`
- Create: `docs/systems/runninghub/node-runtime-flow.md`
- Create: `docs/systems/admin/README.md`
- Create: `docs/systems/admin/architecture.md`
- Create: `docs/systems/admin/protocol-and-capabilities.md`
- Create: `docs/systems/admin/ui-and-information-architecture.md`
- Create: `docs/systems/api/README.md`
- Create: `docs/systems/api/architecture.md`
- Create: `docs/systems/api/interface-map.md`
- Create: `docs/systems/api/request-response-flow.md`
- Create: `docs/systems/worker/README.md`
- Create: `docs/systems/worker/execution-chain.md`
- Create: `docs/systems/worker/queue-and-concurrency.md`
- Create: `docs/systems/worker/output-materialization.md`
- Test: `rg -n "RunningHub|后台|API|Worker|queue|concurrency|runTargetId|workflowId" docs/systems`

- [ ] **Step 1: 为 `docs/systems/README.md` 建立系统地图**

```md
## 核心系统

- RunningHub：协议、catalog、条目建模、节点运行态
- Admin：后台能力边界、协议配置、信息架构
- API：前后端接口、鉴权、提交与查询链路
- Worker：消费、并发、结果落库、队列治理
```

- [ ] **Step 2: 将 RunningHub 知识拆成可导航专题**

```md
## RunningHub 阅读顺序

1. `README.md`
2. `integration-architecture.md`
3. `catalog-and-entry-model.md`
4. `workflow-app-differences.md`
5. `node-runtime-flow.md`
```

- [ ] **Step 3: 将 Admin、API、Worker 各自拆成“定位 + 专题”结构**

```md
## 每个系统目录最少包含

- 系统定位
- 入口文件/关键模块
- 上下游依赖
- 常见排障第一跳
- 相关系统跳转
```

- [ ] **Step 4: 运行系统知识覆盖检查**

Run: `rg -n "RunningHub|后台|API|Worker|queue|concurrency|runTargetId|workflowId" docs/systems`
Expected: 四个系统目录都能命中对应主题，不再只分散在 `MEMORY.md`、`DEVLOG.md`、`project-atlas` 或 `ops`。

### Task 4: 将旧主入口收口成摘要与路由

**Files:**
- Modify: `README.md`
- Modify: `MEMORY.md`
- Modify: `DEVLOG.md`
- Modify: `ops/README.md`
- Test: `rg -n "docs/INDEX.md|docs/systems|docs/memory|docs/logbooks|摘要|跳转|兼容入口" README.md MEMORY.md DEVLOG.md ops/README.md`

- [ ] **Step 1: 收口 `README.md` 为当前状态摘要与入口导航**

```md
## 当前状态

- 当前版本
- 当前 gray / production
- 当前阶段
- 先看哪几个入口
```

- [ ] **Step 2: 收口 `MEMORY.md` 为长期记忆摘要与主题索引**

```md
## 长期记忆入口

- 当前状态摘要
- 长期决策索引
- 关键边界与风险
- 跳转到 `docs/memory/*`
```

- [ ] **Step 3: 给 `DEVLOG.md` 和 `ops/README.md` 增加新结构说明**

```md
## 迁移说明

- 逐日台账继续保留在这里，但新记录优先写入 `docs/logbooks/daily/`
- 运行态与放行索引继续保留在 `ops/README.md`
- 新的总索引位于 `docs/INDEX.md`
```

- [ ] **Step 4: 运行旧入口跳转检查**

Run: `rg -n "docs/INDEX.md|docs/systems|docs/memory|docs/logbooks|摘要|跳转|兼容入口" README.md MEMORY.md DEVLOG.md ops/README.md`
Expected: 四个旧入口都明确出现新目录跳转，不再独自承担全量正文职责。

### Task 5: 验证、同步索引并提交

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `MEMORY.md`
- Modify: `DEVLOG.md`
- Modify: `ops/README.md`
- Modify: `docs/INDEX.md`
- Modify: `docs/governance/*.md`
- Modify: `docs/systems/**/*.md`
- Modify: `docs/memory/README.md`
- Modify: `docs/logbooks/**/*.md`
- Modify: `docs/records/README.md`

- [ ] **Step 1: 检查工作树变更**

Run: `git status --short`
Expected: 只出现本轮新增和修改的文档文件，没有意外源码或删除操作。

- [ ] **Step 2: 同步 CodeGraph**

Run: `codegraph sync`
Expected: 输出成功并将索引与当前仓库内容对齐。

- [ ] **Step 3: 再做一次关键命中检查**

Run: `rg -n "docs/INDEX.md|docs/governance|docs/systems|docs/memory|docs/logbooks|docs/records" AGENTS.md README.md MEMORY.md DEVLOG.md ops/README.md`
Expected: 五个主入口都至少命中新总索引或新目录入口。

- [ ] **Step 4: 提交本轮变更**

```bash
git add AGENTS.md README.md MEMORY.md DEVLOG.md ops/README.md docs/INDEX.md docs/governance docs/systems docs/memory docs/logbooks docs/records docs/superpowers/plans/2026-06-23-harness-documentation-governance-restructure.md
git commit -m "docs: restructure harness documentation governance"
```

- [ ] **Step 5: 记录交付结论**

Run: `git show --stat --oneline HEAD~0`
Expected: 能看到本轮文档治理骨架、入口收口和系统知识目录都已进入同一提交。
