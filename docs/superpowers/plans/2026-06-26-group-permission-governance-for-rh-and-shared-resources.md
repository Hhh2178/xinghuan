# Group Permission Governance For RH And Shared Resources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build group-based access governance so admins can decide which user groups may use specific public resources, RunningHub AI apps, RunningHub workflows, and node capabilities.

**Architecture:** Extend the existing user-group domain into a small policy layer instead of creating a second RBAC system. Store policies by group, expose filtered catalogs to normal users, keep admin panels unfiltered, and enforce the same decisions again at task/resource execution boundaries.

**Tech Stack:** Node.js HTTP API, Postgres migrations with JSON/file fallback, React + TypeScript admin UI, existing RunningHub catalog helpers, existing shared resource routes, existing admin users panel, CSS in `apps/admin/src/styles.css`, contract scripts, CodeGraph workflow.

---

## Scope And Principles

This plan covers:

- Public resource access control by user group.
- RunningHub AI app and workflow access control by user group.
- Node capability access control by user group.
- Successful usage analytics by user group, account, node capability, model, and RunningHub catalog entry.
- Admin UI redesign for account groups and permissions.
- Audit page usage dashboard redesign.
- Public resource admin UI card redesign and preview behavior.
- Frontend hiding/disabled states plus backend enforcement.

This plan does not cover:

- Multiple groups per account.
- Per-user overrides.
- Permission inheritance between groups.
- Billing quota, credits, or rate limits.
- Production rollout until gray is verified.

Recommended first-version policy model:

- Default behavior: allowed.
- Restriction behavior: group-level deny list.
- Admins are never blocked by group policy.
- Users with no group use the `ungrouped` policy bucket.

Why deny-list first:

- Existing content stays available after deployment.
- Admin does not need to configure every existing RH app, workflow, resource, or node before users can work.
- It matches the user's current request: "禁止某些组使用什么资源/素材/节点/RH 应用".

## Current Evidence

Relevant current files:

- `apps/admin/src/admin-users-panel.tsx`
  - Current group management is embedded in a narrow left column.
  - `.user-groups-list` creates the tiny scrollable area shown in the screenshot.
- `apps/admin/src/admin-public-resources-panel.tsx`
  - Current public resource admin page uses `admin-public-resource-row`.
  - Image preview is tiny; video preview is an icon only.
- `apps/web/src/components/ResourceLibraryDrawer.tsx`
  - Public resource drawer still exposes "另存为我的资源".
  - Current action row can overflow when new actions are added.
- `apps/api/src/shared-resource-routes.ts`
  - Public resource list is returned from `/api/shared-resources/items`.
  - Copy-to-personal route can trigger category foreign-key mismatch and should no longer be exposed.
- `apps/api/src/server.ts`
  - RunningHub public catalog is exposed by `/api/runninghub/catalog`.
  - RH detail is exposed by `/api/runninghub/catalog/:catalogId`.
  - RH submit goes through `/api/proxy/runninghub/submit`.
- `apps/api/src/runninghub-catalog.ts`
  - `toPublicRunningHubCatalogItem()` builds public catalog entries with `catalogId = providerId:kind:itemId`.
- `apps/web/src/services/runninghubCatalog.ts`
  - Frontend RH node consumes `/api/runninghub/catalog`.
- `apps/web/src/components/nodes/RunningHubNode.tsx`
  - RH node selects catalog entries and submits them.
- `apps/admin/src/admin-readonly-panels.tsx`
  - Current audit page only renders an audit-log table and does not aggregate successful generation usage.
- `apps/api/src/server.ts`
  - Task table/list logic already joins `xh_tasks` with `xh_users` and `xh_user_groups`.
  - Successful usage analytics should aggregate `xh_tasks.status = 'succeeded'`, not raw audit logs.
  - Image/video async tasks already store `providerId` and model record `modelId`.
  - RunningHub tasks already store `targetType`, `runTargetId`, and `taskCapability`, but need a stable catalog-entry snapshot for admin-entry analytics.
- `docs/systems/canvas/node-and-data-model.md`
  - Existing design says image/video/audio/RH nodes should consume structured model/catalog definitions.
- `docs/systems/runninghub/catalog-and-entry-model.md`
  - Existing design says RH `app` and `workflow` entries must not be mixed and are identified by `kind`, `runTargetId`, `appId`, `workflowId`, and backend catalog data.

## Policy Data Model

Create a single group policy object per group.

```ts
export type GroupPolicySubjectType =
  | "shared_resource_category"
  | "shared_resource_item"
  | "runninghub_app"
  | "runninghub_workflow"
  | "node_type";

export interface GroupPermissionPolicy {
  groupId: string;
  updatedAt: number;
  updatedBy?: string;
  deny: {
    sharedResourceCategoryIds: string[];
    sharedResourceItemIds: string[];
    runningHubAppCatalogIds: string[];
    runningHubWorkflowCatalogIds: string[];
    nodeTypes: string[];
  };
}
```

