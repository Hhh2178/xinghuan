# Admin Configuration Workbench B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Provider/model, RunningHub, ComfyUI, runtime settings, and environment sync to one reusable Admin configuration-workbench visual contract without changing APIs, routes, permissions, refresh policy, revision checks, conflict decisions, or save/test behavior.

**Architecture:** Add a presentation-only configuration-workbench layer beside the A-layer foundation. Each existing page keeps ownership of data loading, drafts, validation, actions, and errors; the shared layer supplies neutral rail/editor/inspector surfaces, object context, summary/status treatment, and stable desktop geometry. Migrate one domain at a time with focused RED/GREEN contracts, then release the complete B batch to old-server Gray.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, CSS, Node release harness.

## Global Constraints

- Target PC `1920x1080`; do not add mobile or tablet product behavior.
- Preserve stable Admin URLs, API payloads, permissions, refresh policy, draft state, revision values, conflict decisions, save/reset/test callbacks, and error boundaries.
- Keep one page identity owned by the route shell. Domain-local headers describe the selected object or section and must not add another H1.
- Use the teal-to-sky gradient only for selected navigation, object context, summaries, and one primary action. Forms, tables, logs, raw output, errors, and destructive actions remain neutral or semantic.
- ComfyUI is visual-only: do not add or change instance, workflow, connector, tunnel, scheduling, or runtime behavior.
- Keep the user's modified July daily index and untracked July 28 log outside every commit.
- Every completed slice updates the visual Audit and the July 29 daily log; Gray state changes only after runtime verification.

---

### Task 1: Add the shared configuration-workbench contract

**Files:**
- Create: `apps/admin/src/admin-configuration-workbench.tsx`
- Create: `apps/admin/src/admin-configuration-workbench.test.tsx`
- Create: `apps/admin/src/styles/admin-configuration-workbench.css`
- Modify: `apps/admin/src/styles.css`
- Modify: `docs/systems/admin/frontend-design/visual-component-registry.md`

**Interfaces:**
- Produces `AdminConfigurationWorkbench`, `AdminConfigurationContext`, `AdminConfigurationLayout`, and `AdminConfigurationSaveBar`.
- The shared components accept presentation content only; they do not own data fetching, draft state, callbacks, navigation, or confirmation behavior.

- [ ] **Step 1: Write the failing render contract**

Assert that rendered markup exposes `data-admin-template="configuration"`, one object-context region, neutral rail/editor/inspector slots, and a save bar whose reset/save disabled states follow props.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- apps/admin/src/admin-configuration-workbench.test.tsx`
Expected: FAIL because the shared module does not exist.

- [ ] **Step 3: Implement the minimum presentation components and focused CSS**

Use A-layer tokens, `StatusPill`, slot-based children, and fixed desktop tracks. Do not add state or effects.

- [ ] **Step 4: Run focused test, Admin build, and design contracts**

Run: `npm test -- apps/admin/src/admin-configuration-workbench.test.tsx`
Run: `npm --workspace @xinghuan/admin run build`
Run: `npm run verify:visual-design-docs-contract`
Run: `npm run verify:component-registry-docs-contract`
Expected: all exit 0.

- [ ] **Step 5: Update the registry and commit**

Commit: `feat(admin): add configuration workbench foundation`

### Task 2: Migrate Provider and model configuration

**Files:**
- Modify: `apps/admin/src/admin-api-settings-panel.tsx`
- Create: `apps/admin/src/admin-api-settings-panel.test.tsx`
- Modify: `apps/admin/src/styles/admin-configuration-workbench.css`
- Modify: `docs/systems/admin/frontend-design/admin-page-visual-audit.md`
- Modify: `docs/logbooks/daily/2026/2026-07/2026-07-29.md`

**Interfaces:**
- Consumes the Task 1 presentation components.
- Keeps `ApiSettingsPanel` props, Provider/model API calls, `refresh`, selection, model dialogs, probe/fetch actions, and assistant draft application unchanged.

- [ ] **Step 1: Write a failing page contract**

Assert the Provider page uses the shared template, preserves provider rail and `activeView` sections, exposes selected Provider context, and keeps save/probe/fetch/model actions wired to their existing handlers.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- apps/admin/src/admin-api-settings-panel.test.tsx`
Expected: FAIL because the page has not adopted the shared template.

- [ ] **Step 3: Migrate only composition and classes**

Wrap the existing rail/content in shared slots, replace the inline identity block with object context, and keep all form fields, handlers, dialogs, result panels, and model editor behavior unchanged.

- [ ] **Step 4: Run focused tests and Admin build**

Run: `npm test -- apps/admin/src/admin-api-settings-panel.test.tsx apps/admin/src/admin-configuration-workbench.test.tsx`
Run: `npm --workspace @xinghuan/admin run build`
Expected: all exit 0.

- [ ] **Step 5: Update Audit/daily evidence and commit**

