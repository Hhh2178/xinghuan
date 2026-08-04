# RunningHub 分组折叠 v0.8.24 Gray Validation

- release: `20260804-runninghub-group-collapse-v0824-r1`
- environment: `gray`
- source commit: `6db6647`
- archive SHA-256: `53c884f3111004ef1034a2472ed34a2968992b37fbd193a8647837c79d7043e8`

## Checks

- Runtime verifier passed: API/Worker active, version `0.8.24`, environment `gray`, permission mode `enforced`, readiness `true`.
- Database: `xinghuan_canvas_gray`; failures `[]`.
- Full test suite and single-port build passed.
- Gray retention dry-run/apply: passed; five releases retained and both current/rollback anchors preserved.

## Result

- The grouped RH selector is active in Gray with default-expanded, per-group collapse behavior.
