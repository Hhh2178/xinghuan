# ComfyUI Unified Node And Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild ComfyUI into one backend-governed, front-end-consumed `comfyui` node, remove the three legacy ComfyUI nodes, and make workflow parameter governance schema-first and maintainable.

**Architecture:** Fix the shared-workflow run id contract first, then harden backend workflow normalization so `analysis / inputSchema / outputSchema / defaultValues` become the only formal contract. After that, rebuild the canvas node around RH-style structure, migrate old canvas data to the new `comfyui` node type, and remove legacy ComfyUI storefront/maker paths from the registry and canvas boot defaults.

**Tech Stack:** TypeScript, React 19, Vite, `@xyflow/react`, Node ESM route handlers, monorepo workspace scripts, contract-style verify scripts.

---

## File Structure

### Backend / shared governance

- Modify: `packages/shared/src/comfyui-workflow.ts`
  - Keep shared parser/types as the only public schema contract.
- Modify: `packages/shared/src/index.ts`
  - Re-export any newly exposed ComfyUI schema helpers.
- Create: `apps/api/src/comfyui-workflow-normalizer.ts`
  - Normalize legacy workflow drafts into stable `inputSchema / outputSchema / defaultValues`.
- Modify: `apps/api/src/comfyui-workflow-registry.ts`
  - Centralize legacy-read compatibility and shared workflow id handling.
- Modify: `apps/api/src/comfyui-public-routes.ts`
  - Run only by canonical shared workflow id and return structured named outputs.

### Admin governance UI

- Modify: `apps/admin/src/admin-comfyui-detail.tsx`
  - Keep instance shell, move workflow governance orchestration here.
- Modify: `apps/admin/src/admin-comfyui-workflow-card.tsx`
  - Turn mapping editor into maintainable schema editor instead of JSON-patch workflow.
- Modify: `apps/admin/src/admin-types.ts`
  - Keep admin DTOs aligned to the final schema contract.
- Modify: `apps/admin/src/styles.css`
  - Align workflow governance sections and table rhythm with the updated structure.

### Frontend unified node

- Create: `apps/web/src/components/nodes/ComfyUINode.tsx`
  - Single front-end ComfyUI node implementation.
- Create: `apps/web/src/components/nodes/ComfyUINodeCatalogSection.tsx`
  - Shared workflow picker view.
- Create: `apps/web/src/components/nodes/ComfyUINodeParamSection.tsx`
  - Schema-driven parameter section.
- Create: `apps/web/src/components/nodes/comfyuiNodeHelpers.ts`
  - Shared helper functions for schema display and run payload shaping.
- Modify: `apps/web/src/services/comfyuiApps.ts`
  - Submit canonical shared workflow id only.
- Modify: `apps/web/src/types/canvas.ts`
  - Add final `comfyui` node type and DTO fields.
- Modify: `apps/web/src/components/Canvas.tsx`
  - Register only the new `comfyui` node, remove old defaults.
- Modify: `apps/web/src/config/nodeRegistry.ts`
  - Expose one visible node named `comfyui`.
- Modify: `apps/web/src/utils/nodePlacement.ts`
  - Add default size for the new `comfyui` node and remove legacy ComfyUI sizes.
- Modify: `apps/web/src/utils/nodeMigration.ts`
  - Migrate old `comfyui-app`, `comfyui-store`, `comfyui-app-maker` nodes into the new model or a visible deprecated fallback.

### Verification

- Create: `scripts/verify-comfyui-run-workflow-id-contract.mjs`
- Create: `scripts/verify-comfyui-unified-node-contract.mjs`
- Create: `scripts/verify-comfyui-legacy-node-migration-contract.mjs`
- Modify: `scripts/verify-admin-comfyui-governance-contract.mjs`
- Modify: `scripts/verify-comfyui-canvas-schema-contract.mjs`
- Modify: `package.json`
  - Wire new verify commands into existing comfyui verification flow.

