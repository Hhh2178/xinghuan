# ComfyUI Workflow Mapping Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real ComfyUI workflow governance chain where admin uploads a workflow JSON, reviews detected inputs and outputs, saves normalized mapping schema, publishes to shared catalog, and canvas consumers run against the same schema.

**Architecture:** Move workflow parsing and schema normalization into `@xinghuan/shared`, migrate API registry and runtime to consume that shared contract, then rebuild the admin workflow-management UI around detected analysis and editable mapping rows. Keep runtime backward compatible by returning both legacy aggregate media arrays and the new named `outputs` contract until the canvas node fully switches over.

**Tech Stack:** TypeScript, `@xinghuan/shared`, admin React app, web React app, Node HTTP API routes, registry JSON storage, repo contract verification scripts.

---

## File Structure

- Create: `packages/shared/src/comfyui-workflow.ts`
  - Shared parser types, input/output detection, normalization helpers, compatibility migration helpers.
- Modify: `packages/shared/src/index.ts`
  - Export shared ComfyUI parser and types.
- Modify: `apps/api/src/comfyui-workflow-registry.ts`
  - Replace local parser logic with shared parser, add schema migration/normalization on read and write.
- Modify: `apps/api/src/comfyui-instance-routes.ts`
  - Accept new `inputSchema` / `outputSchema` payloads, keep old fields compatible.
- Modify: `apps/api/src/comfyui-execution.ts`
  - Build prompt from normalized input schema, collect outputs by schema, expose named output contract.
- Modify: `apps/api/src/comfyui-public-routes.ts`
  - Return `outputs` in addition to `imageUrls` / `videoUrls` / `audioUrls` / `text`.
- Create: `scripts/verify-comfyui-workflow-parser-contract.mjs`
  - Contract-check shared parser exports and compatibility fields.
- Create: `scripts/verify-comfyui-workflow-runtime-contract.mjs`
  - Contract-check public run route and named outputs.
- Modify: `package.json`
  - Register new verify scripts.
- Modify: `apps/admin/src/admin-types.ts`
  - Add analysis, input schema, output schema, compatibility types.
- Modify: `apps/admin/src/admin-api-client.ts`
  - Send and receive new workflow schema payloads.
- Modify: `apps/admin/src/admin-comfyui-detail.tsx`
  - Replace bare upload section with workflow draft creation + selected workflow workspace shell.
- Replace: `apps/admin/src/admin-comfyui-workflow-card.tsx`
  - Rebuild into mapping-governance editor instead of raw JSON textareas.
- Modify: `apps/admin/src/styles.css`
  - Add aligned workflow-governance layout, parser summary, mapping rows, advanced-mode styling.
- Modify: `apps/web/src/types/canvas.ts`
  - Add named output response types and new schema fields if needed.
- Modify: `apps/web/src/utils/comfyuiApps.ts`
  - Consume new input schema semantics instead of relying only on legacy `exposedFields`.
- Modify: `apps/web/src/components/nodes/ComfyUIApplicationNode.tsx`
  - Consume named outputs and render schema-driven parameter/upstream behavior.
- Modify: `docs/logbooks/daily/2026/2026-07/2026-07-03.md`
  - Record implementation completion once done.

## Task 1: Extract Shared Parser and Compatibility Model

**Files:**
- Create: `packages/shared/src/comfyui-workflow.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `scripts/verify-comfyui-workflow-parser-contract.mjs`
- Modify: `package.json`
- Test: `scripts/verify-comfyui-workflow-parser-contract.mjs`

- [ ] **Step 1: Write the failing parser contract test**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../packages/shared/src/comfyui-workflow.ts", import.meta.url), "utf8");
assert.match(source, /export interface ComfyuiWorkflowAnalysisResult/);
assert.match(source, /export interface ComfyuiWorkflowInputSchemaItem/);
assert.match(source, /export interface ComfyuiWorkflowOutputSchemaItem/);
assert.match(source, /export function analyzeComfyuiWorkflow/);
assert.match(source, /export function buildDefaultComfyuiInputSchema/);
assert.match(source, /export function migrateLegacyComfyuiWorkflowSchema/);
```

- [ ] **Step 2: Run the contract test to verify it fails**

Run: `node scripts/verify-comfyui-workflow-parser-contract.mjs`
Expected: FAIL because `packages/shared/src/comfyui-workflow.ts` does not exist yet.

- [ ] **Step 3: Implement the shared parser module**

