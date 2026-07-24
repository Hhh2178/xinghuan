# Canvas Connectivity And Supervision Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make grouped workflow topology legible, reveal selected-node dependency chains, and make AI supervision readiness actionable before Gray validation.

**Architecture:** Keep graph classification in a pure Canvas helper consumed by the existing edge rendering path. Keep client readiness advisory and derived from the same Node Capability Catalog used by the server; preserve API `create/start` validation as authority. Present stable error-code explanations beside the existing Run projection without changing persisted Run data.

**Tech Stack:** React 19, TypeScript, React Flow, Vitest, `@xinghuan/agent-core`, Vite, Playwright CLI.

## Global Constraints

- PC only: validate `1920x1080` and `2560x1440`; no new mobile/tablet work.
- Do not make `legacy_browser` nodes runnable or relax owner/model/budget/runtime gates.
- Gray only after local verification; no Production mutation and no GitHub push.
- Use `rtk` command variants where available and run CodeGraph sync after source edits.

---

### Task 1: Graph Edge Emphasis

**Files:**
- Create: `apps/web/src/components/canvas-edge-emphasis.ts`
- Create: `apps/web/src/components/canvas-edge-emphasis.test.ts`
- Modify: `apps/web/src/components/Canvas.tsx`

**Interfaces:**
- Produces `classifyCanvasEdgeEmphasis(nodes, edges): Map<string, CanvasEdgeEmphasis>`.
- `CanvasEdgeEmphasis` is `normal | muted | direct-upstream | direct-downstream | transitive-upstream | transitive-downstream`.
- Canvas edge rendering consumes the returned map by edge ID.

- [ ] **Step 1: Write failing graph classification tests**

```ts
expect(classifyCanvasEdgeEmphasis(nodes, edges)).toEqual(new Map([
  ['a-b', 'transitive-upstream'], ['b-c', 'direct-upstream'],
  ['c-d', 'direct-downstream'], ['d-e', 'transitive-downstream'],
  ['x-y', 'muted'],
]));
```

- [ ] **Step 2: Run the focused Vitest file and confirm the missing helper fails.**

- [ ] **Step 3: Implement iterative upstream/downstream traversal with visited node and edge sets.**

```ts
for (const edge of edges) {
  if (edge.target === selectedId) emphasis.set(edge.id, 'direct-upstream');
  if (edge.source === selectedId) emphasis.set(edge.id, 'direct-downstream');
}
```

- [ ] **Step 4: Wire the map into Canvas edge class/style generation, then rerun the focused test.**
- [ ] **Step 5: Commit the graph helper and Canvas integration.**

### Task 2: Visible Edge Rendering

**Files:**
- Modify: `apps/web/src/components/Canvas.tsx`
- Modify: `apps/web/src/styles/index.css`
- Test: `apps/web/src/components/canvas-edge-emphasis.test.ts`

**Interfaces:**
- Consumes `CanvasEdgeEmphasis` from Task 1.
- Produces `data-emphasis` on rendered edges and a stable edge layer above Group/Workflow fills.

- [ ] **Step 1: Extend the focused test with no-selection and multi-selection cases returning `normal` emphasis.**
- [ ] **Step 2: Run the test and confirm it fails before Canvas styling is updated.**
- [ ] **Step 3: Add CSS styles for baseline, muted, direct cyan/orange, and transitive cyan-blue/amber edges.**

```css
.react-flow__edge[data-emphasis='direct-upstream'] path { stroke: #38bdf8; stroke-width: 3px; opacity: 1; }
.react-flow__edge[data-emphasis='direct-downstream'] path { stroke: #fb923c; stroke-width: 3px; opacity: 1; }
```

- [ ] **Step 4: Raise the edge layer above region fills without placing it above node interaction surfaces.**
- [ ] **Step 5: Rerun focused tests and capture local screenshots at both approved PC viewports.**
- [ ] **Step 6: Commit edge visibility and styles.**

### Task 3: Advisory Supervision Readiness

