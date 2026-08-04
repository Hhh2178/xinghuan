# RunningHub Group Drawer Rail Alignment v0.8.21 Gray Validation

- release: `20260804-runninghub-group-drawer-alignment-v0821-r1`
- environment: `gray`
- target: `ubuntu@101.33.75.38:728` (`old-server`)
- source commit: `f67f5182421e0908615914029ec21a78726de81a`
- archive SHA-256: `5da3015e11a175bfb5216002c6acfac0f258b9fbde30af6b627c121c0b3cffc0`

## Checks

- Admin focused alignment tests: `4/4` passed.
- Admin type-check, Admin build, and single-port build: passed.
- RunningHub workspace helper contract: passed.
- Runtime verifier: passed with `appServiceActive=true`, `workerServiceActive=true`, `expectedVersionMatched=true`, and `expectedEnvironmentMatched=true`.
- Internal status: `success=true`, `version=0.8.21`, `environment=gray`, `permissionMode=enforced`.
- Public status: `success=true`, `version=0.8.21`, `environment=gray`, `permissionMode=enforced`.
- Permission readiness CLI: `ready=true`, database `xinghuan_canvas_gray`, failures `[]`.
- Readiness metrics: `subjects=137`, `published=125`, `restricted=3`, `retired=9`, `rules=1195`, `principals=5`.
- Retention: dry-run and apply passed with `remaining=5`; current and rollback releases were both retained.

## Acceptance boundary

- The code contract now requires the trigger, item list, and rail-local drawer to share `admin-runninghub-workspace__rail-track` and the scrollbar-gap variable.
- No Production deployment or data access was performed.
- 1920x1080 browser visual verification was not run because Chromium is unavailable in the local environment.
