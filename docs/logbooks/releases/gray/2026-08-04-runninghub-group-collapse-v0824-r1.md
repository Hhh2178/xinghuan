# RunningHub 分组折叠 v0.8.24 Gray

- release: `20260804-runninghub-group-collapse-v0824-r1`
- version: `0.8.24`
- environment: `gray`
- target: `old-server / ubuntu@101.33.75.38:728`
- source commit: `6db6647`
- archive SHA-256: `53c884f3111004ef1034a2472ed34a2968992b37fbd193a8647837c79d7043e8`
- deployedAt: `2026-08-04`

## Scope

- Add per-group collapse controls to the RH catalog selector.
- Keep every group expanded by default; clicking a group header collapses or expands only that group.
- Keep item selection, active highlighting and keyboard navigation limited to visible groups.
- Promote the same sealed artifact to Gray before Production.

## Verification

- Full test suite: `247 passed`, `1 skipped`; `937 passed`, `4 skipped`.
- Single-port build, RunningHub release contracts and sealed package: passed; archive contains 214 entries and manifest contains 188 files.
- Gray runtime: API/Worker active; internal/public status `0.8.24 / gray / enforced`; permission readiness passed.
- Gray database migration: `applied=[]`, `skipped=49`.
- Gray retention dry-run/apply: passed; five releases retained and both current/rollback anchors preserved.

## Boundaries

- Production promotion uses this exact Gray-verified artifact and SHA; no second build is created.
