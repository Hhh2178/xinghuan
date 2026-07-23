# Canvas Agent Experience Phase 6 Recovery Runtime Validation

## Scope

- Baseline: Gray `v0.7.19` code commit `40953b4`.
- Candidate branch: `feature/canvas-agent-runtime`.
- Environment exercised: local single-port `http://127.0.0.1:18200`, production Web build and authenticated page fixture.
- Excluded: GitHub push, Gray deployment, Production mutation, real PostgreSQL Agent Runtime execution.

## Behavior Evidence

- Model preflight freezes unique authorized capability-compatible primary/fallback record IDs and rejects ambiguity, unavailability, incompatible inputs and unauthorized records.
- Worker recovery classifies persisted normalized failure evidence, records attempts and Recovery Decisions, schedules dedicated retry backoff, and overlays audited choices without changing the immutable Run Plan.
- `retryExhaustionPolicy=stop` cannot enter fallback. Compatible fallback, parameter repair, approval resume and prompt rewrite use only frozen candidates or allowed patches.
- Prompt-review rewrite runs as a governed queued `chat` child task using the latest published `recovery / prompt-review-rewrite` route. Route entries are frozen; only technical failure advances, and validated before/after/diff evidence is persisted.
- The original workflow node remains the dependency authority; its downstream steps do not unlock until recovery completes successfully.

## Automated Verification

- Focused tests: 8 files, 60 tests passed.
- Type-check: API, Worker and Web passed.
- Build: Agent Core, Shared, API, Worker and Web passed.
- Contracts: Agent Runtime architecture contract passed with migration 039, model preflight, retry timing, recovery overlay/ledger, governed rewrite routing/evidence and upstream success gating.
- Repository: CodeGraph synchronized and healthy; `git diff --check` passed.

## Browser Evidence

- Desktop `1440x900`: recovery status rendered as `重试中`; actual route rendered as `provider-backup / image-backup`; rewrite evidence rendered as `提示词已改写 · 2 处`; new recovery event labels were readable.
- Legacy desktop failure displayed: `当前草稿无法安全补全模型记录。请从最新工作流重新创建 Run。`
- Narrow `390x844`: panel bounds `x=8, y=8, width=374, height=828`; `documentWidth=390`, `bodyWidth=390`; panel `scrollWidth=372`, `clientWidth=372`; no horizontal overflow or incoherent overlap.
- Screenshots: `output/playwright/phase6-recovery-runtime-1440x900.png`, `output/playwright/phase6-legacy-repair-1440x900.png`, `output/playwright/phase6-legacy-repair-390x844.png`.

## Boundaries And Follow-up

- Local single-port has no PostgreSQL Agent Runtime. Migration application, Recovery Decision persistence, Worker execution, real retry timing and governed rewrite routing require isolated PostgreSQL and later Gray verification.
- The finite mocked SSE response closes after the required events render. EventSource then reconnects into the generic JSON mock and produces a fixture-specific console error; this evidence does not claim clean real-runtime reconnect behavior.
- Initial fixture setup returned `[]` for `/api/assistant/settings`, which omitted required public settings fields. The fixture was corrected to a valid projection; application validation was not weakened.
- Failed multiline Playwright/PowerShell transports were setup failures and produced no product evidence. The retained screenshots and measurements came from the corrected authenticated fixture.

## Result

Phase 6 local code, contract, behavior projection and responsive visual evidence pass. Gray and Production were untouched. Phase 7 may proceed, while real PostgreSQL and Gray recovery execution remain explicit later gates.