---

### Task 1: Lock the shared workflow id contract and reproduce the failing path

**Files:**
- Create: `scripts/verify-comfyui-run-workflow-id-contract.mjs`
- Modify: `apps/web/src/services/comfyuiApps.ts`
- Modify: `apps/web/src/components/nodes/ComfyUIApplicationNode.tsx`
- Modify: `apps/api/src/comfyui-public-routes.ts`

- [ ] **Step 1: Write the failing contract test**

```js
// scripts/verify-comfyui-run-workflow-id-contract.mjs
import { readFile } from "node:fs/promises";

const service = await readFile(new URL("../apps/web/src/services/comfyuiApps.ts", import.meta.url), "utf8");
const node = await readFile(new URL("../apps/web/src/components/nodes/ComfyUIApplicationNode.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../apps/api/src/comfyui-public-routes.ts", import.meta.url), "utf8");

if (!service.includes("/api/comfyui/apps/${encodeURIComponent(app.id)}/run")) {
  throw new Error("Expected current frontend service to submit app.id before refactor");
}

if (!node.includes("entry.workflow.id === activeWorkflowId") || !node.includes("entry.app.id === activeWorkflowId")) {
  throw new Error("Expected current node to mix workflow.id/sharedWorkflowId/app.id before refactor");
}

if (!route.includes('item.id === workflowRef || item.sharedWorkflowId === workflowRef')) {
  throw new Error("Expected backend route to match canonical workflow ids");
}

console.log(JSON.stringify({ ok: true, stage: "red", problem: "frontend-id-mismatch-reproduced" }, null, 2));
```

- [ ] **Step 2: Run the red test to verify the mismatch is real**

Run: `node scripts/verify-comfyui-run-workflow-id-contract.mjs`  
Expected: PASS in red stage and print `frontend-id-mismatch-reproduced`

- [ ] **Step 3: Replace the run payload contract with a canonical shared workflow id**

```ts
// apps/web/src/services/comfyuiApps.ts
export interface RunComfyuiAppOptions {
  sharedWorkflowId: string;
  instanceId?: string;
  userParams?: Record<string, any>;
  inputs?: {
    texts?: string[];
    images?: string[];
    videos?: string[];
    audios?: string[];
  };
}

const response = await fetch(`/api/comfyui/apps/${encodeURIComponent(options.sharedWorkflowId)}/run`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "same-origin",
  body: JSON.stringify({
    instanceId: options.instanceId,
    userParams,
    inputs,
  }),
});
```

- [ ] **Step 4: Make the node save and run only canonical shared workflow ids**

```ts
// apps/web/src/components/nodes/ComfyUIApplicationNode.tsx
const activeWorkflowId = String(d.sharedWorkflowId || "");

const activeEntry = entries.find((entry) => entry.workflow.sharedWorkflowId === activeWorkflowId) || null;

const selectEntry = (entry: CatalogEntry) => update({
  sharedWorkflowId: entry.workflow.sharedWorkflowId || entry.workflow.id,
  comfyuiAppInstanceId: entry.workflow.instanceId,
  comfyuiAppParamValues: defaultComfyAppParamValues(entry.app),
  comfyuiAppSelectedOutputKey: entry.app.outputs[0]?.key || "",
  status: "idle",
  error: "",
});
```

- [ ] **Step 5: Make backend route reject non-canonical refs explicitly**

```ts
// apps/api/src/comfyui-public-routes.ts
const workflow = state.sharedWorkflows.find((item) => item.sharedWorkflowId === workflowRef || item.id === workflowRef);
if (!workflow) {
  sendComfyuiPublicError(response, 404, "COMFYUI_WORKFLOW_NOT_FOUND");
  return true;
}
```

- [ ] **Step 6: Re-run the contract test in green form**

Update the test to assert:

