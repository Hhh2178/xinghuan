# Project Harness Documentation Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the project harness/documentation architecture design into enforceable repository behavior so future agents, windows, and releases keep following the same rules.

**Architecture:** Keep `AGENTS.md`, `README.md`, `MEMORY.md`, `DEVLOG.md`, and `ops/README.md` as short entry files, move detailed rules to `docs/governance/` and `docs/systems/`, then enforce the boundaries with small Node.js contract scripts. Wire the scripts into root `package.json`, `scripts/pre-commit-governance.mjs`, and `docs/systems/harness/` so the rules are visible and executable.

**Tech Stack:** Node.js ESM scripts, npm workspace scripts, Markdown docs, existing Git hooks, existing `docs/` governance structure.

---

## Source Design

Implement this plan against:

- `docs/superpowers/specs/2026-07-06-project-harness-documentation-architecture-design.md`
- `docs/governance/documentation-governance-standard.md`
- `docs/systems/harness/README.md`

ComfyUI feature development remains paused and out of scope.

## File Map

- Modify: `AGENTS.md`
  - Keep only AI constitution, default reading order, safety rules, and links to detailed governance.
- Modify: `README.md`
  - Collapse repeated current-state sections into one canonical summary.
- Modify: `MEMORY.md`
  - Ensure it is a compatibility entry for long-term memory, not a second project state source.
- Modify: `DEVLOG.md`
  - Ensure it points to `docs/logbooks/daily/` for current logs.
- Modify: `ops/README.md`
  - Keep current runtime summary and pointers to `ops/current/`.
- Create: `docs/systems/canvas/frontend-design/README.md`
- Create: `docs/systems/canvas/frontend-design/canvas-visual-language.md`
- Create: `docs/systems/canvas/frontend-design/node-design-standard.md`
- Create: `docs/systems/canvas/frontend-design/interaction-and-overlay-standard.md`
- Create: `docs/systems/canvas/frontend-design/component-usage-policy.md`
- Create: `docs/systems/canvas/frontend-design/verification-checklist.md`
- Modify: `docs/systems/admin/frontend-design/README.md`
- Create: `docs/systems/admin/frontend-design/component-library-policy.md`
- Create: `docs/systems/admin/frontend-design/layout-and-density-standard.md`
- Create: `docs/systems/admin/frontend-design/form-table-drawer-standard.md`
- Create: `docs/systems/admin/frontend-design/icon-text-alignment-standard.md`
- Create: `docs/systems/admin/frontend-design/verification-checklist.md`
- Create: `docs/governance/root-entry-responsibility-matrix.md`
- Create: `docs/systems/interface-documentation-template.md`
- Create: `scripts/verify-documentation-entry-contract.mjs`
- Create: `scripts/verify-visual-design-docs-contract.mjs`
- Create: `scripts/verify-system-doc-template-contract.mjs`
- Create: `scripts/verify-harness-doc-sync-contract.mjs`
- Modify: `scripts/pre-commit-governance.mjs`
- Modify: `scripts/verify-project-harness-contract.mjs`
- Modify: `package.json`
- Modify: `docs/systems/harness/README.md`
- Modify: `docs/systems/harness/workspace-verify-release-map.md`
- Modify: `docs/logbooks/daily/2026/2026-07/2026-07-06.md`

## Commit Boundaries

- Commit 1: Root entry responsibility matrix and root entry cleanup.
- Commit 2: Canvas/admin visual standards and component policy docs.
- Commit 3: Documentation contract scripts and npm wiring.
- Commit 4: Harness docs, daily log, and final verification evidence.

## Task 1: Root Entry Audit And Cleanup

**Files:**
- Create: `docs/governance/root-entry-responsibility-matrix.md`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `MEMORY.md`
- Modify: `DEVLOG.md`
- Modify: `ops/README.md`

- [ ] **Step 1: Create the root entry responsibility matrix**

Write `docs/governance/root-entry-responsibility-matrix.md` with this structure:

```markdown
# Root Entry Responsibility Matrix

## Purpose

This file defines what each root entry is allowed to own. It prevents future agents from copying current state, release evidence, system design, and daily logs into multiple places.

## Entry Rules

| Entry | Primary role | Allowed content | Must link to | Not allowed |
| --- | --- | --- | --- | --- |
| `AGENTS.md` | AI constitution | Safety rules, reading order, collaboration rules, update duties | `docs/INDEX.md`, `docs/governance/`, `docs/systems/harness/` | Long release history, implementation details, duplicated system specs |
| `README.md` | Project overview | One current-state summary, worktree root, navigation links | `docs/INDEX.md`, `ops/current/`, `docs/logbooks/releases/current-release-index.md` | Multiple current-state sections, daily logs, provider internals |
| `MEMORY.md` | Long-term memory compatibility entry | Stable judgments and links into `docs/memory/` | `docs/memory/README.md`, `docs/memory/current-state.md` | Daily progress, detailed release runbooks |
| `DEVLOG.md` | Legacy log compatibility entry | Log policy and current month links | `docs/logbooks/daily/` | New daily records in root |
| `ops/README.md` | Operations entry | Current gray/production summary and ops links | `ops/current/gray.md`, `ops/current/production.md`, `docs/logbooks/releases/` | Product specs, system design, unrelated historical notes |

## Update Rule

When a current-state fact changes, update its canonical source first. Root entries may only keep a short summary and a link.

## Verification

Run:

```bash
npm run verify:documentation-entry-contract
```
```

- [ ] **Step 2: Slim `AGENTS.md`**

Keep these sections:

```markdown
# AGENTS.md - 无限画布 2.0 项目协作规则

## 项目定位

## 默认阅读顺序

## 当前工作根

## 文档权威层级

## AI / 自动化执行规则

## 安全规则

## 提交与发布护栏

## 详细规则入口
```

Move detailed descriptions to links instead of copying them:

```markdown
- CodeGraph 详细规则：`docs/governance/codegraph-and-repo-navigation.md`
- 热点文件治理：`docs/governance/engineering-guardrails.md`
- 发布 gate：`docs/systems/observability-and-ops/release-gates.md`
- Harness 执行地图：`docs/systems/harness/README.md`
- 根入口职责矩阵：`docs/governance/root-entry-responsibility-matrix.md`
```

- [ ] **Step 3: Collapse duplicated `README.md` state sections**

Keep one current status block:

```markdown
## 当前状态摘要

- 当前活跃版本：`v0.5.27`
- 当前灰度：`canvas-next.hhh2121.xyz`
- 当前生产：`canvas.hhh2121.xyz`
- 当前生产版本：`v0.5.22`
- 当前灰度 release：`20260706-task-list-lightweight-gray-r1-v0527`
- 当前生产 release：`20260702-envsync-admin-sections-prod-r1-v0522`
- 当前工作分支：`xinghuan-integration-clean`
- 当前重点：clean worktree 结构治理、harness/documentation contract、灰度链路校验
- ComfyUI 状态：功能开发暂停封存，仅允许 crash/security/rollback/docs 级别例外
```

Remove duplicate sections that repeat the same values under different headings.

- [ ] **Step 4: Ensure compatibility entries point to canonical docs**

At the top of `MEMORY.md`, `DEVLOG.md`, and `ops/README.md`, add or keep a compact notice:

```markdown
> This is a compatibility entry. For canonical current state and evidence, follow the linked docs below.
```

Use Chinese wording if the surrounding file is Chinese.

- [ ] **Step 5: Run root-entry inspection**

Run:

```bash
git diff -- AGENTS.md README.md MEMORY.md DEVLOG.md ops/README.md docs/governance/root-entry-responsibility-matrix.md
```

Expected:

- Root entries are shorter or less repetitive.
- Current release values still match `docs/logbooks/releases/current-release-index.md`.
- No new release facts are introduced without links.

- [ ] **Step 6: Verify current release consistency**

Run:

```bash
npm run verify:current-release-entry-consistency
```

Expected:

```text
"ok": true
```

- [ ] **Step 7: Commit root entry cleanup**

Run:

```bash
git add AGENTS.md README.md MEMORY.md DEVLOG.md ops/README.md docs/governance/root-entry-responsibility-matrix.md
git commit -m "docs: define root entry responsibility boundaries"
```

## Task 2: Canvas Visual Standards

**Files:**
- Create: `docs/systems/canvas/frontend-design/README.md`
- Create: `docs/systems/canvas/frontend-design/canvas-visual-language.md`
- Create: `docs/systems/canvas/frontend-design/node-design-standard.md`
- Create: `docs/systems/canvas/frontend-design/interaction-and-overlay-standard.md`
- Create: `docs/systems/canvas/frontend-design/component-usage-policy.md`
- Create: `docs/systems/canvas/frontend-design/verification-checklist.md`
- Modify: `docs/systems/canvas/README.md`
- Modify: `docs/INDEX.md`

