# Canvas Agent Experience Phase 8 Floating Assistant Validation

## Scope

- Baseline: Gray `v0.7.19` code commit `40953b4`.
- Candidate branch: `feature/canvas-agent-runtime`.
- Environment: local production Web build at `http://127.0.0.1:18200` with authenticated route fixtures.
- Excluded: GitHub push, Gray deployment, Production mutation and claims about real Agent Runtime SSE health.

## Behavior Evidence

- The 48px Assistant launcher drags, snaps to either 12px viewport edge and persists owner-scoped anchor, offset and preferred size in local UI storage.
- The desktop workbench stays outside a 10px launcher gap on both edges. Header dragging changes only bounded relative offsets; native resize records the border-box size without border or entry-animation drift.
- Viewport shrink clamps the rendered panel while retaining the preferred size. Returning from `1000x700` to `1440x900` restored `520x790` after rendering a temporary `520x676` clamp.
- Opening desktop Supervision beside a right-anchored Assistant moved the Assistant to the left. Measured Assistant and Supervision intersection area was `0`.
- At `390x844`, Sidebar is off-canvas, the closed workspace occupies the full width, and both Assistant and Supervision use mutually exclusive `374x828` drawers at `8px` insets with no horizontal overflow.
- Mobile drawers own the overlay stacking context, so their headers and close controls remain above the compact top bar.
- Empty Assistant state exposes only `分析节点报错原因`. A selected `image-recovery` node took priority and enabled the action; no raw Run/Event JSON entered visible copy.
- Minimize preserved two conversation messages. Close-and-clear removed them and returned to the single-action empty state.

## Markdown And Copy Evidence

- Safe Markdown retained HTML skipping, dangerous URL filtering, remote-image omission and reasoning separation.
- A fixture answer rendered semantic `steps`, `code`, `note` and `table` blocks with whole-answer and per-block copy controls.
- Clipboard verification returned `const fixed = true;` for the code block and the complete original Markdown for whole-answer copy.
- Visible conversation text contained neither `runId` nor reasoning JSON.

## Automated Verification

- Focused tests: 4 files, 15 tests passed.
- Type-check: UI and Web passed.
- Build: UI and Web passed.
- Contracts: Canvas Assistant UI, Agent Runtime architecture, file hotspot budgets and hotspot watchlist passed.
- Repository: `git diff --check` passed; CodeGraph was synchronized after source and documentation updates.

## Browser Evidence

- `output/playwright/phase8-mobile-shell-390x844.png`
- `output/playwright/phase8-mobile-assistant-390x844.png`
- `output/playwright/phase8-mobile-supervision-390x844.png`
- `output/playwright/phase8-desktop-assistant-supervision-1440x900.png`
- `output/playwright/phase8-desktop-assistant-markdown-1440x900.png`

The authenticated fixture reports one expected console error because its finite Canvas Run event mock later reconnects to a generic JSON route (`application/json` instead of `text/event-stream`). This is a fixture boundary already recorded in Phase 6, not evidence of a clean or broken real-runtime SSE connection.

## Result

Phase 8 local code, responsive shell, Assistant behavior, geometry, semantic Markdown and visual evidence pass. Real SSE, isolated PostgreSQL and Gray behavior remain assigned to Phases 10 and 11. Gray and Production were untouched, and nothing was pushed.