Postgres table:

```sql
create table if not exists xh_group_permission_policies (
  group_id text primary key references xh_user_groups(id) on delete cascade,
  deny jsonb not null default '{}'::jsonb,
  updated_by text references xh_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_xh_group_permission_policies_updated_at
  on xh_group_permission_policies(updated_at desc);
```

File fallback shape in auth storage:

```ts
interface AuthDb {
  userGroups: UserGroupRecord[];
  groupPermissionPolicies: GroupPermissionPolicy[];
  users: UserRecord[];
  sessions: SessionRecord[];
  loginAttempts: LoginAttemptRecord[];
}
```

Policy lookup helpers:

```ts
function effectiveGroupId(user: CurrentUser | null | undefined) {
  if (!user) return "anonymous";
  return user.groupId || "ungrouped";
}

function canUseSharedResource(policy: GroupPermissionPolicy | null, item: ResourceItem) {
  if (!policy) return true;
  if (policy.deny.sharedResourceItemIds.includes(item.id)) return false;
  if (item.categoryId && policy.deny.sharedResourceCategoryIds.includes(item.categoryId)) return false;
  return true;
}

function canUseRunningHubCatalogItem(policy: GroupPermissionPolicy | null, item: RhCatalogItem) {
  if (!policy) return true;
  if (item.kind === "app") return !policy.deny.runningHubAppCatalogIds.includes(item.catalogId);
  return !policy.deny.runningHubWorkflowCatalogIds.includes(item.catalogId);
}

function canUseNodeType(policy: GroupPermissionPolicy | null, nodeType: string) {
  if (!policy) return true;
  return !policy.deny.nodeTypes.includes(nodeType);
}
```

## Successful Usage Analytics Data Model

The audit page usage dashboard must count successful generation work from task records, not generic audit logs.

Counting rule:

- Include only tasks where `status = "succeeded"`.
- Group by the task owner account and the owner's current group.
- If the owner account has been deleted, retain an `ownerDeleted` bucket using the stored `ownerId`.
- If the owner has no group, use `ungrouped`.
- Admin-triggered task rows are included unless filtered out in UI.

Primary capability buckets:

- `image`: image generation tasks.
- `video`: video generation tasks.
- `runninghub_app`: RunningHub AI App tasks.
- `runninghub_workflow`: RunningHub Workflow tasks.
- `llm`: text/chat/LLM tasks.
- `audio`: audio generation tasks, kept for future reporting even if the first UI focuses on image/video/RH/LLM.
- `unknown`: historical rows that cannot be classified.

Classification rules:

```ts
function classifyUsageTask(task: AdminTaskRecord): UsageCapability {
  const payload = plainObject(task.payload);
  const result = plainObject(task.result);
  const raw = plainObject(result.raw);
  const protocol = safeText(payload.protocol || result.protocol || result.adapter).toLowerCase();
  const capability = safeText(payload.taskCapability || result.capability || raw.capability).toLowerCase();
  const targetType = safeText(payload.targetType || result.rhTargetType).toLowerCase();
  if (protocol === "runninghub" || task.providerId === "runninghub") {
    return targetType === "app" ? "runninghub_app" : "runninghub_workflow";
  }
  if (capability === "image") return "image";
  if (capability === "video") return "video";
  if (capability === "chat" || capability === "llm") return "llm";
  if (capability === "audio") return "audio";
  return "unknown";
}
```

Image and video model detail:

- Image and video usage must be grouped by model record ID and display name.
- `xh_tasks.model_id` currently stores the model record ID for async image/video tasks.
- Analytics should join `xh_models` on `xh_tasks.model_id = xh_models.id`.
- Display fallback order:
  1. `xh_models.display_name`
  2. `xh_models.model_id`
  3. `xh_tasks.model_id`
  4. `未知模型`
- The response must also include provider display data by joining `xh_providers` through `xh_models.provider_id` or `xh_tasks.provider_id`.

RunningHub catalog-entry detail:

- RH usage must be grouped by backend RunningHub catalog entry, not just raw `runTargetId`.
- New RH task payload/result snapshots should include:

```ts
type RunningHubUsageSnapshot = {
  catalogId: string;
  catalogTitle: string;
  catalogKind: "app" | "workflow";
  providerId: string;
  providerName: string;
  runTargetId: string;
  appId?: string;
  workflowId?: string;
};
```