- [ ] **Step 1: Create canvas frontend design README**

Write:

```markdown
# Canvas Frontend Design

This directory is the canonical long-term design standard for the canvas-side product UI.

## Reading Order

1. `canvas-visual-language.md`
2. `node-design-standard.md`
3. `interaction-and-overlay-standard.md`
4. `component-usage-policy.md`
5. `verification-checklist.md`

## Scope

This standard applies to canvas nodes, ports, overlays, context menus, workflow selectors, parameter editors, output displays, runtime states, and canvas-side reusable UI.

## Boundary

Canvas UI should not inherit a full admin component library visual language. Use `@xinghuan/ui` as the project design-system layer and add low-level accessible primitives only when they can be themed into the canvas visual language.
```

- [ ] **Step 2: Create canvas visual language standard**

Write `canvas-visual-language.md` with these required sections:

```markdown
# Canvas Visual Language

## Product Direction

The canvas is a node-based AIGC creative workspace. It should feel like a precise creative instrument, not a generic management dashboard.

## Layout Principles

- Prioritize node clarity, connection readability, and runtime status visibility.
- Keep node chrome compact but not cramped.
- Prefer adaptive height over hidden internal scroll when parameters are important for execution.

## Color And State

- Use neutral dark surfaces for node bodies.
- Use one accent family for active, selected, and running states.
- Use distinct warning and destructive colors for failed, cancelled, and blocked states.

## Typography

- Node title, subtitle, parameter label, helper text, and runtime text must have distinct sizes and weights.

## Motion

- Motion should explain state changes such as running, completing, failing, expanding, and connecting.
- Avoid decorative motion that reduces canvas performance.
```

- [ ] **Step 3: Create node design standard**

Write `node-design-standard.md` with these required sections:

```markdown
# Node Design Standard

## Required Node Regions

1. Header: icon, node name, workflow/model selector, status.
2. Body: parameter groups, mapped inputs, helper text.
3. Runtime: queue/running/success/failure state.
4. Output: one normal generation output port unless the system contract explicitly requires more.

## Geometry

- Nodes use adaptive height.
- Internal scroll is not the default solution for long parameter lists.
- Ports must align to stable connection positions.

## Parameter Rows

- Labels align consistently.
- Required fields are explicit.
- Defaults are visible.
- Hidden fields must be controlled by backend exposure rules or node configuration.

## Output Rules

- Generation-style nodes should expose one normal output port by default.
- Extra diagnostic output belongs in details panels, not extra ports, unless a workflow contract requires it.
```

- [ ] **Step 4: Create overlay and interaction standard**

Write `interaction-and-overlay-standard.md` with:

```markdown
# Interaction And Overlay Standard

## Context Menu

- Context menu actions must be grouped by intent.
- Save to library and publish to public library actions must show permission state.

## Selectors

- Workflow or provider selectors should live in the node header area when they define the node's core behavior.
- Machine-first selection is required when workflows belong to machine instances.

## Dialogs And Popovers

- Dialogs handle destructive, multi-step, or permission-sensitive actions.
- Popovers handle lightweight selection and inspection.

## Error States

- Errors must show actionable text and preserve user input.
```

- [ ] **Step 5: Create canvas component policy**

Write `component-usage-policy.md` with:

```markdown
# Canvas Component Usage Policy

## Primary Layer

Use `@xinghuan/ui` for canvas-side reusable UI.

## Allowed Low-Level Patterns

Radix-style primitives may be used for accessible Dialog, Popover, Tooltip, Select, and Context Menu behavior when wrapped in project components.

## shadcn-style Usage

shadcn-style components may be copied or adapted into `@xinghuan/ui` only when they are themed and owned by this repository.

## Not Allowed

- Do not place raw Ant Design or MUI controls inside canvas nodes.
- Do not create one-off node controls when an existing project component can be extended.
- Do not hide required execution parameters behind default internal scroll areas.
```

- [ ] **Step 6: Create canvas verification checklist**

Write `verification-checklist.md` with:

```markdown
# Canvas Design Verification Checklist

- Node title, icon, selector, body, runtime, and output regions are visually aligned.
- Parameter rows are readable without opening developer tools.
- Required and optional parameters are distinguishable.
- Node height adapts when parameter count increases.
- Connection ports remain stable after parameter expansion.
- Context menu actions show permission-sensitive states.
- Canvas-side UI uses `@xinghuan/ui` or wrapped low-level primitives.
- Admin-only component styling does not leak into canvas nodes.
```

- [ ] **Step 7: Link canvas design docs**

Update `docs/systems/canvas/README.md` and `docs/INDEX.md` to include:

```markdown
- 前台画布视觉规范：`docs/systems/canvas/frontend-design/`
```

- [ ] **Step 8: Commit canvas standards**

Run:

```bash
git add docs/systems/canvas docs/INDEX.md
git commit -m "docs(canvas): add frontend visual design standards"
```

## Task 3: Admin Visual Standards And Component Library Policy

**Files:**
- Modify: `docs/systems/admin/frontend-design/README.md`
- Create: `docs/systems/admin/frontend-design/component-library-policy.md`
- Create: `docs/systems/admin/frontend-design/layout-and-density-standard.md`
- Create: `docs/systems/admin/frontend-design/form-table-drawer-standard.md`
- Create: `docs/systems/admin/frontend-design/icon-text-alignment-standard.md`
- Create: `docs/systems/admin/frontend-design/verification-checklist.md`

- [ ] **Step 1: Update admin frontend design README**

Add these reading-order entries:

```markdown
6. `component-library-policy.md`
7. `layout-and-density-standard.md`
8. `form-table-drawer-standard.md`
9. `icon-text-alignment-standard.md`
10. `verification-checklist.md`
```

- [ ] **Step 2: Create component library policy**

Write:

```markdown
# Admin Component Library Policy

## Decision

Admin may adopt Ant Design 6 through a controlled pilot. It is the preferred business component layer for tables, forms, drawers, modals, upload, pagination, tabs, segmented controls, notifications, empty states, and skeleton loading.

## Why

- Admin is a business governance surface with dense tables and forms.
- Ant Design has mature enterprise components and strong Chinese enterprise ecosystem adoption.
- Ant Design 6 supports React 18 and newer React versions and has modern token-based theming.

## Rollout Rule

Start with one low-risk admin page or component island. Wrap theme and tokens before spreading usage.

## Boundary

Do not use Ant Design as the canvas node visual system.
```

- [ ] **Step 3: Create layout and density standard**

Write:

```markdown
# Admin Layout And Density Standard

## Shell

- Left navigation owns primary module switching.
- Top status area owns environment, version, session, and global state.
- Main content owns page-specific tables, forms, cards, and workbenches.
- Right-side inspector or drawer owns details and secondary actions.

## Density

- Dense data views may use compact tables.
- Form-heavy pages need clear group spacing and section titles.
- KPI cards should not compete with primary work actions.
```

- [ ] **Step 4: Create form/table/drawer standard**

Write:

```markdown
# Admin Form Table Drawer Standard

## Tables

- Tables need clear empty, loading, error, and pagination states.
- Batch actions must show permission and selection state.

## Forms

- Labels, help text, required markers, errors, and save states must be visually consistent.

## Drawers

- Drawers are preferred for inspect/edit flows that should preserve table context.
- Destructive actions inside drawers require confirmation.
```

- [ ] **Step 5: Create icon text alignment standard**

Write:

```markdown
# Admin Icon Text Alignment Standard

## Buttons

- Icons and text must share the same visual center.
- Icon size, gap, and line-height must be consistent for primary, secondary, ghost, and danger buttons.

## Navigation

- Navigation icons use one size and one active-state rule.

## Tables And Cards

- Inline status icons must align with the text baseline and not shift row height unexpectedly.
```

- [ ] **Step 6: Create admin verification checklist**

Write:

```markdown
# Admin Design Verification Checklist

- Page shell matches the admin layout standard.
- Primary action, secondary action, and danger action are visually distinct.
- Icon and text alignment is consistent in buttons, nav, cards, and table rows.
- Tables have loading, empty, error, and pagination states.
- Forms have consistent label, helper, error, and save states.
- Drawer/modal actions preserve permissions and confirmation rules.
- Ant Design usage is wrapped by project theme/tokens during pilot.
```

- [ ] **Step 7: Commit admin standards**

Run:

