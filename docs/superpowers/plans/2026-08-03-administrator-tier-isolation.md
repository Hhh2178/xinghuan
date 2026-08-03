# Administrator Tier Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add root and operator administrator tiers so operators retain business administration capabilities while root identities remain server-side invisible and root account management remains root-only.

**Architecture:** Preserve `role: admin | member` as the coarse authorization contract and add `administratorTier: root | operator` as an orthogonal identity attribute. Central visibility and mutation policies project users, sessions, audits and environment-sync records per viewer; Postgres transactions enforce the last-enabled-root invariant.

**Tech Stack:** TypeScript, Node HTTP API, PostgreSQL, file-storage fallback, React 19 Admin, Vitest, unified permission platform.

## Global Constraints

- This follows the sealed artifact release and becomes Gray `0.8.17`; Production reuses the exact Gray archive.
- Existing `role=admin` records become `administratorTier=root`.
- `role=member` always has no administrator tier.
- Operators can manage business content, ordinary members, user groups and permission policies.
- Operators can see other operators but cannot create, update, disable, delete or promote any administrator account.
- Operators cannot see or infer root users, root sessions, root account audit events or root environment-sync records.
- Direct operator access to a known root user/session ID returns the same 404 as an unknown ID.
- At least one enabled root must remain.
- Root identities are environment-local and are not copied by Gray/Production environment sync.
- Do not touch the existing unrelated July logbook changes.
- If the unrelated July logbook changes are still uncommitted at release time, stop before the release-clean gate and ask the user to resolve them; do not stash, reset, commit or delete them.

---

## File Map

- Create `packages/shared/src/administrator-tier.ts`: shared constants, type and normalizer.
- Create `packages/shared/src/administrator-tier.test.ts`: role/tier compatibility tests.
- Modify `packages/shared/src/index.ts`: export the shared contract.
- Create `apps/api/db/047_administrator_tier.sql`: column, backfill and consistency constraint.
- Modify `apps/api/src/auth-repository.ts`: load the tier in precise session/login lookups.
- Create `apps/api/src/admin-user-visibility.ts`: pure visibility, projection and mutation decisions.
- Create `apps/api/src/admin-user-visibility.test.ts`: root/operator/member matrix tests.
- Create `apps/api/src/auth-user-write-repository.ts`: targeted transactional Postgres account writes.
- Create `apps/api/src/auth-user-write-repository.test.ts`: last-root and operator mutation tests.
- Create `apps/api/src/admin-user-routes.ts`: extracted users/sessions route owner.
- Create `apps/api/src/admin-user-routes.test.ts`: HTTP behavior and 404 non-disclosure tests.
- Modify `scripts/verify-admin-users-panel-contract.mjs`: extend the existing Admin users source contract for route extraction and tier-aware wiring.
- Modify `package.json`: keep the existing Admin users verification command in the focused gate list.
- Modify `apps/api/src/server.ts`: add tier to records/current user, wire the route handler, remove moved route block, normalize file fallback and bootstrap users.
- Modify `apps/api/src/admin-audit-routes.ts`: project audits through viewer visibility.
- Modify `apps/api/src/admin-repository.ts`: preserve raw records; accept a projection callback at route level.
- Modify `apps/api/src/environment-sync-service.ts` and `apps/api/src/server.ts`: exclude root from snapshots and reject overwrite of target root.
- Create `apps/api/src/environment-sync-service.test.ts`: root isolation tests.
- Modify `apps/admin/src/admin-types.ts` and `apps/admin/src/main.tsx`: carry current tier.
- Modify `apps/admin/src/admin-users-panel.tsx`: pass viewer tier.
- Modify `apps/admin/src/admin-user-accounts-section.tsx`: root-only administrator controls.
- Modify `apps/admin/src/admin-user-sessions-section.tsx`: viewer-aware copy/actions.
- Modify `apps/admin/src/admin-users-governance-workbench.test.tsx`: operator/root UI contracts.
- Create `docs/adr/0007-administrator-tier-and-root-identity-isolation.md` and index it.
- Modify `CONTEXT.md` and `docs/systems/auth-and-users/permissions-and-administrator-boundary.md`.

### Task 1: Define and migrate the administrator tier