- Preferred source for new tasks:
  - `payload.rhCatalogId`
  - `payload.rhCatalogTitle`
  - `payload.rhCatalogKind`
  - `payload.runTargetId`
- Historical fallback:
  1. Match public/admin RH catalog by `catalogId` if present.
  2. Match by `providerId + kind + runTargetId`.
  3. Match by `providerId + appId` for `app`.
  4. Match by `providerId + workflowId` for `workflow`.
  5. Fall back to `runTargetId` with label `未知 RH 条目`.

LLM model detail:

- LLM usage should count only successful chat/LLM task records when present.
- Existing synchronous LLM endpoints may not currently create task rows. This plan should add task recording for LLM generation if analytics must include LLM reliably.
- For LLM rows, group by model record ID when available, with the same display fallback as image/video.

## Audit Usage Dashboard UI Design

The audit page should become a two-section page:

- Top: usage analytics dashboard.
- Bottom: existing audit log table.

The dashboard keeps the current sci-fi black/teal admin style. It should feel like an operational cockpit, not a marketing analytics page.

Dashboard filters:

- Time range: today, 7 days, 30 days, custom.
- Group.
- Account.
- Capability: image, video, RH AI app, RH workflow, LLM, audio.
- Provider.
- Model or RH catalog entry.

Top KPI strip:

- Total successful generations.
- Image model calls.
- Video model calls.
- RH AI app calls.
- RH workflow calls.
- LLM calls.

Visual modules:

- Capability ring: percentage share across image/video/RH/LLM/audio.
- Group energy bars: successful calls by group.
- Account leaderboard: top accounts in selected group or all groups.
- Model matrix:
  - Rows: group or account.
  - Columns: model display name for image/video/LLM.
  - Cell: successful count.
- RH entry matrix:
  - Rows: group or account.
  - Columns: RH backend catalog entry title.
  - Cell: successful count.
- Daily trend line:
  - One line per selected capability or aggregate.

Tables:

- Group table columns:
  - Group
  - Members
  - Total successful
  - Image
  - Video
  - RH AI App
  - RH Workflow
  - LLM
  - Top model
  - Top RH entry
- Account table columns:
  - Account
  - Group
  - Total successful
  - Image
  - Video
  - RH AI App
  - RH Workflow
  - LLM
  - Top model/RH entry
- Model table columns:
  - Capability
  - Provider
  - Model display name
  - Model ID
  - Successful count
  - Top group
  - Top account
- RH entry table columns:
  - Kind: AI App or Workflow
  - Provider
  - Backend entry title
  - Catalog ID
  - Run target ID
  - Successful count
  - Top group
  - Top account

Empty state:

- If there are no successful tasks in the selected range, show a compact empty state and keep the raw audit log table visible.

## Admin UI Design

### Users Page Structure

Replace the current single crowded layout with a tabbed or segmented page:

- `账号`
- `用户组`
- `权限`
- `会话`

Recommended default: segmented tabs at the top of the users page.

Layout:

- Top metrics band remains.
- Below metrics, show a compact tab bar.
- Each tab owns the full content width.
- No group editing inside a narrow side column.

### Account Tab

Purpose: create and manage users.

UI:

- Left/top create-user form becomes a horizontal compact panel on wide screens and one-column form on narrow screens.
- Main account table columns:
  - 邮箱
  - 名称
  - 所属组
  - 角色
  - 状态
  - 备注
  - 密码
  - 操作
- Row actions stay compact with icon + short label.
- Long emails and remarks use ellipsis with title tooltip.

### User Group Tab

Purpose: create many groups comfortably.

UI:

- Left: group list/table, full height of content area.
- Right: selected group detail editor.
- Supports 20+ groups without cramped scroll.
- Group row shows:
  - group name
  - member count
  - restricted resource count
  - restricted RH app/workflow count
  - restricted node count
- Group detail editor fields:
  - 分组名称
  - 分组说明
  - 排序值
  - 保存
  - 删除

Delete behavior:

- Disable delete when members exist.
- Show reason in button title and inline status.

### Permissions Tab

Purpose: manage what selected group cannot use.

UI layout:

- Left column: searchable group selector.
- Right content: permission matrix for selected group.
- Top summary strip:
  - 当前组
  - 成员数
  - 已限制公共资源
  - 已限制 RH 应用
  - 已限制 RH 工作流
  - 已限制节点
- Body uses four sub-tabs:
  - 公共资源
  - RH AI 应用
  - RH 工作流
  - 节点能力

Interaction pattern:

- Each row/card has a toggle:
  - On label: `允许`
  - Off label: `禁用`
- Internally store disabled rows in the deny list.
- Search and kind filters are available inside each sub-tab.
- Bulk actions:
  - 当前筛选全部允许
  - 当前筛选全部禁用
