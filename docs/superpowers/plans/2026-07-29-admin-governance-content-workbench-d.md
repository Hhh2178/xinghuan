# Admin Governance And Content Workbench D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Admin visual redesign by migrating organization, security, shared resources, announcements, and automation to one governance/content workbench family without moving data, permission, revision, confirmation, or mutation ownership.

**Architecture:** Add a presentation-only `AdminGovernanceWorkbench` family beside the existing configuration and data templates. Existing route panels continue to own state and operations; each D surface supplies context, controls, rail/editor/Inspector composition, and risk feedback to the shared shell. Migrate one ownership cluster per commit, then release the complete D batch to old-server Gray.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, server rendering tests, CSS modules imported by `styles.css`, Node.js contract verifiers, Playwright CLI.

## Global Constraints

- Active coding root is `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean`; preserve the user's modified July daily index and untracked July 28 log.
- Desktop-only acceptance uses exactly `1920x1080`; do not add mobile/tablet scope.
- Do not change stable URLs, lazy-loader ownership, API endpoints, server-side repositories, permission authority, revision forwarding, confirmations, upload semantics, approval writes, polling, or refresh policies.
- High-risk delete, publish, archive, revoke, deny, approval, and recovery actions keep their current confirmations and server checks.
- Do not add shared abstractions for one-off markup. The shared layer may own only template markers, context, layout slots, toolbar grouping, and presentation semantics.
- Add D styles to `apps/admin/src/styles/admin-governance-workbench.css`; do not append the shared template to the 10,000-line `styles.css` hotspot.
- Do not deploy Production, run billed canaries, apply retention, or print/commit credentials.
- Each completed task updates the visual Audit and July 29 daily log. Canonical Gray state changes only after runtime and browser acceptance.
- Baseline note: `verify:admin-resource-content-phase2` currently fails because it still expects the retired combined resource/content workspace. Task 3 must update that contract to the accepted ten-domain information architecture while preserving resource and announcement behavior assertions.

---

### Task 1: Add The Shared Governance And Content Template

**Files:**
- Create: `apps/admin/src/admin-governance-workbench.tsx`
- Create: `apps/admin/src/admin-governance-workbench.test.tsx`
- Create: `apps/admin/src/styles/admin-governance-workbench.css`
- Modify: `apps/admin/src/main.tsx`
- Modify: `docs/systems/admin/frontend-design/visual-component-registry.md`
- Modify: `docs/systems/admin/frontend-design/admin-page-visual-audit.md`
- Modify: `docs/logbooks/daily/2026/2026-07/2026-07-29.md`

**Interfaces:**
- Produces `AdminGovernanceWorkbench({ label, mode, className?, children })` with `mode: "governance" | "content" | "automation"`, `data-admin-template="governance"`, and `data-governance-mode`.
- Produces `AdminGovernanceContext({ eyebrow, title, description?, status?, actions?, meta?, className? })` using the existing `StatusTone` and `StatusPill`.
- Produces `AdminGovernanceLayout({ rail?, children, inspector?, className? })` with only the supplied slots rendered.
- Produces `AdminGovernanceToolbar({ label, className?, children })` as an unframed accessible control group.
- Must not own route state, dirty state, API calls, confirmation, navigation, filters, or save behavior.

- [x] **Step 1: Write the failing server-render tests**

```tsx
expect(renderToStaticMarkup(
  <AdminGovernanceWorkbench label="组织治理" mode="governance"><span>body</span></AdminGovernanceWorkbench>,
)).toContain('data-admin-template="governance"');
expect(markup).toContain('data-governance-mode="content"');
expect(markup).toContain('data-workbench-slot="rail"');
expect(markup).toContain('data-workbench-slot="editor"');
expect(markup).toContain('data-workbench-slot="inspector"');
expect(toolbarMarkup).toContain('role="group"');
```

- [x] **Step 2: Run RED**

Run: `npm test -- apps/admin/src/admin-governance-workbench.test.tsx`
Expected: fail because the module does not exist.

