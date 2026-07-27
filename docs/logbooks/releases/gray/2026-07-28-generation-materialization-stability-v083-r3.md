# Generation Materialization Stability v0.8.3 Gray

- release: `20260728-generation-materialization-stability-v083-r3`
- version: `0.8.3`
- source commit: `dacca28`
- archive SHA-256: `FE4CBD63B1BBF34FED09C316558E860A2DEABDEEB67CC834E0E8E3987A886C19`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas-next`
- previous current: `20260727-generation-delivery-agent-p0-v083-r1`
- rollback: `20260727-generation-delivery-agent-p0-v083-r1`
- retentionApplyRun: `false`

## Scope

- Unify remote image/video/audio output retry classification and same-origin authorization context.
- Write each successful output to an explicit sibling `.part` path before atomic promotion; preserve video Range continuation.
- Project sanitized `task_materializing` and `task_artifact_ready` runtime events while retaining existing output-only recovery and no-double-submit behavior.

## Verification

- Full Vitest: 188 passed files, 783 passed tests, 1 skipped file, 4 skipped tests.
- Production build, Worker type-check, delivery/observability/recovery contracts and hotspot gates passed.
- Gray current points to r3; API and Worker are active; internal/public status and enforced permission readiness passed with 0 failures.
- No retention command or historical release deletion ran; no paid Provider canary ran.