Commit: `feat(admin): migrate provider configuration workbench`

### Task 3: Migrate RunningHub configuration

**Files:**
- Modify: `apps/admin/src/admin-runninghub-workspace.tsx`
- Modify: `apps/admin/src/admin-runninghub-item-editor.tsx`
- Create: `apps/admin/src/admin-runninghub-workspace.test.tsx`
- Modify: `apps/admin/src/styles/admin-configuration-workbench.css`
- Modify: `docs/systems/admin/frontend-design/admin-page-visual-audit.md`
- Modify: `docs/logbooks/daily/2026/2026-07/2026-07-29.md`

**Interfaces:**
- Keeps RH directory loading, create/save/delete/duplicate/toggle/test/analyze APIs, local tab selection, key-pool behavior, and input/schema/output validation unchanged.
- Uses shared rail/editor/inspector geometry while retaining `AdminRunningHubItemEditor` as the authoritative editor.

- [ ] **Step 1: Write and run a RED contract for shared template adoption and retained handlers**
- [ ] **Step 2: Migrate the hero, stats, directory, editor, analysis, and key-pool surfaces without changing callbacks**
- [ ] **Step 3: Run focused RH tests and Admin build**
- [ ] **Step 4: Update Audit/daily evidence and commit `feat(admin): migrate runninghub configuration workbench`**

### Task 4: Visually converge ComfyUI without functional changes

**Files:**
- Modify: `apps/admin/src/admin-comfyui-overview.tsx`
- Modify: `apps/admin/src/admin-comfyui-detail.tsx`
- Create: `apps/admin/src/admin-comfyui-visual-contract.test.tsx`
- Modify: `apps/admin/src/styles/admin-configuration-workbench.css`
- Modify: `docs/systems/admin/frontend-design/admin-page-visual-audit.md`
- Modify: `docs/logbooks/daily/2026/2026-07/2026-07-29.md`

**Interfaces:**
- Preserves every ComfyUI API call and component prop.
- Replaces the duplicate page band, bespoke health pills, summary cards, and detail header skin with shared context/summary/status treatment only.

- [ ] **Step 1: Write and run a RED source/render contract proving shared visual adoption and unchanged API call count**
- [ ] **Step 2: Migrate overview and detail presentation only**
- [ ] **Step 3: Run focused tests and Admin build**
- [ ] **Step 4: Update Audit/daily evidence and commit `feat(admin): converge comfyui configuration visuals`**

### Task 5: Migrate runtime settings and environment sync

**Files:**
- Modify: `apps/admin/src/admin-readonly-panels.tsx`
- Modify: `apps/admin/src/admin-environment-sync-panel.tsx`
- Create: `apps/admin/src/admin-system-configuration.test.tsx`
- Modify: `apps/admin/src/styles/admin-configuration-workbench.css`
- Modify: `docs/systems/admin/frontend-design/admin-page-visual-audit.md`
- Modify: `docs/logbooks/daily/2026/2026-07/2026-07-29.md`

**Interfaces:**
- Keeps `SystemPanel` props, task queue payload shape, revision forwarding, preview/apply confirmation, selected rows, conflict decisions, and audit result rendering unchanged.
- Adds explicit draft/synchronized presentation and shared configuration geometry without changing when writes occur.

- [ ] **Step 1: Write and run a RED contract for revision/conflict/action preservation and shared template adoption**
- [ ] **Step 2: Migrate runtime settings and environment sync composition**
- [ ] **Step 3: Run focused tests, Admin build, and design/authority contracts**
- [ ] **Step 4: Update Audit/daily evidence and commit `feat(admin): migrate system configuration workbenches`**

### Task 6: Validate and release B to old-server Gray

**Files:**
- Create: `docs/logbooks/releases/gray/2026-07-29-admin-configuration-b-v0810-r1.md`
- Create: `docs/logbooks/validations/2026-07-29-admin-configuration-b-v0810-r1.md`
- Modify: `package.json`, `package-lock.json`
- Modify: `ops/current/release-state.json`, `ops/current/gray.md`, `ops/README.md`
- Modify: `docs/logbooks/releases/current-release-index.md`
- Modify: `docs/memory/current-state.md`
- Modify: `docs/systems/admin/frontend-design/redesign-program.md`

**Interfaces:**
- Produces patch release `0.8.10`; the governed release command determines the archive identity.
- Does not deploy Production, run billed canaries, or apply retention without separate authorization.

- [ ] **Step 1: Run focused tests, full tests, Admin build, release harness, document contracts, hotspot gates, and staged guards**
- [ ] **Step 2: Prepare and deploy only with `--target-profile=old-server --env=gray`**
- [ ] **Step 3: Verify API/Worker, public/internal version and environment, permission readiness, and authenticated `1920x1080` pages for Provider/model, RH, ComfyUI, runtime settings, and environment sync**
- [ ] **Step 4: Record evidence, update canonical state, mark B complete/C active, and commit release records**
