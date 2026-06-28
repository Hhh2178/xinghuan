# Admin Audit Account Model/RH Usage Drilldown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing admin audit usage dashboard so an administrator can select an account and inspect that account's successful model usage and RH entry usage details while preserving the current global usage summary.

**Architecture:** Reuse the existing `GET /api/admin/audit/usage-summary` route and augment the current `AdminUsageSummary` payload with a `selectedUser` detail block. Keep one shared filter model end to end so the account drilldown and the global summary always use the same `succeeded`-only aggregation rules. In the admin frontend, separate the audit dashboard into a filter bar, selected-account drilldown, global summary, and audit log sections without replacing the current analytics foundation.

**Tech Stack:** TypeScript, React, Node HTTP route handlers, existing admin dashboard components, CodeGraph, repo verify scripts, npm workspace builds.

---

## File Map

- Modify: `apps/api/src/admin-usage-analytics.ts`
  - Extend summary types and aggregate `selectedUser` detail rows from the already-filtered successful tasks.
- Modify: `apps/api/src/admin-audit-routes.ts`
  - Keep the current route and query parser, but ensure the query path is ready for account drilldown reads.
- Modify: `apps/admin/src/admin-types.ts`
  - Mirror the backend usage summary type changes for the admin frontend.
- Modify: `apps/admin/src/admin-api-client.ts`
  - Add query-param support to `adminAuditApi.readUsageSummary(filters?)`.
- Modify: `apps/admin/src/admin-usage-dashboard.tsx`
  - Introduce filter controls, selected-account drilldown rendering, and keep the current global totals UI.
- Modify: `apps/admin/src/admin-readonly-panels.tsx`
  - Pass through the new usage dashboard props.
- Modify: `apps/admin/src/main.tsx`
  - Add audit filter state, selected-account state, usage-summary loading, and filter-driven refresh behavior.
- Modify: `scripts/verify-admin-usage-dashboard-contract.mjs`
  - Update the contract checks to cover the account drilldown structure.
- Modify: `DEVLOG.md`
  - Record the implementation and local verification.

## Task 1: Extend backend usage-summary types and selected-account aggregation

**Files:**
- Modify: `apps/api/src/admin-usage-analytics.ts`

- [ ] **Step 1: Write the failing backend contract test**

Add a focused test file that proves a filtered `userId` request still returns global rows plus a `selectedUser` block with model and RH breakdowns:

```ts
import { describe, expect, it } from "vitest";
import { buildAdminUsageSummary, type AdminUsageTaskRecord } from "../src/admin-usage-analytics.js";

describe("buildAdminUsageSummary selected user drilldown", () => {
  it("returns selected user model and RH usage details from successful tasks", () => {
    const tasks: AdminUsageTaskRecord[] = [
      {
        id: "task-model-1",
        status: "succeeded",
        ownerId: "user-1",
        ownerEmail: "alice@example.com",
        ownerName: "Alice",
        ownerGroupId: "group-a",
        ownerGroupName: "A组",
        providerId: "openai",
        providerName: "OpenAI",
        modelId: "gpt-4.1",
        modelRecordId: "model-gpt-41",
        modelDisplayName: "GPT 4.1",
        payload: { taskCapability: "chat" },
        result: {},
        createdAt: 1000,
      },
      {
        id: "task-rh-1",
        status: "succeeded",
        ownerId: "user-1",
        ownerEmail: "alice@example.com",
        ownerName: "Alice",
        ownerGroupId: "group-a",
        ownerGroupName: "A组",
        providerId: "runninghub",
        providerName: "RunningHub",
        payload: {
          protocol: "runninghub",
          targetType: "workflow",
          rhCatalogId: "rh-flow-1",
          rhCatalogTitle: "批量生图工作流",
          workflowId: "run-target-1",
        },
        result: {},
        createdAt: 2000,
      },
    ];

    const summary = buildAdminUsageSummary({
      tasks,
      filters: { from: 0, to: 9999, userId: "user-1" },
      groupMemberCounts: new Map([["group-a", 3]]),
      runningHubResolver: {
        byCatalogId: () => null,
        byTarget: () => null,
      },
    });

    expect(summary.selectedUser?.userId).toBe("user-1");
    expect(summary.selectedUser?.successful).toBe(2);
    expect(summary.selectedUser?.modelBreakdown).toEqual([
      expect.objectContaining({
        displayName: "GPT 4.1",
        total: 1,
      }),
    ]);
    expect(summary.selectedUser?.runningHubBreakdown).toEqual([
      expect.objectContaining({
        catalogId: "rh-flow-1",
        total: 1,
      }),
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w @xinghuan/api -- admin-usage-analytics`

