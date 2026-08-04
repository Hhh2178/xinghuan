# RunningHub 分组选择器与输出归档修复 v0.8.23 Gray

- release: `20260804-runninghub-group-select-archive-fix-v0823-r1`
- version: `0.8.23`
- environment: `gray`
- target: `old-server / ubuntu@101.33.75.38:728`
- source commit: `8d0896d4bb22e7140fba14cc3ea74e28b46aab9a`
- archive SHA-256: `c4e408d18e80d390babbebc2f7628110999c6e2f6952c8fa55c739bd3dc5866f`
- deployedAt: `2026-08-04`

## Scope

- Replace the RH catalog native `select/optgroup` with a local dark grouped selector so group labels remain readable on Windows/Chrome.
- Keep the selector width, typography, item spacing and dark theme aligned with the RH node; the popup has no full-screen backdrop or canvas blur.
- Fix output archive artifact lookup to read `xh_generation_artifacts.size_bytes` through the `size` alias.
- Add a regression test covering artifact-backed archive source resolution.
- Keep Production unchanged.

## Verification

- Full test suite: `247 passed`, `1 skipped`; `937 passed`, `4 skipped`.
- Web/API type-check and single-port production build: passed.
- RunningHub release preset and sealed release package: passed; archive contains 214 entries and manifest contains 188 files.
- Gray deploy: database migration idempotent (`49 skipped`), API and Worker restarted successfully.
- Runtime verifier: internal/public status report `0.8.23 / gray / enforced`; permission readiness `ready=true`.
- Gray retention: dry-run and apply passed; exactly 5 release directories remain with current and rollback retained.

## Boundaries

- Production was not touched; it remains `v0.8.15`.
- A real paid RH download canary remains a user-facing acceptance step; the server-side failure path is covered by the regression test and deployed field fix.