```ts
export interface ComfyuiWorkflowAnalysisResult {
  detectedInputs: ComfyuiDetectedInput[];
  detectedOutputs: ComfyuiDetectedOutput[];
  warnings: ComfyuiParserWarning[];
}

export interface ComfyuiWorkflowInputSchemaItem {
  key: string;
  nodeId: string;
  fieldName: string;
  source: string;
  label: string;
  mode: "hidden" | "param" | "upstream";
  kind: "text" | "textarea" | "number" | "boolean" | "image" | "video" | "audio";
  required: boolean;
  defaultValue?: unknown;
  upstreamSlot?: string;
  order: number;
}

export function analyzeComfyuiWorkflow(workflowJson: Record<string, unknown>): ComfyuiWorkflowAnalysisResult {
  // Move and adapt the existing detect/analyze heuristics here.
}

export function buildDefaultComfyuiInputSchema(
  analysis: ComfyuiWorkflowAnalysisResult,
): ComfyuiWorkflowInputSchemaItem[] {
  return analysis.detectedInputs.map((item, index) => ({
    key: item.key,
    nodeId: item.nodeId,
    fieldName: item.fieldName,
    source: item.source,
    label: item.label,
    mode: item.kind === "image" || item.kind === "video" || item.kind === "audio" ? "upstream" : "param",
    kind: item.kind,
    required: item.source === "prompt",
    defaultValue: item.value,
    upstreamSlot: item.kind === "image" ? "image1" : item.kind === "video" ? "video1" : item.kind === "audio" ? "audio1" : undefined,
    order: index,
  }));
}

export function migrateLegacyComfyuiWorkflowSchema(input: {
  workflowJson: Record<string, unknown>;
  exposedFields?: unknown[];
  defaultValues?: Record<string, unknown>;
  hiddenFields?: string[];
  outputSchema?: unknown[];
}) {
  // Build normalized schema from legacy registry rows.
}
```

- [ ] **Step 4: Export the parser from shared index**

```ts
export * from "./comfyui-workflow.js";
```

- [ ] **Step 5: Register the verify script**

```json
{
  "scripts": {
    "verify:comfyui-workflow-parser-contract": "node scripts/verify-comfyui-workflow-parser-contract.mjs"
  }
}
```

- [ ] **Step 6: Run the parser contract test and shared type-check**

Run: `node scripts/verify-comfyui-workflow-parser-contract.mjs`
Expected: PASS

Run: `npm run type-check -w @xinghuan/shared`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/comfyui-workflow.ts packages/shared/src/index.ts scripts/verify-comfyui-workflow-parser-contract.mjs package.json package-lock.json
git commit -m "feat: extract shared comfyui workflow parser"
```

## Task 2: Migrate API Registry and Runtime to the Shared Schema

**Files:**
- Modify: `apps/api/src/comfyui-workflow-registry.ts`
- Modify: `apps/api/src/comfyui-instance-routes.ts`
- Modify: `apps/api/src/comfyui-execution.ts`
- Modify: `apps/api/src/comfyui-public-routes.ts`
- Create: `scripts/verify-comfyui-workflow-runtime-contract.mjs`
- Test: `scripts/verify-comfyui-workflow-runtime-contract.mjs`

- [ ] **Step 1: Write the failing runtime contract test**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const runtime = await readFile(new URL("../apps/api/src/comfyui-public-routes.ts", import.meta.url), "utf8");
assert.match(runtime, /outputs:/, "public route must return named outputs");

const execution = await readFile(new URL("../apps/api/src/comfyui-execution.ts", import.meta.url), "utf8");
assert.match(execution, /inputSchema/, "execution must consume normalized input schema");
assert.match(execution, /buildNamedComfyuiOutputs|collectComfyuiNamedOutputs/, "execution must build named output payloads");
```

- [ ] **Step 2: Run the runtime contract test to verify it fails**

Run: `node scripts/verify-comfyui-workflow-runtime-contract.mjs`
Expected: FAIL because `outputs` and normalized schema support are not present yet.

- [ ] **Step 3: Replace API-local parser logic with shared parser**

```ts
import {
  analyzeComfyuiWorkflow,
  buildDefaultComfyuiInputSchema,
  buildDefaultComfyuiOutputSchema,
  migrateLegacyComfyuiWorkflowSchema,
} from "@xinghuan/shared";

const analysis = analyzeComfyuiWorkflow(workflowJson);
const inputSchema = payload.inputSchema?.length
  ? normalizeInputSchema(payload.inputSchema, workflowJson)
  : buildDefaultComfyuiInputSchema(analysis);
const outputSchema = payload.outputSchema?.length
  ? normalizeOutputSchema(payload.outputSchema)
  : buildDefaultComfyuiOutputSchema(analysis);
```

- [ ] **Step 4: Keep registry read compatibility with historical rows**

