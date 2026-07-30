# Admin Rail Single-Owner Footer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop configuration rails from double-sticking and remove footer color blocks from Provider and RunningHub catalog rails.

**Architecture:** `AdminConfigurationLayout` remains the sole viewport-positioned rail. Provider and RunningHub rail contents fill that bounded layout using grid; their lists own only vertical overflow. Footer chrome stays structurally identical but has no independent gradient surface.

**Tech Stack:** React, TypeScript, CSS Grid, Vitest, Vite.

## Global Constraints

- Desktop acceptance viewport is exactly `1920x1080`.
- Do not alter Provider, RunningHub, permission, data or runtime APIs.
- Gray deploy precedes Production; Production reuses the same `0.8.14` release archive.

---

### Task 1: Lock rail and footer CSS behaviour

**Files:**
- Modify: `apps/admin/src/admin-api-settings-panel.test.tsx`
- Modify: `apps/admin/src/admin-runninghub-workspace.test.tsx`
- Modify: `apps/admin/src/styles.css`
- Modify: `apps/admin/src/styles/admin-configuration-workbench.css`

**Interfaces:**
- Consumes: `AdminConfigurationLayout` rail height and sticky position contract.
- Produces: a single outer sticky rail with scrollable list bodies and transparent action footers.

- [ ] **Step 1: Write the failing source contracts**

```ts
expect(providerStyles).not.toContain(".provider-rail {\\n  position: sticky");
expect(providerStyles).not.toContain(".provider-rail-footer {\\n  background:");
expect(providerStyles).not.toContain(".admin-runninghub-workspace__rail-footer {\\n  background:");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/admin/src/admin-api-settings-panel.test.tsx apps/admin/src/admin-runninghub-workspace.test.tsx`

Expected: FAIL because both inner rails still own sticky positioning and both footers have gradients.

- [ ] **Step 3: Write minimal implementation**

```css
.provider-rail,
.admin-runninghub-workspace__rail {
  position: static;
  height: 100%;
  max-height: none;
}

.provider-rail-footer,
.admin-runninghub-workspace__rail-footer {
  background: transparent;
}
```

- [ ] **Step 4: Run tests and Admin build**

Run: `npm test -- apps/admin/src/admin-api-settings-panel.test.tsx apps/admin/src/admin-runninghub-workspace.test.tsx && npm --workspace @xinghuan/admin run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/admin-api-settings-panel.test.tsx apps/admin/src/admin-runninghub-workspace.test.tsx apps/admin/src/styles.css apps/admin/src/styles/admin-configuration-workbench.css docs/superpowers/specs/2026-07-30-admin-rail-single-owner-footer-design.md docs/superpowers/plans/2026-07-30-admin-rail-single-owner-footer-implementation.md
git commit -m "fix(admin): unify configuration rail scrolling"
```

### Task 2: Release and verify

**Files:**
- Modify: `docs/logbooks/releases/gray/2026-07-30-admin-rail-single-owner-footer-v0814-r1.md`
- Modify: `docs/logbooks/releases/production/2026-07-30-admin-rail-single-owner-footer-v0814-r1.md`
- Modify: `docs/logbooks/validations/2026-07-30-admin-rail-single-owner-footer-v0814-r1.md`
- Modify: `ops/current/release-state.json`

**Interfaces:**
- Consumes: release archive and `release:gray:verify` / production profile verification.
- Produces: synchronized current release records for both environments.

- [ ] **Step 1: Prepare one `0.8.14` archive**

Run: `npm run release:gray:prepare -- --release=20260730-admin-rail-single-owner-footer-v0814-r1`

- [ ] **Step 2: Deploy Gray and verify runtime**

Run: `npm run release:gray:deploy -- --target-profile=old-server --env=gray ...` followed by `npm run release:gray:verify -- --target-profile=old-server --env=gray --expected-version=0.8.14 --expected-environment=gray`.

- [ ] **Step 3: Deploy the identical archive to Production and verify runtime**

Run: `npm run release:gray:deploy -- --target-profile=old-server --env=production ...` followed by `npm run release:gray:verify -- --target-profile=old-server --env=production --expected-version=0.8.14 --expected-environment=production`.

- [ ] **Step 4: Record release evidence and current state**

Run: release-logbook and current-entry consistency checks.
