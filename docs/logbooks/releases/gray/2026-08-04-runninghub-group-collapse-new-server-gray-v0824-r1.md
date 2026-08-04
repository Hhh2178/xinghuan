# RunningHub 分组折叠 v0.8.24 新服务器 Gray

- release: `20260804-runninghub-group-collapse-v0824-r1`
- version: `0.8.24`
- environment: `gray`
- target: `43.131.246.222:22 / ubuntu`
- domain: `canvas-next.zezhen.online`
- source commit: `6db6647`
- archive SHA-256: `53c884f3111004ef1034a2472ed34a2968992b37fbd193a8647837c79d7043e8`
- deployedAt: `2026-08-04`

## Verification

- Sealed archive checksum passed; no application TypeScript/TSX, source maps or `src/` directories were present outside `node_modules`.
- Database migration: `applied=[046_provider_generation_task_idempotency.sql, 047_administrator_tier.sql, 048_runninghub_catalog_groups.sql, 049_output_archive_jobs.sql]`, `skipped=45`.
- API/Worker active; internal and HTTPS status returned `0.8.24 / gray / enforced`.
- Permission readiness: `ready=true`, failures `[]`, database `xinghuan_canvas_gray`.
- Production was not changed by this Gray step.