- Save button is sticky at the bottom of the permission panel.
- Unsaved changes show a small dirty state.

### Public Resource Permission Sub-Tab

Use two levels:

- Category-level restrictions.
- Item-level restrictions.

UI:

- Left: resource kind filters: 图像 / 视频 / 音频 / 素材集 / 姿势 / 工作流.
- Category rows appear first.
- Items appear as compact preview rows or cards.
- If a category is disabled, all items under it are visually marked disabled.
- Item-level toggles are still visible for precision, but category restriction takes precedence.

Display text:

- Category disabled: `该组不可使用此分类下资源`
- Item disabled: `该组不可使用此素材`

### RH AI App Permission Sub-Tab

Source:

- Admin RunningHub catalog items where `kind === "app"`.

UI card fields:

- Thumbnail if available.
- Title.
- Provider name.
- App ID / run target ID.
- Enabled state.
- Permission toggle.

Disabled RH app behavior:

- Hidden from normal user's RH catalog list.
- If an existing node already references a now-disabled app, show disabled state instead of silently running.
- Backend submit rejects the task.

### RH Workflow Permission Sub-Tab

Source:

- Admin RunningHub catalog items where `kind === "workflow"`.

UI card fields:

- Thumbnail if available.
- Title.
- Provider name.
- Workflow ID / run target ID.
- Input slot count.
- Output kind summary.
- Permission toggle.

Disabled RH workflow behavior:

- Hidden from normal user's RH catalog list.
- Existing node referencing it shows "该用户组无权使用此工作流".
- Backend submit rejects.

### Node Capability Permission Sub-Tab

Source:

- A stable node capability registry exposed by API.

First-version node entries should include:

- image generation node type.
- video generation node type.
- audio generation node type.
- RunningHub node type.
- RH tools node type.
- upload/resource insertion node type if it enables restricted public resources.

UI card fields:

- Node display name.
- Internal node type.
- Capability group.
- Permission toggle.

Disabled node behavior:

- Node creation button hidden or disabled for the user.
- If a project already contains disabled nodes, node shows a lock overlay and run button is disabled.
- Backend rejects task submission using disabled node type.

## Public Resource Admin Card UI Design

The public resource admin page should change from row/table layout to cards.

Card layout:

- Top preview block.
  - Fixed aspect ratio, recommended `aspect-ratio: 4 / 3`.
  - Black background.
  - Image and video use `object-fit: contain`.
  - Empty area remains black.
  - Video shows a muted preview with controls on hover or a play overlay.
- Bottom management block.
  - Title input.
  - Category select.
  - Tags input.
  - Note input.
  - Meta row: mime, size, updated time.
  - Action row: 预览 / 保存 / 删除.

Preview modal:

- Supports image and video.
- Max modal content size follows the previous preview requirement: not full screen, but large enough to inspect complete material.
- Use black background and `object-fit: contain`.
- Video has controls.
- Close on Escape and backdrop click.

Responsive behavior:

- Desktop: grid `repeat(auto-fill, minmax(260px, 1fr))`.
- Narrow width: one column.
- Category sidebar stays, but card grid owns most width.

## Public Resource Drawer UI Design

User-facing drawer changes:

- Remove "另存为我的资源" / "发送到我的资源库".
- Keep preview, add-to-canvas, send-to-node, attach, delete/favorite where applicable.
- Bottom action area:
  - `display: flex`
  - `flex-wrap: wrap`
  - centered
  - fixed-size icon buttons
  - gap remains small but enough to avoid overlap.

Error toast cleanup:

- Since copy-to-personal is removed, the foreign-key error path should disappear from UI.
- Backend route can remain dormant for compatibility, but should not be called by the frontend.

## API Design

### Admin Group Policy APIs

Add:

- `GET /api/admin/group-permission-policies`
- `GET /api/admin/group-permission-policies/:groupId`
- `PUT /api/admin/group-permission-policies/:groupId`

Response:

```ts
interface AdminGroupPermissionPolicyResponse {
  groupId: string;
  groupName?: string;
  memberCount: number;
  deny: GroupPermissionPolicy["deny"];
  updatedAt: number;
  updatedBy?: string;
}
```

PUT body:

```ts
{
  deny: {
    sharedResourceCategoryIds: string[];
    sharedResourceItemIds: string[];
    runningHubAppCatalogIds: string[];
    runningHubWorkflowCatalogIds: string[];
    nodeTypes: string[];
  }
}
```

Validation:

- `groupId` must exist unless it is `ungrouped`.
- Arrays are deduplicated.
- Values are safe strings.
- Unknown IDs may be stored to avoid accidental permission loss when catalogs are temporarily unavailable, but UI should mark them as missing.

### Admin Permission Catalog API

