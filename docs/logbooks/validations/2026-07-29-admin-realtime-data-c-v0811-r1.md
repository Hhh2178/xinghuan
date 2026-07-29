# Admin Realtime Data C v0.8.11 Gray Validation

- release: `20260729-admin-realtime-data-c-v0811-r1`
- environment: `gray`
- target profile: `old-server`
- source commit: `982b756`
- archive SHA-256: `d653c95f93065129afdf692e342e9e207d8c850b353d77346c2aa165fb36a3ea`

## Automated And Runtime Gates

- Release packaging and old-server Gray deployment passed; migrations applied 0 and skipped 46.
- API and Worker were active. Public and internal status, permission `enforced / ready`, remote preflight, request-chain observability, system observability, and environment-sync no-op smoke passed.

## Browser Acceptance

- Seven authenticated routes were inspected at exactly `1920x1080`: overview, tasks, system health, usage, costs, reliability, and audit.
- Runtime structure was present, but visual acceptance failed on two visible command regressions:
  - Tasks `创建任务` wrapped onto two lines.
  - Reliability `刷新状态` used the white browser-default button appearance.

## Result

- Rejected for visual acceptance. Runtime remained healthy while the patch release was prepared.
- Superseded by `20260729-admin-realtime-data-c-v0812-r1`.
