# RunningHub Workspace And Single Node Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first shippable RunningHub refactor slice: normalized RH catalog items on the backend, a dedicated RH admin workspace, and a single dynamic RH node contract on the canvas without breaking existing RH presets.

**Architecture:** Keep `runninghub` as a Provider protocol, add a normalized RH catalog layer on top of the existing `rhApps/rhWorkflows` storage, expose admin and public RH item APIs, then switch the canvas RH node to consume the normalized schema while preserving legacy preset compatibility. Deliver the admin workspace as a dedicated RH page linked from the Provider settings screen, not as a standalone top-level system.

**Tech Stack:** TypeScript, React, Vite, Node HTTP server, existing admin/web monorepo patterns, CodeGraph, static contract scripts under `scripts/`

---

## File Structure

### Backend / shared

- Modify: `apps/api/src/server.ts`
  - Add RH normalized item types, admin RH routes, public RH item detail route, and compatibility transforms from legacy `rhApps/rhWorkflows`.
- Create: `apps/api/src/runninghub-catalog.ts`
  - Normalize legacy RH entries into a stable RH catalog item shape and expose mapping helpers.
- Create: `apps/api/src/runninghub-execution-descriptor.ts`
  - Hold RH execution descriptor defaults and validation helpers for admin input.
- Modify: `packages/shared/src/index.ts`
  - Re-export RH workspace types for admin/web use.
- Create: `packages/shared/src/runninghub.ts`
  - Shared RH item, input slot, output schema, and execution descriptor types.

### Admin

- Modify: `apps/admin/src/admin-types.ts`
  - Add RH normalized item types and admin request/response shapes.
- Modify: `apps/admin/src/admin-api-client.ts`
  - Add RH admin workspace fetch/save/test methods.
- Modify: `apps/admin/src/main.tsx`
  - Register RH workspace route / page entry.
- Modify: `apps/admin/src/admin-api-settings-panel.tsx`
  - Replace inline RH JSON editors with summary and “进入 RH 工作台” entry.
- Create: `apps/admin/src/admin-runninghub-workspace.tsx`
  - RH workspace shell with tabs, list, detail editor, and test area.
- Create: `apps/admin/src/admin-runninghub-item-editor.tsx`
  - Structured RH item editor for basic info, slots, params, outputs, execution descriptor.
- Modify: `apps/admin/src/styles.css`
  - Add RH workspace layout and structured editor styles.

### Web

- Modify: `apps/web/src/services/runninghubCatalog.ts`
  - Switch to normalized RH item contract, preserve legacy helper exports where needed.
- Create: `apps/web/src/utils/runninghubNodeSchema.ts`
  - Convert RH item contract into node-facing input/output/param view model.
- Modify: `apps/web/src/components/nodes/RunningHubNode.tsx`
  - Refactor to use normalized RH item contract, dynamic slot sections, fixed typed handles, legacy preset compatibility.
- Modify: `apps/web/src/services/generation.ts`
  - Keep RH submit/query/upload calls but accept normalized descriptor-backed payload fields where needed.

### Tests / contracts / docs

- Create: `scripts/verify-runninghub-catalog-normalization.mjs`
  - Assert backend RH normalization helpers and public contract shape.
- Create: `scripts/verify-admin-runninghub-workspace-contract.mjs`
  - Assert admin RH workspace route and key editor blocks exist.
- Create: `scripts/verify-runninghub-single-node-contract.mjs`
  - Assert RH node uses fixed typed handles plus dynamic slot rendering.
- Modify: `DEVLOG.md`
  - Record implementation progress when tasks land.
- Modify: `docs/project-atlas/api-navigation.md`
  - Add RH admin/public item routes after implementation.
- Modify: `docs/project-atlas/interfaces-and-dataflow.md`
  - Add RH workspace data flow after implementation.

## Task 1: Add Shared RH Catalog Types And Backend Normalization

**Files:**
- Create: `packages/shared/src/runninghub.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `apps/api/src/runninghub-catalog.ts`
- Create: `apps/api/src/runninghub-execution-descriptor.ts`
- Modify: `apps/api/src/server.ts`
- Test: `scripts/verify-runninghub-catalog-normalization.mjs`

- [ ] **Step 1: Write the failing contract script**

```js
import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const shared = await readFile(new URL("../packages/shared/src/runninghub.ts", import.meta.url), "utf8");
const catalog = await readFile(new URL("../apps/api/src/runninghub-catalog.ts", import.meta.url), "utf8");
const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");

