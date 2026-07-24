# Provider Model Channel Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a user-visible and Admin-visible Provider/model channel health report with 36 two-hour success buckets, recent status labels, privacy-preserving aggregate votes, manual refresh, and bounded automatic refresh.

**Architecture:** PostgreSQL performs bounded settled-task and vote aggregation through a dedicated repository. A channel-health service applies immutable dimension fallback, thresholds, dynamic feedback windows, caching, and viewer-vote isolation; shared contracts and shared report primitives keep Web and Admin semantics aligned. Web owns the template-style modal and voting controls, while Admin owns analytics filters and optional five-minute refresh.

**Tech Stack:** PostgreSQL migrations, Node.js HTTP API, TypeScript 5.9, React 19, Vite 8, Vitest 4, lucide-react, Playwright/browser Harness, existing monorepo governance scripts.

## Global Constraints

- The approved design is `docs/superpowers/specs/2026-07-24-provider-model-channel-health-design.md`.
- Count only `succeeded` and `failed`; exclude queued, running, and cancelled from numerator, denominator, and bucket presence.
- Use the current Beijing-time even-hour two-hour bucket plus the preceding 35 buckets.
- Current model state uses the most recent six hours; fewer than 3 settled tasks is `insufficient_sample`.
- Healthy is `>=95%`, degraded is `>=80% and <95%`, unhealthy is `<80%`.
- Vote eligibility requires a settled task for the exact owner, Provider, and model in the previous 24 hours.
- Show 24-hour votes while the channel has recent use; otherwise use a maximum 72-hour fallback and never show older votes.
- Return aggregate vote counts only; never return voter identities or a voter list.
- Web loads once, refreshes on demand, at whole hours while visible, and once on visibility return when older than ten minutes.
- Admin auto-refresh is optional, five minutes, off by default, and paused while hidden.
- Validate PC `1920x1080` and `2560x1440` only. Do not add mobile/tablet work.
- Do not push GitHub and do not touch Production.
- Do not deploy Gray until the explicit deployment approval gate in Task 9 is satisfied.

---

## File Map

### Shared contract and presentation

- Create `packages/shared/src/channel-health.ts`: response types, bucket math, rate/status helpers, Provider-state precedence.
- Create `packages/shared/src/channel-health.test.ts`: boundary and threshold unit tests.
- Modify `packages/shared/src/index.ts`: export channel-health contracts.
- Create `packages/ui/src/channel-health-report.tsx`: shared Provider/model hierarchy, trend SVG, bucket strip, counts, feedback distribution.
- Create `packages/ui/src/channel-health-report.test.tsx`: static markup and missing-bucket contract tests.
- Modify `packages/ui/src/index.tsx`: export shared report primitives.
- Modify `packages/ui/package.json`: declare the existing workspace `@xinghuan/shared` dependency used by the report contract.
- Modify `package-lock.json`: lock the new `packages/ui` workspace dependency edge.

### Database and API

- Create `apps/api/db/042_provider_model_channel_health.sql`: feedback table and bounded-query indexes.
- Create `apps/api/src/channel-health-migration.test.ts`: migration contract.
- Create `apps/api/src/channel-health-repository.ts`: PostgreSQL catalogue, settled bucket, recent status, feedback aggregate, viewer vote, and atomic vote upsert queries.
- Create `apps/api/src/channel-health-repository.test.ts`: SQL parameter and privacy contract tests.
- Create `apps/api/src/channel-health-service.ts`: report assembly, snapshot fallback, status classification, dynamic feedback window, sort order, 30-second aggregate cache.
- Create `apps/api/src/channel-health-service.test.ts`: domain and cache tests.
- Create `apps/api/src/channel-health-routes.ts`: member/admin GET, member POST, filters, ETag/304.
- Create `apps/api/src/channel-health-routes.test.ts`: authentication-independent handler tests with injected service.
- Modify `apps/api/src/server.ts`: dependency construction and route delegation only.

### Web

- Create `apps/web/src/services/channel-health-api.ts`: ETag-aware read and vote calls.
- Create `apps/web/src/components/channel-health/channel-health-refresh.ts`: whole-hour and visibility refresh policy helpers.
- Create `apps/web/src/components/channel-health/channel-health-refresh.test.ts`: scheduler boundary tests.
- Create `apps/web/src/components/channel-health/useChannelHealth.ts`: request state, stale preservation, cooldown, visibility/hour refresh, voting.
- Create `apps/web/src/components/channel-health/ChannelHealthModal.tsx`: approved V2 template-style subpage.
- Create `apps/web/src/components/channel-health/channel-health.css`: Web theme and PC layout.
- Modify `apps/web/src/components/CanvasToolbar.tsx`: channel-status icon event.
- Modify `apps/web/src/App.tsx`: lazy modal ownership and event wiring.