- [x] **Step 3: Implement the presentation-only components and CSS**

Use Foundation tokens for the allowed context gradient, neutral rail/editor/Inspector surfaces, 8px maximum panel radius, 40px controls, stable desktop grid tracks, wrapping technical text, focus-visible outlines, and reduced-motion behavior. Import the module near the existing Foundation/configuration/data imports in `main.tsx`.

- [x] **Step 4: Update registry, Audit, and daily evidence**

Register the four components as presentation-only and record the template, token source, long-text policy, loading/empty/error expectations, and risk-action boundary.

- [x] **Step 5: Run GREEN and commit**

```text
npm test -- apps/admin/src/admin-governance-workbench.test.tsx
npm run build -w @xinghuan/admin
npm run verify:visual-design-docs-contract
npm run verify:design-token-docs-contract
npm run verify:component-registry-docs-contract
git diff --check
```

Commit: `feat(admin): add governance workbench foundation`

### Task 2: Migrate Organization And Security

**Files:**
- Create: `apps/admin/src/admin-users-governance-workbench.test.tsx`
- Modify: `apps/admin/src/admin-users-panel.tsx`
- Modify: `apps/admin/src/admin-user-accounts-section.tsx`
- Modify: `apps/admin/src/admin-user-groups-section.tsx`
- Modify: `apps/admin/src/admin-user-sessions-section.tsx`
- Modify: `apps/admin/src/permission-platform/panel.tsx`
- Modify: `apps/admin/src/styles/admin-governance-workbench.css`
- Modify: `scripts/verify-admin-users-panel-contract.mjs`
- Modify: `docs/systems/admin/frontend-design/admin-page-visual-audit.md`
- Modify: `docs/logbooks/daily/2026/2026-07/2026-07-29.md`

**Interfaces:**
- `UsersPanel` remains controlled by `activeView` and `onViewChange`; `main.tsx` remains the URL-navigation owner.
- Existing `mutate` calls for create/update/disable/password/group/session operations remain unchanged.
- `PermissionPlatformPanel` remains the sole owner of permission reads, explain calls, revision-aware upsert/delete, reason validation, and effective decisions.
- The shared workbench receives only derived counts, current-view identity, existing action controls, and the current child surface.

- [ ] **Step 1: Write RED composition assertions**

Assert all five views render inside one governance template; the route context changes between organization and security; the overview keeps its five navigation actions; permission mode/readiness, principal selection, reason, domains, search, effective state, and load-more controls remain present.

- [ ] **Step 2: Run RED plus current behavior baseline**

```text
npm test -- apps/admin/src/admin-users-governance-workbench.test.tsx apps/admin/src/permission-platform/access.test.ts
npm run verify:admin-users-panel-contract
npm run verify:permission-platform-hardening
```

Expected: only the new composition assertions fail.

- [ ] **Step 3: Migrate the five views**

Replace the local `AdminWorkspaceBand` identity with `AdminGovernanceContext`, retain the current controlled view navigation, and apply neutral governance layout hooks to accounts, groups, sessions, and the permission matrix. Do not move handlers or manufacture a second confirmation layer.

- [ ] **Step 4: Verify and record evidence**

```text
npm test -- apps/admin/src/admin-users-governance-workbench.test.tsx apps/admin/src/permission-platform/access.test.ts
npm run verify:admin-users-panel-contract
npm run verify:permission-platform-hardening
npm run build -w @xinghuan/admin
npm run verify:visual-design-docs-contract
npm run verify:component-registry-docs-contract
git diff --check
```

- [ ] **Step 5: Commit**

Commit: `feat(admin): migrate organization and security workbenches`

### Task 3: Migrate Shared Resources And Announcements