Expected: FAIL because `selectedUser` is not defined on `AdminUsageSummary`.

- [ ] **Step 3: Add selected-account summary types**

Extend `apps/api/src/admin-usage-analytics.ts` with the new summary block and row types:

```ts
export interface UsageSelectedUserModelRow {
  capability: "image" | "video" | "llm" | "audio";
  providerId: string;
  providerName: string;
  modelRecordId: string;
  modelId: string;
  displayName: string;
  total: number;
  lastUsedAt?: number;
}

export interface UsageSelectedUserRunningHubRow {
  kind: "app" | "workflow";
  providerId: string;
  providerName: string;
  catalogId: string;
  title: string;
  runTargetId: string;
  total: number;
  lastUsedAt?: number;
}

export interface UsageSelectedUserSummary {
  userId: string;
  email: string;
  name: string;
  remark?: string;
  groupId?: string;
  groupName?: string;
  ownerDeleted?: boolean;
  successful: number;
  lastSucceededAt?: number;
  modelBreakdown: UsageSelectedUserModelRow[];
  runningHubBreakdown: UsageSelectedUserRunningHubRow[];
}

export interface AdminUsageSummary {
  range: { from: number; to: number };
  totals: { ... };
  groups: UsageGroupRow[];
  users: UsageUserRow[];
  models: UsageModelRow[];
  runningHubEntries: UsageRunningHubEntryRow[];
  daily: UsageDailyRow[];
  selectedUser?: UsageSelectedUserSummary;
}
```

- [ ] **Step 4: Implement selected-account aggregation from prepared tasks**

Build the detail block from the already-filtered `prepared` tasks so the selected account and global summary always share one filter path:

```ts
const selectedUserTasks = input.filters.userId
  ? prepared.filter((task) => task.userId === input.filters.userId)
  : [];

const selectedUser = selectedUserTasks.length
  ? buildSelectedUserSummary(selectedUserTasks)
  : undefined;

return {
  range: {
    from: input.filters.from,
    to: input.filters.to,
  },
  totals,
  groups,
  users,
  models,
  runningHubEntries,
  daily,
  selectedUser,
};
```

Add helper functions that group the selected user's `modelEntry` rows by `capability + providerId + modelRecordId` and `rhEntry` rows by `kind + providerId + catalogId`, increment `total`, and keep `lastUsedAt = Math.max(...)`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -w @xinghuan/api -- admin-usage-analytics`

Expected: PASS and the new selected-account assertions succeed.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/admin-usage-analytics.ts apps/api/src/__tests__/admin-usage-analytics.test.ts
git commit -m "feat: add selected account usage summary aggregation"
```

## Task 2: Mirror selected-account usage types on the admin frontend

**Files:**
- Modify: `apps/admin/src/admin-types.ts`

- [ ] **Step 1: Write the failing frontend type contract check**

Add a contract assertion so the repo verify script expects the new selected-account types:

```js
check("admin types expose selected user usage summary", adminTypesSource.includes("export interface UsageSelectedUserSummary"));
check("admin types expose selected user model row", adminTypesSource.includes("export interface UsageSelectedUserModelRow"));
check("admin types expose selected user RH row", adminTypesSource.includes("export interface UsageSelectedUserRunningHubRow"));
```

- [ ] **Step 2: Run the contract script to verify it fails**

Run: `node scripts/verify-admin-usage-dashboard-contract.mjs`

Expected: FAIL because the frontend types do not yet include the selected-account usage interfaces.

- [ ] **Step 3: Add the frontend mirror types**

Mirror the backend shape in `apps/admin/src/admin-types.ts`:

```ts
export interface UsageSelectedUserModelRow {
  capability: "image" | "video" | "llm" | "audio";
  providerId: string;
  providerName: string;
  modelRecordId: string;
  modelId: string;
  displayName: string;
  total: number;
  lastUsedAt?: number;
}