Add one aggregate endpoint so the permission UI does not stitch many admin calls:

- `GET /api/admin/permission-catalog`

Response:

```ts
interface AdminPermissionCatalog {
  userGroups: AdminUserGroup[];
  sharedResourceCategories: ResourceCategory[];
  sharedResourceItems: SharedResourceItem[];
  runningHubApps: RhCatalogItem[];
  runningHubWorkflows: RhCatalogItem[];
  nodeTypes: Array<{
    id: string;
    label: string;
    group: string;
    description?: string;
  }>;
}
```

### User Effective Permissions API

Add:

- `GET /api/me/permissions`

Response:

```ts
interface EffectivePermissions {
  groupId: string;
  isAdmin: boolean;
  deny: GroupPermissionPolicy["deny"];
}
```

Use this for frontend node palette and disabled-node states.

### Admin Usage Analytics API

Add:

- `GET /api/admin/audit/usage-summary`

Query parameters:

```ts
type UsageSummaryQuery = {
  from?: string;
  to?: string;
  range?: "today" | "7d" | "30d";
  groupId?: string;
  userId?: string;
  capability?: "image" | "video" | "runninghub_app" | "runninghub_workflow" | "llm" | "audio";
  providerId?: string;
  modelId?: string;
  rhCatalogId?: string;
};
```

Response:

```ts
interface AdminUsageSummary {
  range: { from: number; to: number };
  totals: {
    successful: number;
    image: number;
    video: number;
    runninghubApp: number;
    runninghubWorkflow: number;
    llm: number;
    audio: number;
    unknown: number;
  };
  groups: UsageGroupRow[];
  users: UsageUserRow[];
  models: UsageModelRow[];
  runningHubEntries: UsageRunningHubEntryRow[];
  daily: Array<{
    day: string;
    image: number;
    video: number;
    runninghubApp: number;
    runninghubWorkflow: number;
    llm: number;
    audio: number;
    total: number;
  }>;
}
```

Required row fields:

```ts
interface UsageGroupRow {
  groupId: string;
  groupName: string;
  memberCount: number;
  total: number;
  image: number;
  video: number;
  runninghubApp: number;
  runninghubWorkflow: number;
  llm: number;
  audio: number;
  topModelName?: string;
  topRunningHubEntryTitle?: string;
}

interface UsageUserRow {
  userId: string;
  email: string;
  name: string;
  remark?: string;
  groupId?: string;
  groupName?: string;
  ownerDeleted?: boolean;
  total: number;
  image: number;
  video: number;
  runninghubApp: number;
  runninghubWorkflow: number;
  llm: number;
  audio: number;
  topModelName?: string;
  topRunningHubEntryTitle?: string;
}

interface UsageModelRow {
  capability: "image" | "video" | "llm" | "audio";
  providerId: string;
  providerName: string;
  modelRecordId: string;
  modelId: string;
  displayName: string;
  total: number;
  topGroupName?: string;
  topUserEmail?: string;
}

interface UsageRunningHubEntryRow {
  kind: "app" | "workflow";
  providerId: string;
  providerName: string;
  catalogId: string;
  title: string;
  runTargetId: string;
  total: number;
  topGroupName?: string;
  topUserEmail?: string;
}
```

## Backend Enforcement Points

### Shared Resources

Enforce in `apps/api/src/shared-resource-routes.ts`:

- `GET /api/shared-resources/items`
  - Admin sees all.
  - Member only receives allowed items.
- `GET` item detail if added later.
- Any future use/send/insert endpoint must check item permission.

Do not only rely on filtering; add explicit helper:

```ts
function assertCanUseSharedResource(user: CurrentUser, item: ResourceItem) {
  if (user.role === "admin") return;
  const policy = policyForUser(user);
  if (!canUseSharedResource(policy, item)) throw new HttpError(403, "SHARED_RESOURCE_FORBIDDEN");
}
```

### RunningHub Catalog

Enforce in `apps/api/src/server.ts`:

- `/api/runninghub/catalog`
  - Admin sees all.
  - Member sees only allowed RH apps/workflows.
- `/api/runninghub/catalog/:catalogId`
  - Return 404 or 403 for disallowed item. Recommended: 403 because logged-in user exists but cannot use it.
- `/api/proxy/runninghub/submit`
  - Resolve catalog item from submitted preset/catalog/appInfo.
  - Check group policy before task creation or upstream call.

Important:

- Catalog filtering improves UX.
- Submit-time enforcement is mandatory because old projects may contain previously selected RH entries.

### Node Capabilities

Enforce in two layers:

- Frontend:
  - Hide disabled node palette entries.
  - Existing disabled nodes render lock state and disable run.
