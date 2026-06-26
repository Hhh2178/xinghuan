# Admin Governance Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the admin governance surfaces so user-group creation works reliably with Chinese group names, public resource management uses adaptive preview cards, and the users/permissions backend becomes a stable, readable governance workspace.

**Architecture:** Keep the existing admin route topology and deny-list permission model, but split the work into four implementation batches: group-create chain repair, public-resource admin card rebuild, users/permissions workspace redesign, and UI hardening with gray verification. Prefer helper/component extraction over further growing `admin-users-panel.tsx`, `admin-permissions-panel.tsx`, and `admin-public-resources-panel.tsx`.

**Tech Stack:** Node.js HTTP API, React 19 + TypeScript, Vite admin workspace, existing admin API client, CSS in `apps/admin/src/styles.css`, CodeGraph, contract/verify scripts, gray deployment scripts.

---

## File Structure And Responsibilities

### Existing files to modify

- `apps/api/src/server.ts`
  - Fix user-group create ID generation and localize error-handling boundaries.
- `apps/api/src/api-sanitizers.ts`
  - Keep slug sanitization for display-safe identifiers, but stop relying on it for user-group primary key uniqueness.
- `apps/admin/src/main.tsx`
  - Keep global error banner reserved for page-level/system-level failures instead of local form validation noise.
- `apps/admin/src/admin-users-panel.tsx`
  - Temporary shell until group form, group workbench, and user sessions sections are split out.
- `apps/admin/src/admin-permissions-panel.tsx`
  - Temporary shell until group rail, summary strip, content area, and save bar are split out.
- `apps/admin/src/admin-public-resources-panel.tsx`
  - Temporary shell until category rail, card grid, and preview modal are split out.
- `apps/admin/src/admin-api-client.ts`
  - Add any missing localized methods needed by the redesigned admin surfaces.
- `apps/admin/src/admin-types.ts`
  - Extend admin-side types for preview state and any refined group/policy payloads.
- `apps/admin/src/styles.css`
  - Add the new workspace layout, card grid, preview modal, and anti-overflow rules.
- `docs/systems/admin/ui-and-information-architecture.md`
  - Record the landed IA, not just the intended one.
- `docs/logbooks/daily/2026/2026-06/recent-highlights.md`
  - Record the redesign batch summary after implementation.

### New files to create

- `apps/admin/src/admin-user-groups-section.tsx`
  - Dedicated user-group workbench with local form error handling and a scalable card/list layout.
- `apps/admin/src/admin-user-accounts-section.tsx`
  - Dedicated account tab content so account management is no longer interleaved with group logic.
- `apps/admin/src/admin-user-sessions-section.tsx`
  - Dedicated sessions tab content.
- `apps/admin/src/admin-permissions-group-rail.tsx`
  - Searchable group selector for the permissions workspace.
- `apps/admin/src/admin-permissions-summary-strip.tsx`
  - Summary KPI row for the selected group.
- `apps/admin/src/admin-permissions-savebar.tsx`
  - Sticky dirty/save status component.
- `apps/admin/src/admin-public-resource-card.tsx`
  - Adaptive preview card with preview, meta, and actions.
- `apps/admin/src/admin-media-preview-modal.tsx`
  - Shared image/video/audio preview modal with contain behavior.
- `apps/admin/src/admin-public-resource-category-sidebar.tsx`
  - Category rail extracted from the public-resource page.
- `scripts/verify-admin-governance-redesign-contract.mjs`
  - Static contract script that checks the redesign seams exist.

### Verification commands to use during implementation

- `codegraph status`
- `npm run verify:api-sanitizers-contract`
- `npm run verify:admin-users-panel-contract`
- `npm run verify:shared-resource-library`
- `npm run verify:generation-library-resource-card`
- `npm run verify:engineering-governance-contract`
- `npm run type-check -w @xinghuan/admin`
- `npm run type-check -w @xinghuan/api`
- `npm run build -w @xinghuan/admin`
- `codegraph sync`

---

### Task 1: Repair User-Group Create IDs And Local Error Boundaries

**Files:**
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/api-sanitizers.ts`
- Modify: `apps/admin/src/main.tsx`
- Modify: `apps/admin/src/admin-users-panel.tsx`
- Create: `scripts/verify-admin-governance-redesign-contract.mjs`

- [ ] **Step 1: Add a failing contract check for legacy slug-based group IDs**

```js
import { readFileSync } from "node:fs";