export interface UsageSelectedUserRunningHubRow {
  kind: "app" | "workflow";
  providerId: string;
  providerName: string;
  catalogId: string;
  title: string;
  runTargetId: string;
  total: number;
  lastUsedAt?: number;
}

export interface UsageSelectedUserSummary {
  userId: string;
  email: string;
  name: string;
  remark?: string;
  groupId?: string;
  groupName?: string;
  ownerDeleted?: boolean;
  successful: number;
  lastSucceededAt?: number;
  modelBreakdown: UsageSelectedUserModelRow[];
  runningHubBreakdown: UsageSelectedUserRunningHubRow[];
}
```

Then add `selectedUser?: UsageSelectedUserSummary;` to `AdminUsageSummary`.

- [ ] **Step 4: Run the contract script to verify it passes this portion**

Run: `node scripts/verify-admin-usage-dashboard-contract.mjs`

Expected: PASS for the type exposure checks, even if later UI checks still fail.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/admin-types.ts scripts/verify-admin-usage-dashboard-contract.mjs
git commit -m "feat: add selected account usage types to admin frontend"
```

## Task 3: Add queryable usage-summary API client support

**Files:**
- Modify: `apps/admin/src/admin-api-client.ts`

- [ ] **Step 1: Write the failing API client contract check**

Extend the dashboard contract script to require query support:

```js
check("admin api client supports usage summary query params", adminApiClientSource.includes("new URLSearchParams()"));
check("admin api client forwards usage summary userId filter", adminApiClientSource.includes('query.set("userId", filters.userId)'));
```

- [ ] **Step 2: Run the contract script to verify it fails**

Run: `node scripts/verify-admin-usage-dashboard-contract.mjs`

Expected: FAIL because `readUsageSummary` is still hardcoded to `/api/admin/audit/usage-summary`.

- [ ] **Step 3: Add filter-based query parameter support**

Change `adminAuditApi.readUsageSummary` to:

```ts
readUsageSummary: (filters: {
  range?: "today" | "7d" | "30d";
  from?: number;
  to?: number;
  groupId?: string;
  userId?: string;
  capability?: import("./admin-types").UsageCapability;
  providerId?: string;
  modelId?: string;
  rhCatalogId?: string;
} = {}) => {
  const query = new URLSearchParams();
  if (filters.range) query.set("range", filters.range);
  if (typeof filters.from === "number") query.set("from", String(filters.from));
  if (typeof filters.to === "number") query.set("to", String(filters.to));
  if (filters.groupId) query.set("groupId", filters.groupId);
  if (filters.userId) query.set("userId", filters.userId);
  if (filters.capability) query.set("capability", filters.capability);
  if (filters.providerId) query.set("providerId", filters.providerId);
  if (filters.modelId) query.set("modelId", filters.modelId);
  if (filters.rhCatalogId) query.set("rhCatalogId", filters.rhCatalogId);
  const suffix = query.toString();
  return api<import("./admin-types").AdminUsageSummary>(`/api/admin/audit/usage-summary${suffix ? `?${suffix}` : ""}`);
},
```

- [ ] **Step 4: Run the contract script to verify it passes**

Run: `node scripts/verify-admin-usage-dashboard-contract.mjs`