```js
if (!service.includes("sharedWorkflowId")) throw new Error("sharedWorkflowId missing from service contract");
if (service.includes("app.id)}/run")) throw new Error("legacy app.id run path still present");
if (node.includes("entry.app.id === activeWorkflowId")) throw new Error("legacy app.id selection still present");
```

Run: `node scripts/verify-comfyui-run-workflow-id-contract.mjs`  
Expected: PASS with no legacy-id-mix assertions firing

- [ ] **Step 7: Commit**

```bash
git add scripts/verify-comfyui-run-workflow-id-contract.mjs apps/web/src/services/comfyuiApps.ts apps/web/src/components/nodes/ComfyUIApplicationNode.tsx apps/api/src/comfyui-public-routes.ts
git commit -m "fix: align comfyui shared workflow run ids"
```

### Task 2: Make backend workflow governance schema-first and maintainable

**Files:**
- Create: `apps/api/src/comfyui-workflow-normalizer.ts`
- Modify: `apps/api/src/comfyui-workflow-registry.ts`
- Modify: `packages/shared/src/comfyui-workflow.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `scripts/verify-comfyui-workflow-parser-contract.mjs`

- [ ] **Step 1: Write the failing normalization contract**

```js
// add to scripts/verify-comfyui-workflow-parser-contract.mjs
if (!sharedSource.includes("ComfyuiWorkflowInputSchemaItem")) {
  throw new Error("shared schema types must stay exported");
}

const normalizer = await readFile(new URL("../apps/api/src/comfyui-workflow-normalizer.ts", import.meta.url), "utf8").catch(() => "");
if (normalizer) {
  throw new Error("normalizer file should not exist before this task");
}
```

- [ ] **Step 2: Run the failing parser contract**

Run: `npm run verify:comfyui-workflow-parser-contract`  
Expected: FAIL because `apps/api/src/comfyui-workflow-normalizer.ts` does not exist yet

- [ ] **Step 3: Add the normalizer layer**

```ts
// apps/api/src/comfyui-workflow-normalizer.ts
import type { ComfyuiWorkflowDraft } from "./comfyui-workflow-registry.js";
import {
  buildDefaultComfyuiInputSchema,
  buildDefaultComfyuiOutputSchema,
  migrateLegacyComfyuiWorkflowSchema,
} from "@xinghuan/shared";

export function normalizeComfyuiWorkflowDraft(draft: ComfyuiWorkflowDraft): ComfyuiWorkflowDraft {
  const migrated = migrateLegacyComfyuiWorkflowSchema({
    workflowJson: draft.workflowJson,
    exposedFields: draft.exposedFields,
    hiddenFields: draft.hiddenFields,
    defaultValues: draft.defaultValues,
    outputSchema: draft.outputSchema,
    inputSchema: draft.inputSchema,
  });

  return {
    ...draft,
    analysis: draft.analysis,
    inputSchema: migrated.inputSchema.length ? migrated.inputSchema : buildDefaultComfyuiInputSchema(migrated.exposedFields, migrated.defaultValues),
    outputSchema: migrated.outputSchema.length ? migrated.outputSchema : buildDefaultComfyuiOutputSchema(migrated.detectedOutputs),
    defaultValues: migrated.defaultValues,
  };
}
```

- [ ] **Step 4: Route all registry reads/writes through the normalizer**

```ts
// apps/api/src/comfyui-workflow-registry.ts
import { normalizeComfyuiWorkflowDraft } from "./comfyui-workflow-normalizer.js";

