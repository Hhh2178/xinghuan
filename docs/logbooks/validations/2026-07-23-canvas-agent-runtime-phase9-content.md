# Canvas Agent Runtime Phase 9 Content Validation

## Scope

- Branch: `feature/canvas-agent-runtime`
- Candidate/runtime baseline: `v0.7.19`
- Target: local authenticated Canvas/Admin fixtures only
- Gray: not deployed or mutated in Phase 9
- Production: not opened, queried, deployed or changed

Phase 9 establishes one shared Assistant content boundary for API, Canvas and Admin. It does not change the still-pending product separation, curated Knowledge Snapshot or structured Admin governance work.

## Implementation

- Added `AssistantContent` with `format: markdown-v1`, `version: 1` and normalized final text.
- Added a stateful stream filter for split or unclosed `<think>`, `<analysis>` and `<reasoning>` blocks plus internal `analysis:`, `reasoning:` and `context:` lines.
- Normalized successful and fallback Assistant Chat results through the shared content protocol. Internal exceptions are no longer appended to `rawAssistant`.
- Added one shared `AssistantMarkdown` renderer for Canvas and Admin using `react-markdown` and `remark-gfm`.
- Raw HTML is skipped, dangerous URLs are removed, external links are hardened, remote images become accessible text and heading levels are constrained to panel semantics.
- Canvas and Admin now use the shared renderer. Canvas body/meta typography is `14px/22px` and `12px/18px`; Admin body typography is `14px/22px`.
- Added `verify:assistant-content-contract` to the project Harness and documented the contract.

## Focused Tests

Two focused suites passed, 9 tests total:

- ordinary GFM rendering;
- cross-chunk reasoning tags;
- unclosed reasoning blocks;
- split internal channel prefixes;
- raw HTML/XSS removal;
- dangerous link removal;
- remote image replacement;
- external link target/rel hardening;
- heading-level constraints.

Shared/UI package builds, API/Web/Admin type-checks and Web/Admin production builds passed. The Canvas Assistant Chat, Admin Assistant UI, Agent runtime architecture, project Harness contract, Harness documentation sync and hotspot contracts also passed.

## Browser Evidence

Authenticated browser checks used a mocked split SSE response containing hidden reasoning, GFM and a long code line. The same response path exercised the Web defensive stream filter and shared renderer.

Canvas evidence:

- `output/playwright/phase9-content/canvas-safe-markdown-1366x768.png`
- `output/playwright/phase9-content/canvas-safe-markdown-1440x900.png`
- `output/playwright/phase9-content/canvas-safe-markdown-1920x1080.png`
- `output/playwright/phase9-content/canvas-safe-markdown-390x844.png`

Admin evidence:

- `output/playwright/phase9-content/admin-safe-markdown-1440x900.png`
- `output/playwright/phase9-content/admin-safe-markdown-800x1000.png`

Observed results:

- split reasoning was absent from the DOM;
- headings, lists, tables, quotes, inline code and fenced code rendered as elements rather than raw Markdown;
- `javascript:` links became plain text and external links used `_blank` with `noopener noreferrer`;
- Canvas measured `14px/22px` body and `12px/18px` metadata at every checked viewport;
- the long code block had `551px` scroll width inside a `398px` client width while its parent remained `400px` wide;
- the `1366x768` panel bounds were `430x676` at `(918,72)`, ending at `(1348,748)` inside the viewport;
- the `1920x1080` panel bounds were `430x720` at `(1472,340)`, ending at `(1902,1060)` inside the viewport;
- the `390x844` panel remained within the viewport at `374x828` and the document body did not gain horizontal overflow;
- Canvas had zero runtime console errors in the final `1366x768` and `1920x1080` checks.

The first Admin visual pass exposed a global table `min-width: 720px` leaking into Assistant Markdown. Assistant-scoped `width: 100%; min-width: 0` removed the parent overflow; the final table parent had equal scroll and client widths. Admin retained the two React/Vite development errors and favicon 404 already recorded in the Phase 8 baseline; none originate in the Phase 9 content path.

## Stage Gates

- CodeGraph sync indexed the changed content modules and integration paths.
- Relevant dependency impact remained UI/shared-to-consumer only; Canvas and Admin do not own separate Markdown safety implementations.
- `verify:file-hotspot-budgets` passed.
- `git diff --check` passed.
- `npm run harness:verify:project` first passed in `60.8s`; the final post-documentation rerun passed in `61.1s`, including all workspace type checks, API build, dependency security, package exports, quick acceptance and the new content contract.

Phase 9 is complete. No Gray or Production deployment occurred; Phase 10 begins with the independent floating Assistant and top-header Supervision entry.