const server = readFileSync("apps/api/src/server.ts", "utf8");
if (!server.includes('group-${now}-')) {
  throw new Error("Expected user-group IDs to use generated group-<timestamp>-<random> style IDs.");
}
if (server.includes('safeSlug(body.id || name, `group-${now}`)')) {
  throw new Error("User-group create route still relies on name-derived slug IDs.");
}
```

- [ ] **Step 2: Run the contract first and verify it fails on current source**

```powershell
node scripts/verify-admin-governance-redesign-contract.mjs
```

Expected: fail because `apps/api/src/server.ts` still contains slug-derived user-group IDs.

- [ ] **Step 3: Replace name-derived group ID generation with generated stable IDs**

```ts
const now = Date.now();
const groupId = `group-${now}-${Math.random().toString(36).slice(2, 8)}`;
const group: UserGroupRecord = {
  id: groupId,
  name,
  description: safeText(body.description),
  sortOrder: normalizeUserGroupSortOrder(body.sortOrder),
  createdAt: now,
  updatedAt: now,
};
```

- [ ] **Step 4: Keep name uniqueness, but stop surfacing ID collisions as the primary user path**

```ts
assertUserGroupNameUnique(authDb.userGroups, name);
if (authDb.userGroups.some((item) => item.id === group.id)) {
  throw new Error("系统生成用户组 ID 冲突，请重试");
}
```

- [ ] **Step 5: Move group-create failure messaging into the groups form instead of the page-global banner**

```tsx
const [groupFormError, setGroupFormError] = useState("");

async function handleCreateGroup() {
  setGroupFormError("");
  try {
    await mutate("/api/admin/user-groups", groupForm);
    setGroupForm({ name: "", description: "", sortOrder: 0 });
  } catch (error) {
    setGroupFormError(error instanceof Error ? error.message : String(error));
  }
}
```

- [ ] **Step 6: Keep the global error banner in `main.tsx` for system-level failures only**

```tsx
const [errorScope, setErrorScope] = useState<"global" | "local">("global");

if (errorScope === "global" && error) {
  return <div className="error-banner">{error}</div>;
}
```

- [ ] **Step 7: Re-run the redesign contract and the existing API sanitizer contract**

```powershell
node scripts/verify-admin-governance-redesign-contract.mjs
npm run verify:api-sanitizers-contract
```

Expected: both pass.

- [ ] **Step 8: Commit the batch**

```bash
git add apps/api/src/server.ts apps/api/src/api-sanitizers.ts apps/admin/src/main.tsx apps/admin/src/admin-users-panel.tsx scripts/verify-admin-governance-redesign-contract.mjs
git commit -m "fix: stabilize admin user group creation ids"
```

---

### Task 2: Split The Users Workspace Into Account, Group, Permissions, And Session Sections

**Files:**
- Create: `apps/admin/src/admin-user-accounts-section.tsx`
- Create: `apps/admin/src/admin-user-groups-section.tsx`
- Create: `apps/admin/src/admin-user-sessions-section.tsx`
- Modify: `apps/admin/src/admin-users-panel.tsx`
- Modify: `apps/admin/src/styles.css`
- Test: `scripts/verify-admin-governance-redesign-contract.mjs`

- [ ] **Step 1: Add a failing contract that expects extracted user workspace sections**

```js
import { existsSync } from "node:fs";

