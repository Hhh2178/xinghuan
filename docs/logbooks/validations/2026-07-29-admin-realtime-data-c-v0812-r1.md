# Admin Realtime Data C v0.8.12 Gray Validation

- release: `20260729-admin-realtime-data-c-v0812-r1`
- environment: `gray`
- target profile: `old-server`
- source commit: `7422bf9`
- archive SHA-256: `3f5228e37875e1a87cb7536a3e90814a7bc7088d7313f024297027d2f4f186d1`

## Automated Gates

- Full Vitest passed with 227 files passed, 1 skipped, 869 tests passed, and 4 skipped.
- Full workspace build, Admin visual regression tests (12/12), C behavior/data/refresh contracts, visual docs, design token, component registry, Authority/readiness, hotspot/watchlist, and all three Harness layers passed.
- Release preparation rebuilt the workspace, verified the runninghub preset, and produced the archive recorded above.
- Deployment applied 0 migrations and skipped 46 existing migrations.
- Runtime verification confirmed current release `20260729-admin-realtime-data-c-v0812-r1`, API/Worker active, public/internal `0.8.12 / gray`, and permission `enforced / ready` with zero failures.
- Server-side remote preflight, request-chain observability, system observability, and environment-sync no-op smoke passed.

## Browser Acceptance

- All seven authenticated routes were inspected once at exactly `1920x1080` with the assistant dock open: `/admin/overview`, `/admin/runtime/tasks`, `/admin/system/health`, `/admin/analytics/usage`, `/admin/analytics/costs`, `/admin/analytics/reliability`, and `/admin/analytics/audit`.
- Every route rendered exactly one H1, one data template, zero legacy focus cards, no document or `.admin-main` horizontal overflow, and no assistant/workbench overlap. `.admin-main` retained `overflow-y: auto` as the scroll owner.
- Overview rendered three data tables; Tasks retained its table and the `创建任务` command stayed on one line; Health Inspector opened and closed; Usage and Cost retained their filters/charts; Reliability rendered 14 chart surfaces and a styled dark refresh command; Audit retained seven columns.
- Browser console inspection after the pass reported 0 errors and 0 warnings.
- Screenshots are ignored runtime artifacts under `output/playwright/admin-realtime-data-c-v0812-gray-*-1920x1080.png`.

## Result

- Admin C realtime/data workbenches passed old-server Gray acceptance. C is complete and D governance/content workspaces are active.
- Production, billed canaries, and retention apply were not performed.