### Admin

- Create `apps/admin/src/admin-channel-health-refresh.ts`: optional refresh policy helpers.
- Create `apps/admin/src/admin-channel-health-refresh.test.ts`: hidden-tab and interval tests.
- Create `apps/admin/src/admin-channel-health-dashboard.tsx`: filters, manual refresh, optional auto-refresh, stale preservation.
- Create `apps/admin/src/admin-channel-health-dashboard.css`: dense Admin layout.
- Modify `apps/admin/src/admin-api-client.ts`: filtered reliability read client.
- Modify `apps/admin/src/admin-view-model.ts`: `reliability` view and `/admin/analytics/reliability` route.
- Modify `apps/admin/src/admin-readonly-panels.tsx`: render the channel health dashboard.
- Modify `scripts/verify-admin-view-model-contract.ts`: reliability route assertion.
- Modify `scripts/verify-admin-readonly-panels-contract.mjs`: fourth analytics view assertion.

### Harness and documentation

- Create `scripts/verify-channel-health-contract.mjs`: source-level ownership, route, privacy, refresh, and UI-entry contract.
- Modify `package.json`: add `verify:channel-health-contract` and include it in `harness:verify:project`.
- Create `docs/systems/observability-and-ops/channel-health.md`: operational metric authority and troubleshooting.
- Modify `docs/systems/observability-and-ops/README.md`: link the new system document.
- Modify `docs/systems/admin/README.md`: add Admin route and component entry.
- Create or append the current daily logbook under `docs/logbooks/daily/` with implementation and validation evidence.

---

### Task 1: Shared Channel Health Contract

**Files:**
- Create: `packages/shared/src/channel-health.ts`
- Create: `packages/shared/src/channel-health.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `ChannelHealthReport`, `ChannelHealthProvider`, `ChannelHealthModel`, `ChannelHealthBucket`, `ChannelFeedbackSummary`, `ChannelFeedbackVote`, `ChannelHealthCapability`, `ChannelHealthState`.
- Produces: `buildChannelHealthBucketRange(nowMs)`, `successRate(succeeded, failed)`, `classifyChannelHealth(succeeded, failed)`, `classifyProviderHealth(states)`.
- Consumes: no feature-specific earlier task.

- [ ] **Step 1: Write failing shared contract tests**

```ts
import { describe, expect, it } from "vitest";
import {
  buildChannelHealthBucketRange,
  classifyChannelHealth,
  classifyProviderHealth,
  successRate,
} from "./channel-health.js";

