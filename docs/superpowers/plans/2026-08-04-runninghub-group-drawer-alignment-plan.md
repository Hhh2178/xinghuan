# RunningHub Group Drawer Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Execute this plan task-by-task with test checkpoints.

**Goal:** Align the RunningHub group trigger, item cards, and anchored drawer to one shared left-rail content width and visual baseline.

**Architecture:** Keep the existing group state and callbacks in `AdminRunningHubWorkspace`. Add a shared rail track around the trigger/list region, move the trigger into the same scroll-width context as the item cards, and anchor the drawer to the rail instead of the viewport. Use one explicit content width token so the trigger and item cards cannot drift when the list scrollbar is present.

**Tech Stack:** React, TypeScript, existing Admin CSS, Vitest source-contract tests, Vite.

## Global Constraints

- The trigger, item cards, and drawer content must share the same left and right edges.
- The group drawer must open from the left rail near the trigger, not from the viewport edge.
- Existing group filtering, CRUD, enable/disable, delete, count, and permission semantics remain unchanged.
- Text sizes, line heights, and item-card copy density remain unchanged.
- Desktop acceptance target is `1920x1080`; no mobile-only layout is added.

### Task 1: Lock the shared rail track contract

**Files:**
- Modify: `apps/admin/src/admin-runninghub-workspace.test.tsx`

- [ ] Add source-contract assertions that the rail has a shared `admin-runninghub-workspace__rail-track`, the group trigger is inside that track, and the drawer uses rail anchoring classes rather than a viewport-edge-only layout.
- [ ] Run `npx vitest run apps/admin/src/admin-runninghub-workspace.test.tsx` and confirm the new assertions fail before implementation.

### Task 2: Restructure the rail and drawer anchor

**Files:**
- Modify: `apps/admin/src/admin-runninghub-workspace.tsx`

- [ ] Keep the rail title copy in the rail header, then render the group trigger and item list inside the shared rail track so both use the same content width.
- [ ] Preserve item selection and group trigger behavior; do not alter filtering or mutation callbacks.
- [ ] Add a rail-local anchor class to the existing drawer layer while preserving backdrop, Escape, close-button, and modal semantics.

### Task 3: Normalize width and alignment styles

**Files:**
- Modify: `apps/admin/src/styles.css`

- [ ] Make the rail track a two-row grid with the trigger above the independently scrolling item list.
- [ ] Remove the list-only width drift caused by its extra right padding; reserve scrollbar space consistently so the trigger and item cards end on the same x-coordinate.
- [ ] Position the drawer absolutely inside the rail content boundary, with the same width as the rail track, opaque background, and a local shadow; keep the backdrop full-screen and below the drawer.
- [ ] Preserve existing typography, row density, status dots, count pills, and icon hit areas.

### Task 4: Verify and commit

**Files:**
- Modify: `docs/systems/admin/ui-and-information-architecture.md`

- [ ] Document that the RunningHub group trigger, item cards, and drawer share a rail content track.
- [ ] Run focused tests, Admin type-check, Admin build, and the RunningHub workspace helper contract.
- [ ] Run `git diff --check`, stage the implementation and documentation, and commit with `fix: align RunningHub group drawer rail`.
