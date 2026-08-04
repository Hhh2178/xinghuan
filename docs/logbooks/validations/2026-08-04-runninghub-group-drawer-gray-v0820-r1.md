# RunningHub Group Drawer v0.8.20 Gray Validation

- release: `20260804-runninghub-group-drawer-v0820-r1`
- environment: `gray`
- target: `ubuntu@101.33.75.38:728` (`old-server`)
- source commit: `412ca1cabbbdf14f0812c796939d2fedb08f8c17`
- archive SHA-256: `ca8e5c755d3c450f5188b2cc94f782828b2028f7b3d719d8594e3e8b48ba90e8`

## Checks

- Admin focused tests: `4/4` passed.
- Workspace type-check and Admin/single-port builds: passed.
- RunningHub permission, workspace helper, and API route contracts: passed.
- Runtime verifier: passed with `appServiceActive=true`, `workerServiceActive=true`, `expectedVersionMatched=true`, and `expectedEnvironmentMatched=true`.
- Internal status: `success=true`, `version=0.8.20`, `environment=gray`, `permissionMode=enforced`.
- Public status: `success=true`, `version=0.8.20`, `environment=gray`, `permissionMode=enforced`.
- Permission readiness CLI: `ready=true`, database `xinghuan_canvas_gray`, failures `[]`.
- Readiness metrics: `subjects=137`, `published=125`, `restricted=3`, `retired=9`, `rules=1195`, `principals=5`.

## Recovery evidence

- First runtime probe failed because the API port was not listening while the startup gate rejected `RETIRED_SUBJECT_RULE`.
- Reconciliation dry-run reported `subjectUpdates=3`, `ruleUpserts=271`, `ruleDeletes=8`, `unresolvedPrincipals=0`.
- Apply completed with `idempotent=true`; after service restart, the API listened on `127.0.0.1:18200` and all runtime checks passed.
- Retention dry-run and apply passed with `remaining=5`; current and rollback releases were both retained.

## Acceptance boundary

- No Production deployment or data access was performed.
- 1920x1080 browser visual verification was not run because Chromium is unavailable in the local environment.
