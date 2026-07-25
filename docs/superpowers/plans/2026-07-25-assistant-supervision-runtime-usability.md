# AI Assistant And Supervision Runtime Usability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify manual and AI-supervised node runtime/results, repair smart-candidate provenance, prevent assistant/supervision overlap, simplify assistant answers and supervision presentation, and complete the related Admin governance and text-input fixes.

**Architecture:** AI Supervision remains the deterministic workflow controller, while task execution, batch progress, artifact output and node rendering move through the same projection used by normal nodes. Immutable Run snapshots freeze human node identities, generated artifacts freeze resolved execution provenance, and the selected Run exposes an owner-scoped transient runtime projection that is never stored in Canvas topology. Canvas and Admin assistants share UI/input primitives and answer policy while retaining separate Agent configurations and permission boundaries.

**Tech Stack:** TypeScript, React 19, Vite, `@xyflow/react`, Node.js API, PostgreSQL, Redis Worker, Vitest, Playwright/browser acceptance, Agent Runtime, existing Provider generation adapters.

## Global Constraints

- Baseline is Gray `v0.7.43`, release `20260725-ai-governance-supervision-gray-r1-v0743`, source commit `d342ed3`.
- Work only in `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean`.
- Do not push GitHub until the user explicitly requests it after local completion.
- Do not deploy Gray until the user explicitly requests deployment after reviewing local completion.
- Do not touch, restart, test against or mutate Production; Production remains `v0.7.18`.
- PC desktop only. Perform one visual acceptance at `1920x1080`; do not run a dual 1080p/2K matrix.
- Do not expose API keys, cookies, credentials, database URLs, signed media URLs, prompts from unrelated owners or full Provider responses.
- Do not persist transient Workflow Run status, task state or generated result UI into Canvas topology JSON.
- AI Supervision may govern ordering, readiness, concurrency, recovery and selection; deterministic dependencies and Worker claiming remain authoritative.
- Manual and AI-supervised generation must use the same child-run, progress, cancellation, result-order and node-rendering contract.
- Each task below ends with focused tests, relevant type-check/build, diff review and an append-only daily validation entry before the next task begins.

---

## File Map

### Shared contracts

- Create: `packages/shared/src/node-display-identity.ts` and test.
- Create: `packages/shared/src/generation-execution-provenance.ts` and test.
- Create: `packages/shared/src/node-execution-projection.ts` and test.
- Modify: `packages/shared/src/provider-generation-task.ts`.
- Modify: `packages/shared/src/canvas-run-diagnostic.ts` and test.
- Modify: `packages/shared/src/index.ts`.

### Agent compiler and Worker

- Modify: `packages/agent-core/src/workflow-compiler.ts` and tests.
- Modify: `packages/agent-core/src/smart-candidate-selector.ts` and tests.
- Modify: `apps/worker/src/output-materials.ts`.
- Create: `apps/worker/src/output-materials.test.ts`.
- Create: `apps/worker/src/canvas-run-artifact-provenance.ts` and test.
- Modify: `apps/worker/src/canvas-run-candidate-selector.ts` and tests.
- Modify: `apps/worker/src/canvas-run-coordinator.ts` and tests.
- Modify: `apps/worker/src/worker-image-generation-batch.ts` and test.
- Modify: `apps/worker/src/worker-video-generation-batch.ts` and test.
- Modify the equivalent audio batch entry if its execution contract differs after inspection; the shared projection must still support audio without a separate UI path.

### API runtime detail and assistant policy

- Modify: `apps/api/src/canvas-run-repository.ts` and tests.
- Modify: `apps/api/src/canvas-run-service.ts` and tests.
- Modify: `apps/api/src/canvas-run-routes.ts` and tests.
- Create: `apps/api/src/assistant-answer-policy.ts` and test.
- Modify: `apps/api/src/assistant-workflow-context.ts` and test.
- Modify: `apps/api/src/server.ts` only at the existing assistant prompt and Run detail composition boundaries.

### Canvas Web

- Replace: `apps/web/src/components/canvas-agent/canvas-run-node-projection.ts` with the unified projection adapter and extend its test.
- Create: `apps/web/src/components/nodes/useNodeExecutionProjection.ts` and test.
- Modify: `apps/web/src/components/Canvas.tsx` only at transient rendered-node projection wiring.
- Modify: `apps/web/src/components/nodes/ImageNode.tsx`.
- Modify: `apps/web/src/components/nodes/VideoNode.tsx`.
- Modify: `apps/web/src/components/nodes/AudioNode.tsx`.
- Modify: `apps/web/src/components/nodes/OutputNode.tsx`.
- Modify: `apps/web/src/components/nodes/NodeRuntimeCard.tsx` and contract verifier.
- Create: `apps/web/src/components/canvas-agent/CanvasSupervisionRuntimeView.tsx`.
- Create: `apps/web/src/components/canvas-agent/CanvasSupervisionPlanView.tsx`.
- Create: `apps/web/src/components/canvas-agent/CanvasSupervisionEventView.tsx`.
- Modify: `apps/web/src/components/canvas-agent/CanvasSupervisionDock.tsx`.
- Modify: `apps/web/src/components/canvas-agent/CanvasRunSupervisor.tsx`.
- Modify: `apps/web/src/components/canvas-agent/canvas-run-view-model.ts` and test.
- Modify: `apps/web/src/components/canvas-agent/workflow-supervision-readiness.ts` and test.
- Modify: `apps/web/src/components/canvas-assistant/assistant-geometry.ts` and test.
- Modify: `apps/web/src/components/canvas-assistant/useAssistantGeometry.ts`.
- Modify: `apps/web/src/components/canvas-assistant/CanvasAssistantShell.tsx`.
- Create: `apps/web/src/components/inputs/useImeSafeTextControl.ts` and test.
- Modify: `apps/web/src/components/canvas-assistant/AssistantComposer.tsx`.
- Modify: `apps/web/src/components/nodes/MentionPromptInput.tsx` to reuse the shared hook.
- Modify: `apps/web/src/components/canvas-assistant/useAssistantSession.ts` and tests.
- Modify scoped sections in `apps/web/src/styles/index.css`.

