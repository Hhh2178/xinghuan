# RunningHub 分组折叠 v0.8.24 新服务器 Production

- release: `20260804-runninghub-group-collapse-v0824-r1`
- version: `0.8.24`
- environment: `production`
- target: `43.131.246.222:22 / ubuntu`
- domain: `canvas.zezhen.online`
- source commit: `6db6647`
- archive SHA-256: `53c884f3111004ef1034a2472ed34a2968992b37fbd193a8647837c79d7043e8`
- deployedAt: `2026-08-04`
- promotedFromGray: `true`

## Verification

- Production received the exact Gray-verified sealed artifact; no second build was created.
- Database migration: `applied=[046_provider_generation_task_idempotency.sql, 047_administrator_tier.sql, 048_runninghub_catalog_groups.sql, 049_output_archive_jobs.sql]`, `skipped=45`.
- Initial startup readiness found 22 stale rules referencing one retired subject. A controlled Production snapshot was created at `/tmp/xinghuan-backups/production-before-permission-reconcile-20260804.dump`, then those 22 rules were removed in one transaction according to permission reconciliation semantics.
- API/Worker active; internal and HTTPS status returned `0.8.24 / production / enforced`.
- Permission readiness: `ready=true`, failures `[]`, database `xinghuan_canvas_next`.
- Old server remains online as the rollback source; public traffic cutover was not performed.
