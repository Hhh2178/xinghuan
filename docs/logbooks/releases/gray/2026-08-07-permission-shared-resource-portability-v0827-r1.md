# 权限与公共资源可迁移性 v0.8.27 Gray

- release: `20260807-permission-shared-resource-portability-v0827-r1`
- target: old-server Gray
- source commit: `f713aed9e2414ca87418ebe7edfab7c8591683c0`
- encrypted archive SHA-256: `82401a945e4734e584aec7bebb54c605ee76e275d5576ca88954ad65087e6b1d`
- sealed archive SHA-256: `786dde14328bbe3a709f7d24e01f82372011e7c91a230e82ea28a6029372a5dd`

## Result

- `/api/me/permissions` no longer performs permission-subject reconciliation writes during ordinary member reads; per-node resolution failures fail closed and return a degraded snapshot instead of a route-wide 500.
- Public media uses resource-ID content routes and independent `admin/shared-assets` storage. Workflow fragments and material sets rewrite matching private file references to stable public URLs.
- The production migration contract materializes public assets before archiving, preserves public indexes/assets and user inputs, and excludes generated outputs plus ZIP archives.
- The encrypted server artifact was deployed only to old-server Gray. Production, new-server Gray, and all migration data remained untouched.
- API/Worker are active; internal and public status report `0.8.27 / gray / enforced`; permission readiness completed with zero failures.
- Guarded retention dry-run/apply retained five old-server Gray releases with current and rollback protected.
