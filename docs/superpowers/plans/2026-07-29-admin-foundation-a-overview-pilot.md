# Admin Foundation A And Overview Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the canvas rollback through Gray, then deliver the shared Admin visual foundation in the read-only `/admin/overview` pilot without changing APIs, routes, permissions, data semantics, or refresh behavior.

**Architecture:** Keep the current route shell and page data loaders authoritative. Introduce only token mappings and shared presentation primitives that are reused by the overview pilot, then migrate the overview composition to those primitives. Release evidence is recorded only after old-server Gray runtime verification succeeds.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, CSS, Node release harness.

## Global Constraints

- Use `visual-foundation.md`, `admin-page-visual-audit.md`, both component registries, and the existing route shell before changing Admin UI.
- Target PC `1920x1080`; do not add a mobile-specific product surface.
- Preserve stable URLs, API contracts, permissions, data ownership, guarded/manual/live refresh policy, and dirty-state behavior.
- Use the deep-teal to sky-blue gradient only for shell, workspace identity, key summary, and one primary action; semantic states remain independent.
- Keep forms, tables, logs, errors, and long text on neutral surfaces; ensure IDs, URLs, and errors wrap safely.
- Do not modify the user's existing daily-log files unless their content is explicitly part of this batch.
- ComfyUI remains functionally frozen.

---

### Task 1: Close the canvas rollback Gray release

**Files:**
- Modify: root and workspace version manifests as required by the governed release command
- Create: `docs/logbooks/releases/gray/2026-07-29-canvas-reset-v086-r1.md`
- Create: `docs/logbooks/validations/2026-07-29-canvas-reset-v086-r1.md`
- Modify: `ops/current/release-state.json`, `ops/current/gray.md`, release index, and the visual audit/program only after runtime verification

- [x] Create a clean release worktree from `958ad75` and install its worktree hooks.
- [x] Bump the Gray patch version from `0.8.5` to `0.8.6`; prepare a governed old-server Gray archive.
- [x] Run `npm run verify:agent-environment-readiness-contract`, the release harness, and the release preflight in the clean worktree.
- [x] Deploy only with `--target-profile=old-server --env=gray`, then run the Gray verifier with expected version `0.8.6`.
- [x] Record actual command outcomes, archive hash, current/rollback release IDs, API/Worker status, and the user visual acceptance checklist. Do not claim browser acceptance before it occurs.

### Task 2: Define reusable Admin A-layer contracts

**Files:**
- Modify: `apps/admin/src/admin-common-components.tsx`
- Modify: `apps/admin/src/styles.css` and/or focused files under `apps/admin/src/styles/`
- Modify: `apps/admin/src/admin-common-components.test.ts` or an adjacent focused contract test
- Modify: `docs/systems/admin/frontend-design/visual-component-registry.md`

- [ ] Add a failing contract test for Foundation token use, a single workspace identity header, neutral data surfaces, and state semantics.
- [ ] Add the smallest reusable `AdminWorkspaceFrame` / summary-strip presentation API compatible with existing `AdminPageShell`, `AdminWorkspaceBand`, `AdminDataPanel`, `AdminTable`, and `StatusPill` call sites.
- [ ] Map existing Starlight variables to Foundation tokens in a focused shared stylesheet; do not append another global page skin.
- [ ] Run the focused contract test and `npm --workspace @xinghuan/admin run build`.
- [ ] Update the visual registry with the concrete source and interface, then commit the self-contained foundation change.

### Task 3: Migrate the read-only overview pilot

**Files:**
- Modify: `apps/admin/src/admin-overview-panel.tsx`
- Modify: focused overview styles under `apps/admin/src/styles/`
- Modify/Create: `apps/admin/src/admin-overview-panel.test.tsx`
- Modify: `docs/systems/admin/frontend-design/admin-page-visual-audit.md`

- [ ] Write a failing overview contract asserting one page H1, Foundation-backed summary strip, semantic alert treatment, and retained loading/empty/error rendering.
- [ ] Migrate only the overview layout to the shared A-layer primitives; retain its existing data loader inputs and refresh callbacks unchanged.
- [ ] Verify the focused test, Admin build, visual/token/registry contracts, and one `1920x1080` screenshot with no overflow, overlap, or double scrolling.
- [ ] Mark only `/admin/overview` as piloted in the Audit, record the template, tokens, long-text policy, and state treatment in the daily log, then commit.

### Task 4: Gray validate the Admin pilot and hand off B

**Files:**
- Modify: Gray release and validation record for the Admin pilot
- Modify: `ops/current/release-state.json`, `ops/current/gray.md`, release index
- Modify: `docs/systems/admin/frontend-design/redesign-program.md`

- [ ] Prepare a new patch Gray release in a clean worktree and deploy only to old-server Gray.
- [ ] Verify API/Worker readiness and inspect `/admin/overview` at `1920x1080` as an authenticated administrator.
- [ ] Record verified runtime evidence, visual acceptance, known residual risks, and update Program status to make the next B-batch scope explicit.
