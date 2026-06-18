# Admin User Groups And Task Owner Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class admin user groups, account remarks, safe account deletion, and task-list owner visibility so the backend can manage project-team accounts and trace task initiators directly from the admin console.

**Architecture:** Extend the existing admin auth domain instead of introducing a parallel user-management subsystem. The backend remains centered in `apps/api/src/server.ts` with dual storage paths (Postgres + file fallback), while the admin UI extends the current users/tasks panels and typed payloads in place, using existing static contract scripts to lock in the new fields and controls before implementation.

**Tech Stack:** Node.js HTTP API, Postgres SQL migrations with file-storage fallback JSON, React + TypeScript admin UI, existing contract-style verification scripts, monorepo workspace build commands, CodeGraph index workflow.

---

## File Structure

- Create: `apps/api/db/015_user_groups_and_user_notes.sql`
  - Add `xh_user_groups` plus user `group_id` and `remark` columns for Postgres.
- Create: `scripts/verify-admin-user-groups-contract.mjs`
  - Lock backend/admin type surface for user groups, remarks, delete route, and task owner fields.
- Modify: `apps/api/src/server.ts`
  - Extend auth/user/task domain models, read/write paths, user-group endpoints, user create/update/delete behavior, task list owner enrichment, and auditing.
- Modify: `apps/admin/src/admin-types.ts`
  - Add `AdminUserGroup`, extend `AdminUser`, extend `TaskRecord`.
- Modify: `apps/admin/src/main.tsx`
  - Load user groups, pass them into users panel, and keep local exported interfaces aligned with the shared admin types.
- Modify: `apps/admin/src/admin-users-panel.tsx`
  - Add user-group management area, remark editing, group assignment, and delete action.
- Modify: `apps/admin/src/admin-task-panel.tsx`
  - Add task owner display column using remark/name/email/group priority.
- Modify: `apps/admin/src/styles.css`
  - Add focused layout styles for the new user-group controls, inline editors, owner metadata, and delete button placement.
- Modify: `scripts/verify-admin-users-panel-contract.mjs`
  - Assert the users panel includes group CRUD, remark controls, group selector, and delete action.
- Modify: `scripts/verify-admin-task-panel-contract.mjs`
  - Assert the task panel exposes owner metadata and deleted-owner fallback.
- Modify: `DEVLOG.md`
  - Record the feature once implementation and verification are complete.

## Implementation Boundaries

- Keep the current role model unchanged: `role` remains permission, `group` remains organization only.
- Support one primary group per account in this iteration.
- Do not add bulk delete, bulk group reassignment, or group-based RBAC.
- Preserve historical tasks and audit logs when a user is deleted.
- Support both storage drivers:
  - Postgres via migration and SQL paths
  - file fallback via `auth.json`

## Task 1: Lock The Contract Before Changing Data Structures

**Files:**
- Create: `scripts/verify-admin-user-groups-contract.mjs`
- Modify: `scripts/verify-admin-users-panel-contract.mjs`
- Modify: `scripts/verify-admin-task-panel-contract.mjs`
- Test: `scripts/verify-admin-user-groups-contract.mjs`
- Test: `scripts/verify-admin-users-panel-contract.mjs`
- Test: `scripts/verify-admin-task-panel-contract.mjs`

- [ ] **Step 1: Add a new backend/type contract script that should fail first**

Create `scripts/verify-admin-user-groups-contract.mjs` with these checks:

```js
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const api = readFileSync(join(root, "apps", "api", "src", "server.ts"), "utf8");
const types = readFileSync(join(root, "apps", "admin", "src", "admin-types.ts"), "utf8");

assert(types.includes("export interface AdminUserGroup"));
assert(types.includes("groupId?: string;"));
assert(types.includes("groupName?: string;"));
assert(types.includes("remark: string;"));
assert(types.includes("ownerRemark?: string;"));
assert(types.includes("ownerGroupName?: string;"));
assert(api.includes('"/api/admin/user-groups"'));
assert(api.includes('request.method === "DELETE"'));
assert(api.includes("ownerDeleted"));
```

