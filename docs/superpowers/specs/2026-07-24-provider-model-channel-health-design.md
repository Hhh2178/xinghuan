# Provider Model Channel Health Design

## Status

Approved for implementation planning on 2026-07-24. This design does not change Production, deploy Gray, or authorize a GitHub push.

## Problem

Users currently cannot tell which Provider and model channels have been completing requests reliably. Operators can inspect individual tasks and general usage, but there is no shared report that answers three immediate questions:

1. Which image, video, audio, or LLM channel is currently usable?
2. How has its success rate moved over the last three days?
3. What do recent users think of that exact Provider and model combination?

The report must remain readable rather than becoming a general-purpose BI dashboard. Objective task outcomes and subjective user feedback must remain visibly and mathematically separate.

## Goals

- Show the most recent 36 Beijing-time two-hour buckets for image, video, audio, and LLM models.
- Group results by Provider first and model second.
- Count only `succeeded` and `failed` tasks in success metrics.
- Exclude queued, running, and cancelled tasks from both numerator and denominator.
- Omit empty time buckets rather than presenting them as zero success.
- Add an authenticated user vote for each Provider and model combination.
- Show every user the aggregate up/down vote distribution without exposing voter identities.
- Provide a simple user-facing channel-status subpage and an operator view under Data Analytics and Audit.
- Reuse one server-side metric definition and response model across Web and Admin.
- Support PC `1920x1080` and `2560x1440` only.

## Non-goals

- No mobile or tablet-specific layout or validation.
- No arbitrary report ranges or bucket-size configuration in the first release.
- No user, tenant, task, prompt, pricing, raw error, or voter identity data in the public report.
- No success inference from billing state or cost-item status.
- No client-side aggregation from paginated task lists.
- No precomputed metric warehouse or scheduled rollup table in the first release.
- No automatic Provider failover, model routing, or health-based execution policy change.
- No Production change or GitHub push.

## Domain Terms

- **Channel:** one exact `Provider + model` combination. The same native model exposed by two Providers is two channels.
- **Capability:** `image`, `video`, `audio`, or `chat`; Web and Admin label `chat` as `LLM`.
- **Settled task:** a task whose status is `succeeded` or `failed`.
- **Empty bucket:** a two-hour bucket with zero settled tasks. Queued, running, and cancelled tasks do not make a bucket non-empty.
- **Recent use:** at least one settled task for the relevant channel in the stated window.

## Success Metric Contract

### Fact authority

`xh_tasks.status` is the only success/failure fact authority. A task-cost item, billing outcome, Canvas Run status, retry state, or user vote cannot turn a failed task into a success or a successful task into a failure.

The report reads Provider and model identity from the immutable task-creation snapshot when available. For recent tasks without a cost snapshot, it falls back to `xh_tasks.provider_id` and `xh_tasks.model_id`, then resolves current catalogue labels. This fallback is required because Migration 025 did not backfill older task cost items. The aggregation must select at most one canonical dimension snapshot per task so multiple cost ledger rows cannot duplicate task counts.

### Time buckets

- Timezone is fixed to `Asia/Shanghai` on the server.
- The report contains the current Beijing-time two-hour bucket plus the preceding 35 buckets.
- Buckets align to even hours: `00:00-02:00`, `02:00-04:00`, and so on.
- The current bucket is partial until its end.
- Let `anchor` be the start of the current even-hour bucket. The displayed range starts at `anchor - 70 hours`, ends at `anchor + 2 hours`, and ignores timestamps later than the server's current time. This produces exactly 36 stable bucket positions without inventing future observations.
- A task belongs to the bucket containing its `created_at` value.
- A queued or running task is absent. If it later settles while its creation bucket remains in the 36-bucket window, the next refresh updates that original bucket.
- Range boundaries use half-open intervals `[bucketStart, bucketEnd)`.

For each non-empty channel bucket, return only:

- `succeeded`
- `failed`
- `settled = succeeded + failed`
- `successRate = succeeded / settled`

The 72-hour headline uses all settled tasks in the 36 displayed buckets. No-request buckets are returned as absent bucket entries, not as `0%` values.

### Current status

The human-readable model state uses settled tasks from the most recent six hours, independently of the 36-bucket headline rate:

- fewer than 3 settled tasks: `insufficient_sample`
- at least 3 tasks and success rate `>= 95%`: `healthy`
- at least 3 tasks and success rate `>= 80%` but `< 95%`: `degraded`
- at least 3 tasks and success rate `< 80%`: `unhealthy`
- zero settled tasks in the most recent six hours: `no_recent_requests`

Web labels these states as `样本不足`, `畅通`, `轻微波动`, `异常`, and `暂无近期请求`.

Each two-hour visual cell uses the same success-rate thresholds, but a bucket with one or two settled tasks uses the neutral insufficient-sample treatment. Its counts remain available in the tooltip. The trend line does not connect across missing buckets and does not convert missing data to zero.

Provider state is a projection of its currently visible model states:

