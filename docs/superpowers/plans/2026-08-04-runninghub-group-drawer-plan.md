# RunningHub Group Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Execute this plan task-by-task with test checkpoints.

**Goal:** Move RunningHub group management into an opaque, modal drawer so the item rail keeps its full readable width and never has group controls layered over item cards.

**Architecture:** Keep `selectedGroupId` and all existing mutation handlers in `AdminRunningHubWorkspace`. Render a compact filter trigger in the rail header and render `AdminRunningHubGroupManager` only inside a fixed-position drawer with an opaque panel, backdrop, close semantics, and its own scroll area. Preserve the existing group manager data and callbacks; change only composition, accessibility, and visual boundaries.

**Tech Stack:** React, TypeScript, lucide-react, existing Admin CSS, Vitest source-contract tests, Vite build.

## Global Constraints

- Group management must not occupy permanent item-list width or height.
- The drawer must use an opaque panel and backdrop; background item cards must not be operable while open.
- Existing group CRUD, enable/disable, delete, count, and filtering behavior must remain unchanged.
- Desktop acceptance target is 1920x1080; do not add mobile-only layout.
- Do not change API, permission, or catalog data semantics.

### Task 1: Lock the drawer composition contract

**Files:**
- Modify: `apps/admin/src/admin-runninghub-workspace.test.tsx`

**Interfaces:**
- Consumes: current `AdminRunningHubWorkspace` source and `styles.css` source.
- Produces: failing source-contract assertions for drawer trigger, backdrop, close semantics, and removal of the group manager from the permanent rail flow.

- [ ] **Step 1: Write the failing assertions**

Add assertions that the workspace source contains `admin-runninghub-group-trigger`, `admin-runninghub-group-drawer`, `aria-modal=\"true\"`, and `onKeyDown`, and that the permanent rail composition no longer places `<AdminRunningHubGroupManager` before `admin-runninghub-workspace__list-body`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx vitest run apps/admin/src/admin-runninghub-workspace.test.tsx`

Expected: FAIL because the current workspace has no drawer trigger, drawer, or close handling.

### Task 2: Implement the drawer composition

**Files:**
- Modify: `apps/admin/src/admin-runninghub-workspace.tsx`
- Modify: `apps/admin/src/admin-runninghub-group-manager.tsx`

**Interfaces:**
- Consumes: existing `groups`, `scopedItems`, `selectedGroupId`, `handleCreateGroup`, `handleDeleteGroup`, and `handleToggleGroup` callbacks.
- Produces: `AdminRunningHubWorkspace` with `groupDrawerOpen` state, trigger label/count, backdrop and drawer close behavior; `AdminRunningHubGroupManager` as drawer-only content.

- [ ] **Step 1: Add drawer state and close behavior**

Add `groupDrawerOpen` state. Add an effect that listens for `Escape` only while open and closes the drawer. Add `closeGroupDrawer` and make selection close the drawer after calling `setSelectedGroupId`.

- [ ] **Step 2: Replace permanent group manager markup**

Remove the inline `<AdminRunningHubGroupManager>` from the rail flow. Add a compact trigger in `.admin-runninghub-workspace__rail-head` showing the current group label and scoped count. Render the manager in a sibling drawer layer with a backdrop, close button, `role=\"dialog\"`, `aria-modal=\"true\"`, and `onKeyDown` close handling.

- [ ] **Step 3: Make group rows semantically compact**

Keep existing callbacks but render status as a dot/label instead of appending `· 已停用` to the title. Use lucide icons for close, enable/disable, and delete actions with `title` and `aria-label`.

- [ ] **Step 4: Run the focused test**

Run: `npx vitest run apps/admin/src/admin-runninghub-workspace.test.tsx`

Expected: PASS.

### Task 3: Add drawer and trigger styles

**Files:**
- Modify: `apps/admin/src/styles.css`

**Interfaces:**
- Consumes: the class names emitted by Tasks 2.
- Produces: fixed opaque drawer, backdrop, independent group scroll, compact trigger, and preserved item-card width.

- [ ] **Step 1: Add layout styles**

Style the trigger as a compact control in the rail header; style `.admin-runninghub-group-drawer` as `position: fixed` with a stable width near `300px`, high z-index, opaque background, border, and shadow; style the backdrop as a full viewport fixed layer beneath the drawer; give the drawer body independent vertical scrolling.

- [ ] **Step 2: Style group rows and states**

Add explicit row grid columns for label/count/actions, selected left accent, disabled status dot, icon-button hit areas, and no text overflow into adjacent controls.

- [ ] **Step 3: Run Admin type-check and focused tests**

Run: `npx vitest run apps/admin/src/admin-runninghub-workspace.test.tsx && npm run type-check -w @xinghuan/admin`

Expected: PASS.

### Task 4: Verify, document, and commit

**Files:**
- Modify: `apps/admin/src/admin-runninghub-workspace.test.tsx` if final contract wording needs tightening.

**Interfaces:**
- Consumes: completed drawer implementation.
- Produces: verified Admin bundle and a clean commit ready for Gray packaging.

- [ ] **Step 1: Run focused Admin tests**

Run: `npx vitest run apps/admin/src/admin-runninghub-workspace.test.tsx apps/admin/src/admin-runninghub-workspace-helpers.test.tsx`

- [ ] **Step 2: Run Admin build and relevant contracts**

Run: `npm run build -w @xinghuan/admin && npm run verify:admin-runninghub-workspace-helper-split-contract && npm run verify:admin-runninghub-workspace`

- [ ] **Step 3: Commit implementation**

```bash
git add apps/admin/src/admin-runninghub-workspace.tsx apps/admin/src/admin-runninghub-group-manager.tsx apps/admin/src/admin-runninghub-workspace.test.tsx apps/admin/src/styles.css
git commit -m "fix: redesign RunningHub group filter drawer"
```

- [ ] **Step 4: Run full release preparation before Gray**

After the implementation commit, bump the patch version from `0.8.19` to `0.8.20`, rebuild, package a new Gray archive, deploy it to the authorized old-server Gray target, run runtime verification, and perform a 1920x1080 visual check if the browser runtime is available.
