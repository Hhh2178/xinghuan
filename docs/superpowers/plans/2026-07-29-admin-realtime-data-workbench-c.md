# Admin Realtime Data Workbench C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Converge overview, task monitoring, system health, usage, cost, channel reliability, and audit log pages on one reusable Admin realtime/data visual contract without changing their APIs, refresh ownership, filters, task mutations, stale-data behavior, or observability semantics.

**Architecture:** Add a presentation-only data-workbench layer beside the A Foundation and B configuration template. Existing feature components keep all requests, polling, abort/visibility guards, filter state, task actions, charts, and inspectors; the shared layer supplies a template marker, compact data context, toolbar boundary, neutral surfaces, and stable desktop spacing. Migrate overview/tasks first, then system health, then the four analytics views, and release the complete C batch to old-server Gray.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, CSS, existing observability components, Node release harness.

## Global Constraints

- Target only PC `1920x1080`; do not add mobile/tablet product behavior or a second viewport matrix.
- Preserve stable URLs, page loaders, permissions, task create/cancel/retry/recover paths, pagination, filters, auto-refresh intervals, visibility pause, AbortController cancellation, ETag/stale fallback, and chart calculations.
- Keep one page H1 owned by `AdminWorkspaceBand`; C contexts use `strong`/H2/H3 only.
- Use brand gradient only for route identity, selected state, summary/context emphasis, and one primary action. Tables, filters, logs, charts, errors, and Inspector bodies remain neutral or semantic.
- Keep system-health backend aggregation and DTOs unchanged. The earlier environment/queue isolation and health evaluator are already authoritative.
- Do not claim global counts from the current task page. Any status summary derived from `taskPage.items` must be labelled as current-page data.
- Keep the user's modified July daily index and untracked July 28 log outside every commit.
- Each completed task updates the visual Audit and July 29 daily log; Gray state changes only after runtime and browser verification.

---

### Task 1: Add the shared realtime/data presentation contract

**Files:**
- Create: `apps/admin/src/admin-data-workbench.tsx`
- Create: `apps/admin/src/admin-data-workbench.test.tsx`
- Create: `apps/admin/src/styles/admin-data-workbench.css`
- Modify: `apps/admin/src/main.tsx`
- Modify: `docs/systems/admin/frontend-design/visual-component-registry.md`

**Interfaces:**
- Produce `AdminDataWorkbench({ label, mode, className?, children })`, where `mode` is `"overview" | "realtime" | "analytics"` and markup exposes `data-admin-template="data"` plus `data-data-mode`.
- Produce `AdminDataContext({ eyebrow, title, description?, status?, actions?, meta? })`; `status` is `{ label: ReactNode; tone: StatusTone }` and renders the existing `StatusPill`.
- Produce `AdminDataToolbar({ label, children, className? })` as an unframed, accessible control boundary.
- These components never own requests, polling, filters, calculations, Inspector state, task mutations, or navigation.

- [x] **Step 1: Write the failing render contract**

Create tests that render all three modes and assert the data template/mode markers, one context region, semantic status text, optional actions/meta, and an accessible toolbar. Assert no H1 is emitted.

- [x] **Step 2: Run the focused test and verify RED**

Run: `npm test -- apps/admin/src/admin-data-workbench.test.tsx`

Expected: fail because `admin-data-workbench.tsx` does not exist.

- [x] **Step 3: Implement the presentation components and scoped CSS**

Use this public shape:

```tsx
<section className="admin-data-workbench" data-admin-template="data" data-data-mode={mode} aria-label={label}>
  {children}
</section>

<header className="admin-data-context">
  <div className="admin-data-context__copy">
    <span>{eyebrow}</span>
    <strong>{title}</strong>
    {description ? <span>{description}</span> : null}
  </div>
  {status || actions ? <div className="admin-data-context__actions">...</div> : null}
  {meta ? <div className="admin-data-context__meta">{meta}</div> : null}
</header>
```

Import `styles/admin-data-workbench.css` from `main.tsx` beside the Foundation/configuration modules. CSS must use Foundation tokens, 8px-or-less card radius for repeated metrics, stable grid tracks, neutral chart/table surfaces, and no viewport-scaled type.

- [x] **Step 4: Run focused and design gates**

Run:

```text
npm test -- apps/admin/src/admin-data-workbench.test.tsx
npm --workspace @xinghuan/admin run build
npm run verify:visual-design-docs-contract
npm run verify:design-token-docs-contract
npm run verify:component-registry-docs-contract
git diff --check
```

Expected: all exit 0.

- [x] **Step 5: Update the registry and commit**

Commit: `feat(admin): add realtime data workbench foundation`

### Task 2: Migrate overview and task monitoring

**Files:**
- Modify: `apps/admin/src/admin-overview-panel.tsx`
- Modify: `apps/admin/src/admin-overview-panel.test.tsx`
- Modify: `apps/admin/src/admin-task-panel.tsx`
- Create: `apps/admin/src/admin-task-panel.test.tsx`
- Modify: `apps/admin/src/styles/admin-data-workbench.css`
- Modify: `scripts/verify-admin-overview-panel-contract.mjs`
- Modify: `scripts/verify-admin-task-panel-contract.mjs`
- Modify: `docs/systems/admin/frontend-design/admin-page-visual-audit.md`
- Modify: `docs/logbooks/daily/2026/2026-07/2026-07-29.md`

**Interfaces:**
- Consume the Task 1 presentation components.
- Keep `Overview` props and all three source tables unchanged.
- Keep `TasksPanel` props, create-task payload, query updates, pagination, complete logs, output recovery, cancellation, and retry actions unchanged.

- [x] **Step 1: Write RED tests for template adoption and retained task behavior**

Assert overview uses `mode="overview"`. Render an empty `TasksPanel` and assert `mode="realtime"`, current-page summary labels, an eight-column empty row, create/filter controls, and pagination. Source assertions must continue to cover `/api/admin/tasks`, recover-output, cancel, retry, page/pageSize/filters, owner identity, and full log joining.

- [x] **Step 2: Run the focused tests and contracts to verify RED**

Run:

```text
npm test -- apps/admin/src/admin-overview-panel.test.tsx apps/admin/src/admin-task-panel.test.tsx apps/admin/src/admin-data-workbench.test.tsx
npm run verify:admin-overview-panel-contract
npm run verify:admin-task-panel-contract
```

Expected: the new data-template assertions fail while existing behavior assertions pass.

- [x] **Step 3: Recompose overview and tasks**

Wrap overview in `AdminDataWorkbench` without adding a second identity header. Wrap tasks in `AdminDataWorkbench`, add `AdminDataContext`, label summary values as current-page values, keep the two existing `FormPanel` controls as sibling command/filter regions, and add an explicit empty table row with `colSpan={8}`. Do not move any state or callbacks.

- [x] **Step 4: Run focused tests, contracts, and Admin build**

Run the Task 2 RED commands again, then `npm --workspace @xinghuan/admin run build` and `git diff --check`.

Expected: all exit 0.

- [x] **Step 5: Update Audit/daily evidence and commit**

Commit: `feat(admin): migrate overview and task data workbenches`

### Task 3: Migrate system health without changing observability semantics

**Files:**
- Modify: `apps/admin/src/components/observability/AdminSystemHealthDashboard.tsx`
- Create: `apps/admin/src/admin-system-health-workbench.test.tsx`
- Modify: `apps/admin/src/styles/admin-data-workbench.css`
- Modify: `scripts/verify-admin-system-health-visualization-contract.mjs`
- Modify: `docs/systems/admin/frontend-design/admin-page-visual-audit.md`
- Modify: `docs/logbooks/daily/2026/2026-07/2026-07-29.md`

**Interfaces:**
- Keep `AdminSystemHealthDashboard` props and `useAdminSystemHealth` untouched.
- Preserve range keys `1h/24h/7d/30d`, 15-second visible-tab refresh, abort behavior, alert ordering, five-domain truth states, failed/cancelled separation, topology, trend, capacity, timeline, and Inspector.

- [ ] **Step 1: Write a RED render/source contract**

Assert the dashboard uses `AdminDataWorkbench mode="realtime"`, exposes its existing command/alert/domain/topology/chart/Inspector regions, and still contains no H1. Extend the script contract to require the shared template while retaining every current health-semantic assertion.

- [ ] **Step 2: Run focused tests and the health contract to verify RED**

Run:

```text
npm test -- apps/admin/src/admin-system-health-workbench.test.tsx apps/admin/src/admin-system-health-view-model.test.ts
npm run verify:admin-system-health-visualization-contract
```

Expected: only shared-template adoption fails.

- [ ] **Step 3: Add the shared boundary and scoped visual convergence**

Wrap the existing dashboard sequence in `AdminDataWorkbench`; retain the existing command as the anomaly-first local context because it owns live range/refresh actions. Scope new CSS to normalize spacing, borders, surface colors, and chart geometry without changing SVG math or click handlers.

- [ ] **Step 4: Run focused tests, health/authority gates, and Admin build**

Run the Task 3 RED commands again, then:

```text
npm run verify:authority-state
npm run verify:agent-environment-readiness-contract
npm --workspace @xinghuan/admin run build
git diff --check
```

Expected: all exit 0.

- [ ] **Step 5: Update Audit/daily evidence and commit**

Commit: `feat(admin): migrate system health data workbench`

### Task 4: Migrate usage, cost, reliability, and audit analytics

**Files:**
- Modify: `apps/admin/src/admin-readonly-panels.tsx`
- Modify: `apps/admin/src/admin-usage-dashboard.tsx`
- Modify: `apps/admin/src/admin-cost-dashboard.tsx`
- Modify: `apps/admin/src/admin-channel-health-dashboard.tsx`
- Modify: `apps/admin/src/admin-channel-health-dashboard.css`
- Create: `apps/admin/src/admin-analytics-data-workbench.test.tsx`
- Modify: `apps/admin/src/styles/admin-data-workbench.css`
- Modify: `scripts/verify-admin-usage-dashboard-contract.mjs`
- Modify: `docs/systems/admin/frontend-design/admin-page-visual-audit.md`
- Modify: `docs/logbooks/daily/2026/2026-07/2026-07-29.md`

**Interfaces:**
- Usage keeps parent-owned filters, selected account, loading/error, and summary objects.
- Cost keeps its own CNY request, range/group/user/provider/model filters, active-result guard, and immutable historical-price warning.
- Reliability keeps its ETag, last successful report, stale banner, disabled-by-default five-minute refresh, and page-visibility pause.
- Audit keeps the existing seven columns and all raw source values.

- [ ] **Step 1: Write RED tests for all four data views**

Render usage and audit with empty data, render cost/reliability shells without running effects, and assert exactly one `data-admin-template="data"` wrapper per view, `mode="analytics"`, a shared context, explicit empty/loading/error regions, and no H1. Add source assertions for each existing request/filter/stale behavior.

- [ ] **Step 2: Run focused analytics tests and contracts to verify RED**

Run:

```text
npm test -- apps/admin/src/admin-analytics-data-workbench.test.tsx apps/admin/src/admin-channel-health-refresh.test.ts
node scripts/verify-admin-usage-dashboard-contract.mjs
```

Expected: shared-template/context assertions fail; existing refresh/API assertions pass.

- [ ] **Step 3: Migrate each analytics composition**

Use `AdminDataWorkbench` and `AdminDataContext` inside each dashboard so locally owned refresh actions remain colocated. Replace duplicate bespoke headers, keep filters inside neutral `AdminDataToolbar` or existing bounded filter panels, and use the shared context for freshness/status. Wrap the raw audit table with its own analytics context. Do not change request dependencies, response handling, calculations, ranking limits, or columns.

- [ ] **Step 4: Run focused/full analytics gates and Admin build**

Run the Task 4 RED commands again, then:

```text
npm test -- apps/api/src/admin-cost-analytics.test.ts
node scripts/verify-admin-audit-records-repository-contract.mjs
node scripts/verify-admin-usage-summary-repository-contract.mjs
npm --workspace @xinghuan/admin run build
npm run verify:visual-design-docs-contract
npm run verify:component-registry-docs-contract
git diff --check
```

Expected: all exit 0.

- [ ] **Step 5: Update Audit/daily evidence and commit**

Commit: `feat(admin): migrate analytics data workbenches`

### Task 5: Validate and release C to old-server Gray