- [ ] **Step 2: Extend the users-panel contract to require group and remark controls**

Update `scripts/verify-admin-users-panel-contract.mjs` with these assertions:

```js
assert(panelSource.includes("用户组管理"));
assert(panelSource.includes("placeholder=\"分组名称\""));
assert(panelSource.includes("placeholder=\"账号备注\""));
assert(panelSource.includes("所属组"));
assert(panelSource.includes("备注"));
assert(panelSource.includes("删除账号"));
assert(panelSource.includes('"/api/admin/user-groups"'));
assert(panelSource.includes('`/api/admin/users/${user.id}`'));
```

- [ ] **Step 3: Extend the task-panel contract to require owner display**

Update `scripts/verify-admin-task-panel-contract.mjs` to assert:

```js
assert(panelSource.includes("<th>发起账号</th>"));
assert(panelSource.includes("task.ownerRemark"));
assert(panelSource.includes("task.ownerName"));
assert(panelSource.includes("task.ownerEmail"));
assert(panelSource.includes("task.ownerGroupName"));
assert(panelSource.includes("已删除账号"));
```

- [ ] **Step 4: Run the contracts and verify the new one fails**

Run:

```bash
node scripts/verify-admin-user-groups-contract.mjs
node scripts/verify-admin-users-panel-contract.mjs
node scripts/verify-admin-task-panel-contract.mjs
```

Expected:
- `verify-admin-user-groups-contract.mjs`: FAIL because the new types/routes do not exist yet
- existing users/task panel contracts: FAIL once the new required UI markers are added

- [ ] **Step 5: Commit the failing contract**

```bash
git add scripts/verify-admin-user-groups-contract.mjs scripts/verify-admin-users-panel-contract.mjs scripts/verify-admin-task-panel-contract.mjs
git commit -m "test: lock admin user groups and task owner contracts"
```

## Task 2: Add The Persistent User-Group Schema

**Files:**
- Create: `apps/api/db/015_user_groups_and_user_notes.sql`
- Modify: `apps/api/src/server.ts`
- Test: `scripts/verify-admin-user-groups-contract.mjs`

- [ ] **Step 1: Add the Postgres migration**

Create `apps/api/db/015_user_groups_and_user_notes.sql`:

```sql
create table if not exists xh_user_groups (
  id text primary key,
  name text not null unique,
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table xh_users
  add column if not exists group_id text references xh_user_groups(id) on delete set null;

alter table xh_users
  add column if not exists remark text not null default '';

create index if not exists idx_xh_users_group_id on xh_users(group_id);
create index if not exists idx_xh_user_groups_sort_order on xh_user_groups(sort_order asc, created_at asc);
```

- [ ] **Step 2: Extend the in-memory/file-storage auth models**

Update the auth domain in `apps/api/src/server.ts` so it has:

```ts
interface UserGroupRecord {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  passwordHash: string;
  passwordCipher?: string;
  disabled?: boolean;
  groupId?: string;
  remark?: string;
  createdAt: number;
  updatedAt: number;
}

interface AuthDb {
  users: UserRecord[];
  userGroups: UserGroupRecord[];
  sessions: SessionRecord[];
  loginAttempts: LoginAttemptRecord[];
}
```

- [ ] **Step 3: Extend Postgres auth read/write helpers for groups and new user fields**

Update:
- `readAuthDbPostgres()`
- `writeAuthDbPostgres()`
- `insertAuthUserPostgres()`
- `upsertAuthUserPostgres()`

Use explicit query updates:

```ts
const [usersResult, groupsResult, sessionsResult, attemptsResult] = await Promise.all([
  pool.query("select id, email, name, role, password_hash, password_cipher, disabled, group_id, remark, created_at, updated_at from xh_users order by created_at asc"),
  pool.query("select id, name, description, sort_order, created_at, updated_at from xh_user_groups order by sort_order asc, created_at asc"),
  pool.query("select id, user_id, created_at, expires_at, last_seen_at, ip, user_agent, revoked_at from xh_sessions order by created_at desc"),
  pool.query("select key, scope, email, ip, failure_count, first_failed_at, last_failed_at, blocked_until, updated_at from xh_login_attempts order by updated_at desc"),
]);
```

And in user writes:

```ts
`insert into xh_users (id, email, name, role, password_hash, password_cipher, disabled, group_id, remark, created_at, updated_at)
 values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`
```

- [ ] **Step 4: Run the migration locally and rerun the new contract**

Run:

```bash
node scripts/db-migrate.mjs
node scripts/verify-admin-user-groups-contract.mjs
```

Expected:
- migration applies cleanly
- contract still FAILS because routes/types are not fully implemented yet

- [ ] **Step 5: Commit the schema groundwork**

```bash
git add apps/api/db/015_user_groups_and_user_notes.sql apps/api/src/server.ts
git commit -m "feat: add admin user group schema groundwork"
```

## Task 3: Implement Backend CRUD, Safe User Delete, And Task Owner Enrichment

**Files:**
- Modify: `apps/api/src/server.ts`
- Test: `scripts/verify-admin-user-groups-contract.mjs`
- Test: `npm run build -w @xinghuan/api`

- [ ] **Step 1: Add admin-facing serialization helpers**

Add typed serializers near `toAdminUser`:

```ts
function toAdminUserGroup(group: UserGroupRecord) {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    sortOrder: group.sortOrder,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}

function toAdminUser(user: UserRecord, groupsById?: Map<string, UserGroupRecord>) {
  const password = decryptManagedPassword(user);
  const group = user.groupId ? groupsById?.get(user.groupId) : undefined;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    disabled: Boolean(user.disabled),
    groupId: user.groupId || "",
    groupName: group?.name || "",
    remark: safeText(user.remark),
    passwordAvailable: Boolean(password),
    password: password || "",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
```

- [ ] **Step 2: Add `/api/admin/user-groups` CRUD routes**

Inside the admin route section, implement:

```ts
if (url.pathname === "/api/admin/user-groups") {
  const authDb = await readAuthDb();
  if (request.method === "GET") {
    sendT8(response, authDb.userGroups.map(toAdminUserGroup));
    return true;
  }
  if (request.method === "POST") {
    const body = await readJsonBody<{ name?: string; description?: string; sortOrder?: number }>(request);
    const name = safeText(body.name);
    if (!name) throw new Error("缺少分组名称");
    if (authDb.userGroups.some((group) => group.name === name)) throw new Error("分组名称已存在");
    const now = Date.now();
    const group: UserGroupRecord = {
      id: `ugrp-${now}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      description: safeText(body.description),
      sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : authDb.userGroups.length,
      createdAt: now,
      updatedAt: now,
    };
    if (usePostgresRepository()) {
      await insertUserGroupPostgres(group);
    } else {
      await writeAuthDb({ ...authDb, userGroups: [...authDb.userGroups, group] });
    }
    await appendAudit(adminUser, "user-group.create", "user-group", group.id, `创建用户组 ${group.name}`, requestContext);
    sendT8(response, toAdminUserGroup(group));
  }
}

const groupMatch = url.pathname.match(/^\/api\/admin\/user-groups\/([^/]+)$/);
if (groupMatch && request.method === "PATCH") {
  const id = decodeURIComponent(groupMatch[1]);
  const body = await readJsonBody<{ name?: string; description?: string; sortOrder?: number }>(request);
  const nextName = safeText(body.name);
  const nextDescription = safeText(body.description);
  const nextSortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;
  // update the matching group record in Postgres or authDb.userGroups, reject duplicate nextName on other ids, append audit, sendT8(response, toAdminUserGroup(updatedGroup))
}
if (groupMatch && request.method === "DELETE") {
  const id = decodeURIComponent(groupMatch[1]);
  if (authDb.users.some((user) => user.groupId === id)) throw new Error("组内仍有账号，无法删除");
  // remove the matching group from Postgres or authDb.userGroups, append audit, sendT8(response, { ok: true, deletedGroupId: id })
}
```

- [ ] **Step 3: Extend user create/update routes with `groupId` and `remark`**

Update the existing `/api/admin/users` handlers so:

```ts
const body = await readJsonBody<{
  email?: string;
  name?: string;
  role?: string;
  password?: string;
  groupId?: string;
  remark?: string;
}>(request);