1. Any sufficiently sampled unhealthy model produces `存在异常`.
2. Otherwise, any degraded model produces `存在波动`.
3. Otherwise, any healthy model produces `整体畅通`.
4. Otherwise, show the corresponding insufficient-sample or no-recent-request neutral state.

## User Feedback Contract

### Eligibility and uniqueness

- Voting requires an authenticated user.
- The user must own at least one settled task created in the previous 24 hours for the exact Provider and model channel.
- A user has at most one stored vote for a channel.
- The vote is either `up` or `down`.
- Submitting the other value changes the existing vote atomically rather than creating a second vote.
- Multiple tasks do not give the same user additional votes.

The persistence layer stores `owner_id` only to enforce eligibility and uniqueness. Public and Admin read models, exports, logs intended for report consumers, and API responses expose counts only. No voter list or identity drill-down is added.

### Dynamic read window

For each channel:

1. If the channel has at least one settled task in the previous 24 hours, aggregate votes whose latest submission or change is within the previous 24 hours.
2. If the channel has no settled task in the previous 24 hours, expand only that channel's feedback lookup to the previous 72 hours.
3. If no vote exists in the applicable 72-hour maximum window, show `近 3 天暂无评价` and do not reuse older votes.
4. Label the rendered aggregate explicitly as either `近 24 小时` or `近 3 天回溯`.
5. Re-evaluate the window every hour and whenever the user manually refreshes.

The feedback response contains only `up`, `down`, `total`, optional `upRate`, the selected window mode, and the current viewer's own vote for button state. Objective success rate never incorporates these values.

## Data Design

Add a dedicated feedback table with the following logical fields:

- stable ID
- `owner_id`
- `provider_id`
- `model_id`
- `vote` constrained to `up | down`
- eligible task reference used as submission evidence
- `created_at`
- `updated_at`

Enforce a unique key on `(owner_id, provider_id, model_id)`. A vote change updates `vote`, evidence, and `updated_at` in one transaction after eligibility is rechecked.

Add or verify query support for:

- settled tasks by creation time, Provider, and model
- owner eligibility by owner, Provider, model, status, and creation time
- feedback aggregation by Provider, model, and `updated_at`

A partial settled-task index is preferred when the query plan proves it useful. Exact index definitions are implementation decisions validated with representative `EXPLAIN (ANALYZE, BUFFERS)` evidence rather than assumed from table size alone.

## Service Architecture

Use direct PostgreSQL aggregation with a short server-side cache. Do not extend the successful-usage summary because channel reliability has different status, time, privacy, and refresh semantics.

Units:

1. **Channel health repository:** performs bounded task and feedback aggregation and returns database-shaped rows.
2. **Channel health service:** applies snapshot fallback, capability labels, status thresholds, feedback window selection, public visibility, and response ordering.
3. **Feedback command service:** verifies ownership-scoped eligibility and performs the unique vote upsert transaction.
4. **Shared API types:** define Provider, model, bucket, status, feedback aggregate, window metadata, and server update time for both clients.
5. **Web projection:** renders only enabled, user-visible Providers and models in catalogue order.
6. **Admin projection:** supports filters and may include disabled channels that have recent task data, without adding voter identity.

The server caches the aggregate portion for approximately 30 seconds and invalidates the affected channel after a successful vote. Per-viewer vote state is overlaid separately so a shared aggregate cache never leaks another user's selection.

## API Design

### User read

`GET /api/channel-health`

Returns all four capabilities in one request so category switching does not trigger another fetch. The response includes:

- server time and two-hour window bounds
- last aggregate update time
- Providers in catalogue order
- models grouped under Provider
- model 36-bucket series and headline totals
- six-hour current status
- feedback aggregate and feedback window label
- current viewer vote only

It excludes owner IDs, voter records, task IDs, tenant counts, prompts, errors, costs, disabled public catalogue entries, and Provider credentials.

### User vote

`POST /api/channel-health/feedback`

Body:

```json
{
  "providerId": "provider-id",
  "modelId": "model-id",
  "vote": "up"
}
```

The server derives the owner from the authenticated session, verifies that the model belongs to the Provider, verifies recent eligible use, performs the upsert, invalidates the affected aggregate cache, and returns the updated aggregate plus the viewer vote.

### Admin read

`GET /api/admin/analytics/model-success-rates`

Supports optional `capability`, `providerId`, and `modelId` filters. The 36-bucket range and two-hour granularity remain fixed. The endpoint uses Admin authorization and does not return voter identities.

### Cache validation

Read endpoints emit an `ETag`. A client refresh may send `If-None-Match`; unchanged results return `304`. Authenticated response caching remains private at the HTTP boundary even though the aggregate data is shared internally.

## Web Experience

Open `渠道状态` from an icon button in the Canvas toolbar. Use a large centered subpage-style dialog consistent with the existing Workflow Template experience rather than adding a new global navigation system.

The approved V2 layout contains:

- a 220 px left rail for `图像`, `视频`, `音频`, and `LLM`
- a search field for Provider or model
- last-updated text, manual refresh, and close controls
- a compact category summary
- Provider first-level sections
- model second-level rows
- 36-bucket success-rate trend line with Beijing-time direction labels
- a thin two-hour state strip under the line for precise anomaly location
- 72-hour success rate with success and failure counts
- six-hour current state label
- aggregate up/down counts, ratio, and vote buttons

The trend line communicates direction. The state strip and tooltip communicate exact bucket position and counts. Missing buckets break the line and remain visually empty. Objective success data and subjective feedback occupy separate columns.

The public page shows other users' aggregate vote distribution. It never shows who voted.

## Admin Experience

Add `渠道状态` under the stable Data Analytics and Audit workspace, with route:

`/admin/analytics/reliability`

Reuse the same hierarchical report component and visual semantics. Add only capability, Provider, and model filters. Keep the fixed 36-bucket window; do not add an arbitrary report builder, generic KPI wall, or identity drill-down.

## Refresh Policy

### Web

- Load once when opened.
- Provide an explicit refresh button.
- Refresh once at each whole hour while the page is visible so feedback windows slide.
- When the page becomes visible after being hidden, refresh once only if data is older than ten minutes.
- Disable repeated manual refresh for ten seconds.
- Show the exact last-updated time.

### Admin

- Load once when opened.
- Provide manual refresh.
- Offer an optional five-minute auto-refresh toggle, off by default.
- Pause auto-refresh while the browser tab is hidden.

This replaces the originally considered 30-second polling. The server cache and `ETag` further reduce repeated database work and response payload.

## Empty, Loading, And Error States

- Initial loading preserves the stable dialog layout and uses a compact progress state.
- A model with no settled tasks in the displayed window remains listed if currently enabled and shows `暂无近期请求`; its graph is empty.
- Refresh failure preserves the last successful result and labels it `数据可能已过期` with the prior update time.
- Vote submission does not change visible counts until the server transaction succeeds.
- Ineligible voting returns a stable error code rendered as `最近 24 小时未使用该模型`.
- Disabled or mismatched Provider/model input returns a stable validation error without revealing catalogue internals.
- Concurrent vote changes resolve through the database unique constraint and transaction; the returned aggregate is authoritative.

## Security And Privacy

- User reads require normal authenticated application access.
- Vote eligibility uses owner-scoped task lookup.
- Admin reads require Admin authorization.
- Neither user nor Admin endpoints expose task ownership, voter ownership, emails, group IDs, IP addresses, or per-user contribution counts.
- Provider credentials and request payloads are never joined into the report query.
- Server-side allowlists control filter values and vote values.

## Verification

### Repository and service tests

- even-hour Beijing bucket boundaries and half-open intervals
- current partial bucket plus preceding 35 buckets
- task grouping by `created_at`
- late settlement updating the original creation bucket
- exact success/failure counts and rates
- queued, running, and cancelled exclusion
- absent empty buckets
- one canonical dimension row per task despite multiple cost items
- snapshot-first Provider/model labels and fallback behavior
- six-hour status thresholds with fewer than three tasks treated as insufficient
- Provider state precedence
- 24-hour feedback window, 72-hour fallback, and older-than-72-hour expiry
- eligible and ineligible voting
- unique vote insertion and atomic vote change
- aggregate-only public/Admin response contracts

### API and client tests

- authentication and Admin authorization
- filter validation and Provider/model ownership validation
- `ETag` and `304` behavior
- aggregate cache invalidation after voting
- viewer vote isolation from shared cached aggregates
- initial, empty, stale, refresh-failed, and vote-failed UI states
- category switching without another fetch
- manual refresh cooldown, hourly visible refresh, visibility refresh, and paused hidden Admin refresh
- trend gaps and low-sample neutral cells

### Visual and Harness validation

- Playwright interaction and screenshots at `1920x1080` and `2560x1440`
- no text overlap, clipped model names, unstable row heights, or horizontal page overflow
- Provider and model hierarchy remains scannable with realistic long names
- trend, state strip, success counts, and feedback remain distinguishable
- relevant Web, Admin, API, database migration, CodeGraph, source-size, and project Harness checks

## Gray Validation And Release Boundary

After implementation and local Harness completion, Gray validation requires separate authorization to deploy. Gray evidence must use actual settled image, video, audio, and LLM tasks when affordable and available, plus authenticated vote changes from approved test accounts. Validate manual refresh, hourly window labels, status thresholds, empty buckets, feedback fallback, and aggregate privacy.

Do not touch Production and do not push GitHub. Any later Gray release follows the repository release-state, version increment, logbook, retention, rollback, and validation gates in force at that time.

## Rollback

The report and feedback table are additive. UI entry points and API routes can be disabled without changing task execution. Rolling back presentation and read services does not mutate task facts. A database rollback must preserve existing feedback rows unless an explicit one-file migration rollback is separately approved; no task, billing, Canvas, or Provider data is deleted.