**Files:**
- Create: `packages/shared/src/administrator-tier.ts`
- Create: `packages/shared/src/administrator-tier.test.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `apps/api/db/047_administrator_tier.sql`

**Interfaces:**
- Produces: `AdministratorTier`, `normalizeAdministratorTier(role, value)`, `isRootAdministrator(user)`, `isOperatorAdministrator(user)`.

- [ ] **Step 1: Write the failing shared contract tests**

```ts
import { describe, expect, it } from "vitest";
import { normalizeAdministratorTier } from "./administrator-tier.js";

describe("administrator tier", () => {
  it("maps legacy administrators to root", () => {
    expect(normalizeAdministratorTier("admin", undefined)).toBe("root");
  });

  it("keeps explicit operators", () => {
    expect(normalizeAdministratorTier("admin", "operator")).toBe("operator");
  });

  it("removes tiers from members", () => {
    expect(normalizeAdministratorTier("member", "root")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `npx vitest run packages/shared/src/administrator-tier.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the shared contract**

```ts
export const ADMINISTRATOR_TIERS = ["root", "operator"] as const;
export type AdministratorTier = (typeof ADMINISTRATOR_TIERS)[number];

export function normalizeAdministratorTier(
  role: "admin" | "member",
  value: unknown,
): AdministratorTier | undefined {
  if (role !== "admin") return undefined;
  return value === "operator" ? "operator" : "root";
}

export function isRootAdministrator(user: { role: string; administratorTier?: string } | null | undefined) {
  return user?.role === "admin" && normalizeAdministratorTier("admin", user.administratorTier) === "root";
}

export function isOperatorAdministrator(user: { role: string; administratorTier?: string } | null | undefined) {
  return user?.role === "admin" && normalizeAdministratorTier("admin", user.administratorTier) === "operator";
}
```

- [ ] **Step 4: Add the forward-only SQL migration**

```sql
alter table xh_users add column if not exists administrator_tier text;

update xh_users
set administrator_tier = 'root'
where role = 'admin' and administrator_tier is null;

update xh_users
set administrator_tier = null
where role = 'member' and administrator_tier is not null;

alter table xh_users drop constraint if exists xh_users_administrator_tier_check;
alter table xh_users add constraint xh_users_administrator_tier_check check (
  (role = 'member' and administrator_tier is null)
  or (role = 'admin' and administrator_tier in ('root', 'operator'))
);
```

- [ ] **Step 5: Run shared tests and commit**

Run: `npx vitest run packages/shared/src/administrator-tier.test.ts && npm run build -w @xinghuan/shared`

```bash
git add packages/shared/src/administrator-tier.ts packages/shared/src/administrator-tier.test.ts packages/shared/src/index.ts apps/api/db/047_administrator_tier.sql
git commit -m "feat: define administrator tiers"
```

### Task 2: Carry tier through authentication and storage

**Files:**
- Modify: `apps/api/src/auth-repository.ts`
- Modify: `apps/api/src/auth-repository.test.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/auth-postgres-write-order.test.ts`

**Interfaces:**
- `UserRecord` adds `administratorTier?: AdministratorTier`.
- `CurrentUser` includes `administratorTier`.
- `/api/auth/me` and `/api/auth/admin-me` return the tier for admin users.

- [ ] **Step 1: Extend repository tests first**

Add assertions that a Postgres row `{ role: "admin", administrator_tier: null }` maps to root, explicit operator remains operator, and member rows discard an accidental tier.

- [ ] **Step 2: Run the failing repository test**

Run: `npx vitest run apps/api/src/auth-repository.test.ts`

Expected: FAIL because `administratorTier` is missing.

- [ ] **Step 3: Update every precise auth query and mapper**

Add `administrator_tier` to session lookup, login lookup, full auth DB reader, email lookup and session join selects. Normalize with:

```ts
administratorTier: normalizeAdministratorTier(
  row.role === "admin" ? "admin" : "member",
  row.administrator_tier,
),
```

Update insert/upsert SQL to write the column. File-backed `auth.json` reads normalize legacy admin records to root without forcing an unrelated file rewrite during GET.

- [ ] **Step 4: Update bootstrap behavior**

Bootstrap admin records are explicitly root; bootstrap member records have no tier. `toPublicUser` includes the normalized tier. Existing admin-only login continues to test `role === "admin"` so operators can use Admin.

- [ ] **Step 5: Run auth contracts and commit**

Run:

```bash
npx vitest run apps/api/src/auth-repository.test.ts apps/api/src/auth-postgres-write-order.test.ts
npm run verify:auth-current-user-repository-contract
npm run verify:auth-login-precision-query-contract
npm run type-check -w @xinghuan/api
```

```bash
git add apps/api/src/auth-repository.ts apps/api/src/auth-repository.test.ts apps/api/src/server.ts apps/api/src/auth-postgres-write-order.test.ts
git commit -m "feat: carry administrator tier through auth"
```

### Task 3: Centralize root visibility and account mutation policy

**Files:**
- Create: `apps/api/src/admin-user-visibility.ts`
- Create: `apps/api/src/admin-user-visibility.test.ts`

**Interfaces:**
- Produces `canViewAdministratorIdentity(viewer, target): boolean`.
- Produces `visibleUsersForAdministrator(viewer, users): UserRecord[]`.
- Produces `assertAdministratorAccountMutation(input): void` with stable errors.
- Produces `projectAuditForAdministrator(viewer, audit, rootUserIds): AuditRecord | null`.

- [ ] **Step 1: Write the full matrix test**

```ts
const root = { id: "root-1", role: "admin", administratorTier: "root" } as const;
const operator = { id: "operator-1", role: "admin", administratorTier: "operator" } as const;
const operatorTwo = { id: "operator-2", role: "admin", administratorTier: "operator" } as const;
const member = { id: "member-1", role: "member" } as const;

expect(canViewAdministratorIdentity(root, root)).toBe(true);
expect(canViewAdministratorIdentity(operator, root)).toBe(false);
expect(canViewAdministratorIdentity(operator, operatorTwo)).toBe(true);
expect(canViewAdministratorIdentity(operator, member)).toBe(true);
```

Mutation tests must assert operator may edit member, may not edit operator, and root may edit operator. Audit tests must hide root-account targets and redact root business actors to `{ actorId: "", actorEmail: "系统操作" }`.

- [ ] **Step 2: Run the failing policy test**

Run: `npx vitest run apps/api/src/admin-user-visibility.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement stable non-disclosure errors**

Use these error codes:

```ts
export const USER_NOT_FOUND = "USER_NOT_FOUND";
export const ADMINISTRATOR_MANAGEMENT_REQUIRES_ROOT = "ADMINISTRATOR_MANAGEMENT_REQUIRES_ROOT";
export const LAST_ROOT_REQUIRED = "LAST_ROOT_REQUIRED";
```

Visibility checks occur before mutation authorization. If an operator targets root, throw `HttpError(404, USER_NOT_FOUND)`; do not emit the root-only authorization error.

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run apps/api/src/admin-user-visibility.test.ts`

```bash
git add apps/api/src/admin-user-visibility.ts apps/api/src/admin-user-visibility.test.ts
git commit -m "feat: enforce root identity visibility policy"
```

### Task 4: Add transactional account writes and extract user routes

**Files:**
- Create: `apps/api/src/auth-user-write-repository.ts`
- Create: `apps/api/src/auth-user-write-repository.test.ts`
- Create: `apps/api/src/admin-user-routes.ts`
- Create: `apps/api/src/admin-user-routes.test.ts`
- Modify: `apps/api/src/server.ts`

**Interfaces:**
- `createAuthUserWriteRepository(...).createUser(input)`.
- `updateUser({ actor, userId, patch, now }): Promise<UserRecord>`.
- `deleteUser({ actor, userId, now }): Promise<{ id: string; email: string }>`.
- `createAdminUserRouteHandler(deps)` handles users and sessions endpoints.

- [ ] **Step 1: Write transaction tests before repository code**

The fake Postgres client must assert this ordering for a root downgrade/delete/disable:

```text
begin
select target ... for update
select enabled roots ... for update
update/delete target
revoke sessions
commit
```

Test that a single enabled root causes rollback and `LAST_ROOT_REQUIRED`, while two roots allow the mutation.

- [ ] **Step 2: Run the failing repository test**

Run: `npx vitest run apps/api/src/auth-user-write-repository.test.ts`

Expected: FAIL because the repository does not exist.

- [ ] **Step 3: Implement root-safe writes**

Before updating or deleting an admin target, call the centralized mutation policy. When the current target is an enabled root and the next state is not an enabled root, lock and count enabled roots:

```sql
select id
from xh_users
where role = 'admin'
  and administrator_tier = 'root'
  and disabled = false
order by id
for update;
```

Reject if the locked row count is one. Revoke the target's sessions after any password, role, tier, email or disabled-state change.

- [ ] **Step 4: Write route behavior tests**

Test all of these:

- root GET users returns root, operators and members;
- operator GET users returns operators and members but no root;
- operator POST with `role=admin` returns 403;
- operator PATCH member succeeds;
- operator PATCH operator returns 403;
- operator PATCH known root returns 404;
- root creates operator with `{ role: "admin", administratorTier: "operator" }`;
- root cannot remove the final enabled root;
- operator session list excludes root sessions and revoke-by-ID returns 404.

- [ ] **Step 5: Extract the route block and wire it once**

Move `/api/admin/users`, `/api/admin/users/:id`, `/api/admin/sessions`, and session revoke handling out of `server.ts`. Keep user-group routes in their existing owner. Pass current viewer into projections; calculate counts only from already-filtered arrays.

- [ ] **Step 6: Run focused tests and hotspot contracts**

Extend the existing `scripts/verify-admin-users-panel-contract.mjs` to assert that `server.ts` imports and invokes `createAdminUserRouteHandler`, no longer contains the four moved route literals, and the Admin accounts section consumes `administratorTier`. Keep the existing `"verify:admin-users-panel-contract": "node scripts/verify-admin-users-panel-contract.mjs"` root command.

Run:

```bash
npx vitest run apps/api/src/auth-user-write-repository.test.ts apps/api/src/admin-user-routes.test.ts
npm run verify:admin-users-panel-contract
npm run verify:file-hotspot-budgets
npm run verify:hotspot-watchlist-contract
```

- [ ] **Step 7: Commit the route boundary**

```bash
git add apps/api/src/auth-user-write-repository.ts apps/api/src/auth-user-write-repository.test.ts apps/api/src/admin-user-routes.ts apps/api/src/admin-user-routes.test.ts apps/api/src/server.ts package.json scripts/verify-admin-users-panel-contract.mjs
git commit -m "feat: isolate administrator account governance"
```

### Task 5: Remove root identity from audits and environment sync

**Files:**
- Modify: `apps/api/src/admin-audit-routes.ts`
- Create: `apps/api/src/admin-audit-routes.test.ts`
- Modify: `apps/api/src/environment-sync-service.ts`
- Create: `apps/api/src/environment-sync-service.test.ts`
- Modify: `apps/api/src/server.ts`

**Interfaces:**
- Audit route consumes `projectAuditForAdministrator`.
- Environment snapshots contain operators/members only; root never enters comparison or write plans.

- [ ] **Step 1: Add audit projection tests**

For an operator viewer, assert a root-targeted `user.update` audit is absent, a root-authored `provider.update` audit remains with fixed system actor and no IP/User-Agent, and operator/member-authored records remain unchanged. Root viewer receives raw records.

- [ ] **Step 2: Add environment-sync tests**

Assert source root records are excluded, source operator records remain, and applying an operator record onto an existing target root email returns a failed result without changing the root.

- [ ] **Step 3: Run failing tests**

Run: `npx vitest run apps/api/src/admin-audit-routes.test.ts apps/api/src/environment-sync-service.test.ts`

- [ ] **Step 4: Implement projections at the data boundary**

`readEnvironmentSyncLocalSnapshot` filters root before constructing the snapshot. `upsertEnvironmentSyncUser` reads the target record and rejects when `isRootAdministrator(existing)` is true. Do not transmit root password hashes/ciphers over the sync channel.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npx vitest run apps/api/src/admin-audit-routes.test.ts apps/api/src/environment-sync-service.test.ts
npm run verify:environment-sync-smoke
```

```bash
git add apps/api/src/admin-audit-routes.ts apps/api/src/admin-audit-routes.test.ts apps/api/src/environment-sync-service.ts apps/api/src/environment-sync-service.test.ts apps/api/src/server.ts
git commit -m "security: hide root identities from admin projections"
```

### Task 6: Add viewer-aware Admin controls

**Files:**
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/main.tsx`
- Modify: `apps/admin/src/admin-users-panel.tsx`
- Modify: `apps/admin/src/admin-user-accounts-section.tsx`
- Modify: `apps/admin/src/admin-user-sessions-section.tsx`
- Modify: `apps/admin/src/admin-users-governance-workbench.test.tsx`

**Interfaces:**
- `AuthUser` and `AdminUser` add `administratorTier?: AdministratorTier`.
- `UsersPanel` receives `currentUser: AuthUser`.
- Account/session sections receive `viewerTier`.

- [ ] **Step 1: Extend SSR UI tests**

Render the account section as root and operator. Root markup must include `最高管理员`, `次级管理员`, admin-tier selector and operator management actions. Operator markup must include visible operator labels but omit administrator create/edit/disable/delete actions.

- [ ] **Step 2: Run the failing Admin test**

Run: `npx vitest run apps/admin/src/admin-users-governance-workbench.test.tsx`

- [ ] **Step 3: Update create and edit controls**

For root, role options are member, operator and root; serialize as:

```ts
const payload = selection === "member"
  ? { role: "member" }
  : { role: "admin", administratorTier: selection };
```

For operator, the create form is fixed to member and administrator records render read-only identity/status. Member edit controls remain available.

- [ ] **Step 4: Add explicit status labels**

Use copy `最高管理员`, `次级管理员`, `普通成员`. Do not show root count to operators; counts are based on the already-filtered API list. Do not add a placeholder such as “隐藏了 N 个最高管理员”.

- [ ] **Step 5: Run Admin checks and commit**

Run:

```bash
npx vitest run apps/admin/src/admin-users-governance-workbench.test.tsx
npm run type-check -w @xinghuan/admin
npm run build -w @xinghuan/admin
```

```bash
git add apps/admin/src/admin-types.ts apps/admin/src/main.tsx apps/admin/src/admin-users-panel.tsx apps/admin/src/admin-user-accounts-section.tsx apps/admin/src/admin-user-sessions-section.tsx apps/admin/src/admin-users-governance-workbench.test.tsx
git commit -m "feat: add tier-aware administrator controls"
```

### Task 7: Document, validate and release `0.8.17`

**Files:**
- Create: `docs/adr/0007-administrator-tier-and-root-identity-isolation.md`
- Modify: `docs/adr/README.md`
- Modify: `CONTEXT.md`
- Modify: `docs/systems/auth-and-users/permissions-and-administrator-boundary.md`
- Modify: release version/state/logbook files required by governance.

**Interfaces:**
- Produces an auditable Gray/Production rollout with a root-safe rollback path.

- [ ] **Step 1: Record domain and ADR decisions**

Define Highest Administrator and Operator Administrator in `CONTEXT.md`. ADR 0007 records coarse-role compatibility, environment-local root identities, server-side non-disclosure and the last-root transaction.

- [ ] **Step 2: Run the complete local security matrix**

Run:

```bash
npm run type-check
npm run test
npm run build:single-port
npm run verify:member-admin-boundary
npm run verify:admin-session-governance
npm run verify:environment-sync-permission-contract
npm run harness:verify:project
npm run harness:verify:workspace
npm run harness:verify:release
```

- [ ] **Step 3: Back up auth tables and deploy Gray `0.8.17`**

Use release ID `20260803-administrator-tier-isolation-v0817-r1`. Before migration, create the project-authorized database backup covering `xh_users`, `xh_sessions`, `xh_audit_logs` and schema migration state. Deploy the sealed artifact, run migration and verify all existing admins are root.

- [ ] **Step 4: Perform authenticated Gray attack-surface acceptance**

Create one temporary operator through a root session. Verify business Admin pages work, member mutation works, root list/session/audit/sync data is absent, known root IDs return 404, administrator mutation returns 403, and last-root operations return 409. Verify at `1920x1080` and remove or disable only the explicitly created temporary operator through the root UI.

- [ ] **Step 5: Promote the same artifact to Production after approval**

Repeat database backup, migration and authenticated checks with the Production root. Do not copy the Gray root identity or credentials.

- [ ] **Step 6: Update canonical state and release evidence**

Update `ops/current/release-state.json` first, then projections and release/validation logbooks. Run staged release contracts and commit:

Append the verified `0.8.17` administrator-tier implementation and Gray/Production runtime evidence to `docs/systems/harness/README.md` and `docs/systems/harness/workspace-verify-release-map.md`; do not mark the harness sequence complete without the actual artifact and verification references.

```bash
git commit -m "release: deploy administrator tiers v0.8.17"
```