const groupId = safeText(body.groupId);
if (groupId && !authDb.userGroups.some((group) => group.id === groupId)) {
  throw new Error("所属分组不存在");
}
```

Write the new fields:

```ts
groupId: groupId || "",
remark: safeText(body.remark),
```

- [ ] **Step 4: Add safe account deletion**

Implement `DELETE /api/admin/users/:id` with explicit guards:

```ts
if (request.method === "DELETE") {
  if (id === adminUser.id) throw new Error("不能删除当前登录账号");
  const target = authDb.users.find((user) => user.id === id);
  if (!target) throw new Error("用户不存在");
  const remainingAdmins = authDb.users.filter((user) => user.id !== id && user.role === "admin" && !user.disabled);
  if (target.role === "admin" && remainingAdmins.length === 0) {
    throw new Error("不能删除最后一个管理员");
  }
  if (usePostgresRepository()) {
    await deleteAuthUserPostgres(id);
    await revokeUserSessionsPostgres(id, Date.now());
  } else {
    const revokedAt = Date.now();
    await writeAuthDb({
      ...authDb,
      users: authDb.users.filter((user) => user.id !== id),
      sessions: authDb.sessions.map((session) => (session.userId === id ? { ...session, revokedAt } : session)),
    });
  }
  await appendAudit(adminUser, "user.delete", "user", id, `删除用户 ${target.email}`, requestContext);
  sendT8(response, { ok: true, deletedUserId: id });
}
```

For Postgres, delete only from `xh_users` and revoke sessions; let `xh_tasks.owner_id` / `xh_audit_logs.actor_id` follow existing foreign-key behavior.

- [ ] **Step 5: Enrich task records with owner display fields**

Extend `AdminTaskRecord` and `toAdminTaskRecord()`:

```ts
interface AdminTaskRecord {
  id: string;
  title: string;
  status: TaskStatus;
  ownerId?: string;
  providerId?: string;
  modelId?: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  logs: string[];
  createdAt?: number;
  updatedAt: number;
  ownerName?: string;
  ownerEmail?: string;
  ownerRemark?: string;
  ownerGroupId?: string;
  ownerGroupName?: string;
  ownerDeleted?: boolean;
}
```

For Postgres list reads, join `xh_users` and `xh_user_groups`:

```ts
select
  t.id, t.owner_id, t.title, t.status, t.provider_id, t.model_id, t.payload, t.result, t.logs, t.created_at, t.updated_at,
  u.name as owner_name,
  u.email as owner_email,
  u.remark as owner_remark,
  u.group_id as owner_group_id,
  g.name as owner_group_name
from xh_tasks t
left join xh_users u on u.id = t.owner_id
left join xh_user_groups g on g.id = u.group_id
```

For file storage, enrich records after reading:

```ts
const usersById = new Map(authDb.users.map((user) => [user.id, user]));
const groupsById = new Map(authDb.userGroups.map((group) => [group.id, group]));
```

Set:

```ts
ownerDeleted: Boolean(task.ownerId && !owner),
```

- [ ] **Step 6: Run backend verification**

Run:

```bash
node scripts/verify-admin-user-groups-contract.mjs
npm run build -w @xinghuan/api
```

Expected: PASS.

- [ ] **Step 7: Commit the backend implementation**

```bash
git add apps/api/src/server.ts
git commit -m "feat: add admin user group and task owner backend support"
```

## Task 4: Extend Admin Types And Data Loading

**Files:**
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/main.tsx`
- Test: `npm run build -w @xinghuan/admin`

