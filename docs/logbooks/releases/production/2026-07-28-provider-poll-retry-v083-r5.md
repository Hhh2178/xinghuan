# Provider Poll Retry v0.8.3 Production

- release: `20260728-provider-poll-retry-v083-r5`
- version: `0.8.3`
- source commit: `6533a364fa83b155e7ed23311499178f528e2247`
- archive SHA-256: `0D66745F2BE91A019928C5F7579EA2BA394C29F1854F7511D602CE076ED81C28`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas`
- previous current: `20260728-canvas-loading-performance-v083-r4`
- rollback: `20260728-canvas-loading-performance-v083-r4`
- retentionApplyRun: `false`

## Result

- Promoted the same Gray-verified archive after Gray strict runtime verification.
- Production strict runtime verification passed: current r5, API/Worker active, version/environment matched.
- No migration was needed beyond the existing 46 migrations; no paid Provider/Agent canary ran.
