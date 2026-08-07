# 并行分组与 AI 托管恢复 v0.8.28 验证

- release: `20260807-parallel-group-supervision-v0828-r1`
- artifact source: `59d8bfa31d4e447d9332723d4e4a65ee46738e64`
- targets: old/new Gray and old/new Production
- mode: observe (`agentEnabled=true`, `canvasRunsEnabled=true`, automatic recovery and quality evaluation disabled)

## Deployment Matrix

| Target | Runtime | Permission readiness | Supervision plan |
| --- | --- | --- | --- |
| old Gray | `0.8.28 / gray / enforced` | `139 subjects / 1195 rules / 5 principals / 0 failures` | `[2,1,1,1]` |
| old Production | `0.8.28 / production / enforced` | `177 / 2704 / 11 / 0` | `[2,1,1,1]` |
| new Gray | `0.8.28 / gray / enforced` | `132 / 1180 / 5 / 0` | `[2,1,1,1]` |
| new Production | `0.8.28 / production / enforced` | `158 / 2920 / 11 / 0` | `[2,1,1,1]` |

## Runtime Evidence

- Both process gates are active on all four targets and Admin diagnostics expose process activation separately from database controls.
- The plan fixtures prove independent first-layer branches, dependency-preserving downstream layers, deterministic topology, and automatic cleanup of disposable canvases.
- Group runtime contracts cover five-group admission, sixth-group rejection, the global ten-node budget, fair rotation, cycle and external dependency rejection, independent failure continuation, cancellation isolation, and monotonic completion correlation.
- Gray route recovery used ModelScope after both Aifork entries returned upstream `403`. Old Production kept its healthy existing route. New Production was bootstrapped with the three required pools and Agent publications and ended with zero unhealthy current routes.
- Exactly one paid GRS AI GPT image canary ran on old Gray: `task-1786103151150-uiovzp`, artifact `gen-task-1786103151150-uiovzp-image-1`, output `/files/output/task_output_task-1786103151150-uiovzp_1.png`, status succeeded, requested images `1`.
- New hostnames passed HTTPS with direct resolution to the confirmed server address. Ordinary resolver lookup still returns `ENOTFOUND`.

## Artifact Boundary

- The development repository remains source-based.
- All four servers use the same AES-256-GCM wrapped sealed runtime; TypeScript/TSX, source maps, and application `src/` trees are excluded from the server release.

## Retention Evidence

- Old Gray: dry-run/apply passed; five releases remain and current/rollback are protected.
- Old Production: dry-run/apply passed; five releases remain and current/rollback are protected.
- New Gray: `release:retention:prune` dry-run/apply passed; five releases remain and current/rollback are protected.
- New Production: `release:retention:prune` dry-run/apply passed; five releases remain and current/rollback are protected.

## Final Repository Gates

- `npm run ci` passed: all workspace type-checks, production builds, and Vitest (`259 passed, 1 skipped`; `975 passed, 4 skipped`).
- Focused Agent gate, route-health, parallel-group plan, scheduler, completion-sequence, runtime integration, and Canvas runtime split contracts all passed.
- Project, Workspace, and Release Harnesses passed; authority state and current-release consistency both report `v0.8.28` with no failures or warnings.
- Staged governance passed: no runtime artifacts, source-size guard, hotspot budgets/watchlist, release logbook sync, and current-release consistency.
- GitHub push result is recorded in the final commit note after remote verification.
