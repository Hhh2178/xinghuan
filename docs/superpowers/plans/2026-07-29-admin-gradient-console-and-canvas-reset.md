# Admin 渐变科技操作台与画布表现层回撤 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除无效的画布节点新版与切换器，仅保留现代侧边栏，并建立受 Harness 约束的 Admin 全域渐变科技风视觉治理基线。

**Architecture:** Canvas 从应用和节点运行面移除 visual variant，Sidebar 独立成为默认 hover rail。Admin 不直接逐页换肤：先建立 Foundation、Audit、Program 三份权威资料并把它们接入现有设计索引和视觉文档契约；后续各工作域只能从该基础层复用 Token 和组件。

**Tech Stack:** React 19、TypeScript、Vite、Vitest、Zustand、CSS、Node.js Harness。

## Global Constraints

- 默认只验收 PC 1920×1080；不新增移动端专用交互。
- 不改 API、Worker、Provider、权限、数据模型、任务链路和稳定 Admin URL。
- Canvas 只保留悬浮 rail；不得保留用户级旧版/新版选择或节点 modern CSS。
- Admin 使用深海青到天蓝的受控渐变；success/warning/danger 继续独立表达语义。
- 所有 Admin UI 变更先读 `visual-foundation.md`、`admin-page-visual-audit.md`、`redesign-program.md` 和组件注册表。
- 用户已有日常台账改动不纳入本轮提交。

---

### Task 1: 建立并守卫 Admin 视觉治理入口

**Files:**

- Create: `docs/systems/admin/frontend-design/visual-foundation.md`
- Create: `docs/systems/admin/frontend-design/admin-page-visual-audit.md`
- Create: `docs/systems/admin/frontend-design/redesign-program.md`
- Modify: `DESIGN.md`
- Modify: `docs/INDEX.md`
- Modify: `docs/systems/admin/frontend-design/README.md`
- Modify: `scripts/verify-visual-design-docs-contract.mjs`
- Test: `scripts/verify-visual-design-docs-contract.mjs`

**Interfaces:**

- Produces `Foundation/Audit/Program` documents and root/Admin README index links.
- Produces contract assertions for the three files and the mandatory reading order.

- [ ] **Step 1: Write the failing contract assertions**

```js
const adminFoundation = await read("docs/systems/admin/frontend-design/visual-foundation.md");
const adminAudit = await read("docs/systems/admin/frontend-design/admin-page-visual-audit.md");
const adminProgram = await read("docs/systems/admin/frontend-design/redesign-program.md");
assertIncludes(adminReadme, "visual-foundation.md", "admin README must link visual foundation");
assertIncludes(adminReadme, "admin-page-visual-audit.md", "admin README must link visual audit");
assertIncludes(adminReadme, "redesign-program.md", "admin README must link redesign program");
```

- [ ] **Step 2: Run the contract to verify it fails**

Run: `node scripts/verify-visual-design-docs-contract.mjs`  
Expected: FAIL because the governance documents do not exist or are not indexed.

- [ ] **Step 3: Write the minimum governance documents and indexes**

```md
## Mandatory reading order
1. `visual-foundation.md`
2. `admin-page-visual-audit.md`
3. `redesign-program.md`
4. visual and functional component registries
```

Document semantic gradient limits, exact type scale, work-domain audit matrix, target templates, risk rules, phased rollout, and source-of-truth hierarchy.

- [ ] **Step 4: Run the contract to verify it passes**

Run: `node scripts/verify-visual-design-docs-contract.mjs`  
Expected: `visual design docs contract: ok`.

- [ ] **Step 5: Commit**

```bash
git add DESIGN.md docs/INDEX.md docs/systems/admin/frontend-design scripts/verify-visual-design-docs-contract.mjs
git commit -m "docs(admin): establish gradient console visual governance"
```

### Task 2: Remove the canvas presentation switch and restore the original runtime surface

**Files:**

- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/Canvas.tsx`
- Modify: `apps/web/src/components/Sidebar.tsx`
- Modify: `apps/web/src/styles/canvas-modern.css`
- Modify: `apps/web/src/styles/index.css`
- Delete: `apps/web/src/components/CanvasPresentationToggle.tsx`
- Delete: `apps/web/src/components/CanvasPresentationToggle.test.tsx`
- Delete: `apps/web/src/stores/canvasPresentation.ts`
- Delete: `apps/web/src/stores/canvasPresentation.test.ts`
- Delete: `apps/web/src/components/CanvasPresentation.test.ts`
- Modify: `apps/web/src/styles/canvas-modern.test.ts`

**Interfaces:**

- Produces a Sidebar without `presentation` prop and with default `t8-sidebar--modern` class.
- Produces Canvas without `CanvasPresentation` prop, `data-canvas-presentation`, or a modern-only Background color.

- [ ] **Step 1: Write failing boundary tests**

```ts
expect(appSource).not.toContain('CanvasPresentationToggle');
expect(appSource).not.toContain('data-canvas-presentation');
expect(canvasSource).not.toContain('presentation?: CanvasPresentation');
expect(sidebarSource).not.toContain('presentation?: CanvasPresentation');
expect(sidebarSource).toContain('const isModern = true');
expect(modernStyles).not.toContain("data-canvas-presentation='modern'");
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- apps/web/src/styles/canvas-modern.test.ts`  
Expected: FAIL because switch and presentation props are still present.

- [ ] **Step 3: Apply the smallest rollback**

Remove the toggle/store/presentation boundary, make Sidebar’s modern rail unconditional, and scope only Sidebar CSS to `.t8-sidebar--modern`.

- [ ] **Step 4: Run focused test to verify it passes**

Run: `npm test -- apps/web/src/styles/canvas-modern.test.ts`  
Expected: PASS with rail-only modern styling and no presentation selection surface.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/components/Canvas.tsx apps/web/src/components/Sidebar.tsx apps/web/src/styles
git commit -m "fix(canvas): retain sidebar and remove presentation switch"
```

### Task 3: Remove modern node overrides without changing node behavior

**Files:**

- Modify: `apps/web/src/components/nodes/ImageNode.tsx`
- Modify: `apps/web/src/components/nodes/VideoNode.tsx`
- Modify: `apps/web/src/components/nodes/LLMNode.tsx`
- Modify: `apps/web/src/components/nodes/GenerationNodes.presentation.test.ts`
- Modify: `apps/web/src/styles/index.css`
- Delete: `apps/web/src/styles/node-modern.css`
- Delete: `apps/web/src/styles/node-modern.test.ts`

**Interfaces:**

- Produces existing generation-node root markup without `data-node-presentation="generation"`, `data-node-kind`, `data-node-zone`.
- Preserves node payloads, local state, callbacks, material handling and task submission functions.

- [ ] **Step 1: Write failing regression test**

```ts
for (const source of [image, video, llm]) {
  expect(source).not.toContain('data-node-presentation="generation"');
  expect(source).not.toContain('data-node-kind=');
  expect(source).not.toContain('data-node-zone=');
}
expect(indexStyles).not.toContain("@import './node-modern.css';");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- apps/web/src/components/nodes/GenerationNodes.presentation.test.ts`  
Expected: FAIL because modern markers and stylesheet import exist.

- [ ] **Step 3: Remove only presentation markers and stylesheet**

Keep original node props, local state, callbacks, material selection and submission logic unchanged.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- apps/web/src/components/nodes/GenerationNodes.presentation.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/nodes apps/web/src/styles/index.css
git commit -m "fix(canvas): remove ineffective modern node overrides"
```

### Task 4: Verify and prepare Gray release

**Files:**

- Create: `docs/logbooks/validations/2026-07-29-admin-visual-governance-and-canvas-reset.md`
- Modify: `docs/logbooks/releases/gray/<release>.md`
- Modify: `ops/current/release-state.json`
- Modify: `ops/current/gray.md`

**Interfaces:**

- Consumes Canvas rollback and visual governance contract.
- Produces Gray release evidence after runtime verification.

- [ ] **Step 1: Run deterministic checks**

Run:

```bash
npm test
npm --workspace @xinghuan/web run build
npm --workspace @xinghuan/admin run build
npm run verify:visual-design-docs-contract
npm run verify:design-token-docs-contract
```

Expected: all exit 0.

- [ ] **Step 2: Record verification evidence before deployment**

Document focused/full test counts, build results, scope statement, and user acceptance points: side rail, existing/new nodes, MiniMap, Admin visual foundation index.

- [ ] **Step 3: Prepare and deploy the next patch version to old-server Gray**

Use governed Gray package, deployment, and verification commands with `--target-profile=old-server --env=gray`. Do not deploy Production.

- [ ] **Step 4: Run post-deploy verifier**

Run: `npm run release:gray:verify -- --target-profile=old-server --env=gray ...`  
Expected: API and Worker active; public/internal version, environment and permission readiness match release state.

- [ ] **Step 5: Commit release records**

```bash
git add docs/logbooks ops/current
git commit -m "docs(release): record canvas reset gray verification"
```
