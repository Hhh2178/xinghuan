# Gray Release Boundary And Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 固化灰度发布中的职责边界，并提供一套可复用的半自动化脚本、清单和模板。

**Architecture:** 先在规则层明确 Agent 与用户的验收分工，再用三段式脚本覆盖本地准备、远端部署和运行态校验，最后用运维清单与记录模板统一落盘口径。视觉验收明确从 Agent 默认职责中移出，保留为用户人工确认项。

**Tech Stack:** Node.js ESM 脚本、现有 npm workspace 脚本、SSH/SCP、Markdown 文档。

---

### Task 1: 固化发布职责边界

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/governance/documentation-governance-standard.md`

- [ ] **Step 1: 在 AGENTS 中新增发布职责边界规则**
- [ ] **Step 2: 在治理规范中新增同口径正式规则**
- [ ] **Step 3: 明确 Agent 默认不做灰度视觉验收**
- [ ] **Step 4: 明确用户负责视觉、交互和业务体验放行**
- [ ] **Step 5: 自查两份文档表述是否一致**

### Task 2: 新增灰度发布脚本

**Files:**
- Create: `scripts/release/prepare-gray-release.mjs`
- Create: `scripts/release/deploy-gray-release.mjs`
- Create: `scripts/release/verify-gray-runtime.mjs`
- Modify: `package.json`

- [ ] **Step 1: 设计三段脚本的参数接口和输出结构**
- [ ] **Step 2: 实现本地准备脚本**
- [ ] **Step 3: 实现远端部署脚本**
- [ ] **Step 4: 实现运行态校验脚本**
- [ ] **Step 5: 在 `package.json` 暴露标准 npm 命令入口**

### Task 3: 补齐清单和模板

**Files:**
- Create: `ops/gray-release-standard-checklist.md`
- Create: `ops/templates/gray-release-record-template.md`
- Modify: `ops/gray-deploy-runbook.md`
- Modify: `ops/gray-acceptance-checklist.md`

- [ ] **Step 1: 新建职责拆分后的标准清单**
- [ ] **Step 2: 新建灰度发布记录模板**
- [ ] **Step 3: 更新 runbook，默认推荐使用新脚本**
- [ ] **Step 4: 更新灰度验收清单，显式标注视觉验收为用户责任**
- [ ] **Step 5: 检查新旧运维入口是否仍能兼容**

### Task 4: 验证与交付

**Files:**
- Modify: `docs/logbooks/daily/2026/2026-06/2026-06-23.md`
- Modify: `ops/README.md`

- [ ] **Step 1: 运行新脚本的基础校验**
- [ ] **Step 2: 检查 npm 命令入口可用**
- [ ] **Step 3: 补一条当日日台账说明本轮规则与脚本标准化**
- [ ] **Step 4: 如需，在 `ops/README.md` 增加新清单 / 模板入口**
- [ ] **Step 5: 汇总“Agent 已验 / 用户待验”新的使用方式**