- Backend:
  - For task submission endpoints, infer node type or require frontend to send `sourceNodeType`.
  - Reject disallowed `sourceNodeType`.

First implementation can focus on endpoints that already include a source node type or can reliably infer:

- RunningHub submit: `runninghub` or `runninghub-wallet`.
- RH tools submit: `rh-tools`.
- Image/video/audio provider submits: corresponding generation node type if payload includes source.

If an endpoint cannot infer node type safely, do not fake enforcement. Add the field to the request contract first.

## Implementation File Structure

Create:

- `apps/api/db/0xx_group_permission_policies.sql`
  - Postgres policy table.
- `apps/api/src/group-permission-policy.ts`
  - Types, normalization, can-use helpers.
- `apps/api/src/group-permission-policy-routes.ts`
  - Admin policy CRUD and permission catalog endpoints.
- `apps/admin/src/admin-permissions-panel.tsx`
  - New permission management panel or sub-panel used by `UsersPanel`.
- `apps/admin/src/admin-public-resource-card.tsx`
  - Focused public resource card component.
- `apps/admin/src/admin-media-preview-modal.tsx`
  - Shared image/video preview modal for admin.
- `apps/api/src/admin-usage-analytics-routes.ts`
  - Admin-only successful usage aggregation endpoint.
- `apps/api/src/admin-usage-analytics.ts`
  - Task classification, model/RH entry joining, and response shaping helpers.
- `apps/admin/src/admin-usage-dashboard.tsx`
  - Sci-fi usage analytics dashboard rendered above the audit log table.
- `apps/web/src/services/effectivePermissions.ts`
  - Fetch and cache `/api/me/permissions`.
- `scripts/verify-group-permission-governance-contract.mjs`
  - Static contract checks.

Modify:

- `apps/api/src/server.ts`
  - Wire policy routes and enforcement.
  - Wire usage analytics route.
  - Add RH catalog snapshot to RH task creation.
  - Add source node/model metadata normalization for usage analytics.
  - Pass policy helpers into shared resource route handler.
- `apps/api/src/shared-resource-routes.ts`
  - Filter and enforce shared resource access.
- `apps/api/src/runninghub-catalog.ts`
  - Support filtering public catalog items by policy.
- `apps/admin/src/admin-types.ts`
  - Add policy and catalog types.
- `apps/admin/src/admin-api-client.ts`
  - Add admin policy APIs.
- `apps/admin/src/admin-readonly-panels.tsx`
  - Render usage dashboard above the existing audit log table.
- `apps/admin/src/admin-users-panel.tsx`
  - Redesign into account/group/permission/session tabs.
- `apps/admin/src/admin-public-resources-panel.tsx`
  - Use card grid and preview modal.
- `apps/admin/src/styles.css`
  - Add styles for tabs, permission matrix, resource cards, preview modal.
- `apps/web/src/components/ResourceLibraryDrawer.tsx`
  - Remove copy-to-personal action and make action rows wrap.
- `apps/web/src/components/nodes/RunningHubNode.tsx`
  - Show disallowed selected RH item state if catalog detail returns 403.
- `apps/web/src/components/nodes/RunningHubNodeConfigSection.tsx`
  - Render disabled/empty catalog states clearly.
- `apps/web/src/App.tsx` and node palette components if node creation gating lives there.
- `docs/systems/admin/ui-and-information-architecture.md`
  - Record new user/group/permission IA.
- `docs/systems/api/interface-map.md`
  - Add policy and usage analytics endpoints.
- `docs/systems/admin/ui-and-information-architecture.md`
  - Record the audit usage dashboard structure.
- `docs/systems/runninghub/catalog-and-entry-model.md`
  - Record group filtering, submit-time enforcement, and RH usage snapshot fields.
- `docs/logbooks/daily/2026/2026-06/recent-highlights.md`
  - Record implementation summary after completion.

## Task 1: Contract And Schema

**Files:**

- Create: `apps/api/db/0xx_group_permission_policies.sql`
- Create: `apps/api/src/group-permission-policy.ts`
- Create: `scripts/verify-group-permission-governance-contract.mjs`
- Modify: `apps/admin/src/admin-types.ts`

- [ ] Add the Postgres policy migration.
- [ ] Add shared TypeScript policy types and normalizers.
- [ ] Add `AdminGroupPermissionPolicy`, `AdminPermissionCatalog`, and `EffectivePermissions` types.
- [ ] Add a contract script that checks:
  - policy migration exists
  - policy route module exists
  - admin users panel references permission tabs
  - shared resources route filters member results
  - RunningHub catalog and submit enforce policy
  - public resource drawer no longer calls copy-to-personal
- [ ] Run the new contract and verify it fails before implementation.