Expected: PASS for the query-param checks.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/admin-api-client.ts scripts/verify-admin-usage-dashboard-contract.mjs
git commit -m "feat: support filtered admin usage summary requests"
```

## Task 4: Add audit filter state and selected-account refresh flow in the admin shell

**Files:**
- Modify: `apps/admin/src/main.tsx`
- Modify: `apps/admin/src/admin-readonly-panels.tsx`

- [ ] **Step 1: Write the failing contract checks for state and prop wiring**

Extend the verify script with checks such as:

```js
check("main stores usage summary filters", mainSource.includes("const [usageFilters, setUsageFilters]"));
check("main stores selected usage user id", mainSource.includes("const [selectedUsageUserId, setSelectedUsageUserId]"));
check("main loads usage summary through adminAuditApi", mainSource.includes("adminAuditApi.readUsageSummary("));
check("audit panel receives usage filter props", readonlyPanelsSource.includes("usageFilters"));
```

- [ ] **Step 2: Run the contract script to verify it fails**

Run: `node scripts/verify-admin-usage-dashboard-contract.mjs`

Expected: FAIL because `main.tsx` still does a one-shot unfiltered summary fetch.

- [ ] **Step 3: Add dedicated audit usage state and refresh logic**

In `main.tsx`, add:

```ts
const [usageFilters, setUsageFilters] = useState({
  range: "30d" as "today" | "7d" | "30d",
  groupId: "",
  capability: "",
  providerId: "",
});
const [selectedUsageUserId, setSelectedUsageUserId] = useState("");
const [usageSummaryLoading, setUsageSummaryLoading] = useState(false);
const [usageSummaryError, setUsageSummaryError] = useState("");
```

Create a dedicated loader:

```ts
async function loadUsageSummary(filters = usageFilters, selectedUserId = selectedUsageUserId) {
  if (!isAdmin) return;
  setUsageSummaryLoading(true);
  setUsageSummaryError("");
  try {
    const nextUsageSummary = await adminAuditApi.readUsageSummary({
      ...filters,
      groupId: filters.groupId || undefined,
      capability: filters.capability || undefined,
      providerId: filters.providerId || undefined,
      userId: selectedUserId || undefined,
    });
    setUsageSummary(nextUsageSummary);
  } catch (nextError) {
    setUsageSummaryError(nextError instanceof Error ? nextError.message : String(nextError));
  } finally {
    setUsageSummaryLoading(false);
  }
}
```

- [ ] **Step 4: Wire audit panel props and selected-account reset rules**

Pass the new state into `AuditPanel`:

```tsx
<AuditPanel
  auditLogs={auditLogs}
  usageSummary={usageSummary}
  usageSummaryLoading={usageSummaryLoading}
  usageSummaryError={usageSummaryError}
  usageFilters={usageFilters}
  selectedUsageUserId={selectedUsageUserId}
  users={users}
  userGroups={userGroups}
  providers={providers}
  onUsageFiltersChange={setUsageFilters}
  onSelectedUsageUserIdChange={setSelectedUsageUserId}
/>
```

When the selected account no longer belongs to the active group filter, clear it before reload.

- [ ] **Step 5: Run the contract script to verify it passes**

Run: `node scripts/verify-admin-usage-dashboard-contract.mjs`

Expected: PASS for the state and prop wiring checks.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/main.tsx apps/admin/src/admin-readonly-panels.tsx scripts/verify-admin-usage-dashboard-contract.mjs
git commit -m "feat: add audit usage filter state and selected account wiring"
```

## Task 5: Refactor the audit usage dashboard UI for account drilldown

**Files:**
- Modify: `apps/admin/src/admin-usage-dashboard.tsx`

- [ ] **Step 1: Write the failing UI contract checks**

Add checks that require the new sections:

```js
check("usage dashboard renders account selector", usageDashboardSource.includes("选择账号查看明细"));
check("usage dashboard renders selected account summary", usageDashboardSource.includes("账号下钻"));
check("usage dashboard renders account model usage table", usageDashboardSource.includes("账号模型使用明细"));
check("usage dashboard renders account RH usage table", usageDashboardSource.includes("账号 RH 条目使用明细"));
check("usage dashboard keeps global model totals table", usageDashboardSource.includes("模型总使用次数"));
check("usage dashboard keeps global RH totals table", usageDashboardSource.includes("RH 条目总使用次数"));
```

- [ ] **Step 2: Run the contract script to verify it fails**

Run: `node scripts/verify-admin-usage-dashboard-contract.mjs`

Expected: FAIL because the current dashboard only renders the old global KPI layout.

- [ ] **Step 3: Add the filter bar and empty state**

Update `AdminUsageDashboard` props to accept:

```ts
{
  usageSummary: AdminUsageSummary | null;
  usageSummaryLoading: boolean;
  usageSummaryError: string;
  usageFilters: { range: "today" | "7d" | "30d"; groupId: string; capability: string; providerId: string };
  selectedUsageUserId: string;
  users: AdminUser[];
  userGroups: AdminUserGroup[];
  providers: ProviderRecord[];
  onUsageFiltersChange: (...) => void;
  onSelectedUsageUserIdChange: (value: string) => void;
}
```

