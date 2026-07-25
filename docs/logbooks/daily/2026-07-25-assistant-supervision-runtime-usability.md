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
| Human node identity | Complete | 17 focused tests, Shared/Agent Core type-check/build, Web type-check, diff check | This logbook | This local commit |
| Smart candidate provenance | Complete | 39 focused tests, materializer/diagnostic Harness, Shared/Agent Core/Worker type-check and build | This logbook | This local commit |
| Unified supervised batch execution | Complete | 57 focused tests, generation contracts, Shared/Agent Core/API/Worker type-check and build, diff check | This logbook | This local commit |
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
- 2026-07-25: Human node identity TDD RED reproduced both missing shared identity resolution and an absent Run step identity. The shared helper now applies the custom `label` / `name` / `title` precedence, capability-catalog fallback and a bounded safe ID suffix.
- 2026-07-25: Every newly compiled Run step freezes `displayIdentity`; the Web contract keeps the field optional so historical Run JSON remains readable and can use the same shared helper as later presentation work is migrated.
- 2026-07-25: Identity verification passed 17 focused tests, Shared and Agent Core type-check/build, Web type-check and `git diff --check`.
- 2026-07-25: Smart selector RED reproduced the reported topology exactly: one upstream image step emitted three artifacts through one edge, the static image prompt was empty and the selector ignored the resolved task prompt.
- 2026-07-25: New materialized artifacts now freeze bounded `GenerationExecutionProvenanceV1` facts: source task/node, optional Run/step, Provider, stable model record and the resolved prompt. Credentials, arbitrary headers, Provider bodies and media URLs are not copied into this projection.
- 2026-07-25: Legacy artifacts reconstruct provenance from `source_task_id` only through a task query scoped by the current `owner_id`. Owner and task mismatches fail closed; historical artifact rows are not mutated.
- 2026-07-25: Candidate validation still requires at least two same-kind artifacts. Incomplete provenance now names the missing field internally, while the shared user diagnostic gives a direct upstream-node repair action and keeps artifact IDs in technical detail.
- 2026-07-25: Provenance verification passed 39 focused tests, the Worker output materializer and supervision diagnostic Harnesses, Shared/Agent Core/Worker type-check, all three builds and `git diff --check`.
- 2026-07-25: Unified supervised generation now uses one bounded batch runner for image, video and audio. It starts at most four independent children, preserves `batchIndex` ordering, records safe child errors and upstream task IDs, retains completed children on cancellation and ignores late results after cancellation.
- 2026-07-25: Output materialization binds Artifact IDs by the ordered child output ownership rather than raw array index. A regression fixture proves that a later successful child cannot donate its Artifact ID to an earlier failed child; duplicate output URLs remain separate candidate identities.
- 2026-07-25: Detailed owner-scoped Run reads now project `runtimeSteps`; workflow Run lists remain a single lightweight query. Step/task status precedence keeps evaluation and selection visibly running, while a queued Step with an already-running task also projects as running.
- 2026-07-25: Canvas Run progress events persist ordered child states without Provider URLs. Event deduplication includes child transitions, so `running -> failed` is recorded even when aggregate success/request counts do not change.
- 2026-07-25: Task 4 verification passed 57 focused tests across nine files, `verify:generation-count-contract`, `verify:provider-generation-task-contract`, Shared/Agent Core/API/Worker type-check, all four builds and `git diff --check`. GitHub, Gray and Production remained untouched.
