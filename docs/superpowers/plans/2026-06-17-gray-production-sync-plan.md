# Gray/Production Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a guarded admin sync workflow that can compare and selectively sync users and providers between gray and production, with per-item conflict decisions and audit logging. Provider sync must include the provider's related models in the same operation, and the admin wording must be rewritten for operators instead of engineers.

**Architecture:** Add a dedicated admin sync page, a compare/apply API pair, and a server-side sync service that reads source/target environment snapshots, computes diffs, applies selected actions, and records auditable execution results. Keep the feature isolated from existing user/provider CRUD screens while reusing existing admin auth, view-model patterns, and audit infrastructure.

**Tech Stack:** React + TypeScript admin UI, Node/TypeScript API server, existing admin auth/session model, existing audit log pipeline, existing gray/production environment conventions.

---

## File Structure

- `apps/admin/src/admin-environment-sync-panel.tsx`
  - New admin page for source/target environment selection, diff preview, selection state, conflict decisions, and execution controls.
- `apps/admin/src/admin-types.ts`
  - Add sync request/response types, diff row shapes, conflict strategy types, and execution result types.
- `apps/admin/src/admin-view-model.ts`
  - Add new `environment-sync` tab metadata.
- `apps/admin/src/main.tsx`
  - Wire the new tab into admin navigation and data loading hooks.
- `apps/admin/src/styles.css`
  - Add page layout, diff table, selection bar, conflict controls, and execution summary styles.
- `apps/api/src/server.ts`
  - Add admin routes for compare/apply sync and server-side request validation.
- `apps/api/src/environment-sync-service.ts`
  - New service for reading environment snapshots, computing diffs, validating conflict decisions, and applying selected sync operations, including provider-bound model sync.
- `apps/api/src/environment-sync-types.ts`
  - New local server-side sync domain types if separation from frontend types is useful.
- `scripts/verify-admin-environment-sync-contract.mjs`
  - Static contract for tab wiring, page presence, and route existence.
- `scripts/verify-environment-sync-service.mjs`
  - Static contract for compare/apply service behavior markers.
- `docs/superpowers/specs/2026-06-17-gray-production-sync-design.md`
  - Existing approved design, update only if implementation clarifies a design edge.
- `DEVLOG.md`
  - Record implementation and verification when feature lands.

## Data Model

- Environment ids:
  - `gray`
  - `production`
- Sync object kinds:
  - `user`
  - `provider`
- Provider sync bundle:
  - provider base config
  - all models attached by `providerId`
- Diff row states:
  - `missing_in_target`
  - `missing_in_source`
  - `conflict`
  - `identical`
- Per-item sync decision:
  - `skip`
  - `use_source`
  - `keep_target`
- Execution result:
  - selected count
  - applied count
  - skipped count
  - failed count
  - row-level result details

## Assumptions To Preserve

- Only admin users may access or execute sync.
- Sync is manual, not scheduled.
- API keys and passwords are included in sync, but never rendered back in plaintext.
- Existing admin CRUD remains the source of truth for same-environment editing; sync is a separate operator workflow.
- Gray and production are treated as two explicitly named runtime targets, not arbitrary remote clusters.

## Task 1: Define Sync Types And Contracts

**Files:**
- Modify: `apps/admin/src/admin-types.ts`
- Create: `scripts/verify-admin-environment-sync-contract.mjs`
- Create: `scripts/verify-environment-sync-service.mjs`

- [ ] **Step 1: Add sync type definitions to admin types**

Add exact types for environment selection, diff rows, execution payloads, and results in `apps/admin/src/admin-types.ts`.

```ts
export type EnvironmentSyncTarget = "gray" | "production";
export type EnvironmentSyncObjectKind = "user" | "provider";
export type EnvironmentSyncDiffState = "missing_in_target" | "missing_in_source" | "conflict" | "identical";
export type EnvironmentSyncDecision = "skip" | "use_source" | "keep_target";

export interface EnvironmentSyncPreviewRow {
  id: string;
  kind: EnvironmentSyncObjectKind;
  displayName: string;
  naturalKey: string;
  state: EnvironmentSyncDiffState;
  sourceSummary: Record<string, unknown>;
  targetSummary: Record<string, unknown>;
  defaultDecision: EnvironmentSyncDecision;
}

export interface EnvironmentSyncPreviewResponse {
  sourceEnvironment: EnvironmentSyncTarget;
  targetEnvironment: EnvironmentSyncTarget;
  generatedAt: number;
  users: EnvironmentSyncPreviewRow[];
  providers: EnvironmentSyncPreviewRow[];
}

export interface EnvironmentSyncApplyItem {
  id: string;
  kind: EnvironmentSyncObjectKind;
  decision: EnvironmentSyncDecision;
  selected: boolean;
}

export interface EnvironmentSyncApplyRequest {
  sourceEnvironment: EnvironmentSyncTarget;
  targetEnvironment: EnvironmentSyncTarget;
  items: EnvironmentSyncApplyItem[];
}

export interface EnvironmentSyncApplyResultRow {
  id: string;
  kind: EnvironmentSyncObjectKind;
  decision: EnvironmentSyncDecision;
  status: "applied" | "skipped" | "failed";
  message?: string;
}

export interface EnvironmentSyncApplyResponse {
  sourceEnvironment: EnvironmentSyncTarget;
  targetEnvironment: EnvironmentSyncTarget;
  executedAt: number;
  results: EnvironmentSyncApplyResultRow[];
}
```

- [ ] **Step 2: Write static contract for new admin feature**

Create `scripts/verify-admin-environment-sync-contract.mjs` to assert that:
- `admin-types.ts` exports sync types
- `main.tsx` contains the new tab
- the new panel file is mounted
- `server.ts` contains compare/apply routes

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const types = readFileSync(join(root, "apps/admin/src/admin-types.ts"), "utf8");
const main = readFileSync(join(root, "apps/admin/src/main.tsx"), "utf8");
const viewModel = readFileSync(join(root, "apps/admin/src/admin-view-model.ts"), "utf8");
const server = readFileSync(join(root, "apps/api/src/server.ts"), "utf8");

assert(types.includes("EnvironmentSyncTarget"));
assert(types.includes("EnvironmentSyncPreviewResponse"));
assert(viewModel.includes("environment-sync"));
assert(main.includes("AdminEnvironmentSyncPanel"));
assert(server.includes('"/api/admin/environment-sync/preview"'));
assert(server.includes('"/api/admin/environment-sync/apply"'));

console.log(JSON.stringify({ ok: true }, null, 2));
```

- [ ] **Step 3: Write static contract for sync service**

Create `scripts/verify-environment-sync-service.mjs` to assert that the new service file exists and contains preview/apply entry points.

```js
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const servicePath = join(root, "apps/api/src/environment-sync-service.ts");
assert.equal(existsSync(servicePath), true);
const source = readFileSync(servicePath, "utf8");
assert(source.includes("createEnvironmentSyncService"));
assert(source.includes("previewEnvironmentSync"));
assert(source.includes("applyEnvironmentSync"));

console.log(JSON.stringify({ ok: true }, null, 2));
```

- [ ] **Step 4: Run contracts to verify they fail**

Run:

```bash
node scripts/verify-admin-environment-sync-contract.mjs
node scripts/verify-environment-sync-service.mjs
```

Expected: both commands fail because files and routes are not wired yet.

- [ ] **Step 5: Commit after type/contract scaffolding lands**

```bash
git add apps/admin/src/admin-types.ts scripts/verify-admin-environment-sync-contract.mjs scripts/verify-environment-sync-service.mjs
git commit -m "feat: scaffold environment sync contracts"
```

## Task 2: Add Admin Navigation And Page Shell

**Files:**
- Modify: `apps/admin/src/admin-view-model.ts`
- Modify: `apps/admin/src/main.tsx`
- Create: `apps/admin/src/admin-environment-sync-panel.tsx`
- Modify: `apps/admin/src/styles.css`

- [ ] **Step 1: Add new admin tab metadata**

Add `environment-sync` to the tab union and navigation list in `apps/admin/src/admin-view-model.ts`.

```ts
export type AdminTabId =
  | "overview"
  | "users"
  | "providers"
  | "assistant"
  | "tasks"
  | "audit"
  | "system"
  | "environment-sync";
```

Add a nav entry with a clear label such as `环境同步`.

- [ ] **Step 2: Create a page shell component**

Create `apps/admin/src/admin-environment-sync-panel.tsx` with:
- source environment selector
- target environment selector
- preview button
- empty diff state
- placeholders for user/provider sections
- execution summary area

Use existing admin page patterns: section cards, compact controls, dense operator-focused layout.

- [ ] **Step 3: Mount the panel in main admin app**

Modify `apps/admin/src/main.tsx` to:
- import `AdminEnvironmentSyncPanel`
- render it on `activeTab === "environment-sync"`
- pass existing `mutate` or dedicated callbacks as needed

- [ ] **Step 4: Add baseline styles**

Add CSS for:
- two-column environment selector header
- toolbar with preview/apply buttons
- selection summary bar
- diff sections for users/providers
- conflict decision row layout

Avoid card-inside-card nesting; use full-width sections with compact internal rows.

- [ ] **Step 5: Run static contract and verify partial pass/fail**

Run:

```bash
node scripts/verify-admin-environment-sync-contract.mjs
```

Expected:
- tab/page checks pass
- route/service checks still fail

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/admin-view-model.ts apps/admin/src/main.tsx apps/admin/src/admin-environment-sync-panel.tsx apps/admin/src/styles.css
git commit -m "feat: add admin environment sync page shell"
```

## Task 3: Implement Server Preview Service

**Files:**
- Create: `apps/api/src/environment-sync-service.ts`
- Modify: `apps/api/src/server.ts`
- Test: `scripts/verify-environment-sync-service.mjs`

- [ ] **Step 1: Define service interface and environment readers**

In `apps/api/src/environment-sync-service.ts`, create a factory with:
- `previewEnvironmentSync`
- `applyEnvironmentSync`

Dependencies should be injected from `server.ts`, including:
- admin db readers for current environment
- any remote environment fetcher
- audit writer
- `safeText` helpers

- [ ] **Step 2: Implement preview diff builder**

`previewEnvironmentSync` should:
- reject same source/target
- read source and target snapshots
- compare users by email
- compare providers by name or stable id fallback
- compare provider models by `provider.name + capability + modelId`
- return rows grouped into `users` and `providers`
- mark rows as `missing_in_target`, `missing_in_source`, `conflict`, or `identical`
- assign `defaultDecision`
- include provider model summary counts in provider preview rows

Keep summaries safe:
- no plaintext password
- no plaintext API key
- expose only flags like `hasPassword`, `hasApiKey`, protocol, enabled status

- [ ] **Step 3: Add preview route to server**

In `apps/api/src/server.ts`, add:

```ts
if (url.pathname === "/api/admin/environment-sync/preview" && request.method === "POST") {
  // require admin auth
  // read JSON body
  // validate sourceEnvironment/targetEnvironment
  // call previewEnvironmentSync
  // return JSON
}
```

- [ ] **Step 4: Update service contract**

Make `scripts/verify-environment-sync-service.mjs` pass by ensuring:
- file exists
- preview/apply entry points exist
- compare route exists

- [ ] **Step 5: Run contracts**

Run:

```bash
node scripts/verify-environment-sync-service.mjs
node scripts/verify-admin-environment-sync-contract.mjs
npm run build -w @xinghuan/api
```

Expected:
- service contract passes
- admin contract still fails only on apply route if not added yet
- API build passes

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/environment-sync-service.ts apps/api/src/server.ts scripts/verify-environment-sync-service.mjs scripts/verify-admin-environment-sync-contract.mjs
git commit -m "feat: add environment sync preview service"
```

## Task 4: Implement Apply Sync Service

**Files:**
- Modify: `apps/api/src/environment-sync-service.ts`
- Modify: `apps/api/src/server.ts`
- Test: `scripts/verify-environment-sync-service.mjs`

- [ ] **Step 1: Implement apply validation**

`applyEnvironmentSync` must:
- reject same source/target
- require at least one selected item
- reject `conflict` rows without explicit `use_source` or `keep_target`
- skip rows marked `skip`

- [ ] **Step 2: Implement user apply logic**

For `use_source`:
- create or update target user by email
- sync role, disabled state, password hash/cipher fields

For `keep_target`:
- mark row skipped

Never return password plaintext in response.

- [ ] **Step 3: Implement provider apply logic**

For `use_source`:
- create or update target provider by natural key
- sync baseUrl, protocol, enabled state, note, encrypted API key fields
- sync all related model records under the matched target provider id
- upsert models by `provider.name + capability + modelId`

For `keep_target`:
- mark row skipped

- [ ] **Step 4: Add apply route**

In `server.ts`, add:

```ts
if (url.pathname === "/api/admin/environment-sync/apply" && request.method === "POST") {
  // require admin auth
  // read body
  // call applyEnvironmentSync
  // write audit log
  // return row-level results
}
```

- [ ] **Step 5: Audit sync execution**

Record:
- action: `environment_sync.apply`
- source env
- target env
- selected item counts
- applied/skipped/failed counts

- [ ] **Step 6: Verify**

Run:

```bash
node scripts/verify-environment-sync-service.mjs
node scripts/verify-admin-environment-sync-contract.mjs
npm run build -w @xinghuan/api
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/environment-sync-service.ts apps/api/src/server.ts
git commit -m "feat: add environment sync apply flow"
```

## Task 5: Connect Admin Preview UI

**Files:**
- Modify: `apps/admin/src/admin-environment-sync-panel.tsx`
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/styles.css`

- [ ] **Step 1: Add preview request state**

In the panel, add:
- `sourceEnvironment`
- `targetEnvironment`
- `preview`
- `busy`
- `showOnlyDiff`
- `showOnlyConflict`
- search inputs for users/providers

- [ ] **Step 2: Add preview fetch**

Call:

```ts
api<EnvironmentSyncPreviewResponse>("/api/admin/environment-sync/preview", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ sourceEnvironment, targetEnvironment }),
});
```

- [ ] **Step 3: Render grouped diff lists**

Render separate sections:
- 用户
- 服务商

Each row should show:
- display name
- diff state badge
- source summary
- target summary
- checkbox
- decision selector when conflict

- [ ] **Step 4: Add all-select controls**

Add:
- select all users
- clear all users
- select all providers
- clear all providers
- select visible rows only

- [ ] **Step 5: Add filters and search**

Rows should be filterable by:
- conflict only
- diff only
- text search

- [ ] **Step 6: Verify admin build**

Run:

```bash
npm run build -w @xinghuan/admin
node scripts/verify-admin-environment-sync-contract.mjs
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/admin-environment-sync-panel.tsx apps/admin/src/admin-types.ts apps/admin/src/styles.css
git commit -m "feat: add environment sync preview ui"
```

## Task 6: Connect Apply UI And Confirmation

**Files:**
- Modify: `apps/admin/src/admin-environment-sync-panel.tsx`
- Modify: `apps/admin/src/styles.css`

- [ ] **Step 1: Add per-row decision state**

Track:
- selected rows
- per-row `decision`
- derived counts

- [ ] **Step 2: Add execution confirmation**

Before apply:
- show source env
- show target env
- show selected user count
- show selected provider count
- show conflict count
- require explicit confirm

- [ ] **Step 3: Add apply request**

Call:

```ts
api<EnvironmentSyncApplyResponse>("/api/admin/environment-sync/apply", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    sourceEnvironment,
    targetEnvironment,
    items: selectedItems,
  }),
});
```

- [ ] **Step 4: Render result summary**

Show:
- applied count
- skipped count
- failed count
- failed row messages

- [ ] **Step 5: Verify**

Run:

```bash
npm run build -w @xinghuan/admin
node scripts/verify-admin-environment-sync-contract.mjs
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/admin-environment-sync-panel.tsx apps/admin/src/styles.css
git commit -m "feat: add environment sync apply ui"
```

## Task 7: Add Focused Documentation And Logbook Updates

**Files:**
- Modify: `docs/superpowers/specs/2026-06-17-gray-production-sync-design.md`
- Modify: `DEVLOG.md`
- Optionally Modify: `docs/project-atlas/interfaces-and-dataflow.md`

- [ ] **Step 1: Update design if implementation clarified comparison keys**

If the implementation settles on:
- user key = email
- provider key = name or name+baseUrl

write that explicitly in the spec.

- [ ] **Step 2: Add DEVLOG entry**

Record:
- feature implemented
- validation commands
- whether gray deploy happened yet

- [ ] **Step 3: Add atlas routing note if needed**

If this introduces a durable operator workflow, add a short note to the relevant atlas doc pointing to the admin environment sync page.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-06-17-gray-production-sync-design.md DEVLOG.md docs/project-atlas/interfaces-and-dataflow.md
git commit -m "docs: record environment sync workflow"
```

## Task 8: Final Verification And Gray Rollout Prep

**Files:**
- No new files required unless rollout docs are updated

- [ ] **Step 1: Run full targeted verification**

Run:

```bash
npx tsx scripts/verify-api-sanitizers-contract.ts
node scripts/verify-provider-generation-task-service.mjs
node scripts/verify-admin-assistant-ui-contract.mjs
node scripts/verify-admin-assistant-chat.mjs
node scripts/verify-admin-environment-sync-contract.mjs
node scripts/verify-environment-sync-service.mjs
npm run build -w @xinghuan/shared
npm run build -w @xinghuan/api
npm run build -w @xinghuan/admin
codegraph sync
```

Expected:
- all verification scripts pass
- all builds pass
- CodeGraph sync completes

- [ ] **Step 2: Manual acceptance checklist**

Verify in admin UI:
- source/target env pickers work
- preview loads both users and providers
- full select works
- conflict selector works
- apply confirmation reflects counts
- result summary displays row outcomes

- [ ] **Step 3: Prepare gray rollout note**

If rollout proceeds this session, create an ops note documenting:
- release id
- migration or no-migration status
- gray acceptance evidence

- [ ] **Step 4: Commit final implementation state**

```bash
git add -A
git commit -m "feat: add gray production environment sync workflow"
```

## Self-Review

- Spec coverage:
  - dual-direction sync: covered in Tasks 3-6
  - preview before apply: covered in Tasks 3 and 5
  - per-item selection and select-all: covered in Task 5
  - per-conflict decision: covered in Tasks 4 and 6
  - password/API key sync: covered in Task 4
  - audit logging: covered in Task 4
- Placeholder scan:
  - No `TBD`/`TODO`
  - Commands included
  - File paths included
- Type consistency:
  - preview/apply types defined first in Task 1
  - same names reused through UI and API tasks

Plan complete and saved to `docs/superpowers/plans/2026-06-17-gray-production-sync-plan.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