```bash
git add docs/systems/admin/frontend-design
git commit -m "docs(admin): define visual standards and component policy"
```

## Task 4: System Interface Documentation Template

**Files:**
- Create: `docs/systems/interface-documentation-template.md`
- Modify: `docs/systems/README.md`

- [ ] **Step 1: Create system interface template**

Write:

```markdown
# System Interface Documentation Template

Copy this structure into `docs/systems/<system>/` when a system gains new durable API, permission, runtime, or UI-node behavior.

## Responsibility

Describe what this system owns and what it does not own.

## Public Interfaces

| Interface | Method | Permission | Request | Response | Error contract |
| --- | --- | --- | --- | --- | --- |

## Data Model

Describe durable entities, fields, ownership, and revision rules.

## Runtime Flow

Describe frontend, API, worker, provider, storage, and output flow.

## Permissions And Roles

Describe admin-only, group-scoped, owner-scoped, and public behavior.

## Verification

List exact commands and manual checks.

## Agent Verified

List what automation can verify.

## User Acceptance Required

List what requires human product or visual acceptance.
```

- [ ] **Step 2: Link template from systems README**

Add:

```markdown
- 系统接口文档模板：`docs/systems/interface-documentation-template.md`
```

- [ ] **Step 3: Commit template**

Run:

```bash
git add docs/systems/interface-documentation-template.md docs/systems/README.md
git commit -m "docs(systems): add interface documentation template"
```

## Task 5: Documentation Entry Contract

**Files:**
- Create: `scripts/verify-documentation-entry-contract.mjs`
- Modify: `package.json`

- [ ] **Step 1: Create `verify-documentation-entry-contract.mjs`**

Create:

```javascript
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

const files = {
  agents: await read("AGENTS.md"),
  readme: await read("README.md"),
  memory: await read("MEMORY.md"),
  devlog: await read("DEVLOG.md"),
  ops: await read("ops/README.md"),
  matrix: await read("docs/governance/root-entry-responsibility-matrix.md"),
  releaseIndex: await read("docs/logbooks/releases/current-release-index.md"),
};

assertIncludes(files.agents, "docs/INDEX.md", "AGENTS.md must point to docs index");
assertIncludes(files.agents, "docs/governance/", "AGENTS.md must point to governance docs");
assertIncludes(files.agents, "docs/systems/harness/", "AGENTS.md must point to harness docs");
assertIncludes(files.agents, "docs/governance/root-entry-responsibility-matrix.md", "AGENTS.md must point to root responsibility matrix");

assertIncludes(files.readme, "docs/INDEX.md", "README.md must point to docs index");
assertIncludes(files.readme, "docs/logbooks/releases/current-release-index.md", "README.md must point to current release index");
assertIncludes(files.readme, "ops/current/gray.md", "README.md must point to gray current ops entry");
assertIncludes(files.readme, "ops/current/production.md", "README.md must point to production current ops entry");

assertIncludes(files.memory, "docs/memory/", "MEMORY.md must point to docs/memory");
assertIncludes(files.devlog, "docs/logbooks/daily/", "DEVLOG.md must point to daily logbooks");
assertIncludes(files.ops, "ops/current/gray.md", "ops README must point to gray current entry");
assertIncludes(files.ops, "ops/current/production.md", "ops README must point to production current entry");

assertIncludes(files.matrix, "`AGENTS.md`", "root matrix must describe AGENTS.md");
assertIncludes(files.matrix, "`README.md`", "root matrix must describe README.md");
assertIncludes(files.matrix, "`MEMORY.md`", "root matrix must describe MEMORY.md");
assertIncludes(files.matrix, "`DEVLOG.md`", "root matrix must describe DEVLOG.md");
assertIncludes(files.matrix, "`ops/README.md`", "root matrix must describe ops README");

const readmeCurrentStateHeadings = countMatches(files.readme, /^## 当前状态摘要$/gm);
assert.equal(readmeCurrentStateHeadings, 1, "README.md must contain exactly one current-state summary heading");

for (const forbiddenHeading of ["## 当前定位", "## 2026-07-03 状态更新"]) {
  assert.equal(
    files.readme.includes(forbiddenHeading),
    false,
    `README.md should not keep duplicate heading ${forbiddenHeading}`,
  );
}

console.log("documentation entry contract: ok");

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

function assertIncludes(source, needle, message) {
  assert.equal(source.includes(needle), true, message);
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
}
```