## Task 2: Backend Policy Storage And APIs

**Files:**

- Create: `apps/api/src/group-permission-policy-routes.ts`
- Modify: `apps/api/src/server.ts`
- Modify: auth DB read/write helpers in `apps/api/src/server.ts`

- [ ] Extend `AuthDb` with `groupPermissionPolicies`.
- [ ] Read/write `xh_group_permission_policies` in Postgres mode.
- [ ] Read/write policy list in file fallback mode.
- [ ] Implement `GET /api/admin/group-permission-policies`.
- [ ] Implement `GET /api/admin/group-permission-policies/:groupId`.
- [ ] Implement `PUT /api/admin/group-permission-policies/:groupId`.
- [ ] Implement `GET /api/admin/permission-catalog`.
- [ ] Implement `GET /api/me/permissions`.
- [ ] Audit policy changes with actor, group, and changed counts.

## Task 3: Public Resource Enforcement And UI Cleanup

**Files:**

- Modify: `apps/api/src/shared-resource-routes.ts`
- Modify: `apps/web/src/components/ResourceLibraryDrawer.tsx`

- [ ] Add policy dependency injection to shared resource route handler.
- [ ] Filter `/api/shared-resources/items` for normal members.
- [ ] Keep admin visibility unfiltered.
- [ ] Remove public drawer copy-to-personal UI and handler.
- [ ] Remove unused frontend API call if it has no remaining consumer.
- [ ] Make drawer action row wrap and center.
- [ ] Verify the foreign-key error can no longer be triggered from UI.

## Task 4: RunningHub Enforcement

**Files:**

- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/runninghub-catalog.ts`
- Modify: `apps/web/src/services/runninghubCatalog.ts`
- Modify: `apps/web/src/components/nodes/RunningHubNode.tsx`
- Modify: `apps/web/src/components/nodes/RunningHubNodeConfigSection.tsx`

- [ ] Filter `/api/runninghub/catalog` by effective group policy.
- [ ] Enforce `/api/runninghub/catalog/:catalogId`.
- [ ] Enforce `/api/proxy/runninghub/submit`.
- [ ] If a selected catalog item becomes forbidden, show a locked state in the node.
- [ ] Do not silently switch to another RH item.
- [ ] Add user-facing error text: `该用户组无权使用此 RH 应用/工作流`.

## Task 5: Node Capability Gating

**Files:**

- Create: `apps/api/src/node-capability-registry.ts`
- Modify: node palette or add-node path in `apps/web/src/App.tsx`
- Modify: submit service payloads where source node type is missing.

- [ ] Define stable node type catalog for permission UI.
- [ ] Expose node catalog in `/api/admin/permission-catalog`.
- [ ] Fetch `/api/me/permissions` in frontend.
- [ ] Hide or disable blocked node creation entries.
- [ ] Lock existing disallowed nodes rather than deleting them from projects.
- [ ] Add backend rejection for endpoints that can identify disallowed node type.

## Task 6: Admin Users And Permissions UI

**Files:**

- Create: `apps/admin/src/admin-permissions-panel.tsx`
- Modify: `apps/admin/src/admin-users-panel.tsx`
- Modify: `apps/admin/src/admin-api-client.ts`
- Modify: `apps/admin/src/styles.css`

- [ ] Split users page into `账号 / 用户组 / 权限 / 会话`.
- [ ] Move group creation and editing to full-width group tab.
- [ ] Build permission tab with selected group and four sub-tabs.
- [ ] Add searchable lists for public resources, RH apps, RH workflows, and nodes.
- [ ] Add allow/disable toggles backed by deny lists.
- [ ] Add bulk allow/disable for current filtered set.
- [ ] Add sticky save bar with dirty state.
- [ ] Add missing-item rendering for IDs in policy that no longer exist.

## Task 7: Public Resource Admin Card Redesign

**Files:**

- Create: `apps/admin/src/admin-public-resource-card.tsx`
- Create: `apps/admin/src/admin-media-preview-modal.tsx`
- Modify: `apps/admin/src/admin-public-resources-panel.tsx`
- Modify: `apps/admin/src/styles.css`

- [ ] Replace `admin-public-resource-row` mapping with card grid.
- [ ] Add black `object-contain` image/video preview area.
- [ ] Add video preview support.
- [ ] Add `预览` action.
- [ ] Add image/video modal with full material visible.
- [ ] Keep category sidebar and toolbar stable.
- [ ] Ensure cards wrap without horizontal page scroll.

## Task 8: Audit Usage Analytics Dashboard

**Files:**

- Create: `apps/api/src/admin-usage-analytics.ts`
- Create: `apps/api/src/admin-usage-analytics-routes.ts`
- Create: `apps/admin/src/admin-usage-dashboard.tsx`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/admin/src/admin-readonly-panels.tsx`
- Modify: `apps/admin/src/admin-api-client.ts`
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/styles.css`
- Modify: `docs/systems/api/interface-map.md`
- Modify: `docs/systems/admin/ui-and-information-architecture.md`
- Modify: `docs/systems/runninghub/catalog-and-entry-model.md`

- [ ] Add `GET /api/admin/audit/usage-summary`.
- [ ] Aggregate only `status = 'succeeded'` tasks.
- [ ] Join users and user groups for group/account breakdown.
- [ ] Join `xh_models` and `xh_providers` so image/video/LLM counts show model display names.
- [ ] Classify image and video rows by `payload.taskCapability`, `result.capability`, and model capability fallback.
- [ ] Classify RH rows by `providerId = runninghub`, `result.protocol = runninghub`, or `payload.protocol = runninghub`.
- [ ] Group RH rows by `rhCatalogId` when present.
- [ ] Add fallback matching by `providerId + targetType + runTargetId` for historical RH rows.
- [ ] Add RH task snapshot fields for new tasks:
  - `payload.rhCatalogId`
  - `payload.rhCatalogTitle`
  - `payload.rhCatalogKind`
  - `result.rhCatalogId`
  - `result.rhCatalogTitle`
  - `result.rhCatalogKind`
- [ ] Add LLM task recording or document the first implementation's limitation if existing LLM calls are synchronous and not task-backed.
- [ ] Add `AdminUsageSummary` types in `apps/admin/src/admin-types.ts`.
- [ ] Fetch usage summary when audit tab is active.
- [ ] Render sci-fi KPI strip, capability ring, group bars, account leaderboard, model matrix, RH entry matrix, and daily trend.
- [ ] Keep the existing audit-log table below the dashboard.
- [ ] Add filters for time range, group, account, capability, provider, model, and RH catalog entry.
- [ ] Add empty state for no successful task rows.

## Task 9: Tests And Verification

Run:

```powershell
npm run verify:hotspot-watchlist-contract
npm run verify:engineering-governance-contract
node scripts/verify-group-permission-governance-contract.mjs
npm run typecheck -w apps/admin
npm run typecheck -w apps/web
npm run typecheck -w apps/api
npm run build -w apps/admin
npm run build -w apps/web
```

Manual gray verification:

- Create group `限制组`.
- Put a test member into `限制组`.
- Disable one public resource category for `限制组`.
- Confirm member cannot see those public resources in the drawer.
- Confirm admin can still see all public resources.
- Disable one RH AI app for `限制组`.
- Confirm member cannot select it in RH node catalog.
- Open an old project that already references the disabled RH app.
- Confirm node shows locked state and submit is rejected.
- Disable one RH workflow for `限制组` and repeat the same checks.
- Disable one node type for `限制组`.
- Confirm member cannot create that node and existing nodes are locked.
- Confirm unrestricted groups still behave as before.

Visual verification:

- Public resource drawer action buttons wrap cleanly in two rows when needed.
- Admin public resource cards show complete portrait and landscape media.
- Admin video resource can be previewed.
- User group page supports more than 10 groups without tiny inner scroll.
- Permission tab remains usable at desktop width and narrow width.
- Audit usage dashboard counts only successful tasks.
- Image and video rows can be drilled down to model display name and model ID.
- RH rows can be drilled down to backend AI App or Workflow entry title and catalog ID.
- Group totals equal the sum of their account rows for the same filters.
- Deleted-owner rows do not crash the dashboard and remain identifiable.

## Deployment Plan

Gray only first:

- Bump version for this batch.
- Run migrations on gray.
- Deploy to `canvas-next.hhh2121.xyz`.
- Verify `/api/status`.
- Verify policy APIs as admin.
- Verify member filtered catalog behavior.
- Update release logbook, current release index, `ops/current/gray.md`, and `ops/README.md`.
- Push Git after local verification and gray deployment evidence is recorded.

Production should wait for user acceptance on gray.

## Rollback Notes

- If UI is broken but backend is healthy, revert frontend release only.
- If policy filtering blocks too much, set all policy deny lists to empty.
- If migration causes issue, leave table in place but bypass enforcement with an emergency env flag:

```ts
XINGHUAN_GROUP_POLICY_ENFORCEMENT=off
```

The implementation should check this flag in enforcement helpers, not throughout UI components.

## Open Decisions Before Implementation

1. Use recommended first-version policy: default allowed with group-level deny lists.
2. Admins bypass all group restrictions.
3. Users without a group use `ungrouped`.
4. Node type restrictions initially cover creation and identifiable submit endpoints only.
5. Production deploy waits for gray acceptance.
