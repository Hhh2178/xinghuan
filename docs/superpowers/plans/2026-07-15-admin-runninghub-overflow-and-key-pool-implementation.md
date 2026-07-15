# Admin RunningHub Overflow And Key Pool Implementation Plan

> Use `superpowers:executing-plans` and test-driven development. Every production edit follows a witnessed failing contract.

**Goal:** Eliminate RunningHub catalog text collisions, move RH Key pool management to the Provider level, add conservative Admin overflow guardrails, and publish a verified `v0.6.5` gray release.

**Architecture:** Keep data loading and mutations in `AdminRunningHubWorkspace`. Reorder the existing Key pool panel above catalog filtering, introduce explicit semantic tracks for catalog cards, and use scoped CSS guardrails that do not interfere with table-owned scrolling.

## Task 1: Lock The New Structure With Failing Contracts

**Files:**

- Modify: `scripts/verify-admin-runninghub-workspace-contract.mjs`
- Modify: `scripts/verify-runninghub-key-pool-contract.mjs`

1. Require the Key pool panel to appear before `admin-runninghub-workspace__sticky-shell` and `admin-runninghub-workspace__layout`.
2. Require Provider-level explanatory copy and Provider identity in the Key pool summary.
3. Reject a Key pool panel inside `admin-runninghub-workspace__editor-stack`.
4. Require catalog title, note, summary, warning, and footer classes.
5. Require one-line title/summary clamps, two-line note/warning clamps, and shrink-safe card tracks.
6. Run both contracts and record the expected failures.

## Task 2: Implement Provider-Level Key Pool IA

**Files:**

- Modify: `apps/admin/src/admin-runninghub-workspace.tsx`
- Modify: `apps/admin/src/styles.css`

1. Resolve a display label for the active RunningHub Provider.
2. Move the Key pool panel below statistics and above filters.
3. Keep the panel collapsed by default and expose mutation controls only when expanded.
4. Replace nested Key cards with bounded Key rows.
5. Preserve all existing API calls and mutation behavior.

## Task 3: Implement Catalog Text Tracks And Overflow Guardrails

**Files:**

- Modify: `apps/admin/src/admin-runninghub-workspace.tsx`
- Modify: `apps/admin/src/styles.css`

1. Add explicit title, note, summary, warning, and footer elements.
2. Apply title attributes to truncated source text.
3. Add scoped Admin child shrink rules and toolbar wrapping.
4. Keep table horizontal scrolling untouched.
5. Re-run the two contracts until green.

## Task 4: Local Verification

Run:

```text
node scripts/verify-admin-runninghub-workspace-contract.mjs
node scripts/verify-runninghub-key-pool-contract.mjs
node scripts/verify-admin-runninghub-workspace-helper-split-contract.mjs
npm run type-check -w @xinghuan/admin
npm run build -w @xinghuan/admin
npm run build:single-port
npm run harness:verify:project
npm run harness:verify:workspace
```

All commands must pass without using a paid model request.

## Task 5: Gray Release And Browser Acceptance

1. Bump only the gray release to `v0.6.5`; production remains unchanged.
2. Prepare and deploy a release named `20260715-admin-runninghub-overflow-key-pool-v065` unless release tooling requires a collision-free suffix.
3. Verify health endpoints and Admin login.
4. Test `1920x1080` and `2560x1440`, each with AI assistant closed and open.
5. Test workflow and AI application tabs, long cards, Key pool collapse/expand, and critical page regressions.
6. Do not display or record RH Key values.

## Task 6: Governance, Commit, And Push

**Files:**

- Add: `docs/logbooks/validations/2026-07-15-admin-runninghub-overflow-key-pool.md`
- Add: `docs/logbooks/releases/gray/2026-07-15-admin-runninghub-overflow-key-pool-v065.md`
- Modify: `docs/logbooks/releases/current-release-index.md`
- Modify: `docs/logbooks/daily/2026/2026-07/2026-07-15.md`
- Modify: `DEVLOG.md`
- Modify current gray/runtime entry files required by the release harness.

Run all staged-source, hotspot, release consistency, worktree cleanliness, project, workspace, and release harness gates. Commit, push `origin/xinghuan-integration-clean`, and confirm local/remote commit equality.

## Completion Record

- Tasks 1-3 completed through witnessed failing contracts and passing implementation.
- Task 4 completed with Admin/all-workspace type checks, single-port build, project harness, and workspace harness.
- Task 5 completed in gray `v0.6.5` across `1920x1080` and `2560x1440`, with the AI assistant open and closed.
- Task 6 release and validation records completed; production remains unchanged at `v0.5.22`.
