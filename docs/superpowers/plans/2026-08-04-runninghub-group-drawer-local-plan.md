# RunningHub Group Drawer Local Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with checkpoints.

**Goal:** Remove the legacy full-screen blur/backdrop from the RunningHub group filter and keep the drawer, trigger, and item cards aligned inside the left rail.

**Architecture:** Keep group state and mutation handlers in `AdminRunningHubWorkspace`. Render the manager as a rail-local absolute layer and close it through Escape, close action, or a document-level outside pointer handler. The right editor and the rest of the admin page remain outside the drawer interaction boundary.

**Tech Stack:** React, TypeScript, existing Admin CSS, Vitest source-contract tests, Vite.

## Global Constraints

- Do not change group data, permission, CRUD, or filtering semantics.
- Do not render a full-screen backdrop or use `backdrop-filter` for this drawer.
- Preserve the shared rail width token and text density.
- Desktop visual acceptance target is `1920x1080`.
- Keep changes isolated to Admin RunningHub workspace and its focused tests/docs.

### Task 1: Change the failing contract tests

**Files:**
- Modify: `apps/admin/src/admin-runninghub-workspace.test.tsx`

**Interfaces:**
- Produces the assertions that the implementation must satisfy: no drawer backdrop, no modal semantics, rail-local drawer, Escape/outside-close behavior.

- [ ] Replace assertions requiring `.admin-runninghub-group-drawer__backdrop`, `position: fixed`, and `aria-modal="true"` with assertions that the workspace source has a rail-local `<aside>`, `onKeyDown`, `onPointerDown`/outside-close handling, and a close action.
- [ ] Add a source-contract assertion that `admin-runninghub-group-drawer__backdrop` is absent from the workspace source.
- [ ] Run `npx vitest run apps/admin/src/admin-runninghub-workspace.test.tsx`.
- [ ] Confirm the test fails because the current implementation still renders the backdrop and modal attribute.

### Task 2: Remove the global interaction layer

**Files:**
- Modify: `apps/admin/src/admin-runninghub-workspace.tsx`

- [ ] Remove the trailing full-screen backdrop element.
- [ ] Change the drawer from modal dialog semantics to `aside`/`role="region"` with a stable accessible label.
- [ ] Keep Escape handling on the drawer.
- [ ] Add a document-level pointer listener only while the drawer is open; ignore events inside the rail track and drawer, and close for events elsewhere without preventing the original click.
- [ ] Ensure the listener is cleaned up when the drawer closes or the component unmounts.
- [ ] Keep existing group select/create/delete/toggle callbacks unchanged.

### Task 3: Normalize local drawer styles

**Files:**
- Modify: `apps/admin/src/styles.css`

- [ ] Delete the `.admin-runninghub-group-drawer__backdrop` rule and its blur/background layer.
- [ ] Keep `.admin-runninghub-group-drawer--rail` absolutely positioned inside the rail track with the existing shared width boundary.
- [ ] Preserve opaque panel background, local border, local shadow, internal scrolling, and animation.
- [ ] Verify the drawer has no viewport-edge fixed positioning after the rail modifier is applied.

### Task 4: Verify and document

**Files:**
- Modify: `docs/systems/admin/ui-and-information-architecture.md` if the file contains the current RunningHub rail rule; otherwise add the rule to the appropriate existing Admin UI system document.

- [ ] Run `npx vitest run apps/admin/src/admin-runninghub-workspace.test.tsx`.
- [ ] Run `npm run type-check -w @xinghuan/admin` and `npm run build -w @xinghuan/admin`.
- [ ] Run `git diff --check` and the Admin layout contract relevant to the changed workspace.
- [ ] Run the desktop visual check at `1920x1080` and verify no blur or right-editor occlusion.
- [ ] Commit with `fix: remove RunningHub group drawer global blur`.