**Files:**
- Create: `apps/admin/src/admin-resource-content-workbench.test.tsx`
- Modify: `apps/admin/src/admin-public-resources-panel.tsx`
- Modify: `apps/admin/src/admin-public-resource-category-sidebar.tsx`
- Modify: `apps/admin/src/admin-public-resource-card.tsx`
- Modify: `apps/admin/src/admin-announcement-panel.tsx`
- Modify: `apps/admin/src/styles/admin-governance-workbench.css`
- Modify: `scripts/verify-admin-resource-content-phase2-contract.mjs`
- Modify: `scripts/verify-admin-public-resources-starlight-contract.mjs`
- Modify: `docs/systems/admin/frontend-design/admin-page-visual-audit.md`
- Modify: `docs/logbooks/daily/2026/2026-07/2026-07-29.md`

**Interfaces:**
- Public resources retain `adminSharedResourceApi` list/category/create/rename/delete/item update/delete/upload operations, item/category revisions, complete media preview, kind/category/search filters, and existing delete confirmation.
- Announcements retain parent-owned load/mutation callbacks, local editor draft, explicit publish confirmation fields, archive/delete behavior, preview, and loading/busy guards.
- The accepted information architecture keeps `/admin/resources` and `/admin/content/announcements` as separate workspaces.

- [ ] **Step 1: Write RED template and route-ownership assertions**

Assert resource mode renders the category rail, editor grid, preview action, upload command, and explicit empty state; content mode renders directory/editor/preview composition, draft/published/archive states, and the existing publish confirmation controls.

- [ ] **Step 2: Run RED and capture the known stale contract failure**

```text
npm test -- apps/admin/src/admin-resource-content-workbench.test.tsx
npm run verify:admin-public-resources-starlight
npm run verify:admin-resource-content-phase2
node scripts/verify-admin-announcement-records-repository-contract.mjs
npm run verify:app-shell-loading-announcement-contract
```

Expected: the new test fails; `verify:admin-resource-content-phase2` fails only on its retired combined-workspace assertion.

- [ ] **Step 3: Migrate both workspaces and update the stale contract**

Use `AdminGovernanceWorkbench mode="governance"` for resources and `mode="content"` for announcements. Replace only page identity/composition markup, move no callbacks, and update the contract to assert distinct `resources` and `content` workspaces with their stable paths.

- [ ] **Step 4: Verify and record evidence**

```text
npm test -- apps/admin/src/admin-resource-content-workbench.test.tsx
npm run verify:admin-public-resources-starlight
npm run verify:admin-resource-content-phase2
node scripts/verify-admin-announcement-records-repository-contract.mjs
npm run verify:app-shell-loading-announcement-contract
npm run build -w @xinghuan/admin
npm run verify:visual-design-docs-contract
git diff --check
```

- [ ] **Step 5: Commit**

Commit: `feat(admin): migrate resource and content workbenches`

### Task 4: Converge Automation Governance

**Files:**
- Create: `apps/admin/src/admin-automation-governance-workbench.test.tsx`
- Modify: `apps/admin/src/admin-assistant-governance-workspace.tsx`
- Modify: `apps/admin/src/admin-agent-governance-workspace.tsx`
- Modify: `apps/admin/src/admin-agent-activity-workspace.tsx`
- Modify: `apps/admin/src/styles/admin-governance-workbench.css`
- Modify: `docs/systems/admin/frontend-design/admin-page-visual-audit.md`
- Modify: `docs/logbooks/daily/2026/2026-07/2026-07-29.md`

**Interfaces:**
- Assistant route keeps parent-owned revision-aware settings save and separate canvas/admin assistant drafts.
- Supervision keeps `adminAgentGovernanceApi`, role/pool/quality/knowledge editors, version/publish controls, dirty guards, and loading/error ownership.
- Activity keeps `buildActivityCases`, filter/selection state, evidence timeline, required decision reason, confirmation, and `decideApproval` writes.

- [ ] **Step 1: Write RED route composition tests**

Assert `/assistants`, `/supervision`, and `/activity` each expose one automation governance template and one route-specific context, while the existing revision save, versioned editor, metrics, queue/detail, approval reason, reject, and approve controls remain rendered.

- [ ] **Step 2: Run RED and current contracts**

