# 2026-07-25 Assistant And Supervision Runtime Usability

## Baseline

- Branch: `feature/canvas-agent-runtime`
- Gray baseline: `v0.7.43`, release `20260725-ai-governance-supervision-gray-r1-v0743`
- GitHub push and Gray deployment remain paused until explicit user approval.
- Production remains `v0.7.18` and is not touched or tested.
- Visual acceptance is PC desktop only at `1920x1080`.
- Design: `docs/superpowers/specs/2026-07-25-assistant-supervision-runtime-usability-design.md`
- Plan: `docs/superpowers/plans/2026-07-25-assistant-supervision-runtime-usability.md`

## Stage Ledger

| Stage | Status | Verification | Evidence | Commit |
| --- | --- | --- | --- | --- |
| Direct Agent workspace model loading | Complete | Focused Vitest, static Harness contract, Admin type-check/build, diff check | This logbook | This local commit |
| Human node identity | In progress | Pending | Pending | Pending |
| Smart candidate provenance | Pending | Pending | Pending | Pending |
| Unified supervised batch execution | Pending | Pending | Pending | Pending |
| Canvas runtime projection | Pending | Pending | Pending | Pending |
| Supervision information architecture | Pending | Pending | Pending | Pending |
| Assistant panel geometry | Pending | Pending | Pending | Pending |
| Assistant answer policy and context | Pending | Pending | Pending | Pending |
| IME and native text selection | Pending | Pending | Pending | Pending |
| Admin workspaces and assistant UI | Pending | Pending | Pending | Pending |
| Integrated local acceptance | Pending | Pending | Pending | Pending |

## Execution Notes

- 2026-07-25: Direct navigation opens workspace ID `automation`; the loader previously handled only `capabilities` and `rh`, so the Agent editors received no Provider/model catalog even though the independently published Agent routes could still answer conversations.
- 2026-07-25: TDD RED was observed in `apps/admin/src/admin-data-loaders.test.ts`: `readAdminWorkspaceSnapshot("automation", ...)` returned `{}` instead of the expected Provider/model snapshot.
- 2026-07-25: The minimal fix reuses the existing Provider/model catalog loader for `automation`. It does not introduce a second catalog or fabricate model options.
- 2026-07-25: Added `verify:admin-agent-runtime-model-loading` and placed it in the project Harness chain. The contract verifies both direct workspace loading and first-render model propagation into `AdminAgentGovernanceWorkspace`.
- 2026-07-25: Focused verification passed: one Vitest test, the new static contract, Admin type-check, Admin build and the project Harness contract. The build reported only the existing Vite `node:crypto` browser-externalization warning.