for (const path of [
  "apps/admin/src/admin-user-accounts-section.tsx",
  "apps/admin/src/admin-user-groups-section.tsx",
  "apps/admin/src/admin-user-sessions-section.tsx",
]) {
  if (!existsSync(path)) throw new Error(`Missing extracted admin section: ${path}`);
}
```

- [ ] **Step 2: Run the contract and confirm it fails before file extraction**

```powershell
node scripts/verify-admin-governance-redesign-contract.mjs
```

Expected: fail because the new section files do not exist yet.

- [ ] **Step 3: Extract the accounts tab into its own section component**

```tsx
export function AdminUserAccountsSection({
  users,
  userGroups,
  mutate,
}: AdminUserAccountsSectionProps) {
  return (
    <div className="users-tab-stack">
      <FormPanel title="新增成员" icon={Plus}>
        {/* existing account create fields */}
      </FormPanel>
      <AdminTable title="账号列表">{/* existing account rows */}</AdminTable>
    </div>
  );
}
```

- [ ] **Step 4: Extract the group workbench into its own section with local error surface**

```tsx
export function AdminUserGroupsSection({
  groups,
  users,
  mutate,
}: AdminUserGroupsSectionProps) {
  return (
    <div className="users-group-workbench">
      <section className="panel-stack">
        <FormPanel title="新建用户组" icon={FolderTree}>
          {/* group form + local form error */}
        </FormPanel>
        <section className="data-panel users-group-list-panel">
          {/* searchable card/grid/list layout */}
        </section>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Extract the sessions tab into its own section**

```tsx
export function AdminUserSessionsSection({
  sessions,
  mutate,
}: AdminUserSessionsSectionProps) {
  return (
    <div className="users-tab-stack">
      <div className="api-card users-subhero">{/* session summary */}</div>
      <AdminTable title="活跃会话">{/* session rows */}</AdminTable>
    </div>
  );
}
```

- [ ] **Step 6: Simplify `admin-users-panel.tsx` into a shell that only owns tab state and shared data loading**

```tsx
{activeTab === "accounts" ? (
  <AdminUserAccountsSection users={users} userGroups={sortedGroups} mutate={mutate} />
) : null}
{activeTab === "groups" ? (
  <AdminUserGroupsSection groups={sortedGroups} users={users} mutate={mutate} />
) : null}
{activeTab === "sessions" ? (
  <AdminUserSessionsSection sessions={sessions} mutate={mutate} />
) : null}
```

- [ ] **Step 7: Replace the current cramped group editor layout with a stable two-zone workbench**

```css
.users-group-workbench {
  display: grid;
  grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
  gap: 16px;
}

.users-group-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}
```

- [ ] **Step 8: Run the existing users-panel contract plus the redesign contract**

```powershell
node scripts/verify-admin-governance-redesign-contract.mjs
npm run verify:admin-users-panel-contract
npm run type-check -w @xinghuan/admin
```

Expected: all pass.

- [ ] **Step 9: Commit the batch**

```bash
git add apps/admin/src/admin-user-accounts-section.tsx apps/admin/src/admin-user-groups-section.tsx apps/admin/src/admin-user-sessions-section.tsx apps/admin/src/admin-users-panel.tsx apps/admin/src/styles.css scripts/verify-admin-governance-redesign-contract.mjs
git commit -m "refactor: split admin users workspace sections"
```

---

### Task 3: Rebuild The Permissions Workspace With A Proper Group Rail, Summary Strip, And Save Bar

**Files:**
- Create: `apps/admin/src/admin-permissions-group-rail.tsx`
- Create: `apps/admin/src/admin-permissions-summary-strip.tsx`
- Create: `apps/admin/src/admin-permissions-savebar.tsx`
- Modify: `apps/admin/src/admin-permissions-panel.tsx`
- Modify: `apps/admin/src/styles.css`
- Test: `scripts/verify-admin-governance-redesign-contract.mjs`

- [ ] **Step 1: Add a failing contract for extracted permissions workspace seams**

```js
for (const path of [
  "apps/admin/src/admin-permissions-group-rail.tsx",
  "apps/admin/src/admin-permissions-summary-strip.tsx",
  "apps/admin/src/admin-permissions-savebar.tsx",
]) {
  if (!existsSync(path)) throw new Error(`Missing permissions seam: ${path}`);
}
```

- [ ] **Step 2: Run the redesign contract and confirm it fails before extraction**

```powershell
node scripts/verify-admin-governance-redesign-contract.mjs
```

Expected: fail because the permissions seam files are missing.

- [ ] **Step 3: Extract the left-side group selector into a dedicated rail**

```tsx
export function AdminPermissionsGroupRail({
  groups,
  selectedGroupId,
  onSelect,
  search,
  onSearchChange,
}: AdminPermissionsGroupRailProps) {
  return (
    <section className="data-panel permissions-groups-panel">
      {/* header + search + group cards */}
    </section>
  );
}
```

- [ ] **Step 4: Extract the current-group KPI row so it can be styled independently from the editor**

```tsx
export function AdminPermissionsSummaryStrip({
  groupName,
  memberCount,
  restrictedResources,
  restrictedApps,
  restrictedWorkflows,
  restrictedNodes,
}: AdminPermissionsSummaryStripProps) {
  return <div className="permissions-summary-grid">{/* summary cards */}</div>;
}
```

- [ ] **Step 5: Extract the sticky save bar with clean state vocabulary**

```tsx
export function AdminPermissionsSavebar({
  dirty,
  saving,
  onSave,
}: AdminPermissionsSavebarProps) {
  return (
    <div className="permissions-savebar">
      <strong>{dirty ? "当前分组权限有未保存改动" : "当前分组权限已同步"}</strong>
      <button type="button" disabled={!dirty || saving} onClick={onSave}>
        {saving ? "保存中" : "保存权限"}
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Tone down the left-side group cards and re-center emphasis on the right-side editor**

```css
.permissions-group-card.active {
  border-color: rgba(45, 212, 191, 0.34);
  background: rgba(8, 47, 73, 0.24);
  box-shadow: inset 0 0 0 1px rgba(45, 212, 191, 0.18);
}

.permissions-hero {
  padding: 18px;
  border-radius: 14px;
}
```

- [ ] **Step 7: Make the permissions toolbar and section tabs obey anti-overflow rules**

```css
.permissions-section-tabs,
.permissions-toolbar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.permissions-toolbar__actions button {
  min-height: 38px;
  max-width: 100%;
  white-space: normal;
}
```

- [ ] **Step 8: Run type-check and the redesign contract**

```powershell
node scripts/verify-admin-governance-redesign-contract.mjs
npm run type-check -w @xinghuan/admin
```

Expected: pass.

- [ ] **Step 9: Commit the batch**

```bash
git add apps/admin/src/admin-permissions-group-rail.tsx apps/admin/src/admin-permissions-summary-strip.tsx apps/admin/src/admin-permissions-savebar.tsx apps/admin/src/admin-permissions-panel.tsx apps/admin/src/styles.css scripts/verify-admin-governance-redesign-contract.mjs
git commit -m "refactor: rebuild admin permissions workspace layout"
```

---

### Task 4: Convert Public Resource Admin From Rows To Adaptive Preview Cards

**Files:**
- Create: `apps/admin/src/admin-public-resource-card.tsx`
- Create: `apps/admin/src/admin-media-preview-modal.tsx`
- Create: `apps/admin/src/admin-public-resource-category-sidebar.tsx`
- Modify: `apps/admin/src/admin-public-resources-panel.tsx`
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/styles.css`
- Test: `scripts/verify-admin-governance-redesign-contract.mjs`

- [ ] **Step 1: Add a failing contract for the card-based public resource seams**

```js
for (const path of [
  "apps/admin/src/admin-public-resource-card.tsx",
  "apps/admin/src/admin-media-preview-modal.tsx",
  "apps/admin/src/admin-public-resource-category-sidebar.tsx",
]) {
  if (!existsSync(path)) throw new Error(`Missing public resource seam: ${path}`);
}
```

- [ ] **Step 2: Run the redesign contract and verify it fails before file creation**

```powershell
node scripts/verify-admin-governance-redesign-contract.mjs
```

Expected: fail because the public-resource seam files do not exist yet.

- [ ] **Step 3: Extract the category rail into its own component**

```tsx
export function AdminPublicResourceCategorySidebar({
  categories,
  categoryId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: AdminPublicResourceCategorySidebarProps) {
  return <aside className="data-panel admin-public-resources-categories">{/* rail UI */}</aside>;
}
```

- [ ] **Step 4: Create a single resource card component with upper preview and lower management zone**

```tsx
export function AdminPublicResourceCard({
  item,
  draft,
  onChange,
  onPreview,
  onSave,
  onDelete,
}: AdminPublicResourceCardProps) {
  return (
    <article className="admin-public-resource-card">
      <div className="admin-public-resource-card__preview">{/* image/video/audio preview */}</div>
      <div className="admin-public-resource-card__body">{/* fields + meta + actions */}</div>
    </article>
  );
}
```

- [ ] **Step 5: Add a shared preview modal that preserves full material visibility**

```tsx
export function AdminMediaPreviewModal({
  item,
  open,
  onClose,
}: AdminMediaPreviewModalProps) {
  if (!open || !item) return null;
  return (
    <div className="admin-media-preview-modal">
      <div className="admin-media-preview-modal__frame">{/* contain-based media */}</div>
    </div>
  );
}
```

- [ ] **Step 6: Replace the existing row layout with an auto-fit card grid**

```css
.admin-public-resources-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
}

.admin-public-resource-card__preview {
  aspect-ratio: 4 / 3;
  background: #020617;
}
```

- [ ] **Step 7: Make image/video/audio preview all obey full-material contain rules**

```css
.admin-public-resource-card__preview img,
.admin-media-preview-modal__frame img,
.admin-media-preview-modal__frame video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}
```

- [ ] **Step 8: Run the existing shared-resource contract, admin type-check, and redesign contract**

```powershell
node scripts/verify-admin-governance-redesign-contract.mjs
npm run verify:shared-resource-library
npm run type-check -w @xinghuan/admin
```

Expected: pass.

- [ ] **Step 9: Commit the batch**

```bash
git add apps/admin/src/admin-public-resource-card.tsx apps/admin/src/admin-media-preview-modal.tsx apps/admin/src/admin-public-resource-category-sidebar.tsx apps/admin/src/admin-public-resources-panel.tsx apps/admin/src/admin-types.ts apps/admin/src/styles.css scripts/verify-admin-governance-redesign-contract.mjs
git commit -m "feat: rebuild admin public resource cards and preview"
```

---

### Task 5: Harden Responsive Rules, Update Docs, And Prepare Gray Verification

**Files:**
- Modify: `apps/admin/src/styles.css`
- Modify: `docs/systems/admin/ui-and-information-architecture.md`
- Modify: `docs/logbooks/daily/2026/2026-06/recent-highlights.md`
- Test: `scripts/verify-admin-governance-redesign-contract.mjs`

- [ ] **Step 1: Add a failing contract that expects anti-overflow selectors in the admin stylesheet**

```js
const styles = readFileSync("apps/admin/src/styles.css", "utf8");
for (const needle of [
  ".admin-public-resources-grid",
  ".admin-media-preview-modal",
  ".permissions-savebar",
  ".users-group-workbench",
]) {
  if (!styles.includes(needle)) throw new Error(`Missing expected admin governance style hook: ${needle}`);
}
```

- [ ] **Step 2: Run the redesign contract and verify it still enforces the intended seams**

```powershell
node scripts/verify-admin-governance-redesign-contract.mjs
```

Expected: pass only after the preceding tasks are complete.

- [ ] **Step 3: Add final anti-overflow rules for hero copy, pills, action rows, and scroll areas**

```css
.users-hero,
.permissions-hero,
.admin-public-resources-hero {
  grid-template-columns: minmax(0, 1fr);
}

.users-hero p,
.permissions-hero p,
.admin-public-resources-hero p {
  white-space: normal;
  overflow-wrap: anywhere;
}
```

- [ ] **Step 4: Document the landed IA in the admin systems doc**

```md
## 2026-06-26 后台治理重构落地

- 用户后台正式拆成账号 / 用户组 / 权限 / 会话四个稳定工作区
- 公共资源后台改为卡片化预览治理页
- 创建用户组改用系统生成的稳定唯一 ID，不再依赖中文名 slug
```

- [ ] **Step 5: Record the implementation summary in the daily logbook**

```md
- 完成后台治理重构第一批落地：
  - 用户组创建 ID 策略修复
  - 用户 / 权限工作台分区重构
  - 公共资源后台卡片化预览改造
  - UI 防溢出与滚动区治理
```

- [ ] **Step 6: Run the final local verification chain**

```powershell
codegraph status
node scripts/verify-admin-governance-redesign-contract.mjs
npm run verify:admin-users-panel-contract
npm run verify:shared-resource-library
npm run verify:engineering-governance-contract
npm run type-check -w @xinghuan/admin
npm run type-check -w @xinghuan/api
npm run build -w @xinghuan/admin
codegraph sync
```

Expected: all pass, and CodeGraph stays in sync with source.

- [ ] **Step 7: Commit the docs and hardening batch**

```bash
git add apps/admin/src/styles.css docs/systems/admin/ui-and-information-architecture.md docs/logbooks/daily/2026/2026-06/recent-highlights.md scripts/verify-admin-governance-redesign-contract.mjs
git commit -m "docs: record admin governance redesign landing"
```

---

## Gray Verification Checklist

- [ ] Create a Chinese-named group such as `榴莲组` and verify creation succeeds.
- [ ] Confirm group-create validation errors stay inside the group form, not the page-global red banner.
- [ ] Create more than 10 groups and confirm the group workbench remains fully scrollable and readable.
- [ ] Verify users hero title/subtitle no longer clip at desktop widths.
- [ ] Verify permissions page keeps left rail readable and right editor visually primary.
- [ ] Verify public resource cards fully show portrait and landscape images inside black preview frames.
- [ ] Verify video preview opens in the modal and remains fully visible without forced full-screen fill.
- [ ] Verify audio entries still render stable cards and metadata without broken layout.
- [ ] Verify button rows wrap without overlapping previews or clipping text.

## Deployment Notes

- Gray only after local verification succeeds.
- Update release evidence only after gray runtime is confirmed.
- Do not push Git and gray deploy as one blind batch; keep:
  1. local verification,
  2. clean commit,
  3. gray deploy,
  4. gray evidence logging,
  5. push.

## Self-Review

- Spec coverage:
  - User-group ID collision: covered by Task 1.
  - Users/permissions full redesign: covered by Tasks 2 and 3.
  - Public resource admin redesign: covered by Task 4.
  - Anti-overflow and documentation sync: covered by Task 5.
- Placeholder scan:
  - No `TODO` / `TBD` placeholders remain.
- Type consistency:
  - All extracted admin sections keep the existing `mutate` flow and admin types model.

