# Canvas Agent Runtime Phase 13 Route Safety Validation

## Scope

- Branch: `feature/canvas-agent-runtime`
- Scope: local code and test validation only
- Gray deployment: deferred until Phase 12 authenticated Visual gate closes
- Production and GitHub: untouched

## Route Safety Evidence

- Pool version creation rejects non-`chat` models, disabled models/providers and duplicate models.
- Pool version approval revalidates stored entries before `draft -> approved`.
- Approval validation runs inside the same row-locking transaction as the status transition, eliminating a model/provider capability race between validation and approval.
- Pool version publication revalidates the same stored entries inside the publication transaction.
- Runtime route selection joins enabled models/providers and `m.capability = 'chat'`, so stale or generation entries cannot be selected.
- Media input transport snapshots remain capability/protocol-derived; generation node model selection remains outside the Agent LLM pool.

## Verification

- `npm test`: 116 files passed, 1 skipped; 416 tests passed, 4 skipped.
- `npm run build -w @xinghuan/api`: passed.
- `npm run type-check -w @xinghuan/api`: passed.
- `npm run verify:agent-governance-contract`: passed.
- `codegraph sync`: passed.
- Focused recovery matrix: 9 files / 36 tests passed across routing, Orchestrator, quality repository/service, recovery service/routes and Worker coordinator.
- Explicit pure-domain assertions cover bounded parameter repair, one quality regeneration, retry/model-switch exhaustion and final stop.
- Native video matrix: 5 files / 41 tests passed. It proves Gemini Files is preferred, `remote_url` stays disabled unless the media gateway explicitly enables it, sampled frames are used only when already present, and missing native/frame evidence fails explicitly without FFmpeg.

## Open Gate

The Phase 12 authenticated Admin browser gate is still open because this environment has no local PostgreSQL/Redis fixture and no authorized one-time admin account. No Gray or Production runtime was contacted.
