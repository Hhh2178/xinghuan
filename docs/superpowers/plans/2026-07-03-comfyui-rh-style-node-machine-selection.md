# ComfyUI RH-Style Node And Machine Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one RH-style `comfyui` canvas node that consumes backend-governed shared workflows, supports machine selection, and keeps a single unified output port while preserving structured ComfyUI outputs behind the scenes.

**Architecture:** Extend the existing schema-first ComfyUI foundation instead of rebuilding it. First lock the shared/backend contract for display tiers, machine bindings, and machine-aware execution. Then upgrade the admin governance UI to edit those fields explicitly. Finally split the current ComfyUI node into RH-style sections, wire workflow + machine selectors into the node shell, and finish by cleaning up legacy node visibility, migration, docs, and harness verification.

**Tech Stack:** TypeScript, React 19, Vite, `@xyflow/react`, Node ESM route handlers, monorepo workspace scripts, contract-style verify scripts, CodeGraph sync.

---

## File Structure

### Shared / backend contract

- Modify: `packages/shared/src/comfyui-workflow.ts`
  - Add the formal schema fields for `displayTier`, machine bindings, and machine execution mode.
- Modify: `packages/shared/src/index.ts`
  - Re-export the new ComfyUI schema types so API, admin, and web all read the same contract.
- Modify: `apps/api/src/comfyui-workflow-normalizer.ts`
  - Default missing `displayTier` and `instanceBindings` values when loading old drafts.
- Modify: `apps/api/src/comfyui-workflow-registry.ts`
  - Persist machine binding data on instance workflows and shared workflows.
- Modify: `apps/api/src/comfyui-execution.ts`
  - Validate whether the requested machine is allowed for the chosen shared workflow and compute the actual execution instance.
- Modify: `apps/api/src/comfyui-public-routes.ts`
  - Return machine-aware workflow catalog data and honor the selected machine at run time.

### Admin governance UI

- Modify: `apps/admin/src/admin-types.ts`
  - Keep admin DTOs aligned with the shared contract.
- Modify: `apps/admin/src/admin-api-client.ts`
  - Keep workflow create/update payloads aligned with machine bindings and display tiers.
- Modify: `apps/admin/src/admin-comfyui-detail.tsx`
  - Keep instance-level orchestration, selected workflow state, and push-to-shared behavior here.
- Modify: `apps/admin/src/admin-comfyui-workflow-card.tsx`
  - Add editable controls for display tier, upstream slot semantics, and machine binding / default machine selection.
- Modify: `apps/admin/src/styles.css`
  - Align the new governance fields to the existing admin ComfyUI layout.

### Canvas node

- Modify: `apps/web/src/types/canvas.ts`
  - Keep public catalog and run-result types aligned with the backend contract.
- Create: `apps/web/src/components/nodes/comfyuiNodeHelpers.ts`
  - Hold selector helpers, visible-parameter grouping, machine-label formatting, and primary-output resolution.
- Create: `apps/web/src/components/nodes/ComfyUINodeSelectorSection.tsx`
  - Hold RH-style workflow + machine selection controls.
- Create: `apps/web/src/components/nodes/ComfyUINodeParamSection.tsx`
  - Render primary and secondary parameter groups from schema.
- Create: `apps/web/src/components/nodes/ComfyUINodeRunSection.tsx`
  - Render status, run button, and machine-aware runtime messaging.
- Create: `apps/web/src/components/nodes/ComfyUINodeOutputSummarySection.tsx`
  - Render a lightweight output summary instead of a result wall.
- Modify: `apps/web/src/components/nodes/ComfyUIApplicationNode.tsx`
  - Reduce this file to node shell + state orchestration + section composition.
- Modify: `apps/web/src/config/nodeRegistry.ts`
  - Keep only one visible `comfyui` node entry.
- Modify: `apps/web/src/components/Canvas.tsx`
  - Ensure the new node remains the only active ComfyUI canvas entry point.
- Modify: `apps/web/src/utils/nodeMigration.ts`
  - Keep old ComfyUI node documents loading into the unified node model.
- Modify: `apps/web/src/utils/nodePlacement.ts`
  - Keep default size and placement aligned with the larger RH-style shell.

### Verification / docs

- Modify: `scripts/verify-comfyui-workflow-parser-contract.mjs`
  - Assert the formal schema additions exist.
- Modify: `scripts/verify-comfyui-instance-pool-contract.mjs`
  - Assert machine bindings persist in the registry and shared catalog.
- Modify: `scripts/verify-admin-comfyui-governance-contract.mjs`
  - Assert the admin UI exposes display-tier and machine-binding controls.
