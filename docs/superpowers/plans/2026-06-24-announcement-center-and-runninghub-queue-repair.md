# Announcement Center And RunningHub Queue Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为无限画布 2.0 增加可实时触达的公告中心，并完成 RunningHub 轮询超时与多 Key 调度失效的专项修复，确保 gray 可做真实业务验收。

**Architecture:** 本轮分三段推进。第一段先补 `announcement` 的数据模型、API、SSE 单向广播和前后台壳层；第二段把前台公告抽屉与强提醒半阻断弹层接到现有登录态和顶部壳层；第三段专项收口 RunningHub 的执行前选 Key、轮询超时治理、队列可视化与真实 verify 护栏。每一段都必须独立通过类型检查、契约脚本和可回退提交。

**Tech Stack:** TypeScript, React 19, Node.js, PostgreSQL, SSE, Redis, RunningHub worker dispatch, shared package contracts, CodeGraph, RTK

---

## File Map

### Announcement 数据与 API

- Create: `apps/api/db/017_announcements.sql`
  负责公告主表与已读表。
- Create: `packages/shared/src/announcements.ts`
  负责共享公告类型、SSE 事件类型、前后台 DTO。
- Modify: `packages/shared/src/index.ts`
  导出公告共享类型。
- Create: `apps/api/src/announcement-store.ts`
  负责公告读写、筛选、已读、发布与归档。
- Create: `apps/api/src/announcement-sse.ts`
  负责内存级 SSE 客户端注册、广播、清理。
- Create: `apps/api/src/admin-announcement-routes.ts`
  负责后台公告 CRUD / publish / archive。
- Create: `apps/api/src/public-announcement-routes.ts`
  负责前台公告列表、未读数、标记已读、SSE stream。
- Modify: `apps/api/src/server.ts`
  接入新 routes，不在 `server.ts` 内直接堆公告业务实现。

### Admin UI

- Modify: `apps/admin/src/admin-view-model.ts`
  新增 `announcement` tab 与左侧导航项。
- Modify: `apps/admin/src/admin-types.ts`
  新增公告类型定义。
- Modify: `apps/admin/src/admin-api-client.ts`
  新增公告管理 API client。
- Create: `apps/admin/src/admin-announcement-panel.tsx`
  后台公告工作台，包含列表、筛选、编辑器、发布确认。
- Modify: `apps/admin/src/main.tsx`
  接入公告面板与加载逻辑。
- Modify: `apps/admin/src/styles.css`
  公告工作台样式，保持现有后台视觉语言。

### Web 公告中心

- Create: `apps/web/src/services/announcements.ts`
  前台公告 API 与 SSE 订阅封装。
- Create: `apps/web/src/hooks/useAnnouncements.ts`
  前台公告中心状态机，统一列表、未读、强提醒队列。
- Create: `apps/web/src/components/AnnouncementCenterDrawer.tsx`
  右侧抽屉式公告中心。
- Create: `apps/web/src/components/AnnouncementStrongReminderModal.tsx`
  半阻断强提醒弹层，关闭即已读。
- Modify: `apps/web/src/services/api.ts`
  导出前台需要的公告类型或复用通用请求。
- Modify: `apps/web/src/App.tsx`
  顶部右侧加公告入口、挂载 drawer / modal。
- Modify: `apps/web/src/styles/index.css`
  公告入口、抽屉和强提醒样式。

### RunningHub 队列与轮询

- Modify: `apps/api/src/server.ts`
  保持 RH 入队只写 `preferredRhKeyId`，补更明确的 `rhQueueReason` 和运行态回传。
- Modify: `apps/worker/src/worker-runninghub-dispatch.ts`
  修正多 Key 真实择优顺序与占位逻辑。
- Modify: `apps/worker/src/worker-runninghub-client.ts`
  修正轮询超时治理、网关类失败处理、heartbeat 补强。
- Modify: `apps/worker/src/worker.ts`
  只保留 glue：调用 dispatch/client、写回运行态、触发统一失败字段。
- Modify: `docs/systems/runninghub/README.md`
  补公告与 RH release 后的真实系统边界说明。
- Modify: `docs/systems/worker/queue-and-concurrency.md`
  补 RH 总并发、默认 Key 优先与 all_keys_busy 语义。

### Verify / Governance

- Create: `scripts/verify-announcement-contract.mjs`
  检查公告 routes、shared types、admin/web 入口均已接入。
