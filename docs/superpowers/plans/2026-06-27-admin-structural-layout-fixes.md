# Admin Structural Layout Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the admin backend structural layout regressions where create forms are squeezed by generic grids, API settings layers overlap parent capability tabs, and public resource cards stretch/crop previews.

**Architecture:** Add explicit layout variants to shared admin panels instead of relying on nested generic `.form-grid` behavior. Flatten the API settings page into a single contained two-column workbench with no floating overlay behavior. Make public resource cards fixed-width grid items and let image previews keep natural proportional height inside the card.

**Tech Stack:** React, TypeScript, CSS, project contract scripts, Vite admin build.

---

### Task 1: Single-column Create Form Panels

**Files:**
- Modify: `apps/admin/src/admin-common-components.tsx`
- Modify: `apps/admin/src/admin-user-accounts-section.tsx`
- Modify: `apps/admin/src/admin-user-groups-section.tsx`
- Modify: `apps/admin/src/styles.css`
- Modify: `scripts/verify-admin-layout-overlap-fixes-contract.mjs`

- [ ] Add `bodyClassName` support to `FormPanel`.
- [ ] Pass `bodyClassName="form-grid form-grid--stack"` from the account and group create panels.
- [ ] Add CSS for `.form-grid--stack` so it always uses one column.
- [ ] Ensure `users-create-stack-card` and `users-group-create-card` are grid-column full width.
- [ ] Extend the layout contract to check that the stacked form variant is used.

### Task 2: API Settings Non-overlay Workbench

**Files:**
- Modify: `apps/admin/src/admin-api-settings-panel.tsx`
- Modify: `apps/admin/src/styles.css`
- Modify: `scripts/verify-admin-api-layout-contract.mjs`

- [ ] Remove the duplicate API settings section header inside `ApiSettingsPanel`.
- [ ] Add a compact content header that does not duplicate the parent page tab/hero.
- [ ] Change `.api-settings-page` from nested fixed grid with transparent background to a single block container.
- [ ] Change `.api-settings-layout` to a normal two-column workbench without `overflow: hidden` clipping or overlay behavior.
- [ ] Make `.provider-rail` normal document-flow content with no `position`, `top`, z-index, or floating-like behavior.
- [ ] Keep only the main admin page as the scrolling owner where possible.
- [ ] Extend the API layout contract to reject overlay-prone provider rail and duplicated page header patterns.

### Task 3: Fixed-width Public Resource Cards With Natural Image Height

**Files:**
- Modify: `apps/admin/src/styles.css`
- Modify: `scripts/verify-admin-layout-overlap-fixes-contract.mjs`
- Modify: `scripts/verify-admin-resource-content-phase2-contract.mjs`

- [ ] Change `.admin-public-resources-grid` to fixed card columns such as `repeat(auto-fill, 250px)` with `justify-content: start`.
- [ ] Set `.admin-public-resource-card` width to the same fixed card width and stop stretching to `1fr`.
- [ ] Remove fixed/clamped height from image preview stages.
- [ ] Let image previews render at `width: 100%; height: auto; object-fit: contain`.
- [ ] Keep video/audio previews bounded with a stable aspect ratio so controls do not collapse.
- [ ] Extend contracts to ensure public resources do not use `1fr` card stretching and images do not use fixed-height crop behavior.

### Task 4: Verification, Version, and Logbook

**Files:**
- Modify: `docs/logbooks/daily/2026/2026-06/2026-06-27.md`

- [ ] Run focused contracts for admin layout, API layout, public resources, and resource content.
- [ ] Run admin build.
- [ ] Update daily logbook with root cause and verification evidence.
- [ ] Prepare a new gray release only after local verification passes.