- [ ] **Step 1: Extend the admin type surface**

Add to `apps/admin/src/admin-types.ts`:

```ts
export interface AdminUserGroup {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface AdminUser extends AuthUser {
  disabled: boolean;
  groupId?: string;
  groupName?: string;
  remark: string;
  passwordAvailable: boolean;
  password: string;
  createdAt: number;
  updatedAt: number;
}

export interface TaskRecord {
  id: string;
  title: string;
  status: TaskStatus;
  ownerId?: string;
  providerId?: string;
  modelId?: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  logs: string[];
  createdAt?: number;
  updatedAt: number;
  ownerName?: string;
  ownerEmail?: string;
  ownerRemark?: string;
  ownerGroupId?: string;
  ownerGroupName?: string;
  ownerDeleted?: boolean;
}
```

- [ ] **Step 2: Mirror the local exported interfaces in `main.tsx`**

Update the local re-exported shapes so contracts and panel props stay aligned:

```ts
export interface AdminUser extends AuthUser {
  disabled: boolean;
  groupId?: string;
  groupName?: string;
  remark: string;
  passwordAvailable: boolean;
  password: string;
  createdAt: number;
  updatedAt: number;
}
```

Add:

```ts
const [userGroups, setUserGroups] = useState<AdminUserGroupShape[]>([]);
```

And load them with the existing admin bootstrap:

```ts
const [
  nextSummary,
  nextAssistantSettings,
  nextUsers,
  nextUserGroups,
  nextSessions,
  nextProviders,
  nextModels,
  nextAuditLogs,
  nextSystem,
] = await Promise.all([
  api<Summary>("/api/admin/summary"),
  api<AssistantSettings>("/api/admin/assistant/settings"),
  api<AdminUserShape[]>("/api/admin/users"),
  api<AdminUserGroupShape[]>("/api/admin/user-groups"),
  api<AdminSessionRecordShape[]>("/api/admin/sessions"),
  api<ProviderRecordShape[]>("/api/admin/providers"),
  api<ModelRecordShape[]>("/api/admin/models"),
  api<AuditRecord[]>("/api/admin/audit"),
  api<SystemInfo>("/api/admin/system"),
]);
```

- [ ] **Step 3: Pass groups into the users panel**

Update the render call:

```tsx
<UsersPanel users={users} userGroups={userGroups} sessions={sessions} mutate={mutate} />
```

- [ ] **Step 4: Run the admin build**

Run:

```bash
npm run build -w @xinghuan/admin
```

Expected:
- types in `admin-types.ts` and `main.tsx` compile cleanly
- if the build fails at this stage, the remaining errors should be limited to `admin-users-panel.tsx` and `admin-task-panel.tsx` props/field usage that Tasks 5 and 6 will resolve

- [ ] **Step 5: Commit the type and data-loading changes**

```bash
git add apps/admin/src/admin-types.ts apps/admin/src/main.tsx
git commit -m "feat: load admin user groups into the console"
```

## Task 5: Rebuild The Users Panel For Groups, Remarks, And Delete

**Files:**
- Modify: `apps/admin/src/admin-users-panel.tsx`
- Modify: `apps/admin/src/styles.css`
- Modify: `scripts/verify-admin-users-panel-contract.mjs`
- Test: `scripts/verify-admin-users-panel-contract.mjs`
- Test: `npm run build -w @xinghuan/admin`

- [ ] **Step 1: Extend panel props and creation form**

Change the panel signature:

```tsx
export function UsersPanel({
  users,
  userGroups,
  sessions,
  mutate,
}: {
  users: AdminUser[];
  userGroups: AdminUserGroup[];
  sessions: AdminSessionRecord[];
  mutate: AdminMutate;
}) {
  return (
    <section className="panel-stack users-page">
      <div className="users-layout">{/* user-group management column + user table column */}</div>
      <AdminTable title="活跃会话">{sessions.map((session) => <tr key={session.id} />)}</AdminTable>
    </section>
  );
}
```