**Files:**
- Create: `docs/logbooks/releases/gray/2026-07-29-admin-realtime-data-c-v0811-r1.md`
- Create: `docs/logbooks/validations/2026-07-29-admin-realtime-data-c-v0811-r1.md`
- Modify: `package.json`, `package-lock.json`
- Modify: `ops/current/release-state.json`, `ops/current/gray.md`, `ops/README.md`
- Modify: `docs/logbooks/releases/current-release-index.md`
- Modify: `docs/memory/current-state.md`
- Modify: `docs/systems/admin/frontend-design/redesign-program.md`
- Modify: `docs/systems/admin/frontend-design/admin-page-visual-audit.md`
- Modify: `docs/logbooks/daily/2026/2026-07/2026-07-29.md`

**Interfaces:**
- Produce patch release `0.8.11` and release `20260729-admin-realtime-data-c-v0811-r1` unless the governed prepare command assigns a different release identity.
- Deploy only with `--target-profile=old-server --env=gray`.
- Do not deploy Production, run billed canaries, or apply retention without separate authorization.

- [ ] **Step 1: Run focused tests and all C behavior contracts**

Run:

```text
npm test -- apps/admin/src/admin-data-workbench.test.tsx apps/admin/src/admin-overview-panel.test.tsx apps/admin/src/admin-task-panel.test.tsx apps/admin/src/admin-system-health-workbench.test.tsx apps/admin/src/admin-system-health-view-model.test.ts apps/admin/src/admin-analytics-data-workbench.test.tsx apps/admin/src/admin-channel-health-refresh.test.ts apps/api/src/admin-cost-analytics.test.ts
npm run verify:admin-overview-panel-contract
npm run verify:admin-task-panel-contract
npm run verify:admin-system-health-visualization-contract
node scripts/verify-admin-usage-dashboard-contract.mjs
node scripts/verify-admin-audit-records-repository-contract.mjs
node scripts/verify-admin-usage-summary-repository-contract.mjs
npm run verify:visual-design-docs-contract
npm run verify:design-token-docs-contract
npm run verify:component-registry-docs-contract
npm run verify:authority-state
npm run verify:agent-environment-readiness-contract
npm run verify:file-hotspot-budgets
npm run verify:hotspot-watchlist-contract
git diff --check
```

Expected: all exit 0.

- [ ] **Step 2: Run full tests, full workspace build, and all three Harness layers**

Run:

```text
npm test
npm run build
npm run harness:verify:project
npm run harness:verify:workspace
npm run harness:verify:release
```

Expected: all exit 0; retain the known dependency-audit warning without a forced upgrade.

- [ ] **Step 3: Prepare and deploy only old-server Gray**

Create a clean release worktree from the completed C commit, verify `.githooks`, and use the authorized local SSH identity through `XINGHUAN_SSH_KEY` without recording its value. Run:

```text
npm version patch --no-git-tag-version
npm run release:gray:prepare -- --release=20260729-admin-realtime-data-c-v0811-r1 --preset=runninghub
npm run release:gray:deploy -- --target-profile=old-server --env=gray --release=20260729-admin-realtime-data-c-v0811-r1 --archive=dist-release/20260729-admin-realtime-data-c-v0811-r1.tar.gz --ssh-key=$env:XINGHUAN_SSH_KEY
npm run release:gray:verify -- --target-profile=old-server --env=gray --ssh-key=$env:XINGHUAN_SSH_KEY --expected-version=0.8.11 --expected-environment=gray --expected-permission-mode=enforced --expected-permission-ready=true
```

Run migrations, remote preflight, request-chain observability, system observability, and environment-sync no-op smoke from the deployed release. Do not run Production, paid canaries, or retention apply.

- [ ] **Step 4: Perform authenticated desktop acceptance**

Inspect exactly once at `1920x1080`:

```text
/admin/overview
/admin/runtime/tasks
/admin/system/health
/admin/analytics/usage
/admin/analytics/costs
/admin/analytics/reliability
/admin/analytics/audit
```

Require one H1, one data template, no legacy focus card, no page/main horizontal overflow, `.admin-main` scroll ownership, no assistant overlap, stable filters/tables/charts/Inspector, and no nested cards.

- [ ] **Step 5: Record evidence and activate D**

Write release/validation evidence, update canonical state and current projections, mark C complete/D active in Program/Audit, run staged release/document/hotspot guards, commit release records, and synchronize the clean commits into the main worktree without touching the user's July files.