assert.match(shared, /export interface RhCatalogItem/);
assert.match(shared, /export interface RhInputSlotDefinition/);
assert.match(shared, /export interface RhExecutionDescriptor/);
assert.match(catalog, /export function normalizeRunningHubCatalogItem/);
assert.match(catalog, /export function toPublicRunningHubCatalogItem/);
assert.match(server, /\/api\/admin\/runninghub\/items/);
assert.match(server, /\/api\/runninghub\/catalog\/:id|\/api\/runninghub\/catalog\/.+request\.method === "GET"/);
```

- [ ] **Step 2: Run contract to verify it fails**

Run: `node scripts/verify-runninghub-catalog-normalization.mjs`  
Expected: FAIL because the new RH shared file and normalization helpers do not exist yet.

- [ ] **Step 3: Add shared RH types**

```ts
export type RhCatalogItemKind = "app" | "workflow";
export type RhSlotDataType = "text" | "image" | "video" | "audio" | "json";

export interface RhInputSlotDefinition {
  key: string;
  label: string;
  dataType: RhSlotDataType;
  cardinality: "single" | "multiple";
  required: boolean;
  supportsConnection: boolean;
  supportsManualInput: boolean;
  supportsUpload: boolean;
  bindingTarget: { nodeId?: string; fieldName: string };
  description?: string;
  acceptRoles?: string[];
}