- [ ] **Step 2: Add npm script**

Add to root `package.json` scripts:

```json
"verify:documentation-entry-contract": "node scripts/verify-documentation-entry-contract.mjs"
```

- [ ] **Step 3: Run the contract**

Run:

```bash
npm run verify:documentation-entry-contract
```

Expected:

```text
documentation entry contract: ok
```

- [ ] **Step 4: Commit documentation entry contract**

Run:

```bash
git add scripts/verify-documentation-entry-contract.mjs package.json package-lock.json
git commit -m "chore: enforce documentation entry boundaries"
```

## Task 6: Visual Design Docs Contract

**Files:**
- Create: `scripts/verify-visual-design-docs-contract.mjs`
- Modify: `package.json`

- [ ] **Step 1: Create visual docs contract**

Create:

```javascript
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

const requiredFiles = [
  "docs/systems/canvas/frontend-design/README.md",
  "docs/systems/canvas/frontend-design/canvas-visual-language.md",
  "docs/systems/canvas/frontend-design/node-design-standard.md",
  "docs/systems/canvas/frontend-design/interaction-and-overlay-standard.md",
  "docs/systems/canvas/frontend-design/component-usage-policy.md",
  "docs/systems/canvas/frontend-design/verification-checklist.md",
  "docs/systems/admin/frontend-design/README.md",
  "docs/systems/admin/frontend-design/component-library-policy.md",
  "docs/systems/admin/frontend-design/layout-and-density-standard.md",
  "docs/systems/admin/frontend-design/form-table-drawer-standard.md",
  "docs/systems/admin/frontend-design/icon-text-alignment-standard.md",
  "docs/systems/admin/frontend-design/verification-checklist.md",
];

const docs = new Map();
for (const file of requiredFiles) {
  docs.set(file, await read(file));
}

assertIncludes(docs.get("docs/systems/canvas/frontend-design/README.md"), "node-design-standard.md", "canvas README must link node design standard");
assertIncludes(docs.get("docs/systems/canvas/frontend-design/node-design-standard.md"), "Internal scroll is not the default", "canvas node standard must ban default internal scroll");
assertIncludes(docs.get("docs/systems/canvas/frontend-design/component-usage-policy.md"), "@xinghuan/ui", "canvas component policy must name @xinghuan/ui");
assertIncludes(docs.get("docs/systems/canvas/frontend-design/component-usage-policy.md"), "Do not place raw Ant Design", "canvas policy must keep Ant Design out of nodes");

assertIncludes(docs.get("docs/systems/admin/frontend-design/README.md"), "component-library-policy.md", "admin README must link component policy");
assertIncludes(docs.get("docs/systems/admin/frontend-design/component-library-policy.md"), "Ant Design 6", "admin policy must record Ant Design 6 pilot");
assertIncludes(docs.get("docs/systems/admin/frontend-design/icon-text-alignment-standard.md"), "Icons and text", "admin icon alignment doc must define icon text rule");

const docsIndex = await read("docs/INDEX.md");
const canvasReadme = await read("docs/systems/canvas/README.md");
assertIncludes(docsIndex, "docs/systems/canvas/frontend-design/", "docs index must link canvas visual docs");
assertIncludes(canvasReadme, "docs/systems/canvas/frontend-design/", "canvas README must link visual docs");

console.log("visual design docs contract: ok");

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

function assertIncludes(source, needle, message) {
  assert.equal(String(source).includes(needle), true, message);
}
```

- [ ] **Step 2: Add npm script**

Add to root `package.json` scripts:

```json
"verify:visual-design-docs-contract": "node scripts/verify-visual-design-docs-contract.mjs"
```

- [ ] **Step 3: Run visual docs contract**

Run:

```bash
npm run verify:visual-design-docs-contract
```

Expected:

```text
visual design docs contract: ok
```

- [ ] **Step 4: Commit visual docs contract**

Run:

```bash
git add scripts/verify-visual-design-docs-contract.mjs package.json package-lock.json
git commit -m "chore: enforce visual design documentation contract"
```

## Task 7: System Doc Template Contract

**Files:**
- Create: `scripts/verify-system-doc-template-contract.mjs`
- Modify: `package.json`

- [ ] **Step 1: Create system doc template contract**

Create:

```javascript
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const template = await read("docs/systems/interface-documentation-template.md");
const systemsReadme = await read("docs/systems/README.md");

for (const section of [
  "## Responsibility",
  "## Public Interfaces",
  "## Data Model",
  "## Runtime Flow",
  "## Permissions And Roles",
  "## Verification",
  "## Agent Verified",
  "## User Acceptance Required",
]) {
  assertIncludes(template, section, `template must include ${section}`);
}

assertIncludes(systemsReadme, "docs/systems/interface-documentation-template.md", "systems README must link interface template");

console.log("system doc template contract: ok");

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

function assertIncludes(source, needle, message) {
  assert.equal(source.includes(needle), true, message);
}
```

- [ ] **Step 2: Add npm script**

Add:

```json
"verify:system-doc-template-contract": "node scripts/verify-system-doc-template-contract.mjs"
```

- [ ] **Step 3: Run contract**

Run:

```bash
npm run verify:system-doc-template-contract
```

Expected:

```text
system doc template contract: ok
```

- [ ] **Step 4: Commit contract**

Run:

```bash
git add scripts/verify-system-doc-template-contract.mjs package.json package-lock.json
git commit -m "chore: enforce system documentation template"
```

## Task 8: Harness Sync Contract And Wiring

**Files:**
- Create: `scripts/verify-harness-doc-sync-contract.mjs`
- Modify: `scripts/pre-commit-governance.mjs`
- Modify: `scripts/verify-project-harness-contract.mjs`
- Modify: `package.json`
- Modify: `docs/systems/harness/README.md`
- Modify: `docs/systems/harness/workspace-verify-release-map.md`

- [ ] **Step 1: Create harness doc sync contract**

Create:

```javascript
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const rootPackage = JSON.parse(await read("package.json"));
const harnessReadme = await read("docs/systems/harness/README.md");
const harnessMap = await read("docs/systems/harness/workspace-verify-release-map.md");
const preCommit = await read("scripts/pre-commit-governance.mjs");

const scripts = rootPackage.scripts ?? {};

for (const [name, command] of Object.entries({
  "verify:documentation-entry-contract": "node scripts/verify-documentation-entry-contract.mjs",
  "verify:visual-design-docs-contract": "node scripts/verify-visual-design-docs-contract.mjs",
  "verify:system-doc-template-contract": "node scripts/verify-system-doc-template-contract.mjs",
  "verify:harness-doc-sync-contract": "node scripts/verify-harness-doc-sync-contract.mjs",
})) {
  assert.equal(scripts[name], command, `${name} must be exposed in package.json`);
  assertIncludes(harnessReadme, name, `harness README must mention ${name}`);
  assertIncludes(harnessMap, name, `harness map must mention ${name}`);
}

for (const scriptFile of [
  "verify-documentation-entry-contract.mjs",
  "verify-visual-design-docs-contract.mjs",
  "verify-system-doc-template-contract.mjs",
]) {
  assertIncludes(preCommit, scriptFile, `pre-commit governance must run ${scriptFile}`);
}

assertIncludes(
  scripts["harness:verify:project"],
  "verify:harness-doc-sync-contract",
  "project harness chain must include harness doc sync contract",
);

console.log("harness doc sync contract: ok");

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

function assertIncludes(source, needle, message) {
  assert.equal(String(source).includes(needle), true, message);
}
```

- [ ] **Step 2: Add npm script**

Add:

```json
"verify:harness-doc-sync-contract": "node scripts/verify-harness-doc-sync-contract.mjs"
```

- [ ] **Step 3: Update project harness chain**

Change `harness:verify:project` to:

```json
"harness:verify:project": "npm run verify:project-harness-contract && npm run verify:documentation-entry-contract && npm run verify:visual-design-docs-contract && npm run verify:system-doc-template-contract && npm run verify:harness-doc-sync-contract && npm run harness:verify:quick"
```

- [ ] **Step 4: Add documentation contracts to pre-commit governance**

In `scripts/pre-commit-governance.mjs`, add these steps after release consistency:

```javascript
  {
    label: "verify-documentation-entry-contract",
    args: ["scripts/verify-documentation-entry-contract.mjs"],
  },
  {
    label: "verify-visual-design-docs-contract",
    args: ["scripts/verify-visual-design-docs-contract.mjs"],
  },
  {
    label: "verify-system-doc-template-contract",
    args: ["scripts/verify-system-doc-template-contract.mjs"],
  },
```

