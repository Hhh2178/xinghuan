# Canvas Agent Runtime Phase 10 Product Separation Validation

## Scope

- Branch: `feature/canvas-agent-runtime`
- Candidate/runtime baseline: `v0.7.19`
- Target: local authenticated Canvas fixture with controlled Canvas Run API/SSE browser responses
- Gray: not deployed or mutated in Phase 10
- Production: not opened, queried, deployed or changed

## Product Separation

- `CanvasAssistantShell` now owns only the floating launcher, conversation, attachments, knowledge/workflow context and composer. It contains no supervision Tab, Canvas Run control or `penguin:open-run-supervisor` listener.
- `App` owns an independent `AI 托管` action directly beside announcements. The action exposes open, active, approval/paused and alert states without depending on Assistant visibility.
- `CanvasSupervisionDock` owns panel visibility, the legacy-node open event and one continuously mounted `useCanvasRunProjection`. Closing the panel does not unmount the projection or cancel the Run; reopening refreshes the same owner-scoped API record and retains SSE events.
- `CanvasRunSupervisor` is a projection-only view. It displays group order, intra-group dependencies, durable step state, Provider/model evidence, attempts, input mode/cropping, quality selection, recovery/backup evidence, reason, budgets, elapsed time, approvals and the event timeline.
- The legacy `canvas-agent` type and renderer remain for old canvases, but its node-registry entry is hidden from the new-node catalog.

## Behavioral Tests

The pure supervision view model passed 4 focused tests:

- ordered durable events project retry, approval and terminal states;
- input/cropping and quality-selection evidence remain explicit and do not invent missing values;
- event labels and persisted budget fields format for the compact panel;
- explicit group order and step dependency records remain intact.

Web type-check and production build passed. The Canvas Assistant/Supervision UI contract, Agent runtime architecture contract, hotspot budget and `git diff --check` passed.

## Browser Evidence

Screenshots:

- `output/playwright/phase10-separation/dual-panels-empty-1440x900.png`
- `output/playwright/phase10-separation/dual-panels-run-1440x900.png`
- `output/playwright/phase10-separation/supervision-run-800x1000.png`
- `output/playwright/phase10-separation/supervision-run-390x844.png`

Authenticated browser checks proved:

- the Assistant accessibility tree contains conversation/context/composer controls and no supervision Tab;
- the top-bar `AI 托管` action opens a distinct `AI 托管面板` while the Assistant stays open;
- the Sidebar utility count changed from 13 to 12 and `Agent 托管` is absent from the new-node catalog;
- at `1440x900`, Assistant bounds were `(454,160)-(884,880)` and supervision bounds were `(902,122)-(1422,842)`, so the panels did not overlap;
- the top canvas terminal control ended at `y=106` while supervision began at `y=122`, so the panel did not cover the key toolbar;
- step body typography measured `14px/22px` and metadata measured `12px/18px`;
- the populated projection showed two ordered groups, three steps, waiting/running/approval/succeeded evidence, Provider/model, attempt count, sampled input, recovery reason, budgets, elapsed time, approval controls and five ordered events;
- closing supervision left the Assistant visible and the top action at `data-status=running`; reopening restored the same Run and all five events;
- `800x1000` used a contained `520x920` supervision surface with internal vertical scrolling and no document overflow;
- `390x844` used a `374x828` full-screen drawer inside the viewport, with equal panel scroll/client widths and no document overflow;
- the final browser console contained only the existing React Flow development warning about nodeTypes/edgeTypes identity, not a Phase 10 runtime error.

## Structure Review

- CodeGraph indexed 923 files / 12,190 nodes / 33,626 edges after the new controller and view-model modules landed.
- `CanvasSupervisionDock` owns only UI/controller state and the existing projection hook; it does not create a second Run authority.
- `buildCanvasRunStepViews` only affects the supervision view and its pure module.
- Assistant and supervision remain separate component trees; legacy node compatibility remains in the renderer/type registry but not the creation catalog.
- No API, Worker, database, Gray or Production behavior changed in this phase.

The final `npm run harness:verify:project` passed in `62.4s`, including all workspace type checks, API build, dependency security, package exports, quick acceptance and the updated UI/architecture/documentation contracts.

Phase 10 is complete. Phase 11 is limited to curated node/model/document knowledge sources and immutable published Knowledge Snapshots.