```ts
const migrated = migrateLegacyComfyuiWorkflowSchema({
  workflowJson,
  exposedFields: payload.exposedFields,
  defaultValues: payload.defaultValues,
  hiddenFields: payload.hiddenFields,
  outputSchema: payload.outputSchema,
});
```

- [ ] **Step 5: Update execution prompt builder to consume input schema**

```ts
for (const field of input.inputSchema || []) {
  if (field.mode === "hidden") continue;
  const value = resolveSchemaValue(field, userParams, defaultValues, mediaInputs);
  writeWorkflowField(workflowJson, field.nodeId, field.fieldName, value);
}
```

- [ ] **Step 6: Add named output collection to runtime response**

```ts
const outputs = workflow.outputSchema
  .filter((item) => item.enabled !== false)
  .map((item) => ({
    key: item.key,
    label: item.label,
    kind: item.kind,
    value: resolveOutputValue(item, { imageUrls, videoUrls, audioUrls, text }),
  }));

deps.sendT8(response, {
  workflowId: workflow.id,
  sharedWorkflowId: workflow.sharedWorkflowId || workflow.id,
  outputs,
  imageUrls,
  videoUrls,
  audioUrls,
  text,
});
```

- [ ] **Step 7: Run runtime contract, API type-check, and parser contract**

Run: `node scripts/verify-comfyui-workflow-runtime-contract.mjs`
Expected: PASS

Run: `npm run type-check -w @xinghuan/api`
Expected: PASS

Run: `npm run verify:comfyui-workflow-parser-contract`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/comfyui-workflow-registry.ts apps/api/src/comfyui-instance-routes.ts apps/api/src/comfyui-execution.ts apps/api/src/comfyui-public-routes.ts scripts/verify-comfyui-workflow-runtime-contract.mjs package.json package-lock.json
git commit -m "feat: unify comfyui workflow runtime schema"
```

## Task 3: Rebuild the Admin Workflow Governance UI

**Files:**
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/admin-api-client.ts`
- Modify: `apps/admin/src/admin-comfyui-detail.tsx`
- Replace: `apps/admin/src/admin-comfyui-workflow-card.tsx`
- Modify: `apps/admin/src/styles.css`
- Test: `npm run type-check -w @xinghuan/admin`

- [ ] **Step 1: Add admin types for analysis and normalized schema**

```ts
export interface ComfyuiWorkflowAnalysisResult {
  detectedInputs: ComfyuiDetectedInput[];
  detectedOutputs: ComfyuiDetectedOutput[];
  warnings: string[];
}

export interface ComfyuiWorkflowInputSchemaItem {
  key: string;
  nodeId: string;
  fieldName: string;
  label: string;
  mode: "hidden" | "param" | "upstream";
  kind: "text" | "textarea" | "number" | "boolean" | "image" | "video" | "audio";
  required: boolean;
  defaultValue?: unknown;
  order: number;
}
```

- [ ] **Step 2: Update admin API client payloads**

```ts
createWorkflow(instanceId, {
  title,
  workflowJson,
});

updateWorkflow(instanceId, workflowId, {
  title,
  description,
  inputSchema,
  defaultValues,
  outputSchema,
});
```

- [ ] **Step 3: Replace raw JSON card editing with row-based governance editor**

```tsx
<section className="admin-comfyui-workflow-governance">
  <ParserSummaryCard analysis={workflow.analysis} />
  <InputMappingEditor
    rows={draftInputSchema}
    onChange={setDraftInputSchema}
  />
  <OutputMappingEditor
    rows={draftOutputSchema}
    onChange={setDraftOutputSchema}
  />
  <details>
    <summary>高级 JSON</summary>
    <textarea value={workflowJsonText} />
  </details>
</section>
```

- [ ] **Step 4: Rework the workflow creation area to explain the next step**

```tsx
<div className="admin-comfyui-create-workflow-panel__guide">
  <strong>上传后系统会自动解析输入、输出和告警。</strong>
  <span>创建草稿后，请在下方确认哪些字段是画布参数、哪些是上游输入口、哪些输出需要发布。</span>
</div>
```

- [ ] **Step 5: Add aligned layout and mapping row styling**

```css
.admin-comfyui-mapping-row {
  display: grid;
  grid-template-columns: minmax(220px, 1.6fr) 110px 120px 120px minmax(160px, 1fr) 120px;
  gap: 12px;
  align-items: center;
}

.admin-comfyui-parser-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
```

- [ ] **Step 6: Type-check the admin app**