- Create: `scripts/verify-announcement-sse-contract.mjs`
  检查 SSE 事件名、强提醒字段与关闭即已读链路。
- Modify: `scripts/verify-runninghub-dynamic-key-selection-contract.mjs`
  收紧为“默认 Key 优先 + fallback 其他 Key + all_keys_busy”。
- Modify: `scripts/verify-runninghub-queue-governance-contract.mjs`
  收紧为“轮询 timeout 治理 + 运行态/队列提示存在”。
- Modify: `scripts/verify-local-acceptance-chain.mjs`
  把公告 / RH 新 verify 纳入本地放行链。

## Scope Guard

- 本计划只做统一公告系统，不拆第二套 release note 系统。
- 本计划不做浏览器原生系统通知，不做 WebSocket。
- 本计划不做 RH 平台之外的 provider polling 大重构，只补 RH 专项与共享运行态字段兼容。
- `apps/worker/src/worker.ts` 本轮只允许继续下沉 RH glue，不允许再回填大块协议细节。

### Task 1: 建立公告与 RH 修复的基线护栏

**Files:**
- Create: `scripts/verify-announcement-contract.mjs`
- Create: `scripts/verify-announcement-sse-contract.mjs`
- Modify: `scripts/verify-runninghub-dynamic-key-selection-contract.mjs`
- Modify: `scripts/verify-runninghub-queue-governance-contract.mjs`
- Modify: `scripts/verify-local-acceptance-chain.mjs`

- [ ] **Step 1: 写公告接入 contract**

```js
import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const shared = await readFile(new URL("../packages/shared/src/announcements.ts", import.meta.url), "utf8");
const adminViewModel = await readFile(new URL("../apps/admin/src/admin-view-model.ts", import.meta.url), "utf8");
const adminMain = await readFile(new URL("../apps/admin/src/main.tsx", import.meta.url), "utf8");
const webApp = await readFile(new URL("../apps/web/src/App.tsx", import.meta.url), "utf8");
const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");

assert.match(shared, /AnnouncementPriority/);
assert.match(shared, /AnnouncementStreamEvent/);
assert.match(adminViewModel, /"announcement"/);
assert.match(adminMain, /AdminAnnouncementPanel/);
assert.match(webApp, /AnnouncementCenterDrawer/);
assert.match(server, /\/api\/announcements\/stream/);

console.log("PASS announcement contract");
```

- [ ] **Step 2: 写公告 SSE contract**

```js
import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const sse = await readFile(new URL("../apps/api/src/announcement-sse.ts", import.meta.url), "utf8");
const webHook = await readFile(new URL("../apps/web/src/hooks/useAnnouncements.ts", import.meta.url), "utf8");

assert.match(sse, /announcement\.published/);
assert.match(sse, /announcement\.updated/);
assert.match(webHook, /markAnnouncementRead/);
assert.match(webHook, /strongReminder/);

console.log("PASS announcement SSE contract");
```

- [ ] **Step 3: 收紧 RH 队列 contract**

把 `scripts/verify-runninghub-dynamic-key-selection-contract.mjs` 和 `scripts/verify-runninghub-queue-governance-contract.mjs` 的断言补到：

```js
assert.match(dispatch, /preferredRhKeyId/);
assert.match(dispatch, /all_keys_busy/);
assert.match(dispatch, /isDefault/);
assert.match(client, /RunningHub 轮询超时/);
assert.match(client, /upstream_poll_timeout/);
assert.match(client, /onHeartbeat/);
```

- [ ] **Step 4: 把新 verify 纳入本地验收链**

在 `scripts/verify-local-acceptance-chain.mjs` 追加：

```js
"node scripts/verify-announcement-contract.mjs",
"node scripts/verify-announcement-sse-contract.mjs",
"node scripts/verify-runninghub-dynamic-key-selection-contract.mjs",
"node scripts/verify-runninghub-queue-governance-contract.mjs",
```

- [ ] **Step 5: 运行护栏确认先红后绿**

Run:

```bash
node scripts/verify-announcement-contract.mjs
node scripts/verify-announcement-sse-contract.mjs
node scripts/verify-runninghub-dynamic-key-selection-contract.mjs
node scripts/verify-runninghub-queue-governance-contract.mjs
```

