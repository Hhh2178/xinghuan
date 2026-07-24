# 2026-07-24 Provider Model Channel Health

## Scope

Implement the approved Provider/model channel health report without a GitHub push, Gray deployment, or Production action.

## Completed This Session

- Confirmed and committed the design: `03171be`.
- Confirmed and committed the implementation plan: `da78827`.
- Added shared channel-health contracts and status thresholds: `91d515c`.
- Added additive Migration 042 for aggregate channel feedback storage: `8dc61e0`.
- Added settled-task aggregation, owner-scoped vote upsert, dynamic feedback window assembly, and route-level ETag behavior: `03e120d`, `32fecce`.
- Added member/API route integration with the required `server.ts` hotspot evidence: `2e11263`.
- Added the shared report primitive and the Web template-style channel-status subpage; the Web toolbar now opens the lazy modal.
- Added the Admin-only `/admin/analytics/reliability` analytics view. It uses the same report primitive with capability, Provider, and model filters; feedback remains aggregate and read-only. The Admin API reader preserves ETag/304 behavior, and the optional five-minute refresh is off by default and paused for hidden tabs.

## Current Verification Evidence

- `npx vitest run packages/shared/src/channel-health.test.ts`: pass.
- `npx vitest run apps/api/src/channel-health-migration.test.ts apps/api/src/task-cost-migration.test.ts`: pass.
- `npm run verify:db-migrate-release-deps`: pass.
- `npx vitest run apps/api/src/channel-health-repository.test.ts apps/api/src/channel-health-service.test.ts apps/api/src/channel-health-routes.test.ts`: pass before the pending server-route commit.
- `npm run type-check -w @xinghuan/api`: pass before the pending server-route commit.
- `npx vitest run apps/web/src/components/channel-health/channel-health-refresh.test.ts`: pass.
- `npm run type-check -w @xinghuan/web`: pass.
- `npm run build -w @xinghuan/web`: pass.
- `npx vitest run apps/admin/src/admin-channel-health-refresh.test.ts`: pass.
- `npm run verify:admin-view-model-contract && npm run verify:admin-readonly-panels-contract`: pass.
- `npm run type-check -w @xinghuan/admin && npm run build -w @xinghuan/admin`: pass.
- `npm run verify:channel-health-contract`: pass.
- `npm run verify:project-harness-contract && npm run verify:harness-doc-sync-contract`: pass after registering the feature contract in the project Harness.
- Focused feature suite: `8` files / `20` tests passed for shared bucket rules, UI trend gaps, migration, repository, service, routes, Web refresh, and Admin refresh.
- `npm run type-check`: pass for all workspaces.
- `npm run build`: pass for all workspaces.
- `npm run harness:verify:project`: pass, including the new channel-health contract.
- `npm run harness:verify:workspace`: pass, including CodeGraph sync, all workspace type checks, and package exports.

## Local Runtime Evidence

- `npm run db:migrate` returned `DATABASE_NOT_CONFIGURED` before any connection attempt. The workstation has no `DATABASE_URL`, `XINGHUAN_DATABASE_URL`, or isolated test database variable, and no local PostgreSQL or Docker process. Migration 042 was therefore not applied to any environment.
- Built local single-port runtime started on `http://127.0.0.1:18200`; `GET /api/status` returned `200` with local environment metadata. `/` and `/admin/` returned `200`; unauthenticated `GET /api/channel-health` and `GET /api/admin/analytics/model-success-rates` both returned the expected `401` boundary.
- Playwright rendered the local login shell at `1920x1080` and `2560x1440` with no console errors. Ignored evidence paths: `output/playwright/.playwright-cli/page-2026-07-24T14-03-03-644Z.png` and `output/playwright/.playwright-cli/page-2026-07-24T14-03-23-924Z.png`.
- Authenticated report rendering, real settled image/video/audio/LLM aggregation, feedback eligibility and mutation, migration execution, query-plan inspection, and report-specific desktop screenshots cannot be truthfully completed without an isolated PostgreSQL/auth fixture or an explicitly authorized Gray deployment.

## Boundary

No Gray release preparation, deployment, database migration, or runtime test has occurred. No Production request and no GitHub push has occurred. The next gate is explicit Gray authorization for the additive Migration 042, release build, and authenticated real-task/vote acceptance only.

## Gray Follow-up: Surface Readability

- Gray `v0.7.41` was deployed after the initial log entry; this follow-up prepares a `v0.7.42` UI-only Gray patch.
- Moved the member channel-health entry from the compact Canvas tool strip to the top bar immediately after “公告”, with an explicit “渠道状态” label.
- Wrapped the Admin report header, filters, and report body in the established `api-card` surface treatment. The report receives an opaque dark shell so the trend, rate, and feedback columns remain readable over the administration grid backdrop.
- No aggregation, feedback, route, database, task-execution, Provider-routing, or Production behavior changed.
- Local evidence: `npm run verify:channel-health-contract`, `npm run type-check`, `npm run build`, and five focused channel-health test files all passed.
