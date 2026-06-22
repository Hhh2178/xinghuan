# RunningHub App Workflow Distinction And V2 Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Distinguish RunningHub AI App vs Workflow end to end, auto-switch admin editing when the user fills the wrong area, block mixed-state catalog records, and move AI App submission to the official v2 protocol.

**Architecture:** Add one shared RunningHub target-detection layer that feeds both admin analyze and catalog normalization, then enforce the same kind/target invariants in backend save paths and frontend editor flows. Keep the canvas node and worker thin by consuming normalized catalog descriptors and using the correct protocol per normalized `kind`.

**Tech Stack:** Node.js, TypeScript, React, existing contract-verification scripts, current RunningHub admin/workspace runtime

---

### Task 1: Lock failing contracts for type detection, auto-switch, and v2 app submit

**Files:**
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/scripts/verify-runninghub-analyze-contract.mjs`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/scripts/verify-runninghub-workflow-contract.mjs`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/scripts/verify-runninghub-worker-submit-contract.mjs`

- [ ] **Step 1: Add failing analyze-contract checks for new detection metadata**

```js
assert.match(server, /function detectRunningHubTarget\(/);
assert.match(server, /call-api\/api-detail\/([0-9A-Za-z_-]+)\?apiType=4/);
assert.match(server, /shouldSwitch/);
assert.match(server, /detectedKind/);
assert.match(server, /detectedTargetId/);
assert.match(server, /autoSwitchMessage/);
```

- [ ] **Step 2: Add failing workflow-contract checks for admin auto-switch UI**

```js
[
  "Admin workspace auto-switches tab when analyze detects another RH kind",
  /setActiveTab\(draft\.detectedKind/.test(adminWorkspace) &&
    /已自动切换到 AI 应用区域/.test(adminWorkspace) &&
    /已自动切换到工作流区域/.test(adminWorkspace),
],
[
  "Admin types expose detect metadata for RH analyze draft",
  /detectedKind\?: "app" \| "workflow"/.test(adminTypes) &&
    /detectedTargetId\?: string;/.test(adminTypes) &&
    /autoSwitchMessage\?: string;/.test(adminTypes),
],
```

- [ ] **Step 3: Add failing worker-contract checks for AI App v2 submit**

```js
[
  "AI App submit uses official v2 route",
  /targetType === "app"[\s\S]*\/openapi\/v2\/run\/ai-app\//.test(worker),
],
[
  "AI App query uses v2 query route",
  /targetType === "app"[\s\S]*\/openapi\/v2\/query/.test(worker),
],
[
  "AI App submit body no longer sends taskType ASYNC old-form payload",
  !/taskType:\s*"ASYNC"/.test(worker),
],
```

- [ ] **Step 4: Run the three focused verification scripts and confirm red**

Run:

```powershell
node scripts/verify-runninghub-analyze-contract.mjs
node scripts/verify-runninghub-workflow-contract.mjs
node scripts/verify-runninghub-worker-submit-contract.mjs
```

Expected:

```text
At least one FAIL line in each script for missing detect metadata, missing admin auto-switch, and old AI App protocol usage.
```

- [ ] **Step 5: Commit the red test harness**

```bash
git -C D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b add scripts/verify-runninghub-analyze-contract.mjs scripts/verify-runninghub-workflow-contract.mjs scripts/verify-runninghub-worker-submit-contract.mjs
git -C D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b commit -m "test: lock runninghub kind distinction contracts"
```

### Task 2: Build one shared RunningHub target-detection layer and feed analyze draft

**Files:**
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/runninghub-catalog.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/server.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/admin/src/admin-types.ts`

- [ ] **Step 1: Add a normalized detection result shape**

```ts
export interface RunningHubDetectedTarget {
  kind?: "app" | "workflow";
  targetId: string;
  confidence: "high" | "medium" | "low";
  reason: string;
  shouldSwitch: boolean;
}
```

- [ ] **Step 2: Replace plain `parseRunningHubRef()` fallback logic with structured detection**

```ts
export function detectRunningHubTarget(input: {
  docUrl?: unknown;
  sourceUrl?: unknown;
  runTargetId?: unknown;
  pageId?: unknown;
  requestExample?: Record<string, unknown> | null;
  requestedKind?: "app" | "workflow";
}): RunningHubDetectedTarget {
  const docUrl = safeText(input.docUrl || input.sourceUrl);
  const requestExample = input.requestExample || null;
  const explicitWorkflowId = safeText(requestExample?.workflowId);
  const explicitAppId = safeText(requestExample?.webappId || input.runTargetId);
  const docApiDetailApp = docUrl.match(/call-api\/api-detail\/([0-9A-Za-z_-]+)\?apiType=4/i);
  if (docApiDetailApp) {
    return { kind: "app", targetId: docApiDetailApp[1], confidence: "high", reason: "docUrl 命中 call-api AI App 文档", shouldSwitch: input.requestedKind === "workflow" };
  }
  if (/^workflow-[0-9A-Za-z_-]+$/i.test(explicitWorkflowId || safeText(input.runTargetId))) {
    return { kind: "workflow", targetId: explicitWorkflowId || safeText(input.runTargetId), confidence: "high", reason: "命中 workflow 风格 ID", shouldSwitch: input.requestedKind === "app" };
  }
  if (explicitAppId && /\/run\/ai-app\//i.test(docUrl)) {
    return { kind: "app", targetId: explicitAppId, confidence: "high", reason: "文档与示例共同指向 AI App", shouldSwitch: input.requestedKind === "workflow" };
  }
  return { kind: input.requestedKind, targetId: safeText(input.runTargetId || explicitWorkflowId || explicitAppId), confidence: "low", reason: "仅识别到 targetId，类型待确认", shouldSwitch: false };
}
```

- [ ] **Step 3: Feed detection into analyze draft instead of blindly trusting the tab**

```ts
const requestExampleObject = parseRunningHubExampleObject(input.requestExample);
const detected = detectRunningHubTarget({
  docUrl: input.docUrl,
  sourceUrl: input.sourceUrl,
  runTargetId: input.runTargetId,
  pageId: input.pageId,
  requestExample: requestExampleObject,
  requestedKind: input.kind,
});
const kind = detected.kind === "app" ? "app" : "workflow";
const runTargetId = safeText(input.runTargetId || detected.targetId, pageId || createRunningHubCatalogEntryId(kind));
```

- [ ] **Step 4: Return detection metadata in `RunningHubAnalyzeDraft`**

```ts
return {
  summary: `已根据 ${kind === "app" ? "AI 应用" : "工作流"} 线索生成结构化 RH 草案，请重点核对运行目标、输入槽和执行规则。`,
  detectedKind: detected.kind,
  detectedTargetId: detected.targetId,
  autoSwitchMessage: detected.shouldSwitch
    ? kind === "app"
      ? "检测到这是 AI App，已自动切换到 AI 应用区域"
      : "检测到这是工作流，已自动切换到工作流区域"
    : "",
  warnings,
  sections,
};
```

- [ ] **Step 5: Extend admin types for the new analyze payload**

```ts
export interface RunningHubAnalyzeDraft {
  summary: string;
  sections: RunningHubAnalyzeDraftSection[];
  warnings: string[];
  detectedKind?: "app" | "workflow";
  detectedTargetId?: string;
  autoSwitchMessage?: string;
}
```

- [ ] **Step 6: Run focused verification and confirm green for backend/analyze metadata**

Run:

```powershell
node scripts/verify-runninghub-analyze-contract.mjs
```

Expected:

```text
PASS runninghub analyze contract
```

- [ ] **Step 7: Commit the shared detection layer**

```bash
git -C D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b add apps/api/src/runninghub-catalog.ts apps/api/src/server.ts apps/admin/src/admin-types.ts scripts/verify-runninghub-analyze-contract.mjs
git -C D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b commit -m "feat: detect runninghub app and workflow targets"
```

### Task 3: Add admin auto-switch and explicit feedback in workspace and editor

**Files:**
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/admin/src/admin-runninghub-workspace.tsx`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/admin/src/admin-runninghub-item-editor.tsx`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/admin/src/admin-api-client.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/scripts/verify-runninghub-workflow-contract.mjs`

- [ ] **Step 1: Auto-switch the analyze tab when backend returns a confident other kind**

```tsx
const [analyzeHint, setAnalyzeHint] = useState("");

async function handleAnalyze() {
  const draft = await adminRunningHubApi.analyzeItemDraft({ ...payload, kind: activeTab });
  if (draft.detectedKind && draft.detectedKind !== activeTab) {
    setActiveTab(draft.detectedKind);
  }
  setAnalyzeHint(draft.autoSwitchMessage || draft.summary);
  setAnalyzeDraft(draft);
}
```

- [ ] **Step 2: Render a visible analyze hint block**

```tsx
{analyzeHint ? (
  <div className="admin-runninghub-analyze-panel__hint">
    {analyzeHint}
  </div>
) : null}
```

- [ ] **Step 3: Normalize item editor save payloads so wrong-type remnants are cleared**

```tsx
const payload = {
  title: title.trim(),
  note: note.trim(),
  pageId: pageId.trim(),
  appId: currentKind === "app" ? appId.trim() || nextRunTargetId : "",
  workflowId: currentKind === "workflow" ? workflowId.trim() || nextRunTargetId : "",
  runTargetId: nextRunTargetId,
  taskCapability,
  fields,
  executionRules: nextExecutionRules,
};
```

- [ ] **Step 4: Show current-kind feedback in the editor meta area**

```tsx
<dd>{currentKind === "app" ? "AI 应用" : "工作流"}</dd>
<dd>{runTargetId || "未配置"}</dd>
```

- [ ] **Step 5: Expand the workflow-contract verification for auto-switch copy and cleared field ownership**

```js
[
  "Admin editor clears opposite-type IDs when saving",
  /appId: currentKind === "app"/.test(adminEditor) &&
    /workflowId: currentKind === "workflow"/.test(adminEditor),
],
[
  "Admin workspace shows analyze auto-switch feedback",
  /setAnalyzeHint/.test(adminWorkspace) &&
    /admin-runninghub-analyze-panel__hint/.test(adminWorkspace),
],
```

- [ ] **Step 6: Run verification and confirm green**

Run:

```powershell
node scripts/verify-runninghub-workflow-contract.mjs
node scripts/verify-admin-runninghub-workspace-contract.mjs
```

Expected:

```text
PASS lines for admin auto-switch, cleared opposite-type IDs, and runninghub workspace contract.
```

- [ ] **Step 7: Commit the admin auto-switch flow**

```bash
git -C D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b add apps/admin/src/admin-runninghub-workspace.tsx apps/admin/src/admin-runninghub-item-editor.tsx apps/admin/src/admin-api-client.ts scripts/verify-runninghub-workflow-contract.mjs
git -C D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b commit -m "feat: auto-switch runninghub admin kind"
```

### Task 4: Enforce backend save and enable invariants, normalize catalog state

**Files:**
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/server.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/runninghub-execution-descriptor.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/runninghub-catalog.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/scripts/verify-runninghub-catalog-normalization.mjs`

- [ ] **Step 1: Add one backend invariant guard for RH item kind/target consistency**

```ts
function assertRunningHubTargetConsistency(kind: "app" | "workflow", row: {
  runTargetId?: string;
  appId?: string;
  workflowId?: string;
}) {
  const runTargetId = safeText(row.runTargetId);
  const appId = safeText(row.appId);
  const workflowId = safeText(row.workflowId);
  if (kind === "app") {
    if (workflowId) throw new Error("当前条目已识别为 AI 应用，不能继续保留 workflowId");
    if (!runTargetId && !appId) throw new Error("AI 应用缺少 runTargetId/appId");
    return;
  }
  if (!runTargetId && !workflowId) throw new Error("工作流缺少 runTargetId/workflowId");
  if (appId && !workflowId) throw new Error("当前条目已识别为工作流，不能继续保留 appId");
}
```

- [ ] **Step 2: Apply the guard in create, update, and enable paths**

```ts
const next: RunningHubAdminCatalogEntry = {
  ...entry,
  appId,
  workflowId,
  runTargetId: targetId,
  executionRules: {
    ...baseExecutionRules,
    targetType: kind,
    endpoint: nextExecutionEndpoint,
  },
};
assertRunningHubTargetConsistency(kind, next);
if (next.enabled) assertRunningHubEntryCanBeEnabled(next);
```

- [ ] **Step 3: Normalize public catalog and execution descriptor so app items never leak workflow IDs**

```ts
const appId = kind === "app" ? safeText(item.appId || item.runTargetId || item.pageId) : "";
const workflowId = kind === "workflow" ? safeText(item.workflowId || item.runTargetId || item.pageId) : "";
```

- [ ] **Step 4: Add catalog-normalization checks for app/workflow field ownership**

```js
assert.match(source, /const appId = kind === "app"/);
assert.match(source, /const workflowId = kind === "workflow"/);
assert.doesNotMatch(source, /plain.*=>.*workflow/);
```

- [ ] **Step 5: Run verification and confirm green**

Run:

```powershell
node scripts/verify-runninghub-catalog-normalization.mjs
node scripts/verify-runninghub-workflow-contract.mjs
```

Expected:

```text
PASS runninghub catalog normalization
PASS runninghub workflow contract
```

- [ ] **Step 6: Commit the backend guardrail layer**

```bash
git -C D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b add apps/api/src/server.ts apps/api/src/runninghub-execution-descriptor.ts apps/api/src/runninghub-catalog.ts scripts/verify-runninghub-catalog-normalization.mjs
git -C D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b commit -m "fix: block mixed runninghub catalog targets"
```

### Task 5: Adapt canvas node and web submit contract to normalized kinds

**Files:**
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/web/src/services/generation.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/web/src/services/runninghubCatalog.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/web/src/components/nodes/RunningHubNode.tsx`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/packages/shared/src/runninghub.ts`

- [ ] **Step 1: Tighten the public submit type so the frontend carries normalized kind metadata**

```ts
export interface RhSubmitRequest {
  webappId: string;
  pageId?: string;
  workflowId?: string;
  runTargetId?: string;
  targetType?: "app" | "workflow";
  taskCapability?: "image" | "video" | "audio" | "chat";
  nodeInfoList?: Array<{ nodeId: string; fieldName: string; fieldValue: unknown }>;
  instanceType?: string;
}
```

- [ ] **Step 2: Make the node fail fast on illegal mixed-state presets**

```tsx
if (selectedWorkflowPreset?.kind === "app" && selectedWorkflowPreset.workflowId) {
  throw new Error("当前 RunningHub 条目是 AI 应用，但仍残留 workflowId，请先在后台重新保存该条目");
}
```

- [ ] **Step 3: Keep the node submit path aligned with normalized kind ownership**

```tsx
const resolvedTargetType: "app" | "workflow" = selectedWorkflowPreset?.kind === "app" ? "app" : "workflow";
const resolvedRunTargetId = selectedWorkflowPreset?.runTargetId || webappId;
const resolvedWorkflowId = resolvedTargetType === "workflow"
  ? (selectedWorkflowPreset?.workflowId || resolvedRunTargetId)
  : "";
```

- [ ] **Step 4: Preserve runtime catalog descriptors without reintroducing type guessing**

```ts
return {
  ...base,
  kind: row.kind === "app" ? "app" : "workflow",
  appId: typeof row.appId === "string" ? row.appId : "",
  workflowId: typeof row.workflowId === "string" ? row.workflowId : "",
  runTargetId: typeof row.runTargetId === "string" ? row.runTargetId : "",
};
```

- [ ] **Step 5: Run the runtime-facing contract verification**

Run:

```powershell
node scripts/verify-runninghub-workflow-contract.mjs
node scripts/verify-runninghub-single-node-contract.mjs
```

Expected:

```text
PASS lines confirming the node consumes backend catalog items and preserves normalized RH runtime metadata.
```

- [ ] **Step 6: Commit the canvas/runtime adaptation**

```bash
git -C D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b add apps/web/src/services/generation.ts apps/web/src/services/runninghubCatalog.ts apps/web/src/components/nodes/RunningHubNode.tsx packages/shared/src/runninghub.ts
git -C D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b commit -m "fix: normalize runninghub node runtime kinds"
```

### Task 6: Switch AI App worker submission to official v2 protocol and verify end to end

**Files:**
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/worker/src/worker.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/scripts/verify-runninghub-worker-submit-contract.mjs`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/scripts/verify-local-acceptance-chain.mjs`

- [ ] **Step 1: Change the AI App submit/query routes to v2**

```ts
const submitUrl = targetType === "app"
  ? `${task.providerBaseUrl.replace(/\/+$/, "")}/openapi/v2/run/ai-app/${encodeURIComponent(webappId || runTargetId)}`
  : `${task.providerBaseUrl.replace(/\/+$/, "")}/openapi/v2/run/workflow/${encodeURIComponent(workflowId || runTargetId)}`;
const queryUrl = `${task.providerBaseUrl.replace(/\/+$/, "")}/openapi/v2/query`;
```

- [ ] **Step 2: Remove the old AI App submit body shape**

```ts
const submitRequestBody =
  targetType === "app"
    ? {
        nodeInfoList,
        ...(instanceType ? { instanceType } : {}),
      }
    : {
        apiKey,
        workflowId: workflowId || runTargetId,
        nodeInfoList,
        ...(instanceType ? { instanceType } : {}),
      };
```

- [ ] **Step 3: Keep structured diagnostics intact around the new route**

```ts
throw createWorkerTaskError("RunningHub submit failed", {
  rhFailureStage: "submit",
  rhSubmitUrl: submitUrl,
  rhSubmitTargetType: targetType,
  rhRunTargetId: runTargetId,
  rhWorkflowId: workflowId,
  rhSubmitRequest: submitRequestBodyForLog,
  rhSubmitResponseStatus: submitResponse.status,
  rhSubmitResponseText: submitText,
});
```

- [ ] **Step 4: Extend local acceptance verification to include the worker submit contract**

```js
["verify:runninghub-worker-submit-contract", ["node", ["scripts/verify-runninghub-worker-submit-contract.mjs"], {}]],
```

- [ ] **Step 5: Run focused worker verification and then the grouped acceptance checks**

Run:

```powershell
node scripts/verify-runninghub-worker-submit-contract.mjs
npm run verify:runninghub-analyze-contract
npm run verify:runninghub-workflow-contract
npm run verify:runninghub-queue-governance-contract
node scripts/verify-local-acceptance-chain.mjs
```

Expected:

```text
All scripts exit 0, including PASS runninghub worker submit contract.
```

- [ ] **Step 6: Run build verification before claiming success**

Run:

```powershell
npm run build -w @xinghuan/worker
npm run build:single-port
```

Expected:

```text
Both builds exit 0 with no TypeScript errors.
```

- [ ] **Step 7: Commit the v2 worker switch**

```bash
git -C D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b add apps/worker/src/worker.ts scripts/verify-runninghub-worker-submit-contract.mjs scripts/verify-local-acceptance-chain.mjs
git -C D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b commit -m "fix: use runninghub ai app v2 submit protocol"
```

### Task 7: Final verification, diff review, and deployment handoff

**Files:**
- Modify if needed: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/DEVLOG.md`
- Modify if needed: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/MEMORY.md`
- Modify if needed: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/ops/runninghub-protocol-admin-and-canvas-node-rebuild-gray-release-2026-06-22.md`

- [ ] **Step 1: Run the full fresh verification set**

Run:

```powershell
npm run verify:runninghub-analyze-contract
npm run verify:runninghub-workflow-contract
npm run verify:runninghub-queue-governance-contract
npm run verify:runninghub-workflow-api
node scripts/verify-runninghub-worker-submit-contract.mjs
npm run build:single-port
```

Expected:

```text
All commands exit 0.
```

- [ ] **Step 2: Inspect repository state before any gray deployment**

Run:

```powershell
git -C D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b status --short
git -C D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b diff --stat
```

Expected:

```text
Only intended RH files, verification scripts, and optional release notes remain changed.
```

- [ ] **Step 3: Update operational notes if the protocol changed**

```md
- AI App 主协议已切换为 `/openapi/v2/run/ai-app/{id}`。
- 工作台会在错填 AI App/Workflow 时自动切换分类并给出提示。
- 保存/启用时后端将阻止混合态 RH 条目落库。
```

- [ ] **Step 4: Prepare the release handoff**

```text
Document the exact gray verification target, sample AI App document URL, sample workflow ID case, and the expected admin auto-switch behavior for visual QA.
```

