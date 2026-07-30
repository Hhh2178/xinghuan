# Admin Governance Rail And Resource Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 D 批治理工作台的桌面 rail 稳定固定并独立滚动，同时将公共资源类型/分类收敛到 rail、释放正文资源网格宽度。

**Architecture:** `AdminGovernanceLayout` 只新增可验证的 presentation marker，CSS 在 shared layout 层实现桌面 rail 契约和窄屏回退。公共资源仅重排已有控件：类型 selector 传入现有分类 sidebar，搜索保留在 editor toolbar；所有状态与 callbacks 仍由 panel 传递。

**Tech Stack:** React 19、TypeScript、Vitest、Vite、CSS Foundation tokens。

## Global Constraints

- 不改变 API、路由、权限、revision、dirty、确认或 mutation ownership。
- 桌面验收视窗固定为 `1920×1080`；不新增移动端功能。
- 不新增裸色值；只使用 Foundation token。
- 不触碰现有用户日常台账改动。

---

### Task 1: Shared governance rail contract

**Files:**
- Modify: `apps/admin/src/admin-governance-workbench.tsx`
- Modify: `apps/admin/src/styles/admin-governance-workbench.css`
- Test: `apps/admin/src/admin-governance-workbench.test.tsx`

**Interfaces:**
- Consumes: the existing optional `rail` slot in `AdminGovernanceLayout`.
- Produces: `data-workbench-scroll="rail"` on supplied rail slots; existing `data-workbench-slot` values remain unchanged.

- [x] **Step 1: Write the failing contract assertion**

```tsx
expect(fullLayout).toContain('data-workbench-scroll="rail"');
expect(editorOnly).not.toContain('data-workbench-scroll="rail"');
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `npm test -- apps/admin/src/admin-governance-workbench.test.tsx`

Expected: FAIL because the rail has no scroll marker.

- [x] **Step 3: Add the minimal shared presentation implementation**

```tsx
<aside className="admin-governance-layout__rail" data-workbench-slot="rail" data-workbench-scroll="rail">{rail}</aside>
```

Add desktop `position: sticky`, `top: var(--admin-sticky-offset)`, `max-height: calc(100vh - var(--admin-sticky-offset) - 20px)`, and `overflow-y: auto` to the shared rail. In the existing narrow breakpoint, reset those properties to normal document flow.

- [x] **Step 4: Run the focused test and Admin build**

Run: `npm test -- apps/admin/src/admin-governance-workbench.test.tsx && npm run build -w @xinghuan/admin`

Expected: PASS.

### Task 2: Public resource rail/editor reflow

**Files:**
- Modify: `apps/admin/src/admin-public-resources-panel.tsx`
- Modify: `apps/admin/src/admin-public-resource-category-sidebar.tsx`
- Modify: `apps/admin/src/styles/admin-governance-workbench.css`
- Test: `apps/admin/src/admin-resource-content-workbench.test.tsx`

**Interfaces:**
- Consumes: `ResourceKind`, `KIND_META`, `kind`, `setKind`, and existing category callbacks from `AdminPublicResourcesPanel`.
- Produces: a category sidebar that receives and renders the existing type selector; the editor toolbar retains only the labelled search control.

- [x] **Step 1: Write the failing layout ownership assertions**

```tsx
expect(markup).toContain('data-workbench-scroll="rail"');
expect(resourceSource).toContain('kind={kind}');
expect(resourceSource).toContain('onSelectKind={(nextKind) =>');
expect(resourceSource).toContain('label="公共资源搜索"');
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `npm test -- apps/admin/src/admin-resource-content-workbench.test.tsx`

Expected: FAIL because the sidebar has no type-selector interface and the editor toolbar has no search-only label.

- [x] **Step 3: Move only the existing selector markup into the rail**

```tsx
<AdminPublicResourceCategorySidebar
  kind={kind}
  kindMeta={KIND_META}
  onSelectKind={(nextKind) => { setKind(nextKind); setCategoryId("all"); }}
  // existing category props unchanged
/>
```

Render the existing `AdminBandTabButton` list ahead of categories inside the sidebar. Keep the search input in `AdminGovernanceToolbar label="公共资源搜索"`; remove the type selector from that toolbar. Give resource rail selectors a full-width, wrapping layout and let the grid occupy the editor track.

- [x] **Step 4: Run focused tests and documentation contracts**

Run: `npm test -- apps/admin/src/admin-resource-content-workbench.test.tsx apps/admin/src/admin-governance-workbench.test.tsx && npm run verify:visual-design-docs-contract && npm run verify:design-token-docs-contract && npm run verify:component-registry-docs-contract`

Expected: PASS.

### Task 3: Record local evidence and complete verification

**Files:**
- Modify: `docs/systems/admin/frontend-design/admin-page-visual-audit.md`
- Create: `docs/logbooks/daily/2026/2026-07/2026-07-30.md`

- [x] **Step 1: Record the implemented local boundary**

Add the fixed rail/resource reflow to the D local implementation section. State that Gray and authenticated desktop acceptance remain pending; do not mark D complete.

- [x] **Step 2: Add the daily evidence entry**

Create a dated entry listing implementation scope, completed local commands, and remaining Gray/1920×1080 acceptance.

- [x] **Step 3: Run the final local gate**

Run: `npm run build -w @xinghuan/admin && npm run verify:admin-resource-content-phase2 && npm run verify:visual-design-docs-contract && npm run verify:design-token-docs-contract && npm run verify:component-registry-docs-contract && git diff --check`

Expected: PASS with no unstaged edits to the user-owned July 28 logbook files.
