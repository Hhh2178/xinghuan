# Admin Realtime Data C v0.8.12 Gray

- release: `20260729-admin-realtime-data-c-v0812-r1`
- version: `0.8.12`
- source branch: `release/admin-realtime-data-c-v0811`
- source commit: `7422bf9`
- archive SHA-256: `3f5228e37875e1a87cb7536a3e90814a7bc7088d7313f024297027d2f4f186d1`
- target: `old-server` / Gray
- rollback: `20260729-admin-configuration-b-v0810-r1`
- retention apply: `false`

## Scope

- Deliver the shared realtime/data workbench across `/admin/overview`, `/admin/runtime/tasks`, `/admin/system/health`, and the four analytics routes.
- Preserve all existing task actions, data sources, filters, polling, ETag/stale handling, observability calculations, and Inspector ownership.
- Patch the two rejected `v0.8.11` command presentations: keep `创建任务` on one line and apply the Admin command style to `刷新状态`.

## Verification

- Full Vitest passed: 227 files passed, 1 skipped; 869 tests passed, 4 skipped.
- Full workspace build, Admin visual regression tests (12/12), C behavior contracts, design/registry/authority/hotspot gates, and all three Harness layers passed.
- Packaging generated a 2.5 MB archive with the recorded SHA-256. Deployment applied 0 migrations and skipped 46 existing migrations.
- Old-server Gray API and Worker are active. Public/internal status report `0.8.12 / gray`; permission readiness is `enforced / ready` with 132 subjects, 125 published, 3 restricted, 4 retired, 932 rules, 5 principals, and 0 failures.
- Remote preflight, request-chain observability, system observability, and environment-sync no-op smoke passed.
- Authenticated `1920x1080` acceptance passed on all seven routes with the assistant dock open.

## Known Warnings

- Package installation reported 6 high-severity audit findings. No forced dependency upgrade was included in this presentation release.
- System Health reports the existing DB/Redis queue difference and insufficient 24-hour completion sample; this release displays those source values and does not reconcile them.
- Analytics assistant context labeling remains a later context-governance concern and does not alter route content, data, or layout acceptance.

## Not Performed

- No billed Agent or Provider canary.
- No Production deployment.
- No retention apply.
