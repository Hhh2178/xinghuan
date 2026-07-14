# Unified Extensible Permission Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver `v0.6.2`, a registry-driven permission platform that controls visibility and execution for shared resources, RunningHub, canvas nodes, and provider models with group rules and account overrides.

**Architecture:** Introduce a pure authorization resolver, a PostgreSQL/file-backed subject-and-rule repository, and registrars that map product records to stable permission subjects. All first-wave catalogs and submission paths call the resolver for the same action; legacy deny lists remain read-only compatibility data until the new rules are reconciled and verified in gray.

**Tech Stack:** TypeScript, Node.js HTTP API, PostgreSQL 16, existing file-backed fallback, React, Vitest, npm workspaces.

---

## File Map

- `packages/shared/src/permission-contract.ts`: stable actions, subject, rule, and decision DTOs shared by API and admin.
- `apps/api/src/permissions/authorization-resolver.ts`: pure precedence, inheritance, and explanation logic.
- `apps/api/src/permissions/permission-repository.ts`: Postgres/file persistence for subjects and rules.
- `apps/api/src/permissions/permission-subject-registrars.ts`: first-wave domain-to-subject registration.
- `apps/api/src/permissions/permission-service.ts`: server-facing `can`, `filter`, `explain`, and snapshot facade.
- `apps/api/src/permissions/permission-routes.ts`: admin subject/rule/publish/explain APIs.
- `apps/api/db/021_unified_permission_platform.sql`: subject/rule/snapshot tables and indexes.
- `apps/api/src/shared-resource-routes.ts`, `apps/api/src/server.ts`, `apps/api/src/external-proxy.ts`: replace local permission decisions at resource, RH, model, and task boundaries.
- `apps/admin/src/admin-permission-platform-api.ts`, `apps/admin/src/admin-permission-platform-panel.tsx`: registry-driven policy management and account overrides.
- `apps/web/src/services/permission-state.ts`, `apps/web/src/components/Sidebar.tsx`: effective node/model visibility in member UI.
- `docs/systems/auth-and-users/`, `docs/systems/admin/`, `docs/logbooks/releases/`: system documentation and release evidence.

## Task 1: Establish Shared Contracts And Resolver Tests

**Files:**
- Create: `packages/shared/src/permission-contract.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `apps/api/src/permissions/authorization-resolver.ts`
- Create: `apps/api/src/permissions/authorization-resolver.test.ts`

- [ ] **Step 1: Write resolver tests before implementation**

Create fixtures for `restricted`, `published`, and `retired` subjects. Assert all required precedence cases:

```ts
expect(resolvePermission({ user: member, subject: restricted, action: "view", rules: [] }).allowed).toBe(false);
expect(resolvePermission({ user: member, subject: published, action: "execute", rules: [groupDeny, userAllow] }).allowed).toBe(true);
expect(resolvePermission({ user: member, subject: published, action: "execute", rules: [groupAllow, userDeny] }).allowed).toBe(false);
expect(resolvePermission({ user: member, subject: publishedChild, action: "view", rules: [domainAllow, itemDeny] }).allowed).toBe(false);
expect(resolvePermission({ user: member, subject: published, action: "view", rules: [] }).allowed).toBe(false);
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx vitest run apps/api/src/permissions/authorization-resolver.test.ts`
Expected: failure because the resolver module does not exist.

- [ ] **Step 3: Add immutable contracts**

Define `PermissionAction`, `PermissionExposureState`, `PermissionPrincipalType`, `PermissionEffect`, `PermissionSubject`, `PermissionRule`, `PermissionDecision`, and `PermissionedUser` in `packages/shared/src/permission-contract.ts`. Export them from `packages/shared/src/index.ts`.

Use exact action values:

```ts
export const PERMISSION_ACTIONS = ["view", "use", "execute", "manage", "export"] as const;
export const PERMISSION_EXPOSURE_STATES = ["restricted", "published", "retired"] as const;
```

- [ ] **Step 4: Implement the pure resolver**

Implement `resolvePermission(input)` in `authorization-resolver.ts` with these invariant checks:

```ts
if (user.role === "admin") return allow("admin");
if (subject.exposureState !== "published") return deny("subject-not-published");
const accountMatch = findMostSpecificRule("user", user.id, subject, action, rules);
if (accountMatch) return decisionFrom(accountMatch);
const groupMatch = findMostSpecificRule("group", effectiveGroupId(user), subject, action, rules);
if (groupMatch) return decisionFrom(groupMatch);
return deny("no-matching-rule");
```

Subject matching must accept the exact key and its parent chain only. A child-specific rule is more specific than a parent rule; equal specificity prefers deny.

- [ ] **Step 5: Run focused verification**

Run: `npx vitest run apps/api/src/permissions/authorization-resolver.test.ts`
Expected: all resolver precedence tests pass.

- [ ] **Step 6: Commit the isolated resolver**

```bash
git add packages/shared/src/permission-contract.ts packages/shared/src/index.ts apps/api/src/permissions/authorization-resolver.ts apps/api/src/permissions/authorization-resolver.test.ts
git commit -m "feat: add permission authorization resolver"
```

## Task 2: Add Subject And Rule Persistence

**Files:**
- Create: `apps/api/db/021_unified_permission_platform.sql`
- Create: `apps/api/src/permissions/permission-repository.ts`
- Create: `apps/api/src/permissions/permission-repository.test.ts`
- Modify: `apps/api/src/auth-repository.ts`

- [ ] **Step 1: Write repository mapping tests**

Test database-row mapping and file fallback behavior for a subject, a group allow, a user deny, and virtual `ungrouped` principal. Verify that `ungrouped` does not require a user-group row.

- [ ] **Step 2: Create the migration**

Create `xh_permission_subjects` and `xh_permission_rules` with:

```sql
create table xh_permission_subjects (
  subject_key text primary key,
  domain text not null,
  subject_type text not null,
  parent_key text,
  source_id text not null,
  exposure_state text not null check (exposure_state in ('restricted','published','retired')),
  display_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (domain, source_id)
);
create table xh_permission_rules (
  id text primary key,
  principal_type text not null check (principal_type in ('group','user')),
  principal_id text not null,
  subject_key text not null references xh_permission_subjects(subject_key) on delete restrict,
  action text not null check (action in ('view','use','execute','manage','export')),
  effect text not null check (effect in ('allow','deny')),
  reason text not null default '',
  created_by text references xh_users(id) on delete set null,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (principal_type, principal_id, subject_key, action)
);
```

Add indexes on `(domain, exposure_state)`, `(parent_key)`, and `(principal_type, principal_id, action)`.

- [ ] **Step 3: Implement repository boundaries**

`permission-repository.ts` must expose `listSubjects`, `upsertSubject`, `retireSubject`, `listRules`, `upsertRule`, `deleteRule`, and `readAuthorizationState`. It must provide the same normalized records for Postgres and file-backed mode; extend `AuthDb` with `permissionSubjects` and `permissionRules` for the fallback path.

- [ ] **Step 4: Run repository tests and migration smoke**

Run:

```bash
npx vitest run apps/api/src/permissions/permission-repository.test.ts
npm run type-check -w @xinghuan/api -w @xinghuan/shared
```

Expected: normalized records match in both modes and TypeScript passes.

- [ ] **Step 5: Commit persistence**

```bash
git add apps/api/db/021_unified_permission_platform.sql apps/api/src/permissions/permission-repository.ts apps/api/src/permissions/permission-repository.test.ts apps/api/src/auth-repository.ts
git commit -m "feat: persist permission subjects and rules"
```

## Task 3: Register First-Wave Subjects And Compatibility Migration

**Files:**
- Create: `apps/api/src/permissions/permission-subject-registrars.ts`
- Create: `apps/api/src/permissions/permission-subject-registrars.test.ts`
- Modify: `apps/api/src/shared-resource-routes.ts`
- Modify: `apps/api/src/admin-runninghub-routes.ts`
- Modify: `apps/api/src/admin-provider-routes.ts`
- Modify: `apps/api/src/provider-repository.ts`
- Modify: `apps/api/src/server.ts`

- [ ] **Step 1: Write registrar tests**

Cover creation and update of subjects for resource categories/items, RH app/workflow catalog entries, every `NODE_REGISTRY` type, and provider models. Verify every new record is initially `restricted` and a deleted source becomes `retired`, not deleted.

- [ ] **Step 2: Implement stable subject key builders**

Add pure builders such as:

```ts
resourceItemSubjectKey(id) => `resource.item/${id}`
runningHubAppSubjectKey(catalogId) => `runninghub.app/${catalogId}`
canvasNodeSubjectKey(type) => `canvas.node/${type}`
providerModelSubjectKey(modelId) => `provider.model/${modelId}`
```

Parents must be registered pseudo-subjects (`resource.item/*`, `runninghub.app/*`, `canvas.node/*`, `provider.model/*`) with `published` state only when an administrator explicitly enables domain inheritance.

- [ ] **Step 3: Reconcile legacy data without broadening access**

Implement `reconcileFirstWavePermissionSubjects()` and a one-time migration command. Convert existing deny lists as follows:

- missing or wildcard-deny policy: no allow rules
- empty deny policy: do not publish individual subjects automatically
- explicit deny arrays: retain records as legacy compatibility input until an administrator publishes and assigns the subject

Record a reconciliation report containing counts by domain, restricted subjects, retired subjects, and legacy rules not yet represented.

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run apps/api/src/permissions/permission-subject-registrars.test.ts`
Expected: new entries are restricted and no migration fixture grants member access.

- [ ] **Step 5: Commit subject registration**

```bash
git add apps/api/src/permissions apps/api/src/shared-resource-routes.ts apps/api/src/admin-runninghub-routes.ts apps/api/src/admin-provider-routes.ts apps/api/src/provider-repository.ts apps/api/src/server.ts
git commit -m "feat: register first-wave permission subjects"
```

## Task 4: Centralize API Authorization And Eliminate RH Bypass

**Files:**
- Create: `apps/api/src/permissions/permission-service.ts`
- Create: `apps/api/src/permissions/permission-service.test.ts`
- Modify: `apps/api/src/shared-resource-routes.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/external-proxy.ts`
- Modify: `apps/api/src/provider-generation-task-service.ts`

- [ ] **Step 1: Write failing cross-path tests**

Use one published RH subject and one published provider model. Assert that the same member decision applies to catalog filtering and direct task submission. Include the regression case where a named group has no rule: both catalog and direct RH execution must deny.

- [ ] **Step 2: Implement `PermissionService`**

Expose:

```ts
can(user, subjectKey, action): Promise<PermissionDecision>
filter(user, subjects, action): Promise<PermissionSubject[]>
assertAllowed(user, subjectKey, action): Promise<void>
explain(user, subjectKey, action): Promise<PermissionDecision>
```

`assertAllowed` returns `403 PERMISSION_DENIED` without object metadata to members. It must never treat missing rules as allow.

- [ ] **Step 3: Replace first-wave local checks**

- Resource categories/items: `view` for catalogs, `use` for insert/download/preview.
- RH catalog: `view`; target execution: `execute` on the same catalog subject.
- Provider model catalog: `view`; image/video/audio/chat submission: `execute`.
- Canvas node add APIs and node-driven execution: `view`/`use` for node subject plus `execute` for the selected model or RH target.

Keep legacy deny filtering only behind a temporary compatibility adapter; no route may retain `null => allow` behavior.

- [ ] **Step 4: Run API regression suite**

Run:

```bash
npx vitest run apps/api/src/permissions/permission-service.test.ts
npm run type-check -w @xinghuan/api
npx tsx scripts/verify-aicopy-video-adapter-contract.ts
```

Expected: hidden, direct-use, and execution decisions agree; AIFork behavior remains unchanged.

- [ ] **Step 5: Commit centralized enforcement**

```bash
git add apps/api/src/permissions apps/api/src/shared-resource-routes.ts apps/api/src/server.ts apps/api/src/external-proxy.ts apps/api/src/provider-generation-task-service.ts
git commit -m "feat: enforce unified permissions across first-wave APIs"
```

## Task 5: Add Admin Subject Publishing, Group Rules, And Account Overrides

**Files:**
- Create: `apps/api/src/permissions/permission-routes.ts`
- Create: `apps/api/src/permissions/permission-routes.test.ts`
- Create: `apps/admin/src/admin-permission-platform-api.ts`
- Create: `apps/admin/src/admin-permission-platform-panel.tsx`
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/admin-users-panel.tsx`
- Modify: `apps/api/src/server.ts`

- [ ] **Step 1: Write route tests**

Test administrator-only subject listing, publish with direct group assignment, account allow overriding group deny, account deny overriding group allow, stale revision returning `409`, and member requests receiving no forbidden subject metadata.

- [ ] **Step 2: Implement admin APIs**

Provide subject listing, publish/restrict/retire, create/update/delete rule, bulk dry-run, and explain endpoints. Every mutation records actor, previous rule, next rule, reason, and affected member count in audit logs.

- [ ] **Step 3: Implement the registry-driven panel**

Replace the fixed deny-array editor with a subject tree grouped by domain/type. Preserve the existing user workspace layout, add a group/account selector, direct/inherited state badges, action toggles, a publish dialog, an explanation inspector, and a dry-run impact panel. Use the existing visual tokens and avoid nested card panels.

- [ ] **Step 4: Verify routes and admin build**

Run:

```bash
npx vitest run apps/api/src/permissions/permission-routes.test.ts
npm run type-check -w @xinghuan/admin -w @xinghuan/api
npm run build -w @xinghuan/admin
```

Expected: route tests pass and the admin bundle compiles without text-overflow regressions in the new panel.

- [ ] **Step 5: Commit admin governance**

```bash
git add apps/api/src/permissions/permission-routes.ts apps/api/src/permissions/permission-routes.test.ts apps/admin/src/admin-permission-platform-api.ts apps/admin/src/admin-permission-platform-panel.tsx apps/admin/src/admin-types.ts apps/admin/src/admin-users-panel.tsx apps/api/src/server.ts
git commit -m "feat: manage permission subjects and account overrides"
```

## Task 6: Render Effective Member Capabilities In The Canvas

**Files:**
- Create: `apps/web/src/services/permission-state.ts`
- Create: `apps/web/src/services/permission-state.test.ts`
- Modify: `apps/web/src/components/Sidebar.tsx`
- Modify: `apps/web/src/services/runninghubCatalog.ts`
- Modify: `apps/web/src/providers/models.ts`

- [ ] **Step 1: Write frontend state tests**

Test that denied node/model/RH entries are omitted from add/select UI and that an API `403 PERMISSION_DENIED` produces a concise action error without revealing hidden object metadata.

- [ ] **Step 2: Load effective permissions once per session**

Implement a cached `GET /api/me/permissions` client and derived predicates for node and model subjects. Invalidate on login/logout and after a `PERMISSION_DENIED` response.

- [ ] **Step 3: Wire visibility to existing UI entry points**

Filter `NODE_GROUPS` in `Sidebar.tsx`, provider model selectors in `providers/models.ts`, and RH catalog adapters in `services/runninghubCatalog.ts`. Do not remove existing canvas nodes from saved projects; execution remains server-authorized.

- [ ] **Step 4: Run frontend verification**

Run:

```bash
npx vitest run apps/web/src/services/permission-state.test.ts
npm run type-check -w @xinghuan/web
npm run build -w @xinghuan/web
```

Expected: allowed items remain stable, denied entries disappear, and existing nodes remain loadable.

- [ ] **Step 5: Commit member UI integration**

```bash
git add apps/web/src/services/permission-state.ts apps/web/src/services/permission-state.test.ts apps/web/src/components/Sidebar.tsx apps/web/src/services/runninghubCatalog.ts apps/web/src/providers/models.ts
git commit -m "feat: filter member capability entry points"
```

## Task 7: Snapshot Authorization, Documentation, And Gray Rollout

**Files:**
- Modify: `apps/api/db/021_unified_permission_platform.sql`
- Modify: task persistence and task DTO modules identified in Task 4
- Modify: `docs/systems/auth-and-users/README.md`
- Modify: `docs/systems/admin/ui-and-information-architecture.md`
- Create: `docs/logbooks/releases/gray/2026-07-14-unified-permission-platform-gray.md`
- Modify: release/current-state entry files

- [ ] **Step 1: Add task snapshot test**

Create a queued generation fixture and assert that submission persists `subjectKey`, `action`, effective group, winning rule ID/effect, and policy revision. Change a rule after submission and assert the saved task snapshot remains unchanged.

- [ ] **Step 2: Persist snapshots**

Add `authorization_snapshot jsonb not null default '{}'::jsonb` to `xh_tasks` and its file-backed normalizer. Populate the field only after `assertAllowed` succeeds.

- [ ] **Step 3: Execute full verification**

Run:

```bash
npm run type-check -w @xinghuan/shared -w @xinghuan/api -w @xinghuan/admin -w @xinghuan/web -w @xinghuan/worker
npm run build:single-port
npm run verify:package-exports
npm run verify:web-app-version-define
npm run harness:verify:project
```

- [ ] **Step 4: Prepare and deploy gray**

Use the next release ID `20260714-unified-permission-platform-gray-r1-v062`:

```bash
npm run release:gray:prepare -- --release=20260714-unified-permission-platform-gray-r1-v062
npm run release:gray:deploy -- --release=20260714-unified-permission-platform-gray-r1-v062 --archive=dist-release/20260714-unified-permission-platform-gray-r1-v062.tar.gz --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem
npm run release:gray:verify -- --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem --expected-version=0.6.2 --expected-environment=gray
```

- [ ] **Step 5: Perform gray acceptance**

Verify with administrator, ungrouped member, named-group member, and account-exception member:

1. New restricted subject is absent from all member catalogs and direct execution is denied.
2. Publishing to a group grants the configured actions only.
3. Account allow overrides group deny; account deny overrides group allow.
4. Shared resource, RH, node, and model UI agree with direct API/task submission.
5. Audit/explain view identifies the winning rule without returning hidden metadata to a member.

- [ ] **Step 6: Commit release evidence**

```bash
git add docs/systems/auth-and-users/README.md docs/systems/admin/ui-and-information-architecture.md docs/logbooks/releases docs/logbooks/releases/current-release-index.md ops/current/gray.md ops/README.md README.md MEMORY.md AGENTS.md
git commit -m "docs: record unified permission platform gray rollout"
```