### Admin

- Modify: `apps/admin/src/admin-data-loaders.ts`.
- Create: `apps/admin/src/admin-data-loaders.test.ts`.
- Create: `scripts/verify-admin-agent-runtime-model-loading.mjs`.
- Modify: `apps/admin/src/admin-agent-governance-workspace.tsx`.
- Create: `apps/admin/src/admin-supervision-workspace-nav.tsx` and view-model test.
- Modify: `apps/admin/src/admin-agent-pool-editor.tsx`.
- Modify: `apps/admin/src/admin-agent-role-configuration-editor.tsx`.
- Modify: `apps/admin/src/admin-agent-quality-editor.tsx`.
- Refactor: `apps/admin/src/admin-assistant-panel.tsx` around shared assistant primitives.
- Modify: `apps/admin/src/styles.css`.
- Modify: `scripts/verify-admin-assistant-ui-contract.mjs`.
- Modify: `scripts/verify-admin-assistant-workbench.mjs`.

### Documentation and evidence

- Modify: `CONTEXT.md` only if the final projection/provenance terms change domain meaning.
- Modify: `docs/systems/agent-runtime/README.md`.
- Modify: `docs/systems/worker/execution-chain.md`.
- Modify: `docs/systems/storage-and-data/material-and-output-storage.md`.
- Create: `docs/logbooks/daily/2026-07-25-assistant-supervision-runtime-usability.md`.
- Create: `docs/logbooks/validations/2026-07-25-assistant-supervision-runtime-usability-local.md`.
- Create a Gray validation record only after explicit deployment/test authorization.

---

### Task 1: Fix Direct Agent Workspace Model Loading

**Files:**
- Modify: `apps/admin/src/admin-data-loaders.ts`.
- Create: `apps/admin/src/admin-data-loaders.test.ts`.
- Create: `scripts/verify-admin-agent-runtime-model-loading.mjs`.
- Modify: `package.json` to register the new verifier and add it to the Agent governance Harness chain.

**Interfaces:**
- Consumes: the existing provider/model catalog loader.
- Produces: `readAdminWorkspaceSnapshot("agent-runtime")` with enabled model records required by Agent editors.

- [ ] **Step 1: Write the failing direct-navigation test**

```ts
it("loads the model catalog for agent-runtime without visiting provider workspaces", async () => {
  const snapshot = await readAdminWorkspaceSnapshot("agent-runtime", deps);
  expect(snapshot.models).toEqual([
    expect.objectContaining({ id: "chat-model-1", capability: "chat", enabled: true }),
  ]);
});
```

- [ ] **Step 2: Run the focused test and confirm the current empty snapshot**

Run: `npx vitest run apps/admin/src/admin-data-loaders.test.ts`

Expected before implementation: FAIL because `agent-runtime` falls through to `{}` or returns no `models`.

- [ ] **Step 3: Reuse the catalog loader for `agent-runtime`**

Add `agent-runtime` to the workspace set that requests provider/model data. Filter presentation candidates in the editor by `enabled && capability === "chat"`; do not change catalog authority or make the UI fabricate options.

- [ ] **Step 4: Add a static direct-route contract**

The verifier must assert that `agent-runtime` has a loader branch and that the model list is passed to the governance workspace on first render.

- [ ] **Step 5: Run the phase gate**

Run:

```powershell
npx vitest run apps/admin/src/admin-data-loaders.test.ts
npm run verify:admin-agent-runtime-model-loading
npm run type-check -w @xinghuan/admin
npm run build -w @xinghuan/admin
git diff --check
```

- [ ] **Step 6: Record and commit**

Append the commands and result to the daily log, then commit only this task's files with `fix(admin): load agent model catalog directly`.

---

### Task 2: Freeze Human Node Identity In Workflow Runs

**Files:**
- Create: `packages/shared/src/node-display-identity.ts`.
- Test: `packages/shared/src/node-display-identity.test.ts`.
- Modify: `packages/shared/src/index.ts`.
- Modify: `packages/agent-core/src/workflow-compiler.ts`.
- Test: `packages/agent-core/src/workflow-compiler.test.ts`.
- Modify: `apps/web/src/components/canvas-agent/canvas-run-api.ts`.

