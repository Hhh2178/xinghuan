# Artifact Materialization Idempotency v0.8.3 Gray

- release: `20260728-artifact-materialization-idempotency-v083-r21`
- version: `0.8.3`
- source commit: `f34aae785f7de3e88b7ad692404e500b1c687a22`
- archive SHA-256: `45420CC219F76BCE48B8BEC3DDC7829242E5D69273A76E2AF806ED7D017F4399`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas-next`
- previous current: `20260728-canvas-height-fix-v083-r19`
- rollback: `20260728-canvas-height-fix-v083-r19`
- retentionApplyRun: `false`

## Scope

- Serialize the Postgres generation-artifact projection per owner/task with a transaction-scoped advisory lock.
- Make repeated materialization safe when deterministic artifact IDs collide; fall back from primary-key upsert to owner/dedupe upsert inside a savepoint.
- Preserve partial outputs when a provider poll or remote transfer later fails, so a bandwidth/provider failure does not erase already-returned artifacts.

## Verification

- Worker materialization, generation-progress and image-batch tests passed (22 tests); Worker and Web type-check passed.
- Release prepare, build, package and governance gates passed.
- Gray r21 deploy and strict runtime verification passed: API/Worker active, internal/public status `0.8.3 / gray`, permission mode enforced.
- Paid Gray batch returned three persisted image artifacts before the provider timed out on the fourth; no artifact primary-key conflict occurred. Provider timeout remains an upstream availability result, not a materialization failure.
- Production remains held at v0.7.17 per user instruction; no Production deployment ran for r21.