describe("channel health contract", () => {
  it("builds 36 even Beijing-hour buckets", () => {
    const now = Date.parse("2026-07-24T07:31:00.000Z"); // 15:31 Beijing
    const range = buildChannelHealthBucketRange(now);
    expect(range.buckets).toHaveLength(36);
    expect(new Date(range.buckets.at(-1)!.startAt).toISOString()).toBe("2026-07-24T06:00:00.000Z");
    expect(range.buckets.at(-1)!.endAt - range.buckets.at(-1)!.startAt).toBe(7_200_000);
  });

  it("uses the approved sample and rate thresholds", () => {
    expect(classifyChannelHealth(0, 0)).toBe("no_recent_requests");
    expect(classifyChannelHealth(2, 0)).toBe("insufficient_sample");
    expect(classifyChannelHealth(19, 1)).toBe("healthy");
    expect(classifyChannelHealth(8, 2)).toBe("degraded");
    expect(classifyChannelHealth(2, 1)).toBe("unhealthy");
    expect(successRate(1, 3)).toBe(0.25);
  });

  it("gives unhealthy Provider state precedence", () => {
    expect(classifyProviderHealth(["healthy", "unhealthy"])).toBe("unhealthy");
    expect(classifyProviderHealth(["insufficient_sample", "no_recent_requests"])).toBe("insufficient_sample");
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run packages/shared/src/channel-health.test.ts`

Expected: FAIL because `channel-health.ts` does not exist.

- [ ] **Step 3: Implement the shared types and deterministic helpers**

Use these stable discriminants:

```ts
export type ChannelHealthCapability = "image" | "video" | "audio" | "chat";
export type ChannelHealthState = "healthy" | "degraded" | "unhealthy" | "insufficient_sample" | "no_recent_requests";
export type ChannelFeedbackVote = "up" | "down";
export type ChannelFeedbackWindow = "24h" | "72h_fallback";

export interface ChannelHealthBucket {
  startAt: number;
  endAt: number;
  succeeded: number;
  failed: number;
  settled: number;
  successRate: number;
  sufficientSample: boolean;
}

export interface ChannelFeedbackSummary {
  window: ChannelFeedbackWindow;
  up: number;
  down: number;
  total: number;
  upRate: number | null;
  viewerVote: ChannelFeedbackVote | null;
}

export interface ChannelHealthModel {
  providerId: string;
  modelRecordId: string;
  nativeModelId: string;
  displayName: string;
  capability: ChannelHealthCapability;
  enabled: boolean;
  state: ChannelHealthState;
  succeeded: number;
  failed: number;
  settled: number;
  successRate: number | null;
  buckets: ChannelHealthBucket[];
  feedback: ChannelFeedbackSummary;
}

export interface ChannelHealthProvider {
  id: string;
  name: string;
  enabled: boolean;
  state: ChannelHealthState;
  models: ChannelHealthModel[];
}

export interface ChannelHealthReport {
  generatedAt: number;
  windowStartAt: number;
  windowEndAt: number;
  bucketHours: 2;
  bucketCount: 36;
  providers: ChannelHealthProvider[];
}
```

Implement Beijing bucket math with the fixed UTC+8 offset; Beijing has no daylight-saving transition to apply.

- [ ] **Step 4: Export and verify GREEN**

Add `export * from "./channel-health.js";` to `packages/shared/src/index.ts`.

Run: `npx vitest run packages/shared/src/channel-health.test.ts && npm run type-check -w @xinghuan/shared`

Expected: PASS.

- [ ] **Step 5: Commit the shared contract**

```bash
git add packages/shared/src/channel-health.ts packages/shared/src/channel-health.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): define channel health contract"
```

---

### Task 2: Feedback Migration And Query Indexes

**Files:**
- Create: `apps/api/db/042_provider_model_channel_health.sql`
- Create: `apps/api/src/channel-health-migration.test.ts`

**Interfaces:**
- Produces: `xh_channel_feedback` with unique `(owner_id, provider_id, model_id)`.
- Produces: settled-task, vote-eligibility, and feedback-window indexes consumed by Task 3.
- Consumes: `xh_users`, `xh_providers`, `xh_models`, and `xh_tasks` from existing migrations.

- [ ] **Step 1: Write the failing migration contract**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../db/042_provider_model_channel_health.sql", import.meta.url), "utf8");

describe("channel health migration", () => {
  it("stores one constrained vote per owner and channel", () => {
    expect(sql).toMatch(/create table if not exists xh_channel_feedback/i);
    expect(sql).toMatch(/check\s*\(vote in \('up', 'down'\)\)/i);
    expect(sql).toMatch(/unique\s*\(owner_id, provider_id, model_id\)/i);
  });

  it("adds bounded settled and eligibility indexes", () => {
    expect(sql).toMatch(/where status in \('succeeded', 'failed'\)/i);
    expect(sql).toMatch(/owner_id, provider_id, model_id, created_at desc/i);
    expect(sql).toMatch(/provider_id, model_id, updated_at desc/i);
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run apps/api/src/channel-health-migration.test.ts`

Expected: FAIL because Migration 042 does not exist.

- [ ] **Step 3: Create the additive migration**

```sql
create table if not exists xh_channel_feedback (
  id text primary key,
  owner_id text not null references xh_users(id) on delete cascade,
  provider_id text not null references xh_providers(id) on delete cascade,
  model_id text not null references xh_models(id) on delete cascade,
  vote text not null check (vote in ('up', 'down')),
  eligible_task_id text references xh_tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, provider_id, model_id)
);

create index if not exists idx_xh_tasks_channel_health_settled
  on xh_tasks(created_at desc, provider_id, model_id)
  where status in ('succeeded', 'failed');

create index if not exists idx_xh_tasks_channel_feedback_eligibility
  on xh_tasks(owner_id, provider_id, model_id, created_at desc)
  where status in ('succeeded', 'failed');

create index if not exists idx_xh_channel_feedback_window
  on xh_channel_feedback(provider_id, model_id, updated_at desc);
```

- [ ] **Step 4: Verify GREEN and migration ordering**

Run: `npx vitest run apps/api/src/channel-health-migration.test.ts apps/api/src/task-cost-migration.test.ts`

Run: `node scripts/verify-db-migrate-release-deps.mjs`

Expected: PASS; migration remains additive and ordered after 041.

- [ ] **Step 5: Commit the migration**

```bash
git add apps/api/db/042_provider_model_channel_health.sql apps/api/src/channel-health-migration.test.ts
git commit -m "feat(api): add channel feedback storage"
```

---

### Task 3: PostgreSQL Channel Health Repository

**Files:**
- Create: `apps/api/src/channel-health-repository.ts`
- Create: `apps/api/src/channel-health-repository.test.ts`

**Interfaces:**
- Consumes: Task 1 shared discriminants and Task 2 tables/indexes.
- Produces: `readCatalog(audience, filters)`, `readSettledBuckets(range)`, `readRecentStates(since)`, `readFeedbackAggregates(now)`, `readViewerVotes(ownerId)`, `upsertEligibleVote(input)`.
- `upsertEligibleVote` returns `{ kind: "saved"; vote } | { kind: "ineligible" } | { kind: "channel_missing" }`.

- [ ] **Step 1: Write repository tests against an injected Pool stub**

Cover these assertions explicitly:

```ts
expect(executedSql).toContain("t.status in ('succeeded', 'failed')");
expect(executedSql).not.toContain("owner_email");
expect(executedSql).toContain("ci.cost_item_type = 'provider_cost'");
expect(executedSql).toContain("coalesce(ci.provider_id_snapshot");
expect(upsertSql).toContain("on conflict (owner_id, provider_id, model_id)");
expect(upsertSql).toContain("t.owner_id = $1");
expect(upsertSql).toContain("t.created_at >= $4");
```

Use query-result fixtures with one success, one failure, one disabled Admin-only model, 24-hour votes, 72-hour votes, and one viewer vote.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run apps/api/src/channel-health-repository.test.ts`

Expected: FAIL because the repository factory is missing.

- [ ] **Step 3: Implement focused SQL readers**

Use `createChannelHealthRepository({ getPostgresPool, newId, now })`. Keep each query in a separate private function. The settled aggregation must:

- filter only `succeeded` and `failed`
- filter by `created_at` range
- use one `provider_cost` row per task through the existing unique cost-item constraint
- resolve IDs and names using `coalesce(snapshot, task, current catalogue)`
- group by Provider, model, capability, and `date_bin('2 hours', created_at, timestamptz '2000-01-01 00:00:00+08')`
- return counts only, never task rows or owners

The atomic vote command must use one SQL statement with an eligible-task CTE followed by `insert ... on conflict ... do update`, so eligibility cannot change between checking and saving.

- [ ] **Step 4: Verify GREEN and API type-check**

Run: `npx vitest run apps/api/src/channel-health-repository.test.ts`

Run: `npm run type-check -w @xinghuan/api`

Expected: PASS.

- [ ] **Step 5: Commit the repository**

```bash
git add apps/api/src/channel-health-repository.ts apps/api/src/channel-health-repository.test.ts
git commit -m "feat(api): aggregate provider model health"
```

---

### Task 4: Report Service, Cache, And Feedback Window

**Files:**
- Create: `apps/api/src/channel-health-service.ts`
- Create: `apps/api/src/channel-health-service.test.ts`

**Interfaces:**
- Consumes: Task 1 types/helpers and Task 3 repository methods.
- Produces: `readReport({ audience, ownerId, filters })`, `submitVote({ ownerId, providerId, modelRecordId, vote })`, `invalidateChannel(providerId, modelRecordId)`.
- Produces: `ChannelHealthFilters = { capability?: ChannelHealthCapability; providerId?: string; modelRecordId?: string }`.

- [ ] **Step 1: Write failing service tests**

Fixtures must prove:

1. Cancelled/running records cannot enter because the service receives only repository settled counts.
2. Missing buckets are absent from `model.buckets`.
3. A one-task bucket remains visible with `sufficientSample: false`.
4. Six-hour `2/0` is insufficient while `2/1` is unhealthy.
5. A recently used channel selects 24-hour votes.
6. A channel without 24-hour use selects 72-hour fallback votes.
7. Votes older than 72 hours produce zero counts.
8. Two readers share one aggregate repository read inside 30 seconds, but receive different `viewerVote` overlays.
9. A successful vote invalidates only the affected aggregate cache key.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run apps/api/src/channel-health-service.test.ts`

Expected: FAIL because the service factory is missing.

- [ ] **Step 3: Implement report assembly**

Factory signature:

```ts
export function createChannelHealthService(deps: {
  repository: ChannelHealthRepository;
  now?: () => number;
  cacheTtlMs?: number;
}) {
  return { readReport, submitVote, invalidateChannel };
}
```

Cache only the owner-independent aggregate report. Clone or immutably overlay `viewerVote` from `readViewerVotes(ownerId)` after the cache read. Public catalogue output includes enabled Provider/model rows even with no settled buckets. Admin filters may include disabled channels with recent data.

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run packages/shared/src/channel-health.test.ts apps/api/src/channel-health-service.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the service**

```bash
git add apps/api/src/channel-health-service.ts apps/api/src/channel-health-service.test.ts
git commit -m "feat(api): assemble cached channel health reports"
```

---

### Task 5: Member And Admin HTTP Routes

**Files:**
- Create: `apps/api/src/channel-health-routes.ts`
- Create: `apps/api/src/channel-health-routes.test.ts`
- Modify: `apps/api/src/server.ts`

**Interfaces:**
- Consumes: Task 4 `readReport` and `submitVote`.
- Produces: `GET /api/channel-health`, `POST /api/channel-health/feedback`, `GET /api/admin/analytics/model-success-rates`.
- Produces stable errors: `CHANNEL_FEEDBACK_INELIGIBLE`, `CHANNEL_NOT_FOUND`, `CHANNEL_FEEDBACK_VOTE_INVALID`.

- [ ] **Step 1: Write failing handler tests**

Test the handler with injected `sendT8`, `readJsonBody`, and service methods:

```ts
expect(await handleMemberRoutes(memberGet)).toBe(true);
expect(readReport).toHaveBeenCalledWith({ audience: "member", ownerId: "user-1", filters: {} });
expect(await handleMemberRoutes(memberVote)).toBe(true);
expect(submitVote).toHaveBeenCalledWith({ ownerId: "user-1", providerId: "p1", modelRecordId: "m1", vote: "up" });
expect(await handleAdminRoutes(adminGet)).toBe(true);
expect(readReport).toHaveBeenCalledWith(expect.objectContaining({ audience: "admin", filters: { capability: "image" } }));
```

Also assert matching `If-None-Match` returns 304 with an empty body, and invalid capability/vote inputs fail before calling the service.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run apps/api/src/channel-health-routes.test.ts`

Expected: FAIL because the route factory is missing.

- [ ] **Step 3: Implement routes and ETag**

Return a factory with two handlers:

```ts
const { handleMemberRoutes, handleAdminRoutes } = createChannelHealthRouteHandlers({
  service,
  sendT8,
  readJsonBody,
  invalidRequest: (code) => new HttpError(400, code),
  forbidden: (code) => new HttpError(403, code),
});
```

Compute ETags with SHA-256 over the final owner-specific response. Send `cache-control: private, max-age=0, must-revalidate`. The Admin handler rejects non-admin actors even though the outer Admin router already guards the route.

- [ ] **Step 4: Wire only delegation in `server.ts`**

Instantiate repository/service/handlers near the task-cost modules. Delegate member routes after authentication and before model catalogue routes. Delegate the Admin handler beside audit and cost analytics routes. Do not place SQL, report assembly, or vote validation in `server.ts`.

- [ ] **Step 5: Verify GREEN and route ownership**

Run: `npx vitest run apps/api/src/channel-health-routes.test.ts apps/api/src/channel-health-service.test.ts apps/api/src/channel-health-repository.test.ts`

Run: `npm run type-check -w @xinghuan/api`

Expected: PASS.

- [ ] **Step 6: Commit the routes**

```bash
git add apps/api/src/channel-health-routes.ts apps/api/src/channel-health-routes.test.ts apps/api/src/server.ts
git commit -m "feat(api): expose channel health and feedback routes"
```

---

### Task 6: Shared Report Presentation Primitives

**Files:**
- Create: `packages/ui/src/channel-health-report.tsx`
- Create: `packages/ui/src/channel-health-report.test.tsx`
- Modify: `packages/ui/src/index.tsx`
- Modify: `packages/ui/package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: Task 1 shared report types.
- Produces: `ChannelHealthReportView` with capability selection, search, Provider groups, model rows, trend, bucket strip, counts, and aggregate feedback.
- Produces: `ChannelHealthReportViewProps` with optional `onVote`, `votingModelKey`, `interactiveFeedback`, and `filtersSlot`.

- [ ] **Step 1: Write failing static-render tests**

Use `renderToStaticMarkup` and a two-model fixture. Assert:

- capability buttons render `图像`, `视频`, `音频`, `LLM`
- Provider appears before model names
- `成功 19 · 失败 1` renders
- 36 bucket positions render, with missing buckets carrying `data-empty="true"`
- the SVG path contains multiple segments when the fixture has an empty middle bucket
- aggregate `赞` and `踩` counts render without any owner property or identity label
- voting buttons are absent when `interactiveFeedback={false}`

- [ ] **Step 2: Verify RED**

Run: `npx vitest run packages/ui/src/channel-health-report.test.tsx`

Expected: FAIL because the shared report component is missing.

- [ ] **Step 3: Implement the shared semantic structure**

Use lucide `Activity`, `Image`, `Video`, `AudioLines`, `MessageSquareText`, `ThumbsUp`, and `ThumbsDown`. Generate SVG coordinates from present bucket rates only; begin a new path segment after every absent bucket. Keep every component class prefixed `xh-channel-health__` so Web/Admin wrappers can supply their own CSS variables without selector collision.

- [ ] **Step 4: Export and verify GREEN**

Add `export * from "./channel-health-report.js";` to `packages/ui/src/index.tsx`, add `"@xinghuan/shared": "0.7.6"` to `packages/ui/package.json` dependencies, and run `npm install --package-lock-only --ignore-scripts` to update only the root lockfile metadata.

Run: `npx vitest run packages/ui/src/channel-health-report.test.tsx && npm run type-check -w @xinghuan/ui`

Expected: PASS.

- [ ] **Step 5: Commit the shared presentation**

```bash
git add packages/ui/src/channel-health-report.tsx packages/ui/src/channel-health-report.test.tsx packages/ui/src/index.tsx packages/ui/package.json package-lock.json
git commit -m "feat(ui): add shared channel health report"
```

---

### Task 7: Web Channel Status Subpage

**Files:**
- Create: `apps/web/src/services/channel-health-api.ts`
- Create: `apps/web/src/components/channel-health/channel-health-refresh.ts`
- Create: `apps/web/src/components/channel-health/channel-health-refresh.test.ts`
- Create: `apps/web/src/components/channel-health/useChannelHealth.ts`
- Create: `apps/web/src/components/channel-health/ChannelHealthModal.tsx`
- Create: `apps/web/src/components/channel-health/channel-health.css`
- Modify: `apps/web/src/components/CanvasToolbar.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: Task 1 response types, Task 5 HTTP routes, Task 6 report view.
- Produces: `ChannelHealthModal({ open, onClose })`.
- Produces event: `penguin:open-channel-health` from the Canvas toolbar.

- [ ] **Step 1: Write failing refresh-policy tests**

```ts
expect(msUntilNextWholeHour(Date.parse("2026-07-24T07:31:00Z"))).toBe(1_740_000);
expect(shouldRefreshOnVisibility({ lastLoadedAt: 0, now: 700_000 })).toBe(true);
expect(shouldRefreshOnVisibility({ lastLoadedAt: 200_000, now: 700_000 })).toBe(false);
expect(manualRefreshCoolingDown({ lastManualAt: 100_000, now: 109_999 })).toBe(true);
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run apps/web/src/components/channel-health/channel-health-refresh.test.ts`

Expected: FAIL because the helper module is missing.

- [ ] **Step 3: Implement ETag-aware API and hook**

`readChannelHealth(etag?)` must expose `{ kind: "fresh"; report; etag } | { kind: "not_modified"; etag }`. `submitChannelFeedback` sends the exact Provider/model record IDs and vote.

`useChannelHealth(open)` must:

- retain the last good report during refresh failure
- expose `loading`, `refreshing`, `error`, `stale`, `lastLoadedAt`, `manualCooldownUntil`, and `votePendingKey`
- perform one initial load per open
- schedule one whole-hour refresh while visible
- refresh on visibility return only when older than ten minutes
- enforce a ten-second manual cooldown
- replace the affected feedback aggregate only after a successful vote response

- [ ] **Step 4: Implement the approved V2 modal**

Lazy-load the modal from `App.tsx`. Match the Workflow Template modal dimensions and shell, use the shared report view, and provide manual refresh and exact update time. The Web wrapper supplies dark, light, and existing pixel-theme variables without adding another visual system.

Add a lucide `Activity` icon button beside the Workflow Template entry in `CanvasToolbar.tsx`; use a tooltip and `aria-label="打开渠道状态"`.

- [ ] **Step 5: Verify Web behavior and build**

Run: `npx vitest run apps/web/src/components/channel-health/channel-health-refresh.test.ts`

Run: `npm run type-check -w @xinghuan/web && npm run build -w @xinghuan/web`

Expected: PASS.

- [ ] **Step 6: Commit the Web subpage**

```bash
git add apps/web/src/services/channel-health-api.ts apps/web/src/components/channel-health apps/web/src/components/CanvasToolbar.tsx apps/web/src/App.tsx
git commit -m "feat(web): add provider channel status subpage"
```

---

### Task 8: Admin Reliability Analytics View

**Files:**
- Create: `apps/admin/src/admin-channel-health-refresh.ts`
- Create: `apps/admin/src/admin-channel-health-refresh.test.ts`
- Create: `apps/admin/src/admin-channel-health-dashboard.tsx`
- Create: `apps/admin/src/admin-channel-health-dashboard.css`
- Modify: `apps/admin/src/admin-api-client.ts`
- Modify: `apps/admin/src/admin-view-model.ts`
- Modify: `apps/admin/src/admin-readonly-panels.tsx`
- Modify: `scripts/verify-admin-view-model-contract.ts`
- Modify: `scripts/verify-admin-readonly-panels-contract.mjs`

**Interfaces:**
- Consumes: Task 1 types, Task 5 Admin GET, Task 6 report view.
- Produces: `AdminAnalyticsViewId` value `reliability` and stable route `/admin/analytics/reliability`.
- Produces: filter state `{ capability: "" | ChannelHealthCapability; providerId: string; modelRecordId: string }`.

- [ ] **Step 1: Write failing refresh and route assertions**

Add unit cases proving the five-minute timer runs only when enabled and visible. Update the view-model verifier to require:

```ts
resolveAdminPath("/admin/analytics/reliability").analyticsView === "reliability"
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run apps/admin/src/admin-channel-health-refresh.test.ts`

Run: `npm run verify:admin-view-model-contract`

Expected: FAIL because the view and helpers are missing.

- [ ] **Step 3: Implement the Admin client and dashboard**

Add `adminChannelHealthApi.readReport(filters, etag?)` with the same fresh/not-modified union as Web. The dashboard owns its fetch state so `main.tsx` does not gain another report state cluster. Render capability, Provider, and model filters; manual refresh; exact update time; stale warning; and an auto-refresh toggle that defaults off.

Pass `interactiveFeedback={false}` to the shared report view. Admin sees aggregate counts and window labels but no vote buttons or identities.

- [ ] **Step 4: Add stable navigation and readonly-panel ownership**

Extend `AdminAnalyticsViewId`, `adminAnalyticsViews`, and `resolveAdminPath` in `admin-view-model.ts`. Extend `AuditPanel.activeView` and render `AdminChannelHealthDashboard` for `reliability`. Update the two existing source-contract scripts instead of adding route logic to `main.tsx`.

- [ ] **Step 5: Verify GREEN and build**

Run: `npx vitest run apps/admin/src/admin-channel-health-refresh.test.ts`

Run: `npm run verify:admin-view-model-contract && npm run verify:admin-readonly-panels-contract`

Run: `npm run type-check -w @xinghuan/admin && npm run build -w @xinghuan/admin`

Expected: PASS.

- [ ] **Step 6: Commit the Admin view**

```bash
git add apps/admin/src/admin-channel-health-refresh.ts apps/admin/src/admin-channel-health-refresh.test.ts apps/admin/src/admin-channel-health-dashboard.tsx apps/admin/src/admin-channel-health-dashboard.css apps/admin/src/admin-api-client.ts apps/admin/src/admin-view-model.ts apps/admin/src/admin-readonly-panels.tsx scripts/verify-admin-view-model-contract.ts scripts/verify-admin-readonly-panels-contract.mjs
git commit -m "feat(admin): add channel reliability analytics"
```

---

### Task 9: Harness, Documentation, Local Runtime, And Gray Gate

**Files:**
- Create: `scripts/verify-channel-health-contract.mjs`
- Modify: `package.json`
- Create: `docs/systems/observability-and-ops/channel-health.md`
- Modify: `docs/systems/observability-and-ops/README.md`
- Modify: `docs/systems/admin/README.md`
- Create or append: current file under `docs/logbooks/daily/`
- Create after authorized Gray release: release and validation logbooks required by current release governance.

**Interfaces:**
- Consumes: all earlier tasks.
- Produces: `npm run verify:channel-health-contract` and canonical operational documentation.
- Produces: local visual evidence at both approved PC viewports.
- Produces: a Gray deployment approval checkpoint; no Production action.

- [ ] **Step 1: Write the failing source contract**

The verifier must assert:

- Migration 042 exists and contains the vote uniqueness/privacy fields.
- API SQL ownership remains in `channel-health-repository.ts`, not `server.ts`.
- all three route paths exist in `channel-health-routes.ts`.
- shared types include 36 buckets and aggregate feedback without voter identity fields.
- Web has the toolbar event, lazy modal, manual refresh, hourly scheduler, and ten-second cooldown.
- Admin has the reliability route, manual refresh, optional five-minute refresh, and hidden-tab pause.
- the shared report contains an SVG trend and explicit empty-bucket presentation.

- [ ] **Step 2: Verify RED, register, then make GREEN**

Run: `node scripts/verify-channel-health-contract.mjs`

Expected before registration fixes: FAIL on missing package-script/Harness ownership.

Add `"verify:channel-health-contract": "node scripts/verify-channel-health-contract.mjs"` and include it in `harness:verify:project`.

Run: `npm run verify:channel-health-contract`

Expected: PASS.

- [ ] **Step 3: Write canonical system and Admin documentation**

Document metric authority, exact status thresholds, 24/72-hour feedback behavior, identity non-disclosure, refresh/caching, ETag, query-plan inspection, expected error codes, and Gray troubleshooting. Link the document from the observability and Admin system indexes.

- [ ] **Step 4: Run focused and workspace verification**

Run:

```bash
npx vitest run packages/shared/src/channel-health.test.ts packages/ui/src/channel-health-report.test.tsx apps/api/src/channel-health-migration.test.ts apps/api/src/channel-health-repository.test.ts apps/api/src/channel-health-service.test.ts apps/api/src/channel-health-routes.test.ts apps/web/src/components/channel-health/channel-health-refresh.test.ts apps/admin/src/admin-channel-health-refresh.test.ts
npm run type-check
npm run build
npm run verify:channel-health-contract
npm run harness:verify:project
npm run harness:verify:workspace
```

Expected: all commands PASS.

- [ ] **Step 5: Apply Migration 042 only to the authorized local development database**

Run with the local development database environment loaded:

```bash
npm run db:migrate
```

Expected migration output includes `042_provider_model_channel_health.sql`. Do not point this command at Gray or Production.

- [ ] **Step 6: Run local API/Web/Admin and validate behavior**

Start the existing single-port development runtime on an unused local port. Seed or use isolated local settled-task fixtures covering all four capabilities, success, failure, cancellation, running, empty buckets, low samples, 24-hour feedback, and 72-hour fallback.

Verify:

- cancelled/running tasks never change success counts
- empty buckets remain empty and break the trend line
- another user's aggregate vote is visible without identity
- the current user cannot vote without an eligible recent task
- changing a vote changes counts without adding a vote
- manual refresh cooldown and stale-data preservation work
- Admin filters and optional refresh work

- [ ] **Step 7: Capture PC visual evidence**

Use Playwright screenshots and overlap checks at:

```text
1920x1080
2560x1440
```

Inspect the first viewport, long Provider/model names, all four category tabs, a missing-data model, a degraded model, vote pending/error state, and Admin filters. Confirm no page-level horizontal overflow, clipped controls, text overlap, or broken trend rendering.

- [ ] **Step 8: Record evidence and commit implementation completion**

Update the daily logbook with commands, results, screenshots, query-plan evidence, and remaining Gray gate. Stage only source, tests, docs, and approved visual evidence paths; never stage `.superpowers/`, runtime data, credentials, or local database files.

```bash
git add package.json scripts/verify-channel-health-contract.mjs docs/systems/observability-and-ops/channel-health.md docs/systems/observability-and-ops/README.md docs/systems/admin/README.md docs/logbooks/daily
git commit -m "docs: record channel health validation"
```

- [ ] **Step 9: Stop at the Gray deployment approval gate**

Report local commit IDs, full Harness results, current worktree status, local runtime evidence, and the exact Gray migration/release scope. Request explicit Gray deployment approval. Do not run Gray prepare/deploy/migrate commands before that approval, and never touch Production.

- [ ] **Step 10: After explicit Gray approval, deploy and validate Gray**

Follow current `ops/current/README.md`, `ops/current/gray.md`, release version policy, migration safety checks, release logbook, retention dry-run, deploy, and runtime verification. Validate actual settled image/video/audio/LLM tasks and approved test-account vote changes. Capture aggregate-only API evidence and both PC screenshots. Update release state and Gray validation logbooks as required. Do not push GitHub and do not send any Production request.

---

## Completion Evidence

The feature is complete only when all of the following are proven:

- Migration 042 applies cleanly in the target non-Production environment.
- Repository tests and query-plan evidence prove bounded settled-only aggregation.
- Service tests prove thresholds, cache isolation, and 24/72-hour feedback selection.
- Route tests prove auth boundaries, validation, ETag, and aggregate-only response.
- Web and Admin builds pass with the approved refresh behavior.
- Shared UI renders trend gaps, low-sample cells, counts, and feedback without identity.
- `verify:channel-health-contract`, project Harness, and workspace Harness pass.
- PC screenshots at `1920x1080` and `2560x1440` show no overlap or overflow.
- Gray evidence exists only after explicit approval and shows real task/vote behavior.
- Production remains untouched and no GitHub push occurs.
