# Environment Sync Layout Redesign And Versioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the admin environment sync page into a fixed-toolbar plus scrollable workbench layout that coexists cleanly with the always-open right assistant, then promote the app version from `0.1.0` to `0.3.1`, ship gray and production, and document the future versioning rules.

**Architecture:** Keep the existing environment sync feature behavior intact, but restructure the admin page into three explicit zones: compact hero, sticky control toolbar, and a remaining-height workspace with a narrow summary rail and a wide diff table area. Versioning stays monorepo-wide, with the root package and each workspace package advanced together so runtime packaging, admin status, and release notes stay aligned.

**Tech Stack:** React + TypeScript admin UI, monorepo workspace package manifests, existing static contract scripts, existing gray/production release packaging workflow, ops/doc logbook structure.

---

## File Structure

- `apps/admin/src/admin-environment-sync-panel.tsx`
  - Reorganize page DOM into hero, sticky toolbar, narrow rail, and main diff area.
- `apps/admin/src/styles.css`
  - Replace the current environment sync page layout rules with dedicated toolbar/workspace/rail/table styles.
- `scripts/verify-admin-environment-sync-contract.mjs`
  - Extend static contract to assert the new layout structure markers.
- `package.json`
  - Bump root version to `0.3.1`.
- `apps/api/package.json`
  - Bump workspace version to `0.3.1`.
- `apps/admin/package.json`
  - Bump workspace version to `0.3.1`.
- `apps/web/package.json`
  - Bump workspace version to `0.3.1`.
- `apps/worker/package.json`
  - Bump workspace version to `0.3.1`.
- `packages/shared/package.json`
  - Bump workspace version to `0.3.1`.
- `packages/canvas-core/package.json`
  - Bump workspace version to `0.3.1`.
- `packages/model-core/package.json`
  - Bump workspace version to `0.3.1`.
- `packages/ui/package.json`
  - Bump workspace version to `0.3.1`.
- `README.md`
  - Reflect current public project version if referenced.
- `AGENTS.md`
  - Add versioning rules: patch/minor bump on every release, major only on explicit user direction, gray mirrors production version number.
- `DEVLOG.md`
  - Record implementation, gray/prod release ids, version bump, and versioning governance rule.
- `ops/README.md`
  - Update current gray/prod release state and version-related note if needed.
- `ops/server-connection.md`
  - Update current release pointers after deployment.
- `ops/<new release note>.md`
  - Record the UI redesign and version bump rollout.

## Implementation Boundaries

- Keep the right assistant default-open behavior unchanged.
- Do not change environment sync business logic or payload schema unless needed for layout clarity.
- Do not change unrelated admin pages.
- All workspace package versions move together to `0.3.1`.
- Future release rule:
  - gray and production share the same app version string
  - every release increments a non-major version
  - major version changes only when explicitly directed by the user

## Task 1: Lock The Layout Contract Before Refactor

**Files:**
- Modify: `scripts/verify-admin-environment-sync-contract.mjs`
- Test: `scripts/verify-admin-environment-sync-contract.mjs`

- [ ] **Step 1: Add failing assertions for the new page structure**

Update `scripts/verify-admin-environment-sync-contract.mjs` to assert these markers exist in the sync panel source:

```js
assert(panel.includes("environment-sync-toolbar"));
assert(panel.includes("environment-sync-workspace"));
assert(panel.includes("environment-sync-rail"));
assert(panel.includes("environment-sync-table-area"));
assert(panel.includes("environment-sync-section-tabs"));
```

- [ ] **Step 2: Add failing assertions for dedicated CSS layout rules**

Also assert the stylesheet contains:

```js
assert(styles.includes(".environment-sync-toolbar {"));
assert(styles.includes(".environment-sync-workspace {"));
assert(styles.includes(".environment-sync-rail {"));
assert(styles.includes(".environment-sync-table-area {"));
assert(styles.includes(".environment-sync-table-scroll {"));
```

- [ ] **Step 3: Run the contract and verify it fails**

Run:

```bash
node scripts/verify-admin-environment-sync-contract.mjs
```

Expected: FAIL because the new layout markers do not exist yet.

- [ ] **Step 4: Commit the failing contract**

```bash
git add scripts/verify-admin-environment-sync-contract.mjs
git commit -m "test: lock environment sync layout contract"
```

## Task 2: Rebuild The Environment Sync Page Structure

**Files:**
- Modify: `apps/admin/src/admin-environment-sync-panel.tsx`
- Test: `scripts/verify-admin-environment-sync-contract.mjs`

- [ ] **Step 1: Replace sidebar/content split with top toolbar + workspace structure**

Refactor the panel JSX so the main body becomes:

```tsx
<section className="panel-stack environment-sync-page">
  <div className="api-card environment-sync-hero">...</div>
  <section className="environment-sync-toolbar">...</section>
  <section className="environment-sync-workspace">
    <aside className="environment-sync-rail">...</aside>
    <div className="environment-sync-table-area">...</div>
  </section>
</section>
```