- Modify: `scripts/verify-comfyui-canvas-schema-contract.mjs`
  - Assert the web catalog types include machine bindings and structured outputs.
- Modify: `scripts/verify-comfyui-unified-node-contract.mjs`
  - Assert the node shell uses RH-style sections and includes workflow + machine selectors.
- Modify: `scripts/verify-comfyui-legacy-node-migration-contract.mjs`
  - Assert legacy nodes migrate into the unified `comfyui` node.
- Modify: `docs/systems/canvas/node-and-data-model.md`
  - Document the new `comfyui` node shell, fields, and machine selection behavior.
- Modify: `docs/systems/harness/subharness-convention.md`
  - Record the ComfyUI verification entry points.
- Modify: `docs/logbooks/daily/2026/2026-07/2026-07-03.md`
  - Record the implementation batch and verification evidence.

---

### Task 1: Lock the shared schema and machine-aware runtime contract

**Files:**
- Modify: `packages/shared/src/comfyui-workflow.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/api/src/comfyui-workflow-normalizer.ts`
- Modify: `apps/api/src/comfyui-workflow-registry.ts`
- Modify: `apps/api/src/comfyui-execution.ts`
- Modify: `apps/api/src/comfyui-public-routes.ts`
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/web/src/types/canvas.ts`
- Test: `scripts/verify-comfyui-workflow-parser-contract.mjs`
- Test: `scripts/verify-comfyui-instance-pool-contract.mjs`

- [ ] **Step 1: Write the failing schema and instance-pool contract assertions**

```js
// scripts/verify-comfyui-workflow-parser-contract.mjs
if (!sharedSource.includes('displayTier?: "primary" | "secondary" | "advanced"')) {
  throw new Error("ComfyUI input schema is missing displayTier");
}
if (!sharedSource.includes('export interface ComfyuiWorkflowInstanceBinding')) {
  throw new Error("ComfyUI shared schema is missing machine binding type");
}

// scripts/verify-comfyui-instance-pool-contract.mjs
if (!registrySource.includes("instanceBindings")) {
  throw new Error("ComfyUI registry is missing instanceBindings persistence");
}
if (!routeSource.includes("workflow.instanceBindings")) {
  throw new Error("ComfyUI public catalog is missing machine binding exposure");
}
if (!executionSource.includes("requestedInstanceId")) {
  throw new Error("ComfyUI execution helper is missing requested machine routing");
}
```

- [ ] **Step 2: Run the contracts in red**

Run: `npm run verify:comfyui-workflow-parser-contract && node scripts/verify-comfyui-instance-pool-contract.mjs`  
Expected: FAIL with one of:

- `ComfyUI input schema is missing displayTier`
- `ComfyUI registry is missing instanceBindings persistence`

- [ ] **Step 3: Extend the shared schema and normalize backward-compatible defaults**

```ts
// packages/shared/src/comfyui-workflow.ts
export type ComfyuiWorkflowDisplayTier = "primary" | "secondary" | "advanced";
export type ComfyuiWorkflowExecutionMode = "fixed" | "selectable" | "pool";

export interface ComfyuiWorkflowInstanceBinding {
  instanceId: string;
  enabled: boolean;
  isDefault?: boolean;
  executionMode?: ComfyuiWorkflowExecutionMode;
  capabilityTags?: string[];
}

export interface ComfyuiWorkflowInputSchemaItem {
  key: string;
  nodeId: string;
  fieldName: string;
  label: string;
  kind: ComfyuiWorkflowValueKind;
  mode: "param" | "upstream" | "hidden";
  displayTier?: ComfyuiWorkflowDisplayTier;
  required?: boolean;
  defaultValue?: unknown;
  order?: number;
  upstreamSlot?: string;
  slotLabel?: string;
  multiple?: boolean;
  note?: string;
}
```

```ts
// apps/api/src/comfyui-workflow-normalizer.ts
function normalizeInstanceBindings(draft: ComfyuiWorkflowDraft) {
  const raw = Array.isArray(draft.instanceBindings) ? draft.instanceBindings : [];
  const seen = new Set<string>();
  const bindings = raw
    .map((item) => ({
      instanceId: String(item.instanceId || "").trim(),
      enabled: item.enabled !== false,
      isDefault: item.isDefault === true,
      executionMode: item.executionMode === "fixed" || item.executionMode === "pool" ? item.executionMode : "selectable",
      capabilityTags: Array.isArray(item.capabilityTags) ? item.capabilityTags.map((tag) => String(tag)).filter(Boolean) : [],
    }))
    .filter((item) => item.instanceId && !seen.has(item.instanceId) && seen.add(item.instanceId));

  if (!bindings.length) {
    return [{ instanceId: draft.instanceId, enabled: true, isDefault: true, executionMode: "selectable", capabilityTags: [] }];
  }

  if (!bindings.some((item) => item.isDefault)) {
    bindings[0] = { ...bindings[0], isDefault: true };
  }
  return bindings;
}