**Interfaces:**
- Produces:

```ts
export interface NodeDisplayIdentity {
  label: string;
  suffix: string;
  displayName: string;
}

export function resolveNodeDisplayIdentity(input: {
  nodeId: string;
  nodeType?: string;
  customLabel?: unknown;
  catalogLabel?: string;
}): NodeDisplayIdentity;
```

- Extends `CanvasRunPlanStep` with `displayIdentity: NodeDisplayIdentity`.

- [ ] **Step 1: Write identity tests**

```ts
expect(resolveNodeDisplayIdentity({
  nodeId: "smart-candidate-selector-1784938612965-ydhc",
  nodeType: "smart-candidate-selector",
  catalogLabel: "智能候选选择器",
})).toEqual({ label: "智能候选选择器", suffix: "ydhc", displayName: "智能候选选择器 #ydhc" });

expect(resolveNodeDisplayIdentity({
  nodeId: "image-1784938575967-v3uy",
  customLabel: "人物生成",
  catalogLabel: "图像",
})).toMatchObject({ displayName: "人物生成 #v3uy" });
```

- [ ] **Step 2: Run the new shared test and confirm the missing export**

Run: `npx vitest run packages/shared/src/node-display-identity.test.ts`

- [ ] **Step 3: Implement safe suffix and label resolution**

Use the final non-empty `-` token, strip unsafe characters, cap at eight characters and fall back to the final eight safe characters of the full ID. Never use a timestamp or full internal ID as the primary label.

- [ ] **Step 4: Freeze identity in the compiler**

Resolve custom labels from `label`, `name`, then `title`; resolve catalog labels from `CANVAS_RUN_NODE_CAPABILITIES`. Store the result in every plan step. Existing Run JSON without `displayIdentity` remains readable through the same helper.

- [ ] **Step 5: Add compiler regression coverage**

```ts
expect(plan.steps.find((step) => step.nodeId.endsWith("v3uy"))?.displayIdentity)
  .toMatchObject({ displayName: "人物生成 #v3uy" });
```

- [ ] **Step 6: Run the phase gate**

Run:

```powershell
npx vitest run packages/shared/src/node-display-identity.test.ts packages/agent-core/src/workflow-compiler.test.ts
npm run type-check -w @xinghuan/shared
npm run type-check -w @xinghuan/agent-core
npm run build -w @xinghuan/shared
npm run build -w @xinghuan/agent-core
git diff --check
```

- [ ] **Step 7: Record and commit**

Commit with `feat(agent): freeze human node identities in run plans`.

---

### Task 3: Repair Smart Candidate Provenance Without Weakening Validation

**Files:**
- Create: `packages/shared/src/generation-execution-provenance.ts` and test.
- Modify: `packages/shared/src/provider-generation-task.ts` and `index.ts`.
- Modify: `apps/worker/src/output-materials.ts`.
- Create: `apps/worker/src/output-materials.test.ts`.
- Create: `apps/worker/src/canvas-run-artifact-provenance.ts` and test.
- Modify: `apps/worker/src/canvas-run-candidate-selector.ts` and test.
- Modify: `packages/agent-core/src/smart-candidate-selector.ts` and test.
- Modify: `packages/shared/src/canvas-run-diagnostic.ts` and test.

**Interfaces:**
- Produces:

```ts
export interface GenerationExecutionProvenanceV1 {
  schemaVersion: 1;
  sourceTaskId: string;
  sourceNodeId: string;
  canvasRunId?: string;
  canvasRunStepId?: string;
  providerId: string;
  modelRecordId: string;
  resolvedPrompt: string;
}

export function resolveCanvasRunArtifactProvenance(input: {
  artifact: SelectorArtifact;
  sourceTask?: { id: string; ownerId: string; payload: Record<string, unknown> };
}): GenerationExecutionProvenanceV1;
```

- [ ] **Step 1: Reproduce the user's exact one-edge, multi-artifact failure in a test**

```ts
it("accepts three artifacts from one image step whose prompt came from upstream text", () => {
  const context = createSmartCandidateRuntimeContext({
    selectorStep: { nodeId: "selector-ydhc", dependsOn: ["image-v3uy"] },
    upstreamSteps: [{
      id: "step-image",
      nodeId: "image-v3uy",
      status: "succeeded",
      outputBinding: { generationArtifactIds: ["a-0", "a-1", "a-2"] },
    }],
    artifacts: artifactsWithResolvedTaskProvenance,
    planSnapshot,
    inputSnapshot,
    configurationSnapshot,
  });
  expect(context.candidates).toHaveLength(3);
});
```

- [ ] **Step 2: Add a failing materializer assertion**

```ts
expect(materialized.artifacts[0].metadata.provenance).toMatchObject({
  schemaVersion: 1,
  resolvedPrompt: "来自上游文本的最终提示词",
  sourceNodeId: "image-v3uy",
});
```

- [ ] **Step 3: Run the focused tests and capture both failures**

Run:

```powershell
npx vitest run apps/worker/src/canvas-run-candidate-selector.test.ts apps/worker/src/output-materials.test.ts packages/agent-core/src/smart-candidate-selector.test.ts
```

- [ ] **Step 4: Freeze provenance during output materialization**

Build provenance from the already resolved task payload. Store only safe execution facts, never credentials, arbitrary headers, full Provider bodies or signed URLs.

- [ ] **Step 5: Add owner-scoped legacy fallback**

When artifact metadata lacks provenance, query `source_task_id` joined by the current owner and reconstruct from the task's frozen payload. Do not read a task owned by another account. Do not modify historical artifact rows during this read path.

- [ ] **Step 6: Return precise missing-field diagnostics**

Use codes such as `SMART_CANDIDATE_PROVENANCE_INCOMPLETE:resolvedPrompt:<artifactId>` internally. Add a dedicated shared diagnostic classification with a direct user action; keep the artifact/task ID inside technical detail only.

- [ ] **Step 7: Preserve the cardinality rule**

Keep at least two candidate artifacts and same-media validation. Confirm one upstream node with two or more artifacts passes, while one upstream node with one artifact still returns `SMART_CANDIDATE_COUNT_INSUFFICIENT`.

- [ ] **Step 8: Run the phase gate**

Run:

```powershell
npx vitest run packages/shared/src/generation-execution-provenance.test.ts packages/shared/src/canvas-run-diagnostic.test.ts packages/agent-core/src/smart-candidate-selector.test.ts apps/worker/src/canvas-run-artifact-provenance.test.ts apps/worker/src/canvas-run-candidate-selector.test.ts apps/worker/src/worker-image-generation-batch.test.ts
npm run verify:worker-output-materializer
npm run verify:canvas-supervision-diagnostic-contract
npm run type-check -w @xinghuan/worker
npm run build -w @xinghuan/worker
git diff --check
```

- [ ] **Step 9: Record and commit**

Commit with `fix(agent): preserve selector artifact provenance`.

---

### Task 4: Unify Manual And Supervised Batch Execution

**Files:**
- Create: `packages/shared/src/node-execution-projection.ts` and test.
- Modify: `packages/shared/src/provider-generation-task.ts` and `index.ts`.
- Modify: `apps/worker/src/worker-image-generation-batch.ts` and test.
- Modify: `apps/worker/src/worker-video-generation-batch.ts` and test.
- Modify: `apps/worker/src/canvas-run-coordinator.ts` and test.
- Modify: `apps/api/src/canvas-run-repository.ts`, service and route tests.

**Interfaces:**
- Produces `NodeExecutionProjection` from the design specification.
- Detailed Run responses add `runtimeSteps: NodeExecutionProjection[]`; list/overview responses remain unchanged.
- Batch child records use stable `batchIndex`, child `taskId`, terminal status, safe error and ordered output IDs.

- [x] **Step 1: Write a batch concurrency/order test**

```ts
it("submits all requested children independently and orders results by batch index", async () => {
  const gates = deferredExecutions(3);
  const promise = executeImageGenerationBatch({ generationCount: 3, execute: gates.execute });
  expect(gates.started()).toEqual([0, 1, 2]);
  gates.resolve(2, { imageUrls: ["/2.png"], taskId: "provider-2" });
  gates.resolve(0, { imageUrls: ["/0.png"], taskId: "provider-0" });
  gates.resolve(1, { imageUrls: ["/1.png"], taskId: "provider-1" });
  await expect(promise).resolves.toMatchObject({ imageUrls: ["/0.png", "/1.png", "/2.png"] });
});
```

- [x] **Step 2: Write a partial progress and cancellation test**

Assert that each child terminal state emits progress, cancellation stops unfinished children, completed artifacts remain and late results cannot mutate a cancelled Run.

- [x] **Step 3: Run focused tests and confirm the current sequential behavior fails**

Run: `npx vitest run apps/worker/src/worker-image-generation-batch.test.ts apps/worker/src/worker-video-generation-batch.test.ts`

- [x] **Step 4: Implement a bounded shared batch runner**

Use the existing workflow/provider concurrency limit. Do not use unbounded `Promise.all`. Emit child snapshots after submit, progress and terminal settlement. Stable result ordering uses `batchIndex`.

- [x] **Step 5: Persist and project child state**

Extend the safe task result/batch snapshot rather than creating a Canvas-only state table. The selected Run detail query joins only owner-scoped steps/tasks and projects safe URLs already materialized into the platform.

- [x] **Step 6: Add API ownership and list-weight tests**

Confirm another owner cannot read runtime steps and `GET /api/canvas-runs?canvasId=...` does not include heavy runtime output.

- [x] **Step 7: Run the phase gate**

Run:

```powershell
npx vitest run packages/shared/src/node-execution-projection.test.ts apps/worker/src/worker-image-generation-batch.test.ts apps/worker/src/worker-video-generation-batch.test.ts apps/worker/src/canvas-run-coordinator.test.ts apps/api/src/canvas-run-repository.test.ts apps/api/src/canvas-run-routes.test.ts
npm run verify:generation-count-contract
npm run verify:provider-generation-task-contract
npm run type-check -w @xinghuan/api
npm run type-check -w @xinghuan/worker
npm run build -w @xinghuan/api
npm run build -w @xinghuan/worker
git diff --check
```

