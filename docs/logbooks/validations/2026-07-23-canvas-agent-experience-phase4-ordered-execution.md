# Canvas Agent Experience Phase 4 Ordered Execution Validation

## Scope

- Baseline: Gray v0.7.19 audit, local `feature/canvas-agent-runtime` branch.
- Change: workflow-owned stage definitions, topology-constrained ordering, serial/parallel/skip scheduling and immutable Run Plan snapshots.
- Safety: local browser and local API only; no GitHub push, no Gray deployment, no Production contact.

## Domain And Runtime Evidence

- Workflow-member groups project to stable stages; executable members outside groups enter an explicit ungrouped stage.
- Stage ID, name, order, mode and skipped state are normalized with the workflow and included in the Run Plan/subgraph hash.
- Reverse cross-stage dependencies are rejected with the exact edge/source/target. Consecutive independent parallel stages form a scheduling wave while topology dependencies still gate individual steps.
- Legacy groups without stage name/mode remain readable and default to serial execution.

## Browser Evidence

- Supervision displayed grouped and ungrouped stages with drag handles, serial/parallel controls and skip checkboxes.
- Invalid downstream-before-upstream ordering was rejected with `顺序与连线冲突` and did not increment workflow revision.
- Stage mode and skip edits incremented revision. After rebuilding/restarting the current Shared/API runtime, a cold reload preserved revision, parallel mode and skipped state.
- Mode buttons expose `aria-pressed`; conflict visualization is transient DOM state and does not mutate persisted edge selection.
- At `390x844`, document and body scroll width both equaled the 390 pixel viewport. Controls and text did not overlap. Screenshot: `output/playwright/phase4-stage-order-mobile.png`.
- Desktop conflict screenshot: `output/playwright/phase4-stage-order-conflict.png`. Final reload reported zero console errors and warnings. The disposable canvas was explicitly deleted.

## Local Runtime Boundary

- Draft Run creation reached `POST /api/canvas-runs` but local single-port mode returned `AGENT_RUNTIME_POSTGRES_REQUIRED`, as required by the Agent Runtime authority boundary.
- Compiler/kernel tests are the local immutable snapshot and active-order evidence. Authenticated Run locking will be repeated against an isolated PostgreSQL harness and Gray in the later validation phases.

## Verification

- Focused Vitest after final UI changes: 5 files, 38 tests passed.
- Shared and API builds passed; Web type-check/build passed.
- `git diff --check` passed before documentation sync.
- Final contracts, hotspot gates, CodeGraph sync and staged governance are recorded in the Phase 4 checkpoint step.

## Remaining

- Phase 5 owns remembered supervision settings and the complete workflow Run dashboard.
- Phase 6 owns bounded recovery behavior and Gray model-record preflight repair.
- Full Harness, isolated PostgreSQL and Gray runtime validation remain Phase 10/11 work.