const inputSchema = normalizedInputSchema.map((item, index) => ({
  ...item,
  displayTier: item.mode === "param"
    ? item.displayTier || (index < 4 ? "primary" : "secondary")
    : undefined,
}));
```

- [ ] **Step 4: Make registry state, public catalog, and run-time selection machine-aware**

```ts
// apps/api/src/comfyui-workflow-registry.ts
export interface ComfyuiWorkflowDraft {
  id: string;
  instanceId: string;
  title: string;
  workflowJson: Record<string, unknown>;
  analysis: ComfyuiWorkflowAnalysisResult;
  inputSchema: ComfyuiWorkflowInputSchemaItem[];
  defaultValues: Record<string, unknown>;
  outputSchema: ComfyuiWorkflowOutputSchemaItem[];
  instanceBindings: ComfyuiWorkflowInstanceBinding[];
  sharedWorkflowId?: string;
  createdAt: number;
  updatedAt: number;
}
```

```ts
// apps/api/src/comfyui-execution.ts
export function selectComfyuiExecutionInstance(input: {
  state: ComfyuiRegistryState;
  workflow: ComfyuiWorkflowDraft;
  requestedInstanceId?: string;
}) {
  const allowed = new Set(
    (input.workflow.instanceBindings || [])
      .filter((item) => item.enabled !== false)
      .map((item) => item.instanceId),
  );
  const candidates = input.state.instances.filter((item) => allowed.has(item.id));
  const requested = input.requestedInstanceId
    ? candidates.find((item) => item.id === input.requestedInstanceId)
    : null;
  if (requested && requested.health !== "offline") return requested;
  const preferredId = input.workflow.instanceBindings.find((item) => item.isDefault)?.instanceId;
  return candidates.find((item) => item.id === preferredId && item.health !== "offline")
    || candidates.find((item) => item.health === "online")
    || candidates.find((item) => item.health !== "offline")
    || null;
}
```

```ts
// apps/api/src/comfyui-public-routes.ts
deps.sendT8(response, {
  revision: state.revision,
  updatedAt: state.updatedAt,
  instances: state.instances,
  workflows: state.sharedWorkflows.map((workflow) => ({
    ...workflow,
    instanceBindings: workflow.instanceBindings || [],
  })),
});
```

- [ ] **Step 5: Re-run contracts, then type-check the affected workspaces**

Run: `npm run verify:comfyui-workflow-parser-contract && node scripts/verify-comfyui-instance-pool-contract.mjs && npm run type-check -w @xinghuan/api && npm run type-check -w @xinghuan/admin && npm run type-check -w @xinghuan/web`  
Expected:

- parser contract passes
- instance-pool contract passes
- all three workspace type-checks pass

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/comfyui-workflow.ts packages/shared/src/index.ts apps/api/src/comfyui-workflow-normalizer.ts apps/api/src/comfyui-workflow-registry.ts apps/api/src/comfyui-execution.ts apps/api/src/comfyui-public-routes.ts apps/admin/src/admin-types.ts apps/web/src/types/canvas.ts scripts/verify-comfyui-workflow-parser-contract.mjs scripts/verify-comfyui-instance-pool-contract.mjs
git commit -m "feat: add comfyui machine-aware schema contract"
```

### Task 2: Upgrade the admin governance UI for display tiers and machine bindings

**Files:**
- Modify: `apps/admin/src/admin-api-client.ts`
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/admin-comfyui-detail.tsx`
- Modify: `apps/admin/src/admin-comfyui-workflow-card.tsx`
- Modify: `apps/admin/src/styles.css`
- Test: `scripts/verify-admin-comfyui-governance-contract.mjs`

- [ ] **Step 1: Write the failing admin governance contract**

```js
// scripts/verify-admin-comfyui-governance-contract.mjs
if (!workflowCardSource.includes("displayTier")) {
  throw new Error("Admin ComfyUI workflow card is missing displayTier editor");
}
if (!workflowCardSource.includes("instanceBindings")) {
  throw new Error("Admin ComfyUI workflow card is missing machine binding editor");
}
if (!workflowCardSource.includes("默认机器")) {
  throw new Error("Admin ComfyUI workflow card is missing default machine label");
}
if (!styleSource.includes(".admin-comfyui-machine-binding-grid")) {
  throw new Error("Admin ComfyUI styles are missing machine binding layout");
}
```

- [ ] **Step 2: Run the admin contract in red**

Run: `npm run verify:admin-comfyui-governance-contract`  
Expected: FAIL with `Admin ComfyUI workflow card is missing displayTier editor`

- [ ] **Step 3: Extend the admin payloads so the UI can read and save the new contract**

```ts
// apps/admin/src/admin-api-client.ts
updateWorkflow: (
  instanceId: string,
  workflowId: string,
  payload: {
    title?: string;
    description?: string;
    workflowJson?: Record<string, unknown>;
    inputSchema?: import("./admin-types").ComfyuiWorkflowInputSchemaItem[];
    outputSchema?: import("./admin-types").ComfyuiWorkflowOutputSchemaItem[];
    defaultValues?: Record<string, unknown>;
    instanceBindings?: import("./admin-types").ComfyuiWorkflowInstanceBinding[];
  },
) => api<import("./admin-types").ComfyuiWorkflowDraft>(
  `/api/admin/comfyui/instances/${encodeURIComponent(instanceId)}/workflows/${encodeURIComponent(workflowId)}`,
  { method: "PATCH", body: JSON.stringify(payload) },
),
```

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
  instanceBindings: ComfyuiWorkflowInstanceBinding[];
  sharedWorkflowId?: string;
  createdAt: number;
  updatedAt: number;
}
```

- [ ] **Step 4: Add editable controls for display tier and machine bindings**

```tsx
// apps/admin/src/admin-comfyui-workflow-card.tsx
<div className="admin-comfyui-mapping-row__cell">
  <label>展示层级</label>
  <select
    value={field.displayTier || "primary"}
    onChange={(event) => updateInputField(field.key, { displayTier: event.target.value as "primary" | "secondary" | "advanced" })}
  >
    <option value="primary">核心参数</option>
    <option value="secondary">更多参数</option>
    <option value="advanced">高级参数</option>
  </select>
</div>
```

```tsx
// apps/admin/src/admin-comfyui-workflow-card.tsx
<section className="admin-comfyui-workflow-card__section">
  <div className="admin-comfyui-section-head">
    <div className="admin-comfyui-section-head__icon"><Cpu size={14} /></div>
    <div>
      <strong>执行机器</strong>
      <p>控制该工作流可在哪些 ComfyUI 机器上运行，以及默认机器是谁。</p>
    </div>
  </div>
  <div className="admin-comfyui-machine-binding-grid">
    {availableInstances.map((instance) => {
      const binding = bindingMap.get(instance.id) || { instanceId: instance.id, enabled: false, executionMode: "selectable" };
      return (
        <article key={instance.id} className="admin-comfyui-machine-binding-card">
          <label className="admin-comfyui-inline-check">
            <input
              type="checkbox"
              checked={binding.enabled !== false}
              onChange={(event) => updateBinding(instance.id, { enabled: event.target.checked })}
            />
            {instance.name}
          </label>
          <label>
            默认机器
            <input
              type="radio"
              name="comfyui-default-machine"
              checked={binding.isDefault === true}
              onChange={() => setDefaultBinding(instance.id)}
            />
          </label>
        </article>
      );
    })}
  </div>
</section>
```

```tsx
// apps/admin/src/admin-comfyui-detail.tsx
<AdminComfyuiWorkflowCard
  workflow={selectedWorkflow}
  availableInstances={workflows.length ? [instance, ...relatedInstances].filter(Boolean) as ComfyuiInstanceRecord[] : instance ? [instance] : []}
  onSave={handleSaveWorkflow}
  onDelete={handleDeleteWorkflow}
  onPushToShared={handlePushWorkflowToShared}
/>
```

```css
/* apps/admin/src/styles.css */
.admin-comfyui-machine-binding-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.admin-comfyui-machine-binding-card {
  border: 1px solid rgba(80, 220, 255, 0.18);
  border-radius: 16px;
  background: rgba(7, 16, 24, 0.72);
  padding: 12px;
}
```

- [ ] **Step 5: Re-run the admin contract and admin type-check**

Run: `npm run verify:admin-comfyui-governance-contract && npm run type-check -w @xinghuan/admin`  
Expected:

- admin governance contract passes
- admin workspace type-check passes

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/admin-api-client.ts apps/admin/src/admin-types.ts apps/admin/src/admin-comfyui-detail.tsx apps/admin/src/admin-comfyui-workflow-card.tsx apps/admin/src/styles.css scripts/verify-admin-comfyui-governance-contract.mjs
git commit -m "feat: add comfyui admin machine binding controls"
```

### Task 3: Rebuild the canvas node into RH-style sections with workflow and machine selectors

**Files:**
- Create: `apps/web/src/components/nodes/comfyuiNodeHelpers.ts`
- Create: `apps/web/src/components/nodes/ComfyUINodeSelectorSection.tsx`
- Create: `apps/web/src/components/nodes/ComfyUINodeParamSection.tsx`
- Create: `apps/web/src/components/nodes/ComfyUINodeRunSection.tsx`
- Create: `apps/web/src/components/nodes/ComfyUINodeOutputSummarySection.tsx`
- Modify: `apps/web/src/components/nodes/ComfyUIApplicationNode.tsx`
- Modify: `apps/web/src/types/canvas.ts`
- Test: `scripts/verify-comfyui-unified-node-contract.mjs`
- Test: `scripts/verify-comfyui-canvas-schema-contract.mjs`

- [ ] **Step 1: Write the failing unified-node and canvas-schema contracts**

```js
// scripts/verify-comfyui-unified-node-contract.mjs
if (!nodeSource.includes("ComfyUINodeSelectorSection")) {
  throw new Error("ComfyUI node shell is missing selector section split");
}
if (!nodeSource.includes("ComfyUINodeRunSection")) {
  throw new Error("ComfyUI node shell is missing run section split");
}
if (!nodeSource.includes("工作流")) {
  throw new Error("ComfyUI node shell is missing workflow selector label");
}
if (!nodeSource.includes("机器")) {
  throw new Error("ComfyUI node shell is missing machine selector label");
}
if (nodeSource.includes("ArrowLeft")) {
  throw new Error("ComfyUI node shell still contains return-to-list behavior");
}

// scripts/verify-comfyui-canvas-schema-contract.mjs
if (!canvasTypeSource.includes("instanceBindings")) {
  throw new Error("Canvas ComfyUI catalog type is missing instanceBindings");
}
if (!canvasTypeSource.includes("instanceName?: string")) {
  throw new Error("Canvas ComfyUI run result is missing selected machine metadata");
}
if (!canvasTypeSource.includes("outputs: Array<{")) {
  throw new Error("Canvas ComfyUI run result is missing structured outputs");
}
```

- [ ] **Step 2: Run the web contracts in red**

Run: `npm run verify:comfyui-unified-node-contract && npm run verify:comfyui-canvas-schema-contract`  
Expected: FAIL with `ComfyUI node shell is missing selector section split`

- [ ] **Step 3: Split selector / parameter / runtime / output summary helpers out of the node shell**

```ts
// apps/web/src/components/nodes/comfyuiNodeHelpers.ts
import type { ComfyuiCatalogInstance, ComfyuiCatalogWorkflow, ComfyuiRunOutput } from "../../types/canvas";

export function formatComfyuiMachineOption(instance: ComfyuiCatalogInstance) {
  const tags = (instance.capabilities || []).slice(0, 2).join(" / ");
  return `${instance.name} · ${instance.health}${tags ? ` · ${tags}` : ""}`;
}

export function splitVisibleComfyuiParams(fields: Array<{ mode?: string; displayTier?: string }>) {
  return {
    primary: fields.filter((item) => item.mode === "param" && (item.displayTier || "primary") === "primary"),
    secondary: fields.filter((item) => item.mode === "param" && item.displayTier === "secondary"),
    advanced: fields.filter((item) => item.mode === "param" && item.displayTier === "advanced"),
  };
}