- [ ] **Step 2: Move all primary actions into the fixed toolbar**

The toolbar must contain:
- source env
- target env
- swap
- preview
- apply
- selected/conflict counters

Keep labels operator-friendly:
- `从哪里复制`
- `同步到哪里`
- `先查看差异`
- `确认同步`

- [ ] **Step 3: Reduce the rail to summary and bulk controls only**

The rail should contain only:
- status summary
- sync direction
- selected count
- conflict count
- bulk user actions
- bulk provider actions

Do not keep long preformatted left/right summaries there.

- [ ] **Step 4: Add top-level tabs for account/provider sections**

Inside the table area, add a compact section switcher:

```tsx
const [activeSection, setActiveSection] = useState<"users" | "providers">("users");
```

Render:
- `账号`
- `服务商（含模型）`

This prevents two giant tables from stacking immediately on first view.

- [ ] **Step 5: Keep result table below the active diff section**

If `result` exists, render it after the active table section inside the same right area so the toolbar remains visible.

- [ ] **Step 6: Run the contract and verify it still fails only on CSS markers if not added yet**

Run:

```bash
node scripts/verify-admin-environment-sync-contract.mjs
```

Expected: structure assertions pass or partially pass; CSS assertions still fail until Task 3.

- [ ] **Step 7: Commit the structure refactor**

```bash
git add apps/admin/src/admin-environment-sync-panel.tsx
git commit -m "feat: restructure environment sync workbench layout"
```

## Task 3: Rebuild The Environment Sync CSS

**Files:**
- Modify: `apps/admin/src/styles.css`
- Test: `scripts/verify-admin-environment-sync-contract.mjs`

- [ ] **Step 1: Replace current sync layout rules with dedicated workbench rules**

Create dedicated layout classes:

```css
.environment-sync-toolbar { ... }
.environment-sync-workspace { ... }
.environment-sync-rail { ... }
.environment-sync-table-area { ... }
.environment-sync-table-scroll { ... }
.environment-sync-section-tabs { ... }
```

- [ ] **Step 2: Make the toolbar sticky inside the admin main panel**

Use a stable sticky top:

```css
.environment-sync-toolbar {
  position: sticky;
  top: 0;
  z-index: 6;
}
```

Keep height compact. Avoid tall cards inside this area.

- [ ] **Step 3: Give the workspace the remaining page height**

Use a layout that cooperates with `.admin-main--fixed-panel`:

```css
.environment-sync-page {
  min-height: 0;
  height: 100%;
}

.environment-sync-workspace {
  min-height: 0;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 16px;
}
```

- [ ] **Step 4: Make the right table area the only local scroll container**

```css
.environment-sync-table-area {
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}

.environment-sync-table-scroll {
  min-height: 0;
  overflow: auto;
}
```

- [ ] **Step 5: Tighten typography and preformatted summaries**

Summary text inside cells should wrap and not overflow:

```css
.environment-sync-table-area pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}
```

- [ ] **Step 6: Add responsive collapse behavior**

At narrower widths:
- collapse the rail above the table area
- let the assistant overlay follow the existing global behavior

```css
@media (max-width: 1380px) {
  .environment-sync-workspace {
    grid-template-columns: 220px minmax(0, 1fr);
  }
}

@media (max-width: 1180px) {
  .environment-sync-workspace {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 7: Run contract and admin build**

Run:

```bash
node scripts/verify-admin-environment-sync-contract.mjs
npm run build -w @xinghuan/admin
```

Expected: PASS.

- [ ] **Step 8: Commit the CSS refactor**

```bash
git add apps/admin/src/styles.css scripts/verify-admin-environment-sync-contract.mjs
git commit -m "feat: add environment sync sticky toolbar layout"
```

## Task 4: Add A Focused Regression Check For Assistant Coexistence

**Files:**
- Modify: `scripts/verify-admin-environment-sync-contract.mjs`
- Test: `scripts/verify-admin-environment-sync-contract.mjs`

- [ ] **Step 1: Add assertions that the sync page still coexists with the assistant-enabled workspace**

Assert in `main.tsx`:

```js
assert(main.includes("admin-workspace--with-assistant"));
assert(main.includes('activeTab === "environment-sync"'));
```

And in the panel source:

```js
assert(panel.includes("environment-sync-page"));
assert(!panel.includes("environment-sync-sidebar"));
```

- [ ] **Step 2: Run the contract**

Run:

```bash
node scripts/verify-admin-environment-sync-contract.mjs
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-admin-environment-sync-contract.mjs
git commit -m "test: cover environment sync assistant coexistence"
```

## Task 5: Bump Monorepo Version To 0.3.1

**Files:**
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/admin/package.json`
- Modify: `apps/web/package.json`
- Modify: `apps/worker/package.json`
- Modify: `packages/shared/package.json`
- Modify: `packages/canvas-core/package.json`
- Modify: `packages/model-core/package.json`
- Modify: `packages/ui/package.json`