const workflows = raw.workflows.map((item) => normalizeComfyuiWorkflowDraft(normalizeWorkflow(item)));
const sharedWorkflows = raw.sharedWorkflows.map((item) => normalizeComfyuiWorkflowDraft(normalizeWorkflow(item)));
```

- [ ] **Step 5: Keep shared package exports as the only formal schema API**

```ts
// packages/shared/src/index.ts
export * from "./comfyui-workflow.js";
```

- [ ] **Step 6: Re-run parser and execution helper verification**

Run:
- `npm run verify:comfyui-workflow-parser-contract`
- `npm run verify:comfyui-execution-helpers`
- `npm run type-check -w @xinghuan/shared`
- `npm run type-check -w @xinghuan/api`

Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/comfyui-workflow-normalizer.ts apps/api/src/comfyui-workflow-registry.ts packages/shared/src/comfyui-workflow.ts packages/shared/src/index.ts scripts/verify-comfyui-workflow-parser-contract.mjs
git commit -m "refactor: normalize comfyui workflow governance schema"
```

### Task 3: Rebuild admin workflow governance around maintainable schema rows

**Files:**
- Modify: `apps/admin/src/admin-comfyui-workflow-card.tsx`
- Modify: `apps/admin/src/admin-comfyui-detail.tsx`
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/styles.css`
- Test: `scripts/verify-admin-comfyui-governance-contract.mjs`

- [ ] **Step 1: Write the failing admin governance contract**

```js
// scripts/verify-admin-comfyui-governance-contract.mjs
if (!detail.includes("工作流治理")) throw new Error("workflow governance tab missing");
if (!card.includes("mode === \"upstream\"") || !card.includes("mode === \"hidden\"")) {
  throw new Error("schema-mode editor must expose param/upstream/hidden controls");
}
if (!card.includes("defaultValuesFromSchema")) {
  throw new Error("admin card must derive defaults from schema instead of patching raw JSON");
}
```

- [ ] **Step 2: Run the admin governance contract**

Run: `npm run verify:admin-comfyui-governance-contract`  
Expected: FAIL until the new maintainability assertions are satisfied

- [ ] **Step 3: Remove patch-style editing from the workflow card**

```ts
// apps/admin/src/admin-comfyui-workflow-card.tsx
const nextInputSchema = cloneRows(draftInputSchema)
  .map((item, index) => ({
    ...item,
    label: item.label.trim() || item.fieldName,
    upstreamSlot: item.mode === "upstream" ? (item.upstreamSlot || item.source || "").trim() || undefined : undefined,
    order: Number.isFinite(Number(item.order)) ? Math.max(0, Math.floor(Number(item.order))) : index,
  }))
  .sort((a, b) => a.order - b.order);

const payload: ComfyuiWorkflowEditPayload = {
  title: title.trim() || workflow.title,
  description: description.trim(),
  workflowJson: parseWorkflowJson(workflowJsonText, workflow.workflowJson),
  inputSchema: nextInputSchema,
  defaultValues: defaultValuesFromSchema(nextInputSchema),
  outputSchema: nextOutputSchema,
};
```

- [ ] **Step 4: Make admin DTO naming match the final schema contract**

```ts
// apps/admin/src/admin-types.ts
export interface ComfyuiWorkflowDraft {
  id: string;
  instanceId: string;
  title: string;
  workflowJson: Record<string, unknown>;
  analysis: ComfyuiWorkflowAnalysisResult;
  inputSchema: ComfyuiWorkflowInputSchemaItem[];
  defaultValues: Record<string, unknown>;
  outputSchema: ComfyuiWorkflowOutputSchemaItem[];
  sharedWorkflowId?: string;
}
```

- [ ] **Step 5: Tighten the workflow-governance layout rhythm**

```css
/* apps/admin/src/styles.css */
.admin-comfyui-mapping-row {
  display: grid;
  grid-template-columns: 2.2fr 1.2fr 1fr 0.9fr 1.4fr 0.7fr 0.5fr;
  gap: 12px;
  align-items: start;
}

.admin-comfyui-source-cell__copy strong {
  display: block;
  line-height: 1.2;
}
```

- [ ] **Step 6: Re-run admin verification**

Run:
- `npm run verify:admin-comfyui-governance-contract`
- `npm run type-check -w @xinghuan/admin`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/admin-comfyui-workflow-card.tsx apps/admin/src/admin-comfyui-detail.tsx apps/admin/src/admin-types.ts apps/admin/src/styles.css scripts/verify-admin-comfyui-governance-contract.mjs
git commit -m "feat: harden comfyui admin governance editor"
```