Extend the create form state:

```ts
const [form, setForm] = useState({
  email: "",
  name: "",
  role: "member",
  password: "",
  groupId: "",
  remark: "",
});
```

Render:

```tsx
<select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
  <option value="">未分组</option>
  {userGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
</select>
<input placeholder="账号备注" value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} />
```

- [ ] **Step 2: Add a dedicated user-group management panel**

Add a new `FormPanel` above or beside the create form:

```tsx
<FormPanel title="用户组管理" icon={Users}>
  <input placeholder="分组名称" value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} />
  <input placeholder="分组说明" value={groupForm.description} onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })} />
  <input placeholder="排序值" type="number" value={String(groupForm.sortOrder)} onChange={(e) => setGroupForm({ ...groupForm, sortOrder: Number(e.target.value) || 0 })} />
  <button type="button" onClick={() => mutate("/api/admin/user-groups", groupForm)}>创建分组</button>
</FormPanel>
```

And render an adjacent compact list such as:

```tsx
<div className="user-groups-list">
  {userGroups.map((group) => (
    <div key={group.id} className="user-group-row">
      <strong>{group.name}</strong>
      <span>{group.description || "无说明"}</span>
      <span>{users.filter((user) => user.groupId === group.id).length} 个成员</span>
      <div className="row-actions">
        <button type="button" onClick={() => mutate(`/api/admin/user-groups/${group.id}`, { description: group.description, sortOrder: group.sortOrder }, "PATCH")}>保存</button>
        <button type="button" className="danger-button" onClick={() => mutate(`/api/admin/user-groups/${group.id}`, {}, "DELETE")}>删除分组</button>
      </div>
    </div>
  ))}
</div>
```

- [ ] **Step 3: Extend the user table with group, remark, and delete controls**

Update table headers to include:

```tsx
<th>所属组</th>
<th>备注</th>
```

Render inline controls:

```tsx
<select
  value={user.groupId || ""}
  onChange={(event) => mutate(`/api/admin/users/${user.id}`, { groupId: event.target.value }, "PATCH")}
>
  <option value="">未分组</option>
  {userGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
</select>
```

```tsx
<div className="inline-edit">
  <input
    placeholder="账号备注"
    value={remarks[user.id] ?? user.remark ?? ""}
    onChange={(event) => setRemarks({ ...remarks, [user.id]: event.target.value })}
  />
  <button type="button" onClick={() => mutate(`/api/admin/users/${user.id}`, { remark: remarks[user.id] ?? "" }, "PATCH")}>
    保存备注
  </button>
</div>
```

Delete action:

```tsx
<button
  type="button"
  className="danger-button"
  onClick={() => mutate(`/api/admin/users/${user.id}`, {}, "DELETE")}
>
  删除账号
</button>
```

- [ ] **Step 4: Add focused styles for the new management layout**

Add CSS such as:

```css
.users-layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 16px;
}

.user-groups-list,
.user-owner-meta {
  display: grid;
  gap: 8px;
}

.danger-button {
  background: rgba(180, 49, 49, 0.16);
  color: #ffd7d7;
}
```

Keep selectors scoped under existing users/task page class names to avoid cross-page CSS bleed.

- [ ] **Step 5: Run users-panel verification**

Run:

```bash
node scripts/verify-admin-users-panel-contract.mjs
npm run build -w @xinghuan/admin
```

Expected: PASS.

- [ ] **Step 6: Commit the users panel**

```bash
git add apps/admin/src/admin-users-panel.tsx apps/admin/src/styles.css scripts/verify-admin-users-panel-contract.mjs
git commit -m "feat: add admin user groups and account deletion controls"
```

## Task 6: Extend The Task Panel With Owner Visibility

