# Canvas Agent Experience Phase 2 Workflow Variables Validation

## Scope

- Baseline: Gray v0.7.19 audit, local `feature/canvas-agent-runtime` branch.
- Change: Workflow Variable domain, top-level Canvas workflow persistence, Text/Upload controls, summary node and independent Canvas Run input snapshot.
- Safety: local browser and local API only; no GitHub push, no Gray deployment, no Production contact.

## Domain And Runtime Evidence

- Shared parser resolves same-name `##变量##` tokens to stable IDs, preserves `\##字面量##`, rejects unknown/unclosed/non-text tokens and rewrites only matching unescaped tokens on rename.
- Input snapshots validate known keys, required/default/constraint/type rules and deep-freeze workflow ID, revision, values and sources.
- API reads the authenticated owner's persisted Canvas, rejects missing members, duplicate summary nodes and stale text bindings, then saves `input_snapshot` independently from Plan/configuration/budget.
- Legacy Canvas Runs remain readable with an empty input snapshot. Migration 036 is forward-only and worker queries remain compatible because the new column has a non-null empty-object default.

## Browser Evidence

- Desktop `1440x900`: created summary and Text nodes, created/assigned a workflow, added a text variable, rendered yellow token state, edited a value from both node surfaces and retained it after refresh.
- Reference projection showed the Text node number and focused it. Assigning a second summary to the same workflow was rejected explicitly.
- Renaming `文本` to `主体设定` changed the Text source from `##文本##` to `##主体设定##` while preserving the stable reference.
- Entering `##未知##` set `aria-invalid` and displayed `未找到变量“未知”`; no variable was silently created.
- Temporary test canvases were explicitly deleted. The original canvas returned to one canvas / five nodes.
- Evidence: `output/playwright/phase2-text-token-desktop.png` and `output/playwright/phase2-mobile-390x844-known-issue.png`.

## Visual Finding

- The Phase 2 node controls did not overlap at desktop width.
- At `390x844`, the existing desktop Canvas sidebar consumes most horizontal space and Fit View makes nodes too small for practical editing. This is a failed narrow-screen shell result, assigned to Phase 8/10; mobile success is not claimed.

## Verification

- Focused Vitest: 6 files, 34 tests passed.
- `npm run type-check -w @xinghuan/shared`: passed.
- `npm run type-check -w @xinghuan/web`: passed.
- `npm run type-check -w @xinghuan/api`: passed.
- `npm run build -w @xinghuan/shared`: passed.
- `npm run build -w @xinghuan/web`: passed.
- `npm run build -w @xinghuan/api`: passed.
- Package exports, Canvas workflow capabilities, Agent Runtime architecture, hotspot budget/watchlist, documentation entry and domain/ADR contracts: passed.
- `git diff --check`: passed.

## Remaining

- Phase 3 must add authoritative Workflow Region geometry, workflow revision/subgraph compilation, typed boundary I/O and multi-workflow isolation.
- Media variable `assetId` currently carries a stable owner-scoped upload URL because legacy upload records do not expose a Resource Asset UUID; later authority migration must be forward-compatible.
- Full Harness and Gray runtime validation remain Phase 10/11 work.