Run: `npm run type-check -w @xinghuan/admin`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/admin-types.ts apps/admin/src/admin-api-client.ts apps/admin/src/admin-comfyui-detail.tsx apps/admin/src/admin-comfyui-workflow-card.tsx apps/admin/src/styles.css
git commit -m "feat: rebuild comfyui workflow governance editor"
```

## Task 4: Upgrade Canvas Consumption to the Shared Workflow Schema

**Files:**
- Modify: `apps/web/src/types/canvas.ts`
- Modify: `apps/web/src/utils/comfyuiApps.ts`
- Modify: `apps/web/src/components/nodes/ComfyUIApplicationNode.tsx`
- Test: `npm run type-check -w @xinghuan/web`

- [ ] **Step 1: Add canvas-side types for named outputs and normalized input schema**

```ts
export interface ComfyuiRunOutput {
  key: string;
  label: string;
  kind: "text" | "image" | "video" | "audio";
  value: unknown;
}
```

- [ ] **Step 2: Build node params only from schema items with `mode = "param"`**

```ts
const userParams = workflow.inputSchema
  .filter((field) => field.mode === "param")
  .map((field) => schemaFieldToUserParam(field));
```

- [ ] **Step 3: Build upstream material requirements from schema items with `mode = "upstream"`**

```ts
const upstreamInputs = workflow.inputSchema.filter((field) => field.mode === "upstream");
const req = deriveComfyInputRequirements(upstreamInputs);
```

- [ ] **Step 4: Prefer named outputs in the node runtime**

```tsx
const namedOutputs = Array.isArray(d.outputs) ? d.outputs : [];
const outputImages = namedOutputs.filter((item) => item.kind === "image");
const outputVideos = namedOutputs.filter((item) => item.kind === "video");
const outputAudios = namedOutputs.filter((item) => item.kind === "audio");
const outputTexts = namedOutputs.filter((item) => item.kind === "text");
```

- [ ] **Step 5: Keep legacy fallback while switching**

```ts
const outputImages = namedImageUrls.length
  ? namedImageUrls
  : Array.isArray(d.imageUrls) ? d.imageUrls : [];
```

- [ ] **Step 6: Type-check the web app**

Run: `npm run type-check -w @xinghuan/web`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/types/canvas.ts apps/web/src/utils/comfyuiApps.ts apps/web/src/components/nodes/ComfyUIApplicationNode.tsx
git commit -m "feat: consume comfyui workflow schema on canvas"
```

## Task 5: Verification, Doc Sync, and Release Closure

**Files:**
- Modify: `docs/logbooks/daily/2026/2026-07/2026-07-03.md`
- Modify if needed: `docs/logbooks/releases/current-release-index.md`
- Modify if needed: `ops/README.md`
- Modify if needed: `ops/current/gray.md`

- [ ] **Step 1: Sync CodeGraph after source changes**

Run: `codegraph sync`
Expected: sync completes with modified files indexed.

- [ ] **Step 2: Run the ComfyUI parser and runtime verification scripts**

Run: `npm run verify:comfyui-workflow-parser-contract`
Expected: PASS

Run: `node scripts/verify-comfyui-workflow-runtime-contract.mjs`
Expected: PASS

- [ ] **Step 3: Run focused workspace type-checks**

Run: `npm run type-check -w @xinghuan/shared`
Expected: PASS

Run: `npm run type-check -w @xinghuan/api`
Expected: PASS

Run: `npm run type-check -w @xinghuan/admin`
Expected: PASS

Run: `npm run type-check -w @xinghuan/web`
Expected: PASS

- [ ] **Step 4: Run repo governance verification**

Run: `npm run verify:current-release-entry-consistency`
Expected: PASS

- [ ] **Step 5: Update the daily log with implementation and verification evidence**

```md
## ComfyUI 工作流映射治理收口

- 新增 shared parser，统一后台与画布分析口径
- 后台工作流管理改为解析摘要 + 输入映射 + 输出映射
- public run 返回 named outputs
- 共享 ComfyUI 节点开始消费正式 schema
```

- [ ] **Step 6: Review worktree cleanliness**

Run: `git status --short`
Expected: only intended files remain; before final ship this should become empty or be explained by the batch.

- [ ] **Step 7: Commit docs and closure**

```bash
git add docs/logbooks/daily/2026/2026-07/2026-07-03.md docs/logbooks/releases/current-release-index.md ops/README.md ops/current/gray.md
git commit -m "docs: record comfyui workflow governance rollout"
```

## Spec Coverage Check

- Shared parser unification: Task 1
- Registry compatibility and runtime contract: Task 2
- Admin workflow governance UI: Task 3
- Canvas shared workflow consumption: Task 4
- Verification and doc closure: Task 5

No spec section is intentionally left without a task.