**Files:**
- Modify: `apps/admin/src/admin-task-panel.tsx`
- Modify: `apps/admin/src/styles.css`
- Modify: `scripts/verify-admin-task-panel-contract.mjs`
- Test: `scripts/verify-admin-task-panel-contract.mjs`
- Test: `npm run build -w @xinghuan/admin`

- [ ] **Step 1: Add the owner column and display helper**

Inside `apps/admin/src/admin-task-panel.tsx`, add a small formatter:

```tsx
function ownerPrimary(task: TaskRecord) {
  if (task.ownerDeleted) return "已删除账号";
  return task.ownerRemark || task.ownerName || task.ownerEmail || "未知账号";
}
```

Add a new column:

```tsx
<th>发起账号</th>
```

Render:

```tsx
<td>
  <div className="task-owner-meta">
    <strong>{ownerPrimary(task)}</strong>
    <span>
      {task.ownerDeleted
        ? (task.ownerEmail || "未知账号")
        : [task.ownerEmail, task.ownerGroupName].filter(Boolean).join(" · ") || "-"}
    </span>
  </div>
</td>
```

- [ ] **Step 2: Keep the existing task actions and error display untouched**

The task owner addition must be inserted without disturbing:

```tsx
canCancelTask(task.status)
canRetryTask(task.status)
task.result?.failureReason
task.logs?.slice(-2).join(" / ")
```

- [ ] **Step 3: Add owner metadata styles**

In `apps/admin/src/styles.css`:

```css
.task-owner-meta {
  display: grid;
  gap: 2px;
}

.task-owner-meta strong,
.task-owner-meta span {
  min-width: 0;
  overflow-wrap: anywhere;
}
```

- [ ] **Step 4: Run task-panel verification**

Run:

```bash
node scripts/verify-admin-task-panel-contract.mjs
npm run build -w @xinghuan/admin
```

Expected: PASS.

- [ ] **Step 5: Commit the task panel**

```bash
git add apps/admin/src/admin-task-panel.tsx apps/admin/src/styles.css scripts/verify-admin-task-panel-contract.mjs
git commit -m "feat: show task owner details in admin task list"
```

## Task 7: Full Verification, Devlog, And Final Clean State

**Files:**
- Modify: `DEVLOG.md`

- [ ] **Step 1: Run the targeted contracts**

Run:

```bash
node scripts/verify-admin-user-groups-contract.mjs
node scripts/verify-admin-users-panel-contract.mjs
node scripts/verify-admin-task-panel-contract.mjs
```

Expected: PASS.

- [ ] **Step 2: Run the relevant builds**

Run:

```bash
npm run build -w @xinghuan/api
npm run build -w @xinghuan/admin
```

Expected: PASS.

- [ ] **Step 3: Sync CodeGraph**

Run:

```bash
codegraph sync
```

Expected: PASS.

- [ ] **Step 4: Record the feature in DEVLOG**

Add an entry that states:

```md
- 2026-06-18: 后台新增用户组、账号备注、账号删除与任务发起账号可视化能力；覆盖 Postgres 与文件存储双路径，并补充静态契约验证。
```

- [ ] **Step 5: Commit the verified final state**

```bash
git add DEVLOG.md
git commit -m "docs: record admin user group and task owner rollout"
```

## Self-Review

- Spec coverage:
  - 独立用户组实体: Tasks 2 and 3
  - 账号备注: Tasks 3, 4, 5
  - 安全删除账号: Task 3
  - 任务列表显示发起账号/备注/组: Tasks 3 and 6
  - 非空用户组不可删除: Task 3
  - 角色与分组分离: Tasks 2 and 3
  - 历史任务与审计保留: Task 3
  - 验证与日志收束: Task 7
- Placeholder scan:
  - no `TODO` / `TBD`
  - every task has concrete files, commands, and code snippets
- Type consistency:
  - `AdminUserGroup`, `groupId`, `groupName`, `remark`, `ownerRemark`, `ownerGroupName`, and `ownerDeleted` are used consistently across backend and admin UI tasks