- [x] **Step 8: Record and commit**

Commit with `feat(runtime): unify generation batch projections`.

---

### Task 5: Render Supervised Runs Through Existing Node Runtime And Output UI

**Files:**
- Modify: `apps/web/src/components/canvas-agent/canvas-run-node-projection.ts` and test.
- Create: `apps/web/src/components/nodes/useNodeExecutionProjection.ts` and test.
- Modify: `apps/web/src/components/Canvas.tsx`.
- Modify: `ImageNode.tsx`, `VideoNode.tsx`, `AudioNode.tsx`, `OutputNode.tsx`, `NodeRuntimeCard.tsx`.
- Modify: `scripts/verify-node-runtime-card-contract.mjs`.

**Interfaces:**
- Consumes: `runtimeSteps` from the selected Run detail.
- Produces: transient rendered-node data under a reserved non-persisted key such as `__runtimeProjection`.
- `useNodeExecutionProjection(nodeData)` merges manual data and transient projection with active Workflow Run taking visual precedence only while present.

- [x] **Step 1: Write projection tests for running, multi-child success, failure and outputs**

```ts
expect(buildCanvasRunNodeProjection(runDetail)["image-v3uy"]).toMatchObject({
  status: "running",
  progress: "2/3",
  taskRuns: [
    { batchIndex: 0, status: "success" },
    { batchIndex: 1, status: "success" },
    { batchIndex: 2, status: "running" },
  ],
  outputs: { imageUrls: ["/0.png", "/1.png"] },
});
```

- [x] **Step 2: Add a persistence guard test**

Assert that Canvas serialization and workflow template export remove `__runtimeProjection` and that applying a Run projection does not call the Canvas update/persist callback.

- [x] **Step 3: Run tests and confirm the class-only projection fails**

Run:

```powershell
npx vitest run apps/web/src/components/canvas-agent/canvas-run-node-projection.test.ts apps/web/src/components/nodes/useNodeExecutionProjection.test.ts apps/web/src/utils/workflowRuntimeCleanup.test.ts
```

- [x] **Step 4: Merge the transient projection in `Canvas.tsx`**

Map the selected Run detail into the rendered node array only. Do not call `setNodes`, `updateNodeData`, Canvas save or revision APIs.

- [x] **Step 5: Reuse existing runtime and preview components**

Image/video/audio nodes feed the merged projection into `NodeRuntimeCard` and their existing output gallery. Output nodes consume projected upstream artifacts through the same media collection helpers used by manual results. Remove duplicate class-only status copy after all supported nodes render the projection.

- [x] **Step 6: Cover late SSE and Run switching**

Switching the selected workflow/run clears the previous transient projection immediately. A delayed event from the old Run cannot reappear on the new Run.

- [x] **Step 7: Run the phase gate**

Run:

```powershell
npx vitest run apps/web/src/components/canvas-agent/canvas-run-node-projection.test.ts apps/web/src/components/nodes/useNodeExecutionProjection.test.ts apps/web/src/utils/workflowRuntimeCleanup.test.ts
npm run verify:node-runtime-card-contract
npm run verify:canvas-node-render-smoke
npm run type-check -w @xinghuan/web
npm run build -w @xinghuan/web
git diff --check
```

- [x] **Step 8: Record and commit**

Commit with `feat(canvas): show supervised tasks in normal nodes`.

---

### Task 6: Redesign The Supervision Panel And Apply Human Node Names

**Files:**
- Create: `CanvasSupervisionRuntimeView.tsx`, `CanvasSupervisionPlanView.tsx`, `CanvasSupervisionEventView.tsx`.
- Modify: `CanvasSupervisionDock.tsx`, `CanvasRunSupervisor.tsx`, `canvas-run-view-model.ts`, `workflow-supervision-readiness.ts` and tests.
- Modify scoped Canvas supervision styles in `apps/web/src/styles/index.css`.
- Modify: `scripts/verify-canvas-supervision-diagnostic-contract.mjs`.

**Interfaces:**
- Produces internal tab state: `runtime | plan | events`.
- All user-facing step labels consume frozen `displayIdentity`; raw IDs remain in technical detail.

- [x] **Step 1: Write view-model tests for friendly names and hidden empty facts**

```ts
expect(view.currentStep.displayName).toBe("智能候选选择器 #ydhc");
expect(view.primaryFacts).not.toContainEqual(expect.objectContaining({ value: "0" }));
expect(view.serialConstraints[0]).toMatchObject({
  before: "人物生成 #v3uy",
  after: "智能候选选择器 #ydhc",
});
```

- [x] **Step 2: Add a component contract for the three internal tabs**

The static verifier must reject a return to one continuous stack and assert that only the active workspace is rendered.

- [x] **Step 3: Split the current supervisor**

Keep the header, workflow selector, settings trigger and Run commands in the dock. Move default status/failure/candidate/output, plan/analysis and events into separate focused components.

- [x] **Step 4: Simplify the runtime view**