### Task 4: Build the single front-end `comfyui` node with RH-like structure

**Files:**
- Create: `apps/web/src/components/nodes/ComfyUINode.tsx`
- Create: `apps/web/src/components/nodes/ComfyUINodeCatalogSection.tsx`
- Create: `apps/web/src/components/nodes/ComfyUINodeParamSection.tsx`
- Create: `apps/web/src/components/nodes/comfyuiNodeHelpers.ts`
- Modify: `apps/web/src/types/canvas.ts`
- Test: `scripts/verify-comfyui-canvas-schema-contract.mjs`
- Test: `scripts/verify-comfyui-unified-node-contract.mjs`

- [ ] **Step 1: Write the failing unified node contract**

```js
// scripts/verify-comfyui-unified-node-contract.mjs
import { readFile } from "node:fs/promises";

const registry = await readFile(new URL("../apps/web/src/config/nodeRegistry.ts", import.meta.url), "utf8");
const canvas = await readFile(new URL("../apps/web/src/components/Canvas.tsx", import.meta.url), "utf8");
const node = await readFile(new URL("../apps/web/src/components/nodes/ComfyUINode.tsx", import.meta.url), "utf8").catch(() => "");

if (!node) throw new Error("ComfyUINode.tsx must exist");
if (!registry.includes("label: 'comfyui'")) throw new Error("visible node label must be comfyui");
if (!canvas.includes("'comfyui': ComfyUINode")) throw new Error("Canvas must register unified comfyui node");
```

- [ ] **Step 2: Run the failing unified-node contract**

Run: `node scripts/verify-comfyui-unified-node-contract.mjs`  
Expected: FAIL because `ComfyUINode.tsx` does not exist yet

- [ ] **Step 3: Build the RH-shaped node shell**

```tsx
// apps/web/src/components/nodes/ComfyUINode.tsx
export default function ComfyUINode({ id, data, selected }: NodeProps) {
  return (
    <div className="relative flex flex-col nowheel" style={rootStyle}>
      <Handle type="target" position={Position.Left} style={{ ...handleStyle, background: PORT_COLOR.image, left: -6 }} />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle, background: PORT_COLOR.image, right: -6 }} />
      <ComfyUINodeCatalogSection ... />
      <MaterialPreviewSection ... title="通用输入 · 拖拽可调整顺序" />
      <ComfyUINodeParamSection ... />
      <NodeRuntimeCard ... />
    </div>
  );
}
```

- [ ] **Step 4: Make the visible node type and label final**

```ts
// apps/web/src/types/canvas.ts
export type NodeType = /* ... */ | "comfyui";

// apps/web/src/config/nodeRegistry.ts
{ type: "comfyui", label: "comfyui", category: "comfyui", description: "后台共享 ComfyUI 工作流统一消费节点", icon: "Workflow", color: "cyan" }
```

- [ ] **Step 5: Make the schema section consume only `mode = param`**

```tsx
// apps/web/src/components/nodes/ComfyUINodeParamSection.tsx
const visibleParams = app.inputSchema?.filter((field) => field.mode === "param") || [];
```

- [ ] **Step 6: Re-run canvas contracts and web type-check**