export interface RhExecutionDescriptor {
  submit: { endpoint?: string; method?: "GET" | "POST"; bodyMode?: "json" | "form-data"; requestBuilder?: string };
  assetHandling: { mode: "url" | "fileName" | "multipart-file" | "upload-then-reference"; uploadEndpoint?: string; uploadFieldName?: string };
  polling: { enabled: boolean; endpoint?: string; intervalMs?: number; timeoutMs?: number; taskIdPath?: string; statusPath?: string; successValues?: string[]; failureValues?: string[]; failureMessagePath?: string };
  result: { mode: "direct" | "polling"; outputPaths: Array<{ dataType: string; path: string; cardinality: "single" | "multiple" }> };
  errorHandling: { providerErrorPath?: string; fallbackMessage?: string };
}
```

- [ ] **Step 4: Implement backend normalization helpers**

```ts
export function normalizeRunningHubCatalogItem(entry: RunningHubEntry, provider: Pick<AdminProviderRecord, "id" | "name" | "baseUrl">): RhCatalogItem {
  return {
    id: entry.id,
    providerId: provider.id,
    kind: entry.kind,
    title: safeText(entry.title || entry.id),
    note: safeText(entry.note || ""),
    thumbnail: safeText(entry.thumbnail || ""),
    enabled: entry.enabled !== false,
    vendorAppId: safeText(entry.appId || ""),
    vendorWorkflowId: safeText(entry.workflowId || ""),
    runTargetId: safeText(entry.runTargetId || entry.workflowId || entry.appId || entry.id),
    capabilityTags: inferRhCapabilityTags(entry.fields || []),
    inputSlots: inferRhInputSlots(entry.fields || []),
    paramSchema: normalizeRhParamFields(entry.fields || []),
    outputSchema: inferRhOutputs(entry.workflowJson),
    execution: defaultRhExecutionDescriptor(entry),
    workflowJson: safeJsonText(entry.workflowJson || ""),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 5: Expose new admin/public routes in `server.ts`**

```ts
if (url.pathname === "/api/admin/runninghub/items" && request.method === "GET") {
  requireAdmin(requestContext);
  sendT8(response, { items: listRunningHubCatalogItems() });
  return;
}

if (url.pathname === "/api/runninghub/catalog" && request.method === "GET") {
  sendT8(response, buildPublicRunningHubCatalog());
  return;
}
```

- [ ] **Step 6: Run the backend RH normalization contract**

Run: `node scripts/verify-runninghub-catalog-normalization.mjs`  
Expected: PASS

- [ ] **Step 7: Run focused builds**

Run: `npm run build -w @xinghuan/shared`  
Expected: PASS

Run: `npm run build -w @xinghuan/api`  
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/runninghub.ts packages/shared/src/index.ts apps/api/src/runninghub-catalog.ts apps/api/src/runninghub-execution-descriptor.ts apps/api/src/server.ts scripts/verify-runninghub-catalog-normalization.mjs
git commit -m "feat: normalize runninghub catalog items"
```

## Task 2: Build Admin RunningHub Workspace And Move RH Editing Out Of Provider Form

**Files:**
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/admin-api-client.ts`
- Modify: `apps/admin/src/admin-api-settings-panel.tsx`
- Modify: `apps/admin/src/main.tsx`
- Create: `apps/admin/src/admin-runninghub-workspace.tsx`
- Create: `apps/admin/src/admin-runninghub-item-editor.tsx`
- Modify: `apps/admin/src/styles.css`
- Test: `scripts/verify-admin-runninghub-workspace-contract.mjs`

- [ ] **Step 1: Write the failing admin workspace contract**

```js
import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const main = await readFile(new URL("../apps/admin/src/main.tsx", import.meta.url), "utf8");
const workspace = await readFile(new URL("../apps/admin/src/admin-runninghub-workspace.tsx", import.meta.url), "utf8");
const settings = await readFile(new URL("../apps/admin/src/admin-api-settings-panel.tsx", import.meta.url), "utf8");

assert.match(main, /environment-sync|runninghub-workspace/);
assert.match(workspace, /RunningHub 工作台/);
assert.match(workspace, /工作流/);
assert.match(workspace, /AI 应用/);
assert.match(settings, /进入 RH 工作台/);
assert.doesNotMatch(settings, /字段映射 JSON/);
```

- [ ] **Step 2: Run the contract to verify it fails**

Run: `node scripts/verify-admin-runninghub-workspace-contract.mjs`  
Expected: FAIL because the workspace page does not exist yet.

- [ ] **Step 3: Add admin RH API client methods and types**

```ts
export async function listRunningHubItems() {
  return requestJson<{ items: RhCatalogItem[] }>("/api/admin/runninghub/items");
}

export async function updateRunningHubItem(id: string, payload: Partial<RhCatalogItem>) {
  return requestJson<{ item: RhCatalogItem }>(`/api/admin/runninghub/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 4: Create RH workspace shell**

```tsx
export function AdminRunningHubWorkspace() {
  const [tab, setTab] = useState<"workflow" | "app">("workflow");
  const [items, setItems] = useState<RhCatalogItem[]>([]);

  useEffect(() => {
    listRunningHubItems().then((payload) => setItems(payload.items || []));
  }, []);

  return (
    <section className="rh-workspace-page">
      <header className="rh-workspace-hero">
        <div>
          <h1>RunningHub 工作台</h1>
          <p>集中管理 RH 工作流、AI 应用、输入槽和执行规则。</p>
        </div>
      </header>
    </section>
  );
}
```

- [ ] **Step 5: Replace inline RH JSON editing in provider settings with summary + entry button**

```tsx
{rhVisible ? (
  <section className="api-card rh-summary-card">
    <div className="model-section-head">
      <BlockTitle title="RunningHub 工作台" sub="工作流与 AI 应用在专属页面维护" />
      <button type="button" className="ghost-action" onClick={() => setView("runninghub-workspace")}>
        进入 RH 工作台
      </button>
    </div>
    <div className="field-note">Provider 页面仅保留 RH 连接配置与摘要，不再直接编辑字段映射 JSON。</div>
  </section>
) : null}
```

- [ ] **Step 6: Register RH workspace route and styles**

Run: `node scripts/verify-admin-runninghub-workspace-contract.mjs`  
Expected: PASS

Run: `npm run build -w @xinghuan/admin`  
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/admin-types.ts apps/admin/src/admin-api-client.ts apps/admin/src/admin-api-settings-panel.tsx apps/admin/src/main.tsx apps/admin/src/admin-runninghub-workspace.tsx apps/admin/src/admin-runninghub-item-editor.tsx apps/admin/src/styles.css scripts/verify-admin-runninghub-workspace-contract.mjs
git commit -m "feat: add runninghub admin workspace"
```

## Task 3: Add Structured RH Item Editing For Slots, Params, Outputs, And Execution Rules

**Files:**
- Modify: `apps/admin/src/admin-runninghub-item-editor.tsx`
- Modify: `apps/admin/src/admin-runninghub-workspace.tsx`
- Modify: `apps/admin/src/styles.css`
- Test: `scripts/verify-admin-runninghub-workspace-contract.mjs`

- [ ] **Step 1: Extend the failing admin workspace contract for structured sections**

```js
assert.match(workspace, /输入槽定义/);
assert.match(workspace, /参数 Schema/);
assert.match(workspace, /输出定义/);
assert.match(workspace, /执行描述/);
assert.match(workspace, /测试运行/);
assert.doesNotMatch(workspace, /placeholder=\{`\\\[\\n  \{/);
```

- [ ] **Step 2: Run the contract to confirm it fails**

Run: `node scripts/verify-admin-runninghub-workspace-contract.mjs`  
Expected: FAIL because the editor is still only a shell.

- [ ] **Step 3: Add structured item editor sections**

```tsx
<section className="rh-item-section">
  <h3>输入槽定义</h3>
  {draft.inputSlots.map((slot, index) => (
    <RhSlotRow key={slot.key || index} slot={slot} onChange={(patch) => updateSlot(index, patch)} />
  ))}
</section>

<section className="rh-item-section">
  <h3>执行描述</h3>
  <label>素材处理模式</label>
  <select value={draft.execution.assetHandling.mode} onChange={(e) => updateAssetMode(e.target.value)}>
    <option value="url">URL</option>
    <option value="fileName">fileName</option>
    <option value="multipart-file">multipart-file</option>
    <option value="upload-then-reference">upload-then-reference</option>
  </select>
</section>
```

- [ ] **Step 4: Add basic test-run action wiring**

```tsx
async function runItemTest() {
  if (!selectedItemId) return;
  setProbeState("running");
  try {
    const result = await testRunningHubItem(selectedItemId);
    setProbeResult(result);
    setProbeState("success");
  } catch (error) {
    setProbeState("error");
    setProbeResult({ error: error instanceof Error ? error.message : "UNKNOWN_ERROR" });
  }
}
```

- [ ] **Step 5: Re-run admin RH workspace contract and build**

Run: `node scripts/verify-admin-runninghub-workspace-contract.mjs`  
Expected: PASS

Run: `npm run build -w @xinghuan/admin`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/admin-runninghub-item-editor.tsx apps/admin/src/admin-runninghub-workspace.tsx apps/admin/src/styles.css scripts/verify-admin-runninghub-workspace-contract.mjs
git commit -m "feat: add structured runninghub item editor"
```

## Task 4: Refactor Public RH Catalog Service And Single RH Node Contract

**Files:**
- Modify: `apps/web/src/services/runninghubCatalog.ts`
- Create: `apps/web/src/utils/runninghubNodeSchema.ts`
- Modify: `apps/web/src/components/nodes/RunningHubNode.tsx`
- Modify: `apps/web/src/services/generation.ts`
- Test: `scripts/verify-runninghub-single-node-contract.mjs`

- [ ] **Step 1: Write the failing RH node contract**

```js
import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const node = await readFile(new URL("../apps/web/src/components/nodes/RunningHubNode.tsx", import.meta.url), "utf8");
const service = await readFile(new URL("../apps/web/src/services/runninghubCatalog.ts", import.meta.url), "utf8");
const schema = await readFile(new URL("../apps/web/src/utils/runninghubNodeSchema.ts", import.meta.url), "utf8");

assert.match(service, /RhCatalogItem/);
assert.match(schema, /buildRunningHubNodeSchema/);
assert.match(node, /text-in/);
assert.match(node, /image-in/);
assert.match(node, /video-in/);
assert.match(node, /audio-in/);
assert.match(node, /json-in/);
assert.match(node, /成功数|失败数|进行中/);
```

- [ ] **Step 2: Run the contract to verify it fails**

Run: `node scripts/verify-runninghub-single-node-contract.mjs`  
Expected: FAIL because the schema helper and typed fixed handles do not exist yet.

- [ ] **Step 3: Normalize the public RH catalog client**

```ts
export interface RunningHubCatalogItem extends RhCatalogItem {
  providerName: string;
  providerBaseUrl: string;
}

export async function fetchRunningHubCatalog(): Promise<{ items: RunningHubCatalogItem[] }> {
  const response = await fetch("/api/runninghub/catalog");
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload?.error || `HTTP ${response.status}`);
  return { items: payload.data?.items || [] };
}
```

- [ ] **Step 4: Add RH node schema helper**

```ts
export function buildRunningHubNodeSchema(item: RunningHubCatalogItem) {
  return {
    title: item.title,
    kind: item.kind,
    capabilityTags: item.capabilityTags || [],
    inputSlots: item.inputSlots || [],
    paramSchema: item.paramSchema || [],
    outputs: item.outputSchema || [],
  };
}
```

- [ ] **Step 5: Refactor RH node to fixed typed handles plus dynamic slot sections**

```tsx
<Handle id="text-in" type="target" position={Position.Left} style={textHandleStyle} />
<Handle id="image-in" type="target" position={Position.Left} style={imageHandleStyle} />
<Handle id="video-in" type="target" position={Position.Left} style={videoHandleStyle} />
<Handle id="audio-in" type="target" position={Position.Left} style={audioHandleStyle} />
<Handle id="json-in" type="target" position={Position.Left} style={jsonHandleStyle} />

<div className="rh-slot-list">
  {schema.inputSlots.map((slot) => (
    <div key={slot.key} className="rh-slot-row">
      <strong>{slot.label}</strong>
      <span>{slot.dataType}</span>
    </div>
  ))}
</div>
```

- [ ] **Step 6: Preserve legacy preset compatibility**

```ts
const presetId = String(data.rhWorkflowPresetId || "");
const activeItem = items.find((item) => item.id === presetId || item.runTargetId === data.webappId) || null;
```

- [ ] **Step 7: Run RH node contract and web build**

Run: `node scripts/verify-runninghub-single-node-contract.mjs`  
Expected: PASS

Run: `npm run build -w @xinghuan/web`  
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/services/runninghubCatalog.ts apps/web/src/utils/runninghubNodeSchema.ts apps/web/src/components/nodes/RunningHubNode.tsx apps/web/src/services/generation.ts scripts/verify-runninghub-single-node-contract.mjs
git commit -m "feat: refactor runninghub single node contract"
```

## Task 5: Finalize Docs, Verification Hooks, And Integration Pass

**Files:**
- Modify: `docs/project-atlas/api-navigation.md`
- Modify: `docs/project-atlas/interfaces-and-dataflow.md`
- Modify: `DEVLOG.md`
- Test: `scripts/verify-runninghub-catalog-normalization.mjs`
- Test: `scripts/verify-admin-runninghub-workspace-contract.mjs`
- Test: `scripts/verify-runninghub-single-node-contract.mjs`

- [ ] **Step 1: Update atlas docs with implemented RH routes and data flow**

```md
- `GET /api/admin/runninghub/items`
- `PATCH /api/admin/runninghub/items/:id`
- `POST /api/admin/runninghub/items/:id/test`
- `GET /api/runninghub/catalog`
- `GET /api/runninghub/catalog/:id`
```

- [ ] **Step 2: Add DEVLOG entry for RH implementation slice**

```md
### RunningHub 工作台与单一 RH 节点第一阶段实现

目标:
- 完成 RH catalog 规范化、后台工作台骨架和单一 RH 节点契约切换。
```

- [ ] **Step 3: Run all RH verification commands**

Run: `node scripts/verify-runninghub-catalog-normalization.mjs`  
Expected: PASS

Run: `node scripts/verify-admin-runninghub-workspace-contract.mjs`  
Expected: PASS

Run: `node scripts/verify-runninghub-single-node-contract.mjs`  
Expected: PASS

Run: `npm run build -w @xinghuan/shared`  
Expected: PASS

Run: `npm run build -w @xinghuan/api`  
Expected: PASS

Run: `npm run build -w @xinghuan/admin`  
Expected: PASS

Run: `npm run build -w @xinghuan/web`  
Expected: PASS

- [ ] **Step 4: Sync CodeGraph**

Run: `codegraph sync`  
Expected: `Already up to date` or successful sync output

- [ ] **Step 5: Commit**

```bash
git add docs/project-atlas/api-navigation.md docs/project-atlas/interfaces-and-dataflow.md DEVLOG.md
git commit -m "docs: record runninghub workspace implementation"
```

## Self-Review

- Spec coverage:
  - Backend RH catalog normalization: covered by Task 1.
  - RH dedicated admin workspace: covered by Tasks 2 and 3.
  - Single RH node with typed fixed handles and dynamic schema: covered by Task 4.
  - Docs and verification routing: covered by Task 5.
- Placeholder scan:
  - No `TODO`, `TBD`, or “implement later” placeholders remain in tasks.
- Type consistency:
  - `RhCatalogItem`, `RhInputSlotDefinition`, and `RhExecutionDescriptor` are introduced first in Task 1 and reused consistently in later tasks.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-18-runninghub-workspace-and-single-node.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints
