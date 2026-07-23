# Canvas Agent Experience Phase 7 Smart Candidate Selector Validation

## Scope

- Baseline: Gray `v0.7.19` code commit `40953b4`.
- Candidate branch: `feature/canvas-agent-runtime`.
- Environment: local single-port `http://127.0.0.1:18200` and production Web build.
- Excluded: GitHub push, Gray deployment, Production mutation and real PostgreSQL selector execution.

## Behavior Evidence

- `smart-candidate-selector` is separate from deterministic `pick-from-set` and is excluded from the normal generation picker runtime.
- The Worker claims the Run and selector Step transactionally, waits for all direct dependencies to become terminal, and builds candidates only from owner-scoped artifacts plus frozen Plan/Input provenance.
- Candidate sets require at least two unique artifacts, complete prompt/variable/Provider/model provenance, one media type and agreement with the selector's frozen media mode.
- Manual selection locks the owner-scoped Run and Step, validates Top K against the frozen candidate snapshot and ledger, writes the Selection audit and releases downstream work only after success.
- Idempotent replay is checked after the row lock; the same key and selection replays a completed command, while the same key with a different Run, Step or selected ID set fails closed.
- AI evaluation reuses published quality routing, adds variable and note alignment, writes stable ranking/score evidence, and transfers low confidence to manual selection or stops according to the frozen policy.
- Rejected artifacts become `not_selected`. Pruning touches only pre-dispatch `blocked/ready` work and never reports queued/running Provider work as cancelled.

## Automated Verification

- Focused tests: 10 files, 65 tests passed.
- Type-check: Agent Core, Shared, API, Worker and Web passed.
- Build: Agent Core, Shared, API, Worker and Web passed.
- Contracts: Agent Runtime architecture, Canvas Workflow capabilities, Node Acceptance Matrix and file hotspot budgets passed.
- Migration coverage: 8 migration tests passed as part of the focused API migration suite.
- Repository: CodeGraph synchronized; `git diff --check` passed before documentation finalization.

## Browser Evidence

- Registered-node smoke rendered 56/56 nodes with no missing component, class mismatch, runtime error or network failure.
- Desktop verified manual to AI, image to video, Top 1 to Top 3, low-confidence stop and note editing without selector text overflow or control shift.
- Evidence: `output/playwright/phase7-smart-selector-canvas-1440x900.png`, `phase7-smart-selector-manual-detail.png` and `phase7-smart-selector-ai-video-detail.png`.
- At `390x844`, the existing top bar and fixed sidebar overlap and consume the useful Canvas width. `phase7-smart-selector-mobile-390x844.png` records the shell failure; the isolated element image is evidence only, not a mobile Canvas pass.

## Boundaries And Follow-up

- Local single-port has no PostgreSQL Agent Runtime. Migration 040, transactional candidate ledger writes, real quality routing, manual command concurrency and downstream release must be repeated in isolated PostgreSQL and Gray phases.
- Phase 8 owns the responsive shell correction together with floating Assistant geometry and supervision avoidance. Phase 10 must repeat the complete `390x844` and `800x1000` interaction matrix.
- The in-app browser plugin could not initialize (`Cannot redefine property: process`); standalone Playwright CLI produced the retained evidence. This was a tooling boundary, not a product pass or failure.

## Result

Phase 7 local code, contracts, desktop behavior and visual evidence pass. Narrow Canvas shell remains an explicit Phase 8 blocker. Gray and Production were untouched, and nothing was pushed.