Expected:
- 公告两个脚本先失败，因为新文件尚未接入
- RH 脚本在当前问题未修前至少有一项断言失败或待补

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-announcement-contract.mjs scripts/verify-announcement-sse-contract.mjs scripts/verify-runninghub-dynamic-key-selection-contract.mjs scripts/verify-runninghub-queue-governance-contract.mjs scripts/verify-local-acceptance-chain.mjs
git commit -m "test: add announcement and runninghub repair contracts"
```

### Task 2: 建立公告数据库与共享类型

**Files:**
- Create: `apps/api/db/017_announcements.sql`
- Create: `packages/shared/src/announcements.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/admin/src/admin-types.ts`

- [ ] **Step 1: 写公告 migration**

```sql
create table if not exists xh_announcements (
  id text primary key,
  title text not null,
  summary text not null default '',
  content text not null default '',
  type text not null default 'manual',
  priority text not null default 'normal',
  status text not null default 'draft',
  scope text not null default 'all-users',
  pinned boolean not null default false,
  strong_reminder boolean not null default false,
  popup_enabled boolean not null default false,
  version_tag text not null default '',
  published_at bigint,
  expire_at bigint,
  created_by text not null default '',
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists xh_announcement_reads (
  announcement_id text not null references xh_announcements(id) on delete cascade,
  user_id text not null,
  read_at bigint not null,
  primary key (announcement_id, user_id)
);

create index if not exists xh_announcements_status_idx on xh_announcements(status, published_at desc);
create index if not exists xh_announcement_reads_user_idx on xh_announcement_reads(user_id, read_at desc);
```

- [ ] **Step 2: 定义 shared 公告类型**

```ts
export type AnnouncementType = "manual" | "release-note" | "system";
export type AnnouncementPriority = "normal" | "important" | "strong-reminder";
export type AnnouncementStatus = "draft" | "published" | "archived";
export type AnnouncementScope = "all-users" | "admins-only";
export type AnnouncementStreamEvent = "announcement.published" | "announcement.updated";

export interface AnnouncementRecord {
  id: string;
  title: string;
  summary: string;
  content: string;
  type: AnnouncementType;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  scope: AnnouncementScope;
  pinned: boolean;
  strongReminder: boolean;
  popupEnabled: boolean;
  versionTag: string;
  publishedAt?: number;
  expireAt?: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  readAt?: number;
}
```

- [ ] **Step 3: 给 admin 类型补 DTO**

在 `apps/admin/src/admin-types.ts` 追加：

```ts
export interface AdminAnnouncementUpsertPayload {
  title: string;
  summary: string;
  content: string;
  type: "manual" | "release-note" | "system";
  priority: "normal" | "important" | "strong-reminder";
  status?: "draft" | "published" | "archived";
  scope: "all-users" | "admins-only";
  pinned: boolean;
  strongReminder: boolean;
  popupEnabled: boolean;
  versionTag?: string;
  publishedAt?: number | null;
  expireAt?: number | null;
}
```

- [ ] **Step 4: 跑 migration 与 shared 类型验证**

Run:

```bash
node scripts/db-migrate.mjs
npm run type-check -w @xinghuan/shared
npm run type-check -w @xinghuan/admin
```

Expected:
- `017_announcements.sql` 被登记进 `xh_schema_migrations`
- shared/admin 类型检查通过

- [ ] **Step 5: Commit**

```bash
git add apps/api/db/017_announcements.sql packages/shared/src/announcements.ts packages/shared/src/index.ts apps/admin/src/admin-types.ts
git commit -m "feat: add announcement schema and shared types"
```

### Task 3: 实现公告 API、SSE 与发布广播

**Files:**
- Create: `apps/api/src/announcement-store.ts`
- Create: `apps/api/src/announcement-sse.ts`
- Create: `apps/api/src/admin-announcement-routes.ts`
- Create: `apps/api/src/public-announcement-routes.ts`
- Modify: `apps/api/src/server.ts`

- [ ] **Step 1: 抽公告 store，不把 SQL 堆进 `server.ts`**

在 `apps/api/src/announcement-store.ts` 暴露最小接口：

```ts
export interface AnnouncementStore {
  listAdmin(input: { status?: string; type?: string; q?: string }): Promise<AnnouncementRecord[]>;
  create(input: AdminAnnouncementUpsertPayload, user: AuthUser): Promise<AnnouncementRecord>;
  update(id: string, input: AdminAnnouncementUpsertPayload, user: AuthUser): Promise<AnnouncementRecord>;
  publish(id: string, user: AuthUser): Promise<AnnouncementRecord>;
  archive(id: string, user: AuthUser): Promise<AnnouncementRecord>;
  remove(id: string): Promise<void>;
  listForUser(user: AuthUser): Promise<AnnouncementRecord[]>;
  unreadCount(user: AuthUser): Promise<number>;
  markRead(id: string, user: AuthUser): Promise<void>;
}
```

- [ ] **Step 2: 实现 SSE 注册与广播**

在 `apps/api/src/announcement-sse.ts` 写一个小型 broadcaster：

```ts
const clients = new Map<string, ServerResponse>();

export function attachAnnouncementStream(response: ServerResponse, clientId: string) {
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  });
  response.write(": connected\n\n");
  clients.set(clientId, response);
  response.on("close", () => {
    clients.delete(clientId);
  });
}