Do not add `verify-harness-doc-sync-contract` to pre-commit until the wiring commit is complete, because it asserts the wiring itself. It belongs in `harness:verify:project`.

- [ ] **Step 5: Update `verify-project-harness-contract.mjs`**

Add assertions:

```javascript
assert.match(
  scripts["harness:verify:project"],
  /verify:documentation-entry-contract/,
  "project harness should include documentation entry contract",
);
assert.match(
  scripts["harness:verify:project"],
  /verify:visual-design-docs-contract/,
  "project harness should include visual design docs contract",
);
assert.match(
  scripts["harness:verify:project"],
  /verify:system-doc-template-contract/,
  "project harness should include system doc template contract",
);
assert.match(
  scripts["harness:verify:project"],
  /verify:harness-doc-sync-contract/,
  "project harness should include harness doc sync contract",
);
```

- [ ] **Step 6: Update harness docs**

In `docs/systems/harness/README.md`, add:

```markdown
## Documentation Contract Commands

- `npm run verify:documentation-entry-contract`
- `npm run verify:visual-design-docs-contract`
- `npm run verify:system-doc-template-contract`
- `npm run verify:harness-doc-sync-contract`
```

In `docs/systems/harness/workspace-verify-release-map.md`, add the same commands under the documentation harness section.

- [ ] **Step 7: Run all new contracts**

Run:

```bash
npm run verify:documentation-entry-contract
npm run verify:visual-design-docs-contract
npm run verify:system-doc-template-contract
npm run verify:harness-doc-sync-contract
npm run verify:project-harness-contract
npm run harness:verify:project
```

Expected:

```text
documentation entry contract: ok
visual design docs contract: ok
system doc template contract: ok
harness doc sync contract: ok
project harness contract: ok
```

- [ ] **Step 8: Commit harness wiring**

Run:

```bash
git add package.json package-lock.json scripts/pre-commit-governance.mjs scripts/verify-project-harness-contract.mjs scripts/verify-harness-doc-sync-contract.mjs docs/systems/harness/README.md docs/systems/harness/workspace-verify-release-map.md
git commit -m "chore: wire documentation contracts into project harness"
```

## Task 9: Daily Log And Final Verification

**Files:**
- Modify: `docs/logbooks/daily/2026/2026-07/2026-07-06.md`

- [ ] **Step 1: Record the governance implementation**

Append a section:

```markdown
## Project Harness Documentation Governance

### Purpose

Prevent future agents or windows from losing the project documentation and harness logic.

### Completed

- Root entry responsibility matrix added.
- Root entries slimmed to summary and links.
- Canvas/frontend visual standards added.
- Admin visual standards and component policy added.
- System interface documentation template added.
- Documentation contracts added and wired into project harness.

### Verification

- `npm run verify:documentation-entry-contract`
- `npm run verify:visual-design-docs-contract`
- `npm run verify:system-doc-template-contract`
- `npm run verify:harness-doc-sync-contract`
- `npm run harness:verify:project`

### Remaining

- Ant Design 6 pilot is documented but not implemented in this batch.
- Full historical document migration remains gradual and should follow the root entry matrix.
```

- [ ] **Step 2: Run final verification**

Run:

```bash
git status --short
npm run verify:quick
npm run harness:verify:project
npm run verify:current-release-entry-consistency
```

Expected:

- `git status --short` only shows files for this batch before final commit.
- Verification commands exit with status 0.

- [ ] **Step 3: Commit final log**

Run:

```bash
git add docs/logbooks/daily/2026/2026-07/2026-07-06.md
git commit -m "docs(logbook): record harness documentation governance rollout"
```

- [ ] **Step 4: Confirm clean worktree**

Run:

```bash
git status --short
git log --oneline -5
```

Expected:

- `git status --short` prints nothing.
- Last commits match the planned commit boundaries.

## Self-Review Checklist

- Every requirement in the design spec has a task:
  - Root entry cleanup: Task 1.
  - Canvas visual standards: Task 2.
  - Admin visual standards and component library policy: Task 3.
  - Interface template: Task 4.
  - Contract scripts: Tasks 5 to 8.
  - Persistent execution guardrails: Tasks 8 and 9.
- No business code or ComfyUI feature work is included.
- Ant Design 6 is only documented as a future pilot; no package installation happens in this plan.
- Every contract has a package script and an expected success message.
- Final state requires a clean worktree.