export function resolvePrimaryComfyuiOutput(outputs: ComfyuiRunOutput[]) {
  return outputs[0] || null;
}
```

```tsx
// apps/web/src/components/nodes/ComfyUINodeSelectorSection.tsx
export function ComfyUINodeSelectorSection(props: {
  workflowId: string;
  machineId: string;
  workflowOptions: Array<{ id: string; label: string }>;
  machineOptions: Array<{ id: string; label: string; disabled?: boolean }>;
  onSelectWorkflow: (id: string) => void;
  onSelectMachine: (id: string) => void;
}) {
  return (
    <section className="space-y-2">
      <label className="block text-[10px] text-white/55">工作流</label>
      <select value={props.workflowId} onChange={(event) => props.onSelectWorkflow(event.target.value)} className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white">
        <option value="">请选择共享工作流</option>
        {props.workflowOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      <label className="block text-[10px] text-white/55">机器</label>
      <select value={props.machineId} onChange={(event) => props.onSelectMachine(event.target.value)} disabled={!props.workflowId} className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white disabled:opacity-50">
        <option value="">{props.workflowId ? "请选择执行机器" : "请先选择工作流"}</option>
        {props.machineOptions.map((item) => <option key={item.id} value={item.id} disabled={item.disabled}>{item.label}</option>)}
      </select>
    </section>
  );
}
```

```tsx
// apps/web/src/components/nodes/ComfyUINodeParamSection.tsx
export function ComfyUINodeParamSection(props: {
  primaryFields: ComfyuiWorkflowInputSchemaItem[];
  secondaryFields: ComfyuiWorkflowInputSchemaItem[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  return (
    <section className="space-y-2">
      <div className="text-[11px] font-black text-white/85">核心参数</div>
      {props.primaryFields.map((field) => renderComfyuiParamField(field, props.values[field.key], props.onChange))}
      {props.secondaryFields.length ? (
        <details className="rounded border border-white/10 bg-white/[0.03] p-2">
          <summary className="cursor-pointer text-[11px] font-bold text-cyan-200/80">更多参数</summary>
          <div className="mt-2 space-y-2">
            {props.secondaryFields.map((field) => renderComfyuiParamField(field, props.values[field.key], props.onChange))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
```

```tsx
// apps/web/src/components/nodes/ComfyUINodeRunSection.tsx
export function ComfyUINodeRunSection(props: {
  status: string;
  machineLabel: string;
  error?: string;
  isBusy: boolean;
  onRun: () => void;
}) {
  return (
    <section className="space-y-2 rounded border border-white/10 bg-white/[0.03] p-2">
      <div className="flex items-center justify-between text-[11px]">
        <strong className="text-white/90">运行状态</strong>
        <span className="text-cyan-200/70">{props.machineLabel}</span>
      </div>
      {props.error ? <div className="rounded border border-rose-400/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-100">{props.error}</div> : null}
      <button type="button" className="w-full rounded border border-cyan-400/40 bg-cyan-500/12 px-3 py-2 text-sm font-black text-cyan-100" disabled={props.isBusy} onClick={props.onRun}>
        {props.isBusy ? "运行中..." : "运行 comfyui"}
      </button>
    </section>
  );
}
```

```tsx
// apps/web/src/components/nodes/ComfyUINodeOutputSummarySection.tsx
export function ComfyUINodeOutputSummarySection(props: {
  outputs: ComfyuiRunOutput[];
  status: string;
}) {
  const primary = resolvePrimaryComfyuiOutput(props.outputs);
  return (
    <section className="rounded border border-white/10 bg-white/[0.03] p-2">
      <div className="text-[11px] font-black text-white/90">输出摘要</div>
      <div className="mt-1 text-[10px] text-white/60">
        {primary ? `主输出：${primary.label || primary.key} · ${primary.kind}` : "尚未生成结果"}
      </div>
      <div className="mt-1 text-[10px] text-white/40">状态：{props.status} · 已发布输出 {props.outputs.length} 项</div>
    </section>
  );
}
```

- [ ] **Step 4: Rebuild `ComfyUIApplicationNode.tsx` as a section shell and honor machine selection at run time**

```tsx
// apps/web/src/components/nodes/ComfyUIApplicationNode.tsx
const selectedWorkflowId = String(d.sharedWorkflowId || "");
const selectedMachineId = String(d.comfyuiInstanceId || d.comfyuiAppInstanceId || "");

const machineOptions = useMemo(() => {
  if (!activeEntry) return [];
  return (activeEntry.workflow.instanceBindings || [])
    .filter((binding) => binding.enabled !== false)
    .map((binding) => {
      const instance = catalog?.instances.find((item) => item.id === binding.instanceId);
      return instance ? { id: instance.id, label: formatComfyuiMachineOption(instance), disabled: instance.health === "offline" } : null;
    })
    .filter(Boolean) as Array<{ id: string; label: string; disabled?: boolean }>;
}, [activeEntry, catalog?.instances]);

<ComfyUINodeSelectorSection
  workflowId={selectedWorkflowId}
  machineId={selectedMachineId}
  workflowOptions={filteredEntries.map((entry) => ({
    id: entry.workflow.sharedWorkflowId || entry.workflow.id,
    label: entry.workflow.title,
  }))}
  machineOptions={machineOptions}
  onSelectWorkflow={(workflowId) => update({ sharedWorkflowId: workflowId, comfyuiWorkflowId: workflowId })}
  onSelectMachine={(instanceId) => update({ comfyuiInstanceId: instanceId, comfyuiAppInstanceId: instanceId })}
/>
```

```ts
// run payload in ComfyUIApplicationNode.tsx
const result = await runComfyuiApp({
  provider: buildProviderFromEntry(activeEntry),
  app,
  sharedWorkflowId: activeEntry.workflow.sharedWorkflowId || activeEntry.workflow.id,
  instanceId: selectedMachineId,
  userParams: paramValues,
  inputs: {
    texts: orderedTexts.map((item) => item.url),
    images: orderedImages.map((item) => item.url),
    videos: orderedVideos.map((item) => item.url),
    audios: orderedAudios.map((item) => item.url),
  },
});
```

- [ ] **Step 5: Re-run web contracts and web type-check**

Run: `npm run verify:comfyui-unified-node-contract && npm run verify:comfyui-canvas-schema-contract && npm run type-check -w @xinghuan/web`  
Expected:

- unified-node contract passes
- canvas-schema contract passes
- web workspace type-check passes

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/nodes/comfyuiNodeHelpers.ts apps/web/src/components/nodes/ComfyUINodeSelectorSection.tsx apps/web/src/components/nodes/ComfyUINodeParamSection.tsx apps/web/src/components/nodes/ComfyUINodeRunSection.tsx apps/web/src/components/nodes/ComfyUINodeOutputSummarySection.tsx apps/web/src/components/nodes/ComfyUIApplicationNode.tsx apps/web/src/types/canvas.ts scripts/verify-comfyui-unified-node-contract.mjs scripts/verify-comfyui-canvas-schema-contract.mjs
git commit -m "feat: rebuild comfyui node into rh-style shell"
```

### Task 4: Finish legacy-node retirement, migration, and single-node catalog behavior

**Files:**
- Modify: `apps/web/src/config/nodeRegistry.ts`
- Modify: `apps/web/src/components/Canvas.tsx`
- Modify: `apps/web/src/utils/nodeMigration.ts`
- Modify: `apps/web/src/utils/nodePlacement.ts`
- Modify: `scripts/verify-comfyui-legacy-node-migration-contract.mjs`
- Modify: `scripts/verify-comfyui-unified-node-contract.mjs`

- [ ] **Step 1: Write the failing migration and registry assertions**

```js
// scripts/verify-comfyui-legacy-node-migration-contract.mjs
if (!migrationSource.includes("comfyui-app")) {
  throw new Error("Legacy ComfyUI app migration mapping is missing");
}
if (!migrationSource.includes("comfyui-store")) {
  throw new Error("Legacy ComfyUI store migration mapping is missing");
}
if (!migrationSource.includes("type: \"comfyui\"")) {
  throw new Error("Legacy ComfyUI nodes are not rewritten into the unified type");
}

// scripts/verify-comfyui-unified-node-contract.mjs
if (registrySource.includes("type: 'comfyui-app'") && !registrySource.includes("hidden: true")) {
  throw new Error("Legacy ComfyUI app node is still visible in node registry");
}
if (registrySource.includes("type: 'comfyui-store'") && !registrySource.includes("hidden: true")) {
  throw new Error("Legacy ComfyUI store node is still visible in node registry");
}
```

- [ ] **Step 2: Run the migration contract in red**

Run: `npm run verify:comfyui-legacy-node-migration-contract && npm run verify:comfyui-unified-node-contract`  
Expected: FAIL with `Legacy ComfyUI nodes are not rewritten into the unified type`

- [ ] **Step 3: Hide all legacy entries and make the new node the only canvas entry point**

```ts
// apps/web/src/config/nodeRegistry.ts
{
  type: "comfyui",
  label: "comfyui",
  category: "comfyui",
  description: "共享 ComfyUI 工作流与机器选择节点",
  icon: "Workflow",
  color: "cyan",
},
{
  type: "comfyui-app",
  label: "ComfyUI 应用",
  category: "comfyui",
  description: "legacy hidden",
  icon: "Workflow",
  color: "cyan",
  hidden: true,
},
```

```tsx
// apps/web/src/components/Canvas.tsx
const nodeTypes = {
  ...baseNodeTypes,
  comfyui: ComfyUIApplicationNode,
  "comfyui-app": ComfyUIApplicationNode,
  "comfyui-store": ComfyUIApplicationNode,
  "comfyui-app-maker": ComfyUIApplicationNode,
};
```

- [ ] **Step 4: Migrate old saved node data into the unified `comfyui` shape**

```ts
// apps/web/src/utils/nodeMigration.ts
if (node.type === "comfyui-app" || node.type === "comfyui-store" || node.type === "comfyui-app-maker") {
  return {
    ...node,
    type: "comfyui",
    data: {
      ...node.data,
      sharedWorkflowId: node.data?.sharedWorkflowId || node.data?.comfyuiWorkflowId || node.data?.comfyuiAppWorkflowId || "",
      comfyuiInstanceId: node.data?.comfyuiInstanceId || node.data?.comfyuiAppInstanceId || "",
      size: node.data?.size || { w: 420, h: 620 },
    },
  };
}
```

```ts
// apps/web/src/utils/nodePlacement.ts
const DEFAULT_NODE_SIZES = {
  comfyui: { width: 420, height: 620 },
};
```

- [ ] **Step 5: Re-run migration / unified-node contracts and a web smoke type-check**

Run: `npm run verify:comfyui-legacy-node-migration-contract && npm run verify:comfyui-unified-node-contract && npm run type-check -w @xinghuan/web`  
Expected:

- legacy migration contract passes
- unified-node contract passes
- web workspace type-check passes

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/config/nodeRegistry.ts apps/web/src/components/Canvas.tsx apps/web/src/utils/nodeMigration.ts apps/web/src/utils/nodePlacement.ts scripts/verify-comfyui-legacy-node-migration-contract.mjs scripts/verify-comfyui-unified-node-contract.mjs
git commit -m "refactor: retire legacy comfyui node entries"
```

### Task 5: Document the final model and run the full ComfyUI verification chain

**Files:**
- Modify: `docs/systems/canvas/node-and-data-model.md`
- Modify: `docs/systems/harness/subharness-convention.md`
- Modify: `docs/logbooks/daily/2026/2026-07/2026-07-03.md`
- Modify: `package.json`

- [ ] **Step 1: Add the final docs and harness expectations**

```md
<!-- docs/systems/canvas/node-and-data-model.md -->
## `comfyui`

- Single visible ComfyUI node in the canvas.
- RH-style shell with sections for selector, materials, parameters, runtime, and output summary.
- Workflow selector always appears above machine selector.
- External ports remain one input / one output.
- Machine selection is constrained by shared workflow `instanceBindings`.
```

```md
<!-- docs/systems/harness/subharness-convention.md -->
## ComfyUI governance chain

- `npm run verify:comfyui-workflow-parser-contract`
- `npm run verify:admin-comfyui-governance-contract`
- `npm run verify:comfyui-canvas-schema-contract`
- `npm run verify:comfyui-unified-node-contract`
- `npm run verify:comfyui-legacy-node-migration-contract`
- `npm run verify:comfyui-execution-helpers`
- `node scripts/verify-comfyui-instance-pool-contract.mjs`
```

- [ ] **Step 2: Record the delivery batch and keep the harness entry point current**

```md
<!-- docs/logbooks/daily/2026/2026-07/2026-07-03.md -->
- ComfyUI 节点完成 RH 风格壳层重构，顶部固定工作流 + 机器两级选择。
- ComfyUI 后台治理补齐 displayTier 和 instanceBindings，管理员可决定默认机器和可运行机器。
- 统一输出口继续保留，详细结构化输出通过 `outputs` 返回给下游链路。
```

```json
// package.json
"harness:verify:comfyui": "npm run verify:comfyui-workflow-parser-contract && npm run verify:admin-comfyui-governance-contract && npm run verify:comfyui-canvas-schema-contract && npm run verify:comfyui-unified-node-contract && npm run verify:comfyui-legacy-node-migration-contract && npm run verify:comfyui-execution-helpers && node scripts/verify-comfyui-instance-pool-contract.mjs"
```

- [ ] **Step 3: Run CodeGraph sync and the full ComfyUI / harness verification chain**

Run: `npm run codegraph:sync && npm run type-check -w @xinghuan/api && npm run type-check -w @xinghuan/admin && npm run type-check -w @xinghuan/web && npm run harness:verify:comfyui && npm run verify:project-harness-contract`  
Expected:

- CodeGraph sync completes
- API/admin/web type-checks pass
- `harness:verify:comfyui` passes end to end
- `verify:project-harness-contract` passes

- [ ] **Step 4: Do a final worktree review before shipping**

Run: `git status --short && git diff --stat`  
Expected:

- only intended ComfyUI files remain modified
- no stray runtime artifacts or unrelated staged files appear

- [ ] **Step 5: Commit**

```bash
git add docs/systems/canvas/node-and-data-model.md docs/systems/harness/subharness-convention.md docs/logbooks/daily/2026/2026-07/2026-07-03.md package.json
git commit -m "docs: record comfyui rh-style machine selection rollout"
```

## Self-Review Checklist

- Spec coverage:
  - RH-style single node shell: Task 3
  - workflow + machine selectors: Task 3
  - schema-first display tiers and instance bindings: Task 1
  - admin machine binding / parameter governance: Task 2
  - single output port with structured outputs: Task 3
  - legacy node retirement and migration: Task 4
  - docs / harness / verification closure: Task 5
- Placeholder scan:
  - no `TODO`, `TBD`, or “similar to previous task” shortcuts remain
- Type consistency:
  - `displayTier`, `instanceBindings`, `executionMode`, `sharedWorkflowId`, and structured `outputs` use the same names across tasks