```text
npm test -- apps/admin/src/admin-automation-governance-workbench.test.tsx apps/admin/src/admin-agent-governance-workspace.test.ts apps/admin/src/admin-agent-activity-view-model.test.ts apps/admin/src/admin-assistant-governance-view-model.test.ts
npm run verify:agent-governance-contract
npm run verify:admin-agent-runtime-model-loading
npm run verify:admin-assistant-settings-save-contract
npm run verify:assistant-content-contract
```

- [ ] **Step 3: Apply the automation template without moving owners**

Wrap each stable route in `mode="automation"`, normalize its context/actions and neutral work surfaces, and keep all existing editor, publish, approval, and recovery handlers in place.

- [ ] **Step 4: Verify and record evidence**

```text
npm test -- apps/admin/src/admin-automation-governance-workbench.test.tsx apps/admin/src/admin-agent-governance-workspace.test.ts apps/admin/src/admin-agent-activity-view-model.test.ts apps/admin/src/admin-assistant-governance-view-model.test.ts
npm run verify:agent-governance-contract
npm run verify:admin-agent-runtime-model-loading
npm run verify:admin-assistant-settings-save-contract
npm run verify:assistant-content-contract
npm run build -w @xinghuan/admin
npm run verify:visual-design-docs-contract
npm run verify:component-registry-docs-contract
git diff --check
```

- [ ] **Step 5: Commit**

Commit: `feat(admin): converge automation governance workbenches`

### Task 5: Validate And Release D To Old-Server Gray

**Files:**
- Create: `docs/logbooks/releases/gray/2026-07-29-admin-governance-content-d-v0813-r1.md`
- Create: `docs/logbooks/validations/2026-07-29-admin-governance-content-d-v0813-r1.md`
- Modify: `package.json`, `package-lock.json`
- Modify: `ops/current/release-state.json`, `ops/current/gray.md`, `ops/README.md`
- Modify: `docs/logbooks/releases/current-release-index.md`
- Modify: `docs/memory/current-state.md`
- Modify: `docs/systems/admin/frontend-design/redesign-program.md`
- Modify: `docs/systems/admin/frontend-design/admin-page-visual-audit.md`
- Modify: `docs/logbooks/daily/2026/2026-07/2026-07-29.md`

**Interfaces:**
- Produce patch version `0.8.13` and release `20260729-admin-governance-content-d-v0813-r1` unless a visual rejection requires the next governed patch.
- Deploy only with `--target-profile=old-server --env=gray`.

- [ ] **Step 1: Run all D tests/contracts and full verification**

Run all focused commands from Tasks 1-4, then:

```text
npm test
npm run build
npm run harness:verify:project
npm run harness:verify:workspace
npm run harness:verify:release
npm run verify:file-hotspot-budgets
npm run verify:hotspot-watchlist-contract
git diff --check
```

- [ ] **Step 2: Prepare and deploy only old-server Gray**

Create a clean release worktree, bump only the patch version, prepare with the governed runninghub preset, deploy with the old-server target profile, and verify `0.8.13 / gray / enforced / ready`. Run migrations and the four remote operational smoke checks. Do not run Production, billed canaries, or retention apply.

- [ ] **Step 3: Perform one authenticated desktop pass**

Inspect exactly once at `1920x1080`:

```text
/admin/organization
/admin/organization/accounts
/admin/organization/groups
/admin/organization/sessions
/admin/security
/admin/resources
/admin/content/announcements
/admin/automation/assistants
/admin/automation/supervision
/admin/automation/activity
```

Require one H1, one governance template, no legacy focus card, no page/main horizontal overflow, `.admin-main` scroll ownership, no assistant overlap, stable rail/editor/Inspector or queue/detail geometry, and visible risk confirmations.

- [ ] **Step 4: Record completion and close the redesign program**

Update canonical state and all projections, mark D/program complete only after runtime and browser acceptance, run staged release/document/hotspot guards, commit release records, and preserve the user's July files.
