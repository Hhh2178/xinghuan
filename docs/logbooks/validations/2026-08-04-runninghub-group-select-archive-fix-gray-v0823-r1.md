# RunningHub 分组选择器与输出归档修复 v0.8.23 Gray Validation

- release: `20260804-runninghub-group-select-archive-fix-v0823-r1`
- environment: `gray`
- target: `ubuntu@101.33.75.38:728` (`old-server`)
- source commit: `8d0896d4bb22e7140fba14cc3ea74e28b46aab9a`
- archive SHA-256: `c4e408d18e80d390babbebc2f7628110999c6e2f6952c8fa55c739bd3dc5866f`

## Checks

- `release:gray:verify` passed with `appServiceActive=true`, `workerServiceActive=true`, `expectedVersionMatched=true`, `expectedEnvironmentMatched=true`, `expectedPermissionModeMatched=true`, and `expectedPermissionReadinessMatched=true`.
- Internal and public status: `success=true`, `version=0.8.23`, `environment=gray`, `permissionMode=enforced`.
- Permission readiness: database `xinghuan_canvas_gray`, `ready=true`, failures `[]`.
- Database migrations: `applied=[]`, `skipped=49`; release deploy was idempotent.
- Full local test suite: `247` test files passed, `1` skipped; `937` tests passed, `4` skipped.
- Web/API type-check, build and RunningHub release contracts: passed.

## Acceptance boundary

- The grouped selector is now rendered by the application instead of the Windows native popup, removing the white unreadable group-label state.
- The archive API no longer queries the nonexistent `size` column; it aliases `size_bytes as size` and the regression test passes.
- Production deployment and data access were not performed.
- GitHub branch push was attempted twice but blocked by an external GitHub HTTPS connectivity failure (`curl 28`); the local commit and Gray artifact are available.