export function broadcastAnnouncement(event: AnnouncementStreamEvent, payload: AnnouncementRecord) {
  const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const response of clients.values()) response.write(frame);
}
```

- [ ] **Step 3: 后台路由实现 CRUD + publish 二次确认输入**

路由集合：

```ts
GET /api/admin/announcements
POST /api/admin/announcements
PATCH /api/admin/announcements/:id
POST /api/admin/announcements/:id/publish
POST /api/admin/announcements/:id/archive
DELETE /api/admin/announcements/:id
```

发布 body 至少校验：

```ts
{ confirmTitle: string; confirmStrongReminder: boolean; confirmPinned: boolean }
```

- [ ] **Step 4: 前台路由实现列表 / 未读 / 已读 / stream**

路由集合：

```ts
GET /api/announcements
GET /api/announcements/unread-count
POST /api/announcements/:id/read
GET /api/announcements/stream
```

`POST /read` 成功后返回：

```json
{ "success": true, "data": { "announcementId": "...", "readAt": 1782288000000 } }
```

- [ ] **Step 5: 发布时同时广播 strong reminder**

在 `publish()` 成功后：

```ts
broadcastAnnouncement("announcement.published", record);
```

更新时：

```ts
broadcastAnnouncement("announcement.updated", record);
```

- [ ] **Step 6: 跑 API 与 contract**

Run:

```bash
npm run type-check -w @xinghuan/api
node scripts/verify-announcement-contract.mjs
node scripts/verify-announcement-sse-contract.mjs
```

Expected:
- API 类型检查通过
- 公告 contract / SSE contract 通过

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/announcement-store.ts apps/api/src/announcement-sse.ts apps/api/src/admin-announcement-routes.ts apps/api/src/public-announcement-routes.ts apps/api/src/server.ts
git commit -m "feat: add announcement api and sse broadcast"
```

### Task 4: 接入后台公告管理工作台

**Files:**
- Modify: `apps/admin/src/admin-view-model.ts`
- Modify: `apps/admin/src/admin-api-client.ts`
- Create: `apps/admin/src/admin-announcement-panel.tsx`
- Modify: `apps/admin/src/main.tsx`
- Modify: `apps/admin/src/styles.css`

- [ ] **Step 1: 扩展后台导航**

在 `apps/admin/src/admin-view-model.ts` 追加：

```ts
export type AdminTabId =
  | "overview"
  | "users"
  | "providers"
  | "runninghub-workspace"
  | "assistant"
  | "tasks"
  | "audit"
  | "system"
  | "environment-sync"
  | "announcement";
```

并在 `adminNavItems` 中加入：

```ts
{ id: "announcement", label: "公告", icon: Bell }
```

- [ ] **Step 2: 扩展 admin client**

在 `apps/admin/src/admin-api-client.ts` 追加：