Run:
- `npm run verify:comfyui-canvas-schema-contract`
- `node scripts/verify-comfyui-unified-node-contract.mjs`
- `npm run type-check -w @xinghuan/web`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/nodes/ComfyUINode.tsx apps/web/src/components/nodes/ComfyUINodeCatalogSection.tsx apps/web/src/components/nodes/ComfyUINodeParamSection.tsx apps/web/src/components/nodes/comfyuiNodeHelpers.ts apps/web/src/types/canvas.ts apps/web/src/config/nodeRegistry.ts scripts/verify-comfyui-unified-node-contract.mjs scripts/verify-comfyui-canvas-schema-contract.mjs
git commit -m "feat: build unified comfyui canvas node"
```

### Task 5: Remove legacy nodes and migrate existing canvas data

**Files:**
- Modify: `apps/web/src/utils/nodeMigration.ts`
- Modify: `apps/web/src/components/Canvas.tsx`
- Modify: `apps/web/src/utils/nodePlacement.ts`
- Delete: `apps/web/src/components/nodes/ComfyUIStoreNode.tsx`
- Delete: `apps/web/src/components/nodes/ComfyUIAppMakerNode.tsx`
- Delete: `apps/web/src/components/nodes/ComfyUIApplicationNode.tsx`
- Test: `scripts/verify-comfyui-legacy-node-migration-contract.mjs`

- [ ] **Step 1: Write the failing legacy migration contract**

```js
// scripts/verify-comfyui-legacy-node-migration-contract.mjs
const migration = await readFile(new URL("../apps/web/src/utils/nodeMigration.ts", import.meta.url), "utf8");
if (!migration.includes("legacyComfyuiNodeTypes")) {
  throw new Error("legacy ComfyUI node migration map missing");
}
if (!migration.includes("type: \"comfyui\"")) {
  throw new Error("legacy ComfyUI nodes must migrate into unified comfyui type");
}
```

- [ ] **Step 2: Run the failing migration contract**

Run: `node scripts/verify-comfyui-legacy-node-migration-contract.mjs`  
Expected: FAIL before migration code exists

- [ ] **Step 3: Add explicit legacy migration logic**

```ts
// apps/web/src/utils/nodeMigration.ts
const legacyComfyuiNodeTypes = new Set(["comfyui-app", "comfyui-store", "comfyui-app-maker"]);

function migrateLegacyComfyuiNode(node: Node): Node {
  if (!legacyComfyuiNodeTypes.has(String(node.type || ""))) return node;
  return {
    ...node,
    type: "comfyui",
    data: {
      sharedWorkflowId: String((node.data as any)?.sharedWorkflowId || (node.data as any)?.comfyuiAppWorkflowId || ""),
      comfyuiAppInstanceId: String((node.data as any)?.comfyuiAppInstanceId || ""),
      comfyuiAppParamValues: (node.data as any)?.comfyuiAppParamValues || (node.data as any)?.comfyuiStoreParamValues || {},
      migrationNotice: "该节点已从旧 ComfyUI 节点自动迁移",
    },
  };
}
```

- [ ] **Step 4: Remove legacy registrations and defaults**

```ts
// apps/web/src/components/Canvas.tsx
const nodeComponents = {
  // ...
  "comfyui": ComfyUINode,
};

const DEFAULT_NODE_DATA = {
  // ...
  "comfyui": {
    sharedWorkflowId: "",
    comfyuiAppInstanceId: "",
    comfyuiAppSearchQuery: "",
    comfyuiAppParamValues: {},
    materialOrder: [],
    excludedMaterialIds: [],
    status: "idle",
    taskId: "",
    imageUrl: "",
    imageUrls: [],
    videoUrls: [],
    audioUrls: [],
    outputText: "",
    error: "",
  },
};
```

- [ ] **Step 5: Remove legacy placement sizes and add the final one**

```ts
// apps/web/src/utils/nodePlacement.ts
"comfyui": { w: 420, h: 620 },
```

- [ ] **Step 6: Re-run migration and render verification**

Run:
- `node scripts/verify-comfyui-legacy-node-migration-contract.mjs`
- `npm run verify:canvas-node-render-smoke`
- `npm run type-check -w @xinghuan/web`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/utils/nodeMigration.ts apps/web/src/components/Canvas.tsx apps/web/src/utils/nodePlacement.ts scripts/verify-comfyui-legacy-node-migration-contract.mjs
git rm apps/web/src/components/nodes/ComfyUIStoreNode.tsx
git rm apps/web/src/components/nodes/ComfyUIAppMakerNode.tsx
git rm apps/web/src/components/nodes/ComfyUIApplicationNode.tsx
git commit -m "refactor: remove legacy comfyui nodes"
```