- [ ] **Step 1: Update the root version**

Set in `package.json`:

```json
"version": "0.3.1"
```

- [ ] **Step 2: Update every workspace package version**

Set the same exact version in:
- `apps/api/package.json`
- `apps/admin/package.json`
- `apps/web/package.json`
- `apps/worker/package.json`
- `packages/shared/package.json`
- `packages/canvas-core/package.json`
- `packages/model-core/package.json`
- `packages/ui/package.json`

All must read:

```json
"version": "0.3.1"
```

- [ ] **Step 3: Verify version alignment**

Run:

```bash
rg -n '\"version\":\\s*\"0\\.' package.json apps packages -g package.json
```

Expected: every listed package shows `0.3.1`.

- [ ] **Step 4: Commit**

```bash
git add package.json apps/*/package.json packages/*/package.json
git commit -m "chore: bump monorepo version to 0.3.1"
```

## Task 6: Document Versioning Governance

**Files:**
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `README.md`
- Modify: `ops/README.md`

- [ ] **Step 1: Add explicit release versioning rules to AGENTS**

Add a short section stating:
- every release must bump a non-major version
- major version changes require explicit user direction
- gray and production must expose the same version number for the same release batch

- [ ] **Step 2: Record the version jump and governance rule in DEVLOG**

Add an entry that states:
- `0.1.0 -> 0.3.1`
- this batch includes environment sync layout redesign and release alignment
- future minor/patch increments are required per release
- major bumps require explicit user approval

- [ ] **Step 3: Update README if it references the project version**

If a visible version reference exists, update it to `0.3.1`.

- [ ] **Step 4: Add a brief ops note**

In `ops/README.md`, note that:
- gray/prod release pointers may differ during rollout
- but the app version string must stay aligned for a single release batch

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md DEVLOG.md README.md ops/README.md
git commit -m "docs: add release versioning governance"
```

## Task 7: Full Verification Before Release

**Files:**
- No new files required

- [ ] **Step 1: Run targeted sync layout and assistant verification**

Run:

```bash
node scripts/verify-admin-environment-sync-contract.mjs
node scripts/verify-admin-assistant-ui-contract.mjs
node scripts/verify-admin-assistant-chat.mjs
```

Expected: PASS.

- [ ] **Step 2: Run build verification**

Run:

```bash
npm run build -w @xinghuan/shared
npm run build -w @xinghuan/api
npm run build -w @xinghuan/admin
npm run build:single-port
```

Expected: PASS.

- [ ] **Step 3: Sync CodeGraph**

Run:

```bash
codegraph sync
```

Expected: PASS.

- [ ] **Step 4: Commit final implementation state**

```bash
git add -A
git commit -m "feat: redesign environment sync layout for assistant coexistence"
```

## Task 8: Release Gray And Production On 0.3.1

**Files:**
- Modify: `ops/server-connection.md`
- Modify: `ops/README.md`
- Create or Modify: `ops/environment-sync-layout-release-2026-06-17.md`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Package the clean release for gray**

Run:

```bash
npm run package:release -- 20260617-environment-sync-layout-gray-r1-<sha>
```

- [ ] **Step 2: Deploy gray and run gates**

Run the standard gray workflow:

```bash
scp ...
ssh ...
npm ci
npm run db:migrate
sudo systemctl restart xinghuan-canvas-next.service
sudo systemctl restart xinghuan-canvas-next-worker.service
npm run verify:release-preflight
npm run verify:request-chain-observability
npm run verify:system-observability
curl -fsS http://127.0.0.1:18200/api/status
```

Expected: PASS.

- [ ] **Step 3: Package and deploy production on the same version line**

Run:

```bash
npm run package:release -- 20260617-environment-sync-layout-prod-r1-<sha>
```

Then deploy to production with the standard workflow and verify:

```bash
npm run verify:release-preflight
npm run verify:request-chain-observability
npm run verify:system-observability
curl -fsS http://127.0.0.1:18100/api/status
```

- [ ] **Step 4: Update release records**

Record:
- gray release id
- production release id
- both current pointers
- version `0.3.1`
- verification evidence

- [ ] **Step 5: Commit release records**

```bash
git add DEVLOG.md ops/server-connection.md ops/README.md ops/environment-sync-layout-release-2026-06-17.md
git commit -m "docs: record environment sync layout 0.3.1 rollout"
```

## Self-Review

- Spec coverage:
  - sticky top controls: covered in Tasks 2 and 3
  - independent scrollable selection area: covered in Tasks 2 and 3
  - assistant remains default open: covered in Tasks 2 and 4
  - gray and production rollout: covered in Task 8
  - version jump to `0.3.1`: covered in Task 5
  - future version governance: covered in Task 6
- Placeholder scan:
  - no `TODO`/`TBD`
  - explicit files and commands included
- Type consistency:
  - layout class names are defined once and reused consistently
  - version number stays `0.3.1` across all package tasks
