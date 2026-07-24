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

## Boundary

No Gray release preparation, deployment, database migration, or runtime test has occurred. No Production request and no GitHub push has occurred.
