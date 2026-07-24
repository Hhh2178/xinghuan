# Canvas Agent Experience Gray v0.7.28 Validation

## Boundary

- Baseline: Gray `v0.7.19` audit matrix and Accepted ADR 0004.
- Candidate: `v0.7.28`, release `20260724-canvas-agent-explicit-selector-gray-r1-v0728`, source `5969f197374fc014eead9bd08ec6b15de99ca1f1`.
- Gray only. Production remained `v0.7.18`; no GitHub push occurred.

## Explicit Candidate And Cost Closure

- Authenticated formal UI Run `canvas_run_0d640e4f-68fe-43a7-be6e-dc51aae42d6e` succeeded with image `generationCount=2`, quality evaluation disabled and explicit AI selector `Top 1 / 70% / low confidence to manual`.
- The Provider executed two requests and materialized two stable Artifacts. The explicit selector wrote one `selected`, one `not_selected`, confidence `0.92`, an AI Selection audit and a successful Workflow Output.
- Cost settlement was `charged / per_request`, `quantity=2`, `quantity_source=provider_request_count`, `unit_price=0.160000`, `amount=0.320000 CNY`.
- Worker `NRestarts=0` after completion.

## Concurrency And SSE

- Runs `canvas_run_14f69be4-0a6a-488c-bc67-c268c96daf78` and `canvas_run_a524dff4-1609-44d7-b0db-6997d613a2b2` executed concurrently on different Workflow identities, overlapped for about 31 seconds and both succeeded.
- Each Run retained independent Canvas, Workflow, Task, Artifact, Selection, Cost and 14-event ledgers. Each produced two Artifacts, one selected and one not selected, with `0.320000 CNY` charged.
- Authenticated same-origin SSE reconnect with `Last-Event-ID: 10` returned only sequences `11..14` for the target Run: candidate selection completion, two step completions and Run success. No duplicate or cross-Run event appeared.
- The temporary concurrency Canvas was deleted through its explicit Gray Canvas DELETE API after evidence capture.

## PC Visual And Browser Evidence

- The project constitution limits visual validation to `1920x1080` and `2560x1440`; mobile, tablet and other desktop sizes are outside the current acceptance matrix.
- At `1920x1080`, Assistant was `430x696` at `(70,145)` and Supervision was `520x720` at `(1382,122)`. At `2560x1440`, the same stable panels were at `(70,145)` and `(2022,122)`.
- Both viewports had zero panel intersection, exact document/body widths and no horizontal overflow. Manual screenshot review found no clipped controls, incoherent overlap or text occlusion.
- The authenticated UI projected Gray `v0.7.28`, the successful explicit selector, one selected plus one not selected candidate, 92% confidence and 14 durable events.
- All Canvas status, Run, candidate-selection and authority requests returned `200`. The only console error was Cloudflare `524` on the unrelated announcement SSE `/api/announcements/stream`; it did not affect Canvas Run SSE or the AI workflow.
- Evidence:
  - `output/playwright/phase11-gray-v0728-assistant-supervision-1920x1080.png`
  - `output/playwright/phase11-gray-v0728-assistant-supervision-2560x1440.png`

## Release Retention

- The first dry-run exposed stale canonical rollback metadata still pointing to `v0.7.19`; apply was intentionally withheld.
- After canonical state was corrected to current `v0.7.28` and rollback `v0.7.27`, the second dry-run retained exactly `v0.7.28..v0.7.24` and selected eight older Gray directories for pruning.
- Governed apply with `--confirm-retention=5` removed those eight explicit directories, released `2,796,126,208` bytes and reported `RESULT|true|5` with current and rollback intact.
- Standard post-retention runtime verification passed public/internal `0.7.28 / gray / enforced`, expected current symlink and active API/Worker services.

## Final Automated Verification

- Root Vitest: `134` files passed, `1` skipped; `540` tests passed, `4` environment-gated tests skipped.
- Complete production build and workspace type-check passed for all packages, Web and Admin.
- ESLint completed with `0` errors and `239` pre-existing warnings; no warning was promoted to a blocker by repository policy.
- Project Harness passed architecture, Assistant, Agent governance, Canvas workflow, documentation, hotspot, package export, dependency security and permission contracts.
- Workspace Harness passed CodeGraph synchronization, all workspace type checks and package exports.
- Release Harness passed preflight, gate documentation, package contents, retention governance and current release consistency.
- `verify:release-governance-contract`, `verify:current-release-entry-consistency` and `git diff --check` passed with Gray `v0.7.28` and Production `v0.7.18`.

## Result

- The Gray `v0.7.19` audit-to-`v0.7.28` redesign is complete across code, behavior, PC visual evidence, governed runtime, records and Harnesses.
- Production was not restarted, reconfigured or mutated. No GitHub push occurred.
