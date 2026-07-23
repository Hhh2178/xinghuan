# Canvas Agent Experience Phase 3 Workflow Regions Validation

## Scope

- Baseline: Gray v0.7.19 audit, local `feature/canvas-agent-runtime` branch.
- Change: Workflow Region geometry and boundaries, workflow-scoped compilation/Run identity, typed input/output nodes and Supervision targeting.
- Safety: local browser and local API only; no GitHub push, no Gray deployment, no Production contact.

## Domain And Runtime Evidence

- Shared validation rejects duplicate membership and overlapping opaque regions and enforces typed Workflow Input/Output direction rules.
- Workflow compilation includes only explicit members, rejects missing/incomplete groups and ordinary cross-boundary edges, freezes typed inputs and hashes the executable subgraph without visual geometry/color.
- Migration 037 adds workflow identity/revision/hash and a partial owner+canvas+workflow active-run unique index. Repository conflict mapping, idempotency and API responses preserve workflow identity while legacy Canvas Runs remain readable.
- Media input references are resolved from owner-scoped `xh_assets`; browser-provided URLs are not trusted as ownership evidence.

## Browser Evidence

- Created Text, Workflow Input/Output and Workflow Variables nodes, created an opaque region and bound a text input boundary to a same-type variable.
- Assigning later members and increasing node height now expands the region without incrementing revision. DOM measurement confirmed every member rectangle was contained.
- Dragging the region `60x40` moved a member by the same delta. Resizing through pointer events increased the region by approximately `120x80`; color and resize retained `r11`.
- Created a second isolated workflow and switched Supervision `工作流 1 · r11 -> 工作流 2 · r1 -> 工作流 1 · r11`. Overlapping third-region creation was rejected with an explicit dialog.
- Desktop and narrow screenshots: `output/playwright/phase3-two-workflows-supervision-fit-1440x900.png` and `output/playwright/phase3-two-workflows-supervision-390x844.png`. Supporting containment/color evidence is in `phase3-workflow-region-membership-expanded.png` and `phase3-workflow-region-color-binding.png`.
- Console result after reload: zero errors; only existing node placement diagnostics. The disposable canvas was explicitly deleted and the isolated account returned to zero canvases.

## Visual Finding

- Opaque region colors preserve readable automatic contrast and stay behind members. Dynamic member height no longer crosses the visible boundary.
- The Supervision dock fits as a controlled drawer at `390x844` with no control or text overlap. This does not close the broader mobile Canvas sidebar issue already assigned to Phase 8/10.

## Verification

- Focused Vitest: 8 files, 50 tests passed.
- Shared and Agent Core builds passed.
- API and Web type-check/build passed.
- Phase contracts, package exports, hotspot/staged guards, CodeGraph sync and final staged gates are recorded in the Phase 3 checkpoint step.
- `git diff --check`: passed before documentation sync.

## Remaining

- Phase 4 owns topology-constrained stage ordering, serial/parallel/skip semantics and active Run order locking.
- Phase 5 owns remembered supervision settings and the complete workflow Run dashboard.
- Full Harness and Gray runtime validation remain Phase 10/11 work.