Render a filter band with range, group, capability, provider, and account selection, plus an empty state:

```tsx
<section className="usage-panel usage-panel--filters">
  <header>
    <h3>筛选与下钻</h3>
    <span>Usage Filters</span>
  </header>
  <div className="usage-filter-grid">
    ...
  </div>
</section>

{!selectedUsageUserId ? (
  <article className="usage-panel usage-panel--empty-state">
    <header>
      <h3>账号下钻</h3>
      <span>Account Drilldown</span>
    </header>
    <p>请选择账号查看模型与 RH 条目使用明细</p>
  </article>
) : null}
```

- [ ] **Step 4: Render selected-account summary and two detail tables**

Add the account summary card and separate model/RH tables:

```tsx
<article className="usage-panel">
  <header>
    <h3>账号模型使用明细</h3>
    <span>Model Usage by Account</span>
  </header>
  <div className="usage-table-wrap">
    <table className="usage-table">
      <thead>
        <tr>
          <th>能力</th>
          <th>Provider</th>
          <th>模型名称</th>
          <th>模型 ID</th>
          <th>使用次数</th>
          <th>最近使用</th>
        </tr>
      </thead>
      <tbody>...</tbody>
    </table>
  </div>
</article>
```

Mirror the same structure for `账号 RH 条目使用明细`, using `catalogId`, `runTargetId`, `total`, and `lastUsedAt`.

- [ ] **Step 5: Keep the existing global area, but rename the lower tables to totals**

Rename the current tables to `模型总使用次数` and `RH 条目总使用次数`, and keep the current KPI, rankings, and trend sections under the global area.

- [ ] **Step 6: Run the contract script to verify it passes**

Run: `node scripts/verify-admin-usage-dashboard-contract.mjs`

Expected: PASS for the new drilldown and preserved global summary checks.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/admin-usage-dashboard.tsx scripts/verify-admin-usage-dashboard-contract.mjs
git commit -m "feat: add audit account drilldown dashboard UI"
```

## Task 6: Verify builds, sync docs, and record the change

**Files:**
- Modify: `DEVLOG.md`

- [ ] **Step 1: Run focused verification**

Run:

```bash
node scripts/verify-admin-usage-dashboard-contract.mjs
npm run build -w @xinghuan/api
npm run build -w @xinghuan/admin
```

Expected: all commands PASS.

- [ ] **Step 2: Sync CodeGraph**

Run: `codegraph sync`

Expected: CodeGraph reports the index is updated for the modified files.

- [ ] **Step 3: Record the implementation in the development log**

Add a `2026-06-28` entry to `DEVLOG.md` that records:

```md
- 后台审计页成功用量驾驶舱扩展为“先选账号，再看明细”结构。
- `/api/admin/audit/usage-summary` 新增 `selectedUser` 账号模型/RH 使用明细返回块。
- 审计页保留全局模型与 RH 总使用次数表，同时增加账号级模型表和 RH 表。
- 本地已执行 `node scripts/verify-admin-usage-dashboard-contract.mjs`、`npm run build -w @xinghuan/api`、`npm run build -w @xinghuan/admin`。
```

- [ ] **Step 4: Commit**

```bash
git add DEVLOG.md
git commit -m "docs: record audit account drilldown implementation"
```

## Self-Review

- Spec coverage:
  - Reuse existing `usage-summary` route: covered by Tasks 1, 3, 4.
  - Account-first drilldown: covered by Tasks 4 and 5.
  - Separate model and RH tables: covered by Task 5.
  - Preserve global totals: covered by Tasks 1 and 5.
  - `succeeded`-only rule: preserved in Task 1 by building selected-account detail from already-filtered successful tasks.
- Placeholder scan:
  - No `TODO`, `TBD`, or "write tests later" placeholders remain.
- Type consistency:
  - `selectedUser`, `UsageSelectedUserModelRow`, and `UsageSelectedUserRunningHubRow` use the same names across backend, frontend, and verify steps.