Show status, progress, current node, primary control and concise repair action. Hide zero/unlimited cost, empty budgets, full revision metadata and raw route IDs from the default view.

- [x] **Step 5: Replace all raw user-facing node references**

Update readiness items, run plan, AI concurrency groups, serial constraints, failure title, candidate source and assistant bridge. Keep `nodeId` unchanged in event payloads and technical detail.

- [x] **Step 6: Run the phase gate**

Run:

```powershell
npx vitest run apps/web/src/components/canvas-agent/canvas-run-view-model.test.ts apps/web/src/components/canvas-agent/workflow-supervision-readiness.test.ts apps/web/src/components/canvas-agent/canvas-run-assistant-bridge.test.ts
npm run verify:canvas-supervision-diagnostic-contract
npm run type-check -w @xinghuan/web
npm run build -w @xinghuan/web
git diff --check
```

- [x] **Step 7: Record and commit**

Commit with `refactor(canvas): focus supervision runtime views`.

---

### Task 7: Make Assistant Geometry Obstacle-aware

**Files:**
- Modify: `apps/web/src/components/canvas-assistant/assistant-geometry.ts` and test.
- Modify: `apps/web/src/components/canvas-assistant/useAssistantGeometry.ts`.
- Modify: `apps/web/src/components/canvas-assistant/CanvasAssistantShell.tsx`.
- Modify scoped assistant/supervision styles only if a geometry invariant requires it.

**Interfaces:**
- Produces:

```ts
export interface AssistantMovementRegion {
  launcherBounds: AssistantRect;
  panelBounds: AssistantRect;
}

export function resolveAssistantMovementRegion(input: {
  viewport: AssistantSize;
  panelSize: AssistantSize;
  obstacle?: AssistantRect | null;
  gap?: number;
}): AssistantMovementRegion[];
```

- [x] **Step 1: Write no-overlap and clamped-drag tests**

```ts
const supervision = { x: 1382, y: 122, width: 520, height: 720 };
const layout = resolveAssistantLayout({
  viewportWidth: 1920,
  viewportHeight: 1080,
  anchor: { x: 1500, y: 500 },
  size: { width: 430, height: 720 },
  supervisionRect: supervision,
});
expect(assistantRectsOverlap(layout.panel, supervision, 12)).toBe(false);
expect(assistantRectsOverlap(layout.launcher, supervision, 12)).toBe(false);
```

- [x] **Step 2: Add transition tests**

Opening or resizing supervision re-homes an illegal assistant position; closing supervision keeps the anchor when it is valid and restores full movement bounds.

- [x] **Step 3: Run the geometry tests and confirm the current overlap remains possible**

Run: `npx vitest run apps/web/src/components/canvas-assistant/assistant-geometry.test.ts`

- [x] **Step 4: Implement viewport subtraction and nearest legal region selection**

Use pure rectangle math with a 12px gap. Clamp on every pointer move. Do not rely on z-index or choose merely the smaller intersection.

- [x] **Step 5: Observe the supervision rectangle without global event races**

Keep `ResizeObserver` ownership in the geometry hook, but update only when the measured rectangle changes. Ensure pointer capture remains on the assistant control during clamped dragging.

- [x] **Step 6: Run the phase gate**

Run:

```powershell
npx vitest run apps/web/src/components/canvas-assistant/assistant-geometry.test.ts
npm run verify:canvas-assistant-ui-contract
npm run type-check -w @xinghuan/web
npm run build -w @xinghuan/web
git diff --check
```

- [x] **Step 7: Record and commit**

Commit with `fix(canvas): keep assistant clear of supervision`.

---

### Task 8: Fix IME Composition And Native Selection Persistence

**Files:**
- Create: `apps/web/src/components/inputs/useImeSafeTextControl.ts` and test.
- Modify: `apps/web/src/components/canvas-assistant/AssistantComposer.tsx`.
- Modify: `apps/web/src/components/nodes/MentionPromptInput.tsx`.
- Modify: `apps/admin/src/admin-assistant-panel.tsx` to consume the shared-compatible behavior.
- Inspect and modify only the confirmed interfering handlers in `apps/web/src/components/Canvas.tsx`, `useCanvasSelectionMenus.ts` or `useCanvasConnectionPanMode.ts`.

**Interfaces:**
- Produces an input adapter with `value`, `onChange`, `onCompositionStart`, `onCompositionEnd`, `isComposing` and `commit`.

- [x] **Step 1: Write a composition event test**

```ts
fireEvent.compositionStart(textarea);
fireEvent.change(textarea, { target: { value: "ni" } });
fireEvent.keyDown(textarea, { key: "Enter", isComposing: true });
expect(onSend).not.toHaveBeenCalled();
fireEvent.compositionEnd(textarea, { data: "你" });
expect(onChange).toHaveBeenLastCalledWith("你");
```

- [x] **Step 2: Reproduce selection loss in a real browser before changing Canvas handlers**

Use the local app and record which handler or remount clears `window.getSelection()` or `selectionStart/selectionEnd`. Do not remove global Canvas behavior without this evidence.

- [x] **Step 3: Implement the shared IME-safe control**

Buffer during composition, commit once at `compositionend` and block Enter submission while composing. Preserve focus and DOM identity during assistant streaming status updates.

- [x] **Step 4: Stop only confirmed Canvas pointer interference**

Text controls may stop propagation to Canvas drag/pan handlers, but must not call `preventDefault` on normal selection pointer-down/up. Keep existing `nodrag` and `nowheel` semantics.

- [x] **Step 5: Run unit and real-browser phase gates**

Run:

```powershell
npx vitest run apps/web/src/components/inputs/useImeSafeTextControl.test.ts
npm run type-check -w @xinghuan/web
npm run type-check -w @xinghuan/admin
npm run build -w @xinghuan/web
npm run build -w @xinghuan/admin
git diff --check
```

Browser evidence: Microsoft IME Pinyin input plus retained mouse selection across one assistant status rerender.

- [x] **Step 6: Record and commit**

Commit with `fix(ui): preserve ime and native text selection`.

---

### Task 9: Share Assistant UI Behavior And Make Answers Concise By Default

**Files:**
- Create: `apps/api/src/assistant-answer-policy.ts` and test.
- Modify: `apps/api/src/server.ts` assistant prompt construction.
- Modify: `apps/api/src/assistant-workflow-context.ts` and test.
- Extend shared assistant components under `packages/ui/src/` only where both apps need identical behavior.
- Refactor: `apps/admin/src/admin-assistant-panel.tsx`.
- Modify: `apps/web/src/components/canvas-assistant/AssistantConversation.tsx` and `useAssistantSession.ts`.
- Modify Admin and Web scoped assistant styles.

**Interfaces:**
- Produces:

```ts
export type AssistantDetailLevel = "brief" | "technical";

export function resolveAssistantDetailLevel(input: {
  message: string;
  scope: "canvas" | "admin";
}): AssistantDetailLevel;
```

- Canvas/Admin streaming status uses the same semantic phases while each surface provides its own context adapter.

- [x] **Step 1: Write answer-policy tests**

```ts
expect(resolveAssistantDetailLevel({ message: "这个错误怎么处理", scope: "canvas" })).toBe("brief");
expect(resolveAssistantDetailLevel({ message: "给我技术码、任务 ID 和 provenance 字段", scope: "canvas" })).toBe("technical");
```

- [x] **Step 2: Write prompt contract assertions**

Brief mode requires a conclusion plus no more than three actions and forbids raw IDs/JSON in the main answer. Technical mode allows identifiers and structured detail while preserving secret redaction and evidence/guess separation.

- [x] **Step 3: Move common conversation/composer behavior into shared UI primitives**

Share message identity, markdown blocks, copy action, process display, composer, attachment strip and semantic status rendering. Keep Canvas context collection and Admin context collection in their respective apps.

- [x] **Step 4: Make Admin consume SSE statuses**

Map `starting`, `building-context`, `generating` to `正在读取上下文`, `正在分析`, `正在生成答复`. Keep Admin-only Provider/model/task/user/audit features and permissions.

- [x] **Step 5: Use human node identity in assistant attachments**

The prompt receives `displayName` as the primary reference and raw `nodeId` under technical context. The assistant must not repeat raw IDs unless detail level is technical.

- [x] **Step 6: Run the phase gate**

Run:

```powershell
npx vitest run apps/api/src/assistant-answer-policy.test.ts apps/api/src/assistant-workflow-context.test.ts packages/ui/src/assistant-markdown.test.tsx apps/web/src/components/canvas-assistant/assistant-failure-context.test.ts
npm run verify:assistant-content-contract
npm run verify:canvas-assistant-chat
npm run verify:admin-assistant-chat
npm run verify:canvas-assistant-ui-contract
npm run verify:admin-assistant-ui-contract
npm run type-check -w @xinghuan/api
npm run type-check -w @xinghuan/ui
npm run type-check -w @xinghuan/web
npm run type-check -w @xinghuan/admin
git diff --check
```

- [x] **Step 7: Record and commit**

Commit with `feat(assistant): default to concise actionable answers`.

---

### Task 10: Redesign Admin Supervision Governance Workspaces

**Files:**
- Modify: `apps/admin/src/admin-agent-governance-workspace.tsx`.
- Create: `apps/admin/src/admin-supervision-workspace-nav.tsx` and test.
- Modify: `admin-agent-pool-editor.tsx`, `admin-agent-role-configuration-editor.tsx`, `admin-agent-quality-editor.tsx`.
- Modify scoped `apps/admin/src/styles.css`.
- Modify existing Agent governance contract verifiers.

**Interfaces:**
- Produces internal workspace key:

```ts
type SupervisionWorkspaceKey =
  | "overview"
  | "environment"
  | "planner"
  | "routing"
  | "quality"
  | "recovery";
```

- [x] **Step 1: Write navigation/view-model tests**

Assert stable default selection, deep-link mapping, one rendered workspace and retention of unsaved draft warning when switching sections.

- [x] **Step 2: Add a style/structure contract**

The verifier checks established Admin surface, form-row, button, select, segmented-control and sticky-action classes. It rejects the previous continuous vertical stack.

- [x] **Step 3: Implement task-oriented internal navigation**

Keep top-level `AI 助手`, `AI 托管与自动化`, `运行与审计`. Inside supervision render only the selected task domain. Keep version history separate from the active editor.

- [x] **Step 4: Normalize controls and action placement**

Use existing Admin components and tokens. Do not introduce a parallel visual theme. Keep dense PC layout, fixed header/actions and independent content scrolling.

- [x] **Step 5: Run the phase gate**

Run:

```powershell
npx vitest run apps/admin/src/admin-supervision-workspace-nav.test.ts
npm run verify:agent-governance-contract
npm run verify:admin-common-components-contract
npm run verify:admin-layout-overlap-fixes
npm run type-check -w @xinghuan/admin
npm run build -w @xinghuan/admin
git diff --check
```

- [x] **Step 6: Record and commit**

Commit with `refactor(admin): focus supervision governance workspaces`.

---

### Task 11: Local Integration, Real Browser And Real Model Acceptance

**Files:**
- Modify all system documents listed in the File Map based on implemented facts.
- Complete: `docs/logbooks/validations/2026-07-25-assistant-supervision-runtime-usability-local.md`.
- Modify relevant Harness verifiers if the new canonical contracts are not already covered.

**Interfaces:**
- Consumes all prior task outputs.
- Produces a local acceptance record and a release-readiness decision without deploying.

- [x] **Step 1: Run the focused combined suite**

Run every focused test and verifier from Tasks 1-10 as one clean sequence. Record exact pass counts and durations.

- [x] **Step 2: Run integration and Harness gates**

Run:

```powershell
npm run test:canvas-run-postgres-integration
npm run test:canvas-run-local-e2e
npm run type-check
npm run build
npm run harness:verify:project
npm run harness:verify:workspace
npm run harness:verify:release
npm run verify:release-governance-contract
git diff --check
```

Use only the authorized isolated test database/Redis required by the existing scripts. Do not point these commands at Production.

- [x] **Step 3: Start the local app and run one PC visual acceptance**

Use `1920x1080` only. Capture:

- direct Admin Agent route with populated model selectors;
- each focused Admin supervision workspace;
- Admin assistant streaming/analysis state and structured blocks;
- Canvas AI Assistant and AI Supervision open together without overlap;
- simplified runtime, plan and event tabs;
- human node identities with no one-character vertical overflow;
- original image nodes showing supervised child task progress and outputs.

- [x] **Step 4: Perform IME and native-selection behavior acceptance**

Use Microsoft IME Pinyin in Canvas and Admin assistant composers. Keep a mouse text selection active across one streaming/status update and record the result.

- [ ] **Step 5: Perform the authorized real image workflow**

Use a real configured image model and actual cost:

```text
text -> image x3 -> smart candidate selector -> downstream image
```

Then run the two-branch convergence case:

```text
text A -> image A x3 -> selector A --\
                                      -> final image
text B -> image B x3 -> selector B --/
```

Evidence must show requested child count, task IDs in the technical record, independent completion, artifact IDs, selector provenance, selected artifact bindings, final output and visible node previews. Keep secrets and full prompts out of the logbook.

- [x] **Step 6: Perform real assistant acceptance**

Attach the real selector diagnostic. Ask once for ordinary help and once for technical detail. Confirm the first response is concise and hides raw IDs, while the second supplies safe code/provenance detail. Repeat a scoped Admin assistant call and confirm `mode=agent` plus visible analysis states.

- [x] **Step 7: Review the complete diff**

Check for transient runtime persistence, raw user-facing IDs, secret leakage, accidental Production references, source hotspot growth, duplicated assistant/runtime components and unrelated formatting churn.

- [x] **Step 8: Complete documentation and local commit**

Update system documents with implemented facts, complete the validation record and commit the integrated batch locally. Do not push or deploy.

- [x] **Step 9: Stop at the release gate**

Report the local commit, behavior evidence, remaining risks and exact Gray deployment plan. Wait for explicit user approval before GitHub push or Gray deployment.

---

## Final Self-review Checklist

- [x] Every requirement P1-P10 maps to at least one task and an acceptance scenario.
- [x] Smart selector tests cover multiple artifacts from one upstream edge with prompt supplied by an upstream text node.
- [x] Provenance validation remains strict and owner-scoped.
- [x] Manual and supervised node rendering use the same runtime card and preview components.
- [x] Multi-generation task state is independently observable and ordered by `batchIndex`.
- [x] Transient Run projections cannot be saved to Canvas topology or workflow templates.
- [x] Every user-facing node reference uses `displayName`; raw IDs remain technical only.
- [x] Assistant and supervision rectangles cannot overlap while both are open.
- [x] Brief assistant answers do not expose raw IDs or parameter dumps by default.
- [x] Admin assistant retains Admin-only context and permission behavior.
- [x] Chinese IME and selection persistence are proven in a real browser.
- [x] Only one `1920x1080` visual acceptance is performed.
- [x] Gray is not deployed and GitHub is not pushed without a later explicit instruction.
- [x] Production is untouched.