```ts
listAnnouncements: () => api<AnnouncementRecord[]>("/api/admin/announcements"),
createAnnouncement: (payload) => api<AnnouncementRecord>("/api/admin/announcements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
updateAnnouncement: (id, payload) => api<AnnouncementRecord>(`/api/admin/announcements/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
publishAnnouncement: (id, payload) => api<AnnouncementRecord>(`/api/admin/announcements/${encodeURIComponent(id)}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
archiveAnnouncement: (id) => api<AnnouncementRecord>(`/api/admin/announcements/${encodeURIComponent(id)}/archive`, { method: "POST" }),
deleteAnnouncement: (id) => api<{ deleted: true }>(`/api/admin/announcements/${encodeURIComponent(id)}`, { method: "DELETE" }),
```

- [ ] **Step 3: 做双栏公告工作台**

`apps/admin/src/admin-announcement-panel.tsx` 最少要有：

```tsx
<section className="admin-announcement-shell">
  <aside className="admin-announcement-list">...</aside>
  <section className="admin-announcement-editor">...</section>
</section>
```

编辑字段必须包含：
- 标题
- 摘要
- 正文
- 类型
- 优先级
- 范围
- 置顶
- 强提醒
- 弹出
- 发布时间
- 下线时间
- 版本号

- [ ] **Step 4: 发布强提醒做确认弹窗**

确认文案至少包含：

```ts
`将向 ${scopeLabel} 发布强提醒公告：${title}`
```

并明确回显：
- 是否强提醒
- 是否置顶
- 标题

- [ ] **Step 5: 接入后台主壳层**

在 `apps/admin/src/main.tsx` 中：
- 加载公告列表
- `activeTab === "announcement"` 时渲染 `AdminAnnouncementPanel`
- 保持现有 `summary/users/providers/...` 加载顺序不被破坏

- [ ] **Step 6: 跑 admin 验证**

Run:

```bash
npm run type-check -w @xinghuan/admin
npm run verify:admin-view-model-contract
node scripts/verify-announcement-contract.mjs
```

Expected:
- admin 类型检查通过
- `announcement` tab 已被纳入 view model

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/admin-view-model.ts apps/admin/src/admin-api-client.ts apps/admin/src/admin-announcement-panel.tsx apps/admin/src/main.tsx apps/admin/src/styles.css
git commit -m "feat: add admin announcement workspace"
```

### Task 5: 接入前台公告中心与强提醒弹层

**Files:**
- Create: `apps/web/src/services/announcements.ts`
- Create: `apps/web/src/hooks/useAnnouncements.ts`
- Create: `apps/web/src/components/AnnouncementCenterDrawer.tsx`
- Create: `apps/web/src/components/AnnouncementStrongReminderModal.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles/index.css`

- [ ] **Step 1: 封装前台公告 API + SSE**

```ts
export async function listAnnouncements() { ... }
export async function getAnnouncementUnreadCount() { ... }
export async function markAnnouncementRead(id: string) { ... }
export function subscribeAnnouncementStream(handlers: {
  onPublished: (record: AnnouncementRecord) => void;
  onUpdated: (record: AnnouncementRecord) => void;
}) {
  const source = new EventSource("/api/announcements/stream", { withCredentials: true });
  source.addEventListener("announcement.published", ...);
  source.addEventListener("announcement.updated", ...);
  return () => source.close();
}
```

- [ ] **Step 2: 抽公告状态 hook**

`useAnnouncements()` 至少管理：

```ts
{
  items,
  unreadCount,
  drawerOpen,
  strongReminder,
  openDrawer,
  closeDrawer,
  markRead,
  dismissStrongReminder,
}
```

其中关闭强提醒时：

```ts
await markAnnouncementRead(id);
setStrongReminder(null);
```

- [ ] **Step 3: 右上角加公告入口**

在 `apps/web/src/App.tsx` 顶部右侧状态区增加：

```tsx
<button type="button" className="xh-announcement-trigger" onClick={openDrawer}>
  公告
  {unreadCount > 0 ? <span className="xh-announcement-badge">{unreadCount}</span> : null}
</button>
```

- [ ] **Step 4: 强提醒采用半阻断模式**

`AnnouncementStrongReminderModal.tsx` 要求：
- 居中
- 轻遮罩
- 两个按钮
  - `我知道了`
  - `查看详情`

对应行为：

```ts
onAcknowledge => markRead + close
onViewDetail => markRead + openDrawer + close
```

- [ ] **Step 5: 仅强提醒在线即时弹出**

收到 SSE 时只对：

```ts
record.status === "published" &&
record.strongReminder &&
record.popupEnabled
```

入强提醒队列，其余只刷新公告列表与未读数。

- [ ] **Step 6: 跑 web 验证**

Run:

```bash
npm run type-check -w @xinghuan/web
node scripts/verify-announcement-contract.mjs
node scripts/verify-announcement-sse-contract.mjs
```

Expected:
- web 类型检查通过
- 公告入口、drawer、strong reminder contract 全部通过

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/services/announcements.ts apps/web/src/hooks/useAnnouncements.ts apps/web/src/components/AnnouncementCenterDrawer.tsx apps/web/src/components/AnnouncementStrongReminderModal.tsx apps/web/src/App.tsx apps/web/src/styles/index.css
git commit -m "feat: add announcement center and strong reminder modal"
```

### Task 6: 修复 RunningHub 执行前选 Key 与 all_keys_busy 判定

**Files:**
- Modify: `apps/api/src/server.ts`
- Modify: `apps/worker/src/worker-runninghub-dispatch.ts`
- Modify: `apps/worker/src/worker.ts`

- [ ] **Step 1: API 入队继续只写 preferred，不写最终 assigned**

在 RH 入队处保持：

```ts
preferredRhKeyId: preferredRhKey.id,
preferredRhKeyNoteSnapshot: preferredRhKey.note,
```

不要在 API 侧提前写：

```ts
assignedRhKeyId
```

仅当检查到所有 Key 已满时写：

```ts
rhQueueReason: "all_keys_busy"
```

- [ ] **Step 2: 执行前按“默认 Key -> 其他启用 Key”顺序实时检查**

`resolveOrderedRunningHubKeys()` 目标顺序：

```ts
[
  ...pool.filter((item) => item.id === preferredRhKeyId),
  ...pool.filter((item) => item.id !== preferredRhKeyId && item.isDefault),
  ...pool.filter((item) => item.id !== preferredRhKeyId && !item.isDefault),
]
```

并确保 `acquireExecutableRunningHubKey()` 在某把 Key `incr` 失败后继续试后续 Key，而不是直接返回 busy。

- [ ] **Step 3: 无启用 Key 时返回配置错误，不伪装成排队**

```ts
if (pool.length === 0) {
  throw createWorkerTaskError("RunningHub 未配置可用 Key", {
    failureCategory: "model_config",
    providerDiagnostic: "RunningHub 未配置可用 Key",
  });
}
```

- [ ] **Step 4: worker glue 只写回最终实际选中的 Key**

在 `apps/worker/src/worker.ts` 保持：

```ts
assignedRhKeyId: selectedRhKey.id,
assignedRhKeyNoteSnapshot: selectedRhKey.note,
assignedRhKeyMaxConcurrency: selectedRhKey.maxConcurrency,
rhQueueReason: "",
```

- [ ] **Step 5: 跑 RH 多 Key 验证**

Run:

```bash
node scripts/verify-runninghub-dynamic-key-selection-contract.mjs
node scripts/verify-runninghub-key-pool-contract.mjs
node scripts/verify-runninghub-key-acquire-fallback.mjs
npm run type-check -w @xinghuan/worker
npm run type-check -w @xinghuan/api
```

Expected:
- 默认 Key 优先与 fallback contract 通过
- `all_keys_busy` 只在全满时出现

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/server.ts apps/worker/src/worker-runninghub-dispatch.ts apps/worker/src/worker.ts
git commit -m "fix: repair runninghub dynamic key dispatch"
```

### Task 7: 修复 RunningHub 轮询 timeout 治理与运行态提示

**Files:**
- Modify: `apps/worker/src/worker-runninghub-client.ts`
- Modify: `apps/worker/src/worker.ts`
- Modify: `docs/systems/worker/queue-and-concurrency.md`
- Modify: `docs/systems/runninghub/README.md`

- [ ] **Step 1: 将 RH timeout 提升为任务级可容忍窗口**

保持 worker 传入：

```ts
pollIntervalMs: clampNumber(task.payload.pollIntervalMs, 5000, 500, 30000),
timeoutMs: clampNumber(task.payload.timeoutMs || task.payload.maxPollMs || task.payload.pollTimeoutMs, 20 * 60 * 1000, 5000, 60 * 60 * 1000),
```

并确保 `worker-runninghub-client.ts` 不再额外引入更短的私有超时。

- [ ] **Step 2: 对 poll 网关失败保留结构化诊断**

当 query 非 2xx 或非 JSON 时，保留：

```ts
failureCategory: "upstream_poll_gateway_failed",
providerDiagnostic: `RunningHub 轮询失败 ${status}`,
upstreamHttpStatus: status,
upstreamResponseSnippet: pollText.slice(0, 500),
```

超时时：

```ts
failureCategory: "upstream_poll_timeout",
providerDiagnostic: `RunningHub 轮询超时: ${upstreamTaskId}`,
```

- [ ] **Step 3: heartbeat 保持 RH 运行态持续刷新**

`onHeartbeat` 每次 poll 至少写：

```ts
{
  upstreamTaskId,
  taskId: upstreamTaskId,
  runtimeStage: "polling",
  upstreamStatus,
  upstreamMessage,
  rhTargetType: targetType,
  rhRunTargetId: runTargetId,
}
```

- [ ] **Step 4: 运行态提示继续统一**

队列与进度口径：

```ts
queued/submitting => progress "5%"
running => progress "45%"
succeeded => progress "100%"
rhQueueReason === "all_keys_busy" => queueHint "任务队列排队中"
```

- [ ] **Step 5: 跑 RH 轮询专项验证**

Run:

```bash
npx tsx scripts/verify-runninghub-poll-non-json-contract.ts
node scripts/verify-runninghub-queue-governance-contract.mjs
node scripts/verify-runninghub-node-progress-contract.mjs
npm run type-check -w @xinghuan/worker
```

Expected:
- 非 JSON poll、timeout、queue hint contract 全部通过

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/worker-runninghub-client.ts apps/worker/src/worker.ts docs/systems/worker/queue-and-concurrency.md docs/systems/runninghub/README.md
git commit -m "fix: govern runninghub polling timeout and runtime hints"
```

### Task 8: 汇总验证、文档同步、gray 放行准备

**Files:**
- Modify: `docs/logbooks/daily/2026/2026-06/2026-06-24.md`
- Modify: `docs/logbooks/releases/current-release-index.md`
- Modify: `ops/README.md`
- Modify: `ops/current/gray.md`

- [ ] **Step 1: 跑完整本地 gate**

Run:

```bash
node scripts/verify-announcement-contract.mjs
node scripts/verify-announcement-sse-contract.mjs
node scripts/verify-unified-protocol-runtime-contract.mjs
node scripts/verify-runninghub-dynamic-key-selection-contract.mjs
node scripts/verify-runninghub-key-pool-contract.mjs
node scripts/verify-runninghub-node-progress-contract.mjs
node scripts/verify-runninghub-queue-governance-contract.mjs
npx tsx scripts/verify-runninghub-poll-non-json-contract.ts
npm run verify:provider-generation-worker
npm run type-check -w @xinghuan/api
npm run type-check -w @xinghuan/worker
npm run type-check -w @xinghuan/web
npm run type-check -w @xinghuan/admin
codegraph sync
```

- [ ] **Step 2: 同步台账与当前放行入口**

至少记录：
- 公告系统上线范围
- RH timeout 与多 Key 修复范围
- Agent 已验证
- 待用户验收

- [ ] **Step 3: 生成 gray 包**

Run:

```bash
npm run release:gray:prepare
```

Expected:
- release gate、governance gate、worktree clean gate 通过

- [ ] **Step 4: gray 发布**

Run:

```bash
npm run release:gray:deploy -- --release=<release-id> --archive=dist-release/<release-id>.tar.gz --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem
npm run release:gray:verify -- --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem --expected-version=0.5.1 --expected-environment=gray
```

- [ ] **Step 5: Commit**

```bash
git add docs/logbooks/daily/2026/2026-06/2026-06-24.md docs/logbooks/releases/current-release-index.md ops/README.md ops/current/gray.md
git commit -m "docs: record announcement and runninghub gray rollout"
```

## Rollback Notes

- 公告系统与 RH 修复必须分组提交，不允许揉成一个 commit。
- 如果公告 API 上线后前台异常，可先回退公告相关 commit，不影响 RH worker 修复批次。
- 如果 RH 动态选 Key 出现误占位，只回退 `worker-runninghub-dispatch.ts` 与对应 `server.ts` 入队字段批次，不回退公告模块。
- gray 放行前如果 `db:migrate` 或 SSE 路由异常，暂停发布，不允许带着半成品路由进入 deploy。

## Self Review

- 公告模型、后台板块、前台入口、SSE 强提醒、关闭即已读、版本公告并轨，均已被 Task 2-5 覆盖。
- RH timeout、默认 Key 优先、fallback 其他 Key、all_keys_busy、运行态提示与验证脚本，均已被 Task 6-8 覆盖。
- 本计划没有把“视觉观感验收”写成 Agent 职责，仍保持由用户做人工体验验收。
- 本计划不要求回头大拆既有视觉页面，只覆盖当前用户明确要求的公告系统和 RH 队列专项。
