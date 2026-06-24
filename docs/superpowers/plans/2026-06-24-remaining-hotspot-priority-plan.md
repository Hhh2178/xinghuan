# Remaining Hotspot Priority Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不回头重做已完成模块的前提下，为当前尚未完成改造的热点文件建立风险评分、批次顺序和后续拆分边界，让后续执行不再只按照 `1200+` 行数机械推进。

**Architecture:** 本计划不要求立刻大规模改代码，而是先把“剩余热点的优先级、拆分边界、验证方式、批次顺序”固定下来。执行时优先处理关键运行态入口，其次处理高性能敏感或高耦合前端热点，静态数据文件最后处理。

**Tech Stack:** TypeScript, React, Node.js worker runtime, API route orchestration, CodeGraph, repository governance docs

---

### Task 1: 建立剩余热点评分卡

**Files:**
- Modify: `docs/records/architecture/2026-06-24-hotspot-superfile-decomposition-ledger.md`
- Create: `docs/governance/hotspot-risk-scorecard.md`
- Test: `node scripts/verify-hotspot-watchlist-contract.mjs`

- [ ] **Step 1: 为剩余热点定义统一评分维度**

评分维度固定为：
- 职责密度
- 变更耦合度
- 运行态风险
- 性能与渲染敏感度
- 可拆分成熟度

- [ ] **Step 2: 只为尚未完成改造的热点填写评分**

至少覆盖：
- `apps/api/src/server.ts`
- `apps/worker/src/worker.ts`
- `apps/web/src/components/Canvas.tsx`
- `apps/web/src/components/nodes/PoseMasterNode.tsx`
- `apps/web/src/components/nodes/ToolboxParamNode.tsx`
- `apps/web/src/components/nodes/ImageEditModal.tsx`
- `apps/web/src/components/nodes/DrawingBoardNode.tsx`
- `apps/web/src/components/nodes/ImageNode.tsx`
- `apps/web/src/components/nodes/PortraitMasterNode.tsx`
- `apps/web/src/components/nodes/VideoNode.tsx`
- `apps/web/src/components/nodes/LLMNode.tsx`
- `apps/web/src/components/nodes/OutputNode.tsx`
- `apps/web/src/data/portraitMasterOptions.ts`

- [ ] **Step 3: 不把已完成收口的文件重新拉回主改造队列**

明确保留为“已完成主要收口，不回头大改”：
- `RunningHubNode.tsx`
- `RHToolsNode.tsx`
- `ApiSettings.tsx`
- `admin-runninghub-workspace.tsx`
- `admin-api-settings-panel.tsx`

- [ ] **Step 4: Run verification**

Run: `node scripts/verify-hotspot-watchlist-contract.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/governance/hotspot-risk-scorecard.md docs/records/architecture/2026-06-24-hotspot-superfile-decomposition-ledger.md
git commit -m "docs: add hotspot risk scorecard"
```

### Task 2: 固定后续批次顺序

**Files:**
- Modify: `docs/records/architecture/2026-06-24-hotspot-superfile-decomposition-ledger.md`
- Modify: `docs/logbooks/daily/2026/2026-06/2026-06-24.md`
- Test: `node scripts/verify-engineering-governance-contract.mjs`

- [ ] **Step 1: 固定第一批后续重点**

第一批只处理：
- `apps/worker/src/worker.ts`
- `apps/api/src/server.ts`

要求记录：
- 为什么不是按纯行数先动 `Canvas.tsx`
- 为什么关键运行态入口优先级更高

- [ ] **Step 2: 固定第二批前端热点**

第二批只处理：
- `apps/web/src/components/Canvas.tsx`
- `apps/web/src/components/nodes/PoseMasterNode.tsx`
- `apps/web/src/components/nodes/ToolboxParamNode.tsx`

- [ ] **Step 3: 固定第三批和第四批**

第三批：
- `ImageEditModal.tsx`
- `DrawingBoardNode.tsx`
- `ImageNode.tsx`
- `PortraitMasterNode.tsx`

第四批：
- `VideoNode.tsx`
- `LLMNode.tsx`
- `OutputNode.tsx`
- `portraitMasterOptions.ts`

- [ ] **Step 4: 为每批写明默认拆分边界**

至少包含：
- `worker.ts`：`cancel-sync / diagnostics glue`
- `server.ts`：`system settings / queue settings handlers`
- `Canvas.tsx`：`runtime hooks / interaction sections / overlay panels`
- 大节点：`section / param / runtime / output`
- 静态数据：`theme / capability / registry`

- [ ] **Step 5: Run verification**

Run: `node scripts/verify-engineering-governance-contract.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add docs/records/architecture/2026-06-24-hotspot-superfile-decomposition-ledger.md docs/logbooks/daily/2026/2026-06/2026-06-24.md
git commit -m "docs: prioritize remaining hotspot sequence"
```

### Task 3: 把新标准写入项目治理入口

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/governance/README.md`
- Modify: `docs/governance/documentation-governance-standard.md`
- Modify: `docs/governance/engineering-guardrails.md`
- Modify: `docs/governance/hotspot-decomposition-workflow.md`
- Modify: `docs/INDEX.md`
- Test: `node scripts/verify-engineering-governance-contract.mjs`

- [ ] **Step 1: 把 1200+ 降级为报警线**

明确写入：
- `1200+` 是报警与入册线
- 不是唯一拆分顺序标准

- [ ] **Step 2: 写入双轨治理**

双轨：
- 行数轨
- 风险轨

- [ ] **Step 3: 写入后续执行原则**

明确：
- 已完成收口的文件暂不回头大改
- 主要精力放在尚未完成热点
- 后续优先级由评分卡决定

- [ ] **Step 4: Run verification**

Run: `node scripts/verify-engineering-governance-contract.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md docs/governance/README.md docs/governance/documentation-governance-standard.md docs/governance/engineering-guardrails.md docs/governance/hotspot-decomposition-workflow.md docs/INDEX.md
git commit -m "docs: upgrade hotspot governance model"
```
