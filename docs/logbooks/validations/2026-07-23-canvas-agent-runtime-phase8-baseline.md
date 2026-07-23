# Canvas Agent Runtime Phase 8 Baseline

## Scope

- Branch: `feature/canvas-agent-runtime`
- Candidate/runtime baseline: `v0.7.19`
- Authenticated test target: local isolated PostgreSQL/Redis/API/Web/Admin fixture only
- Gray target: public login page and canonical runtime documents only; no authenticated Gray mutation
- Production: not opened, queried, deployed or changed

## Reproduction

1. Open the isolated Canvas at `127.0.0.1:5173`, log in with the documented local bootstrap account, and set the viewport to `1440x900`.
2. Open the floating `AI` launcher, capture the assistant view, then select the `托管` tab and capture the supervision view.
3. Serve the Admin Vite client through a temporary loopback-only proxy to the same isolated API, open `智能体与自动化`, and visit `角色`, `LLM 路由`, and `知识库`.
4. Capture Playwright accessibility snapshots, viewport screenshots and console errors. Stop the temporary Admin server and delete its one explicit temporary config file.

Ignored screenshot artifacts:

- `output/playwright/phase8-baseline/canvas-assistant-1440x900.png`
- `output/playwright/phase8-baseline/canvas-supervision-1440x900.png`
- `output/playwright/phase8-baseline/admin-agent-roles-1440x900.png`
- `output/playwright/phase8-baseline/admin-llm-routes-1440x900.png`
- `output/playwright/phase8-baseline/admin-knowledge-1440x900.png`

## Baseline Findings

- Canvas Assistant and Canvas Run supervision share one `画布 AI 工作台`, one launcher and `协作 / 托管` tabs. No independent supervision trigger exists beside `公告`.
- The new-node catalog still exposes `Agent 托管`; this conflicts with the accepted top-header entry and legacy-only node policy.
- Assistant final content is a plain paragraph. Markdown headings, lists, code and tables cannot render, and the content path has no shared URL/HTML safety policy.
- Canvas node labels and parameter metadata include text visibly below the 12px Meta floor. The assistant itself is more readable, but its identity tabs and run controls still compete inside one panel.
- Admin keeps its assistant dock open at approximately 400px while the navigation consumes approximately 240px. At `1440x900`, Agent governance has about 714px of main width, repeated navigation cards consume most of the first viewport, and the actual role/route/knowledge editor begins below the fold.
- Roles expose `新增配置草稿` without structured fields for prompt, LLM pool, knowledge collections, tools, token/timeout/budget, approval or recovery policy.
- LLM routes expose a single model selector and `以所选模型创建版本`; there is no multi-entry priority/weight/capability/transport/cost/health/retry/circuit editor.
- Knowledge supports collection creation and a plain body textbox, but no Markdown preview, reference validation, snapshot/index status, coverage or model/node projection view.

## Runtime Errors

Navigation reproduced three error-boundary events before the views recovered:

- `RolesView`: `TypeError: value.map is not a function`
- `PoolsView`: `TypeError: Cannot read properties of undefined (reading 'length')`
- `KnowledgeView`: `TypeError: Cannot read properties of undefined (reading 'map')`

The only Canvas console error was a missing local `favicon.ico`. Admin also emitted the same favicon 404. The three view errors are product defects and must be covered by response normalization and regression tests during the editable-workspace phase.

## Exit Decision

This baseline proves Phase 5/6 completion labels were too broad for the corrected product contract. Phase 8 may close only after the domain identities, double-entry UX, safe content boundary, curated Knowledge Snapshot, structured Admin configuration and runtime publication rules are protected by the project Harness. Implementation remains in Phase 9-13.
