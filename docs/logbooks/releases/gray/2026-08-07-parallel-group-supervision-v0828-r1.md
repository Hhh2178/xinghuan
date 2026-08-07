# 并行分组与 AI 托管恢复 v0.8.28 Gray

- release: `20260807-parallel-group-supervision-v0828-r1`
- targets: old-server Gray and new-server Gray
- source commit: `59d8bfa31d4e447d9332723d4e4a65ee46738e64`
- encrypted archive SHA-256: `85a90e8e6a7a5dc942989169d05f77c72b2c98934827f82be6f0828836482cfc`
- sealed archive SHA-256: `99c9654224dd0ba557f4f65938ba59c4eccf08f5f35e410d6c884f5fb38b8bbc`
- rollback: `20260807-permission-shared-resource-portability-v0827-r1`

## Result

- The same encrypted, source-free server artifact is active on both Gray targets; API and Worker report `0.8.28 / gray / enforced`.
- Manual group execution admits at most five active groups and ten active nodes across the canvas. DAG layers run independent branches concurrently, preserve dependency order, reject invalid topology, isolate group cancellation, and keep completion correlation monotonic.
- Agent and Canvas Run controls plus both process gates are enabled. Automatic recovery and quality evaluation remain disabled, so both Gray targets run AI supervision in observe mode.
- Real plan-only supervision passed on both targets with execution layers `[2,1,1,1]` and two independent branches in the first layer. Disposable canvases were removed through supported cleanup.
- Aifork Grok and GPT planning routes returned upstream `403`; the fallback path executed but both entries failed. ModelScope `Qwen/Qwen3-235B-A22B` was published as the preferred Gray `supervision-planning` route and passed.
- Old Gray completed exactly one paid GRS AI `gpt-image-2` canary. Task `task-1786103151150-uiovzp` succeeded through adapter `grsai-image`, produced artifact `gen-task-1786103151150-uiovzp-image-1`, and requested one image. This canary must not be repeated for this release.
- Permission readiness passed with zero failures: old Gray `139 / 1195 / 5`; new Gray `132 / 1180 / 5` for subjects, rules, and principals.
- New-server HTTPS status passed with direct address resolution. Ordinary local DNS still returns `ENOTFOUND`, which is tracked as a domain-side limitation rather than an application failure.

## Retention

- Canonical current and rollback anchors were updated before protected retention execution.
- Old and new Gray dry-run/apply both passed; each retains five releases and protects current plus rollback.