### Task 6: Final verification, doc sync, and gray-ready closure

**Files:**
- Modify: `package.json`
- Modify: `docs/logbooks/daily/2026/2026-07/2026-07-03.md`
- Modify: `docs/logbooks/releases/current-release-index.md` (only if release docs need new status wording after implementation)
- Test: `scripts/verify-comfyui-unified-node-contract.mjs`
- Test: `scripts/verify-comfyui-legacy-node-migration-contract.mjs`

- [ ] **Step 1: Wire the new verify scripts into comfyui verification flow**

```json
// package.json
{
  "scripts": {
    "verify:comfyui-run-workflow-id-contract": "node scripts/verify-comfyui-run-workflow-id-contract.mjs",
    "verify:comfyui-unified-node-contract": "node scripts/verify-comfyui-unified-node-contract.mjs",
    "verify:comfyui-legacy-node-migration-contract": "node scripts/verify-comfyui-legacy-node-migration-contract.mjs",
    "harness:verify:comfyui": "npm run verify:comfyui-connector-harness && npm run verify:comfyui-execution-helpers && npm run verify:comfyui-run-workflow-id-contract && npm run verify:comfyui-unified-node-contract && npm run verify:comfyui-legacy-node-migration-contract && node scripts/verify-comfyui-instance-pool-contract.mjs"
  }
}
```

- [ ] **Step 2: Record the implementation closure in daily log**

```md
## ComfyUI 统一节点与治理收口

目标:
- 前台只保留一个 `comfyui` 节点
- 后台参数治理改为 schema-first
- 修复共享工作流运行 id 错位

验证:
- npm run verify:comfyui-run-workflow-id-contract
- npm run verify:comfyui-unified-node-contract
- npm run verify:comfyui-legacy-node-migration-contract
- npm run verify:admin-comfyui-governance-contract
- npm run verify:comfyui-canvas-schema-contract
- npm run type-check -w @xinghuan/api
- npm run type-check -w @xinghuan/admin
- npm run type-check -w @xinghuan/web
```

- [ ] **Step 3: Run the full focused verification batch**

Run:
- `npm run verify:comfyui-run-workflow-id-contract`
- `npm run verify:admin-comfyui-governance-contract`
- `npm run verify:comfyui-canvas-schema-contract`
- `npm run verify:comfyui-unified-node-contract`
- `npm run verify:comfyui-legacy-node-migration-contract`
- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/admin`
- `npm run type-check -w @xinghuan/web`
- `npm run codegraph:sync`

Expected: all pass

- [ ] **Step 4: Check worktree closure**

Run:
- `git status --short`
- `git diff --stat`

Expected: only intended ComfyUI unification changes remain

- [ ] **Step 5: Commit**

```bash
git add package.json docs/logbooks/daily/2026/2026-07/2026-07-03.md scripts/verify-comfyui-run-workflow-id-contract.mjs scripts/verify-comfyui-unified-node-contract.mjs scripts/verify-comfyui-legacy-node-migration-contract.mjs
git commit -m "docs: record comfyui unified node rollout"
```

---

## Self-Review

- Spec coverage:
  - Shared workflow id bug: Task 1
  - Backend maintainable schema governance: Task 2 and Task 3
  - Single front-end node named `comfyui`: Task 4
  - Legacy node removal and migration: Task 5
  - Verification and closure: Task 6
- Placeholder scan:
  - No `TODO`, `TBD`, or “similar to above” references remain
- Type consistency:
  - Final visible node type is `comfyui`
  - Final run identifier is `sharedWorkflowId`
  - Final backend contract is `analysis / inputSchema / outputSchema / defaultValues`