**Files:**
- Create: `apps/web/src/components/canvas-agent/workflow-supervision-readiness.ts`
- Create: `apps/web/src/components/canvas-agent/workflow-supervision-readiness.test.ts`
- Modify: `apps/web/src/components/canvas-agent/CanvasSupervisionDock.tsx`

**Interfaces:**
- Produces `buildWorkflowSupervisionReadiness({ workflow, nodes, edges }): WorkflowSupervisionReadiness`.
- `WorkflowSupervisionReadiness` contains `state: 'ready' | 'blocked' | 'server-check'` and ordered `{ nodeId?, code, message, action }[]` items.
- Uses `CANVAS_RUN_NODE_CAPABILITIES`; it does not call APIs or enable Start authority.

- [ ] **Step 1: Write failing tests for no workflow, empty workflow, legacy node, missing workflow input, and supported native graph.**
- [ ] **Step 2: Run the focused Vitest file and confirm it fails.**
- [ ] **Step 3: Implement the pure readiness projection using workflow membership, node data, and capability `serverRuntime`.**
- [ ] **Step 4: Render the status and node-specific repair actions in CanvasSupervisionDock before Run controls.**
- [ ] **Step 5: Rerun tests and commit the readiness projection.**

### Task 4: Authoritative Error Translation

**Files:**
- Create: `apps/web/src/components/canvas-agent/canvas-run-error-message.ts`
- Create: `apps/web/src/components/canvas-agent/canvas-run-error-message.test.ts`
- Modify: `apps/web/src/components/canvas-agent/CanvasRunSupervisor.tsx`

**Interfaces:**
- Produces `describeCanvasRunError(code): { title, message, action, technicalCode }`.
- Maps `CANVAS_RUN_LEGACY_NODE_UNSUPPORTED`, `WORKFLOW_BOUNDARY_VALUE_MISSING`, `WORKFLOW_BOUNDARY_VARIABLE_TYPE_MISMATCH`, `CANVAS_RUN_PLAN_EMPTY`, and runtime-disabled errors.

- [ ] **Step 1: Write failing mappings for each stable error code and unknown fallback.**
- [ ] **Step 2: Run focused tests and confirm failure.**
- [ ] **Step 3: Render the translated title/action in the existing error block and keep technical code in a details element.**
- [ ] **Step 4: Rerun tests and commit error translation.**

### Task 5: Local and Gray Validation

**Files:**
- Modify: `docs/systems/canvas/README.md`
- Modify: `docs/systems/agent-runtime/README.md`
- Modify: `docs/logbooks/daily/2026/2026-07/2026-07-24.md`
- Create: `docs/logbooks/validations/2026-07-24-canvas-connectivity-supervision-gray.md`

**Interfaces:**
- Consumes the completed UI and existing Gray release scripts/runbooks.
- Produces local/Gray evidence for the two PC viewports and an isolated workflow Run lifecycle.

- [ ] **Step 1: Run focused Vitest, full relevant type-check, Web build, Assistant/Agent Runtime contracts, CodeGraph sync, and diff check.**
- [ ] **Step 2: Use the authorized Gray runbook to deploy the next patch release only after all local gates pass.**
- [ ] **Step 3: Create an isolated Gray Canvas, verify valid Run, blocked legacy node, missing input, pause/resume/cancel, and event ledger.**
- [ ] **Step 4: Capture `1920x1080` and `2560x1440` screenshots showing grouped edges and selected-chain emphasis.**
- [ ] **Step 5: Delete only the explicit disposable Gray Canvas, record evidence, run required Harness/release gates, and commit documentation.**

## Self-Review

- Spec coverage: Tasks 1-2 cover edge visibility and direct/transitive hierarchy; Tasks 3-4 cover advisory readiness and authoritative errors; Task 5 covers two-viewport local/Gray validation and cleanup.
- No placeholders: every task declares concrete files, interfaces, test cases, and commands or observable gates.
- Type consistency: `CanvasEdgeEmphasis` remains local to the Canvas helper; `WorkflowSupervisionReadiness` is separate from persisted Run records; error translation consumes string codes only.
