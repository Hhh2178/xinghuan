# Provider Generation Task Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将后台发布模型的图片、视频、音频生成链路统一升级为“提交任务 -> 后台队列执行 -> 前端轮询状态 -> 素材落库”的标准方案，并同步升级后台管理、AI 协助配置和验收流程。

**Architecture:** 以现有 `xh_tasks + Redis + Worker + 输出素材落库` 为标准执行底座，把后台发布模型从“接口直返优先”切换为“任务执行优先”。前端节点统一轮询我方任务状态，后台模型编辑器与 AI 协助配置统一输出结构化 `executionMode + advancedConfig`，仅为真正低时延、同步返回能力保留 `sync_inline` 例外路径。

**Tech Stack:** TypeScript, React, Vite, Node.js, PostgreSQL repository, Redis queue, systemd, existing `apps/api`, `apps/worker`, `apps/web`, `apps/admin`, `packages/shared`, `packages/model-core`.

---

## Scope And Split

本计划覆盖 5 个关联子系统，但它们共享同一条标准主线，因此保留在同一份执行清单中：

1. 统一 Provider 任务协议与执行模式
2. API 任务提交/查询/取消标准化
3. Worker 图片/视频/音频统一执行
4. 画布图片/视频/音频节点统一接任务链路
5. 后台管理与 AI 协助配置升级

不在本轮强制一起完成的内容：

- 旧 `MJ / FAL / Seedance / RunningHub` 专属协议全部迁入同一 Worker
- 普通短对话 LLM 强制任务化
- 生产真实大规模压测与配额系统

---

## File Structure Map

### Shared Contract

- Create: `packages/shared/src/provider-generation-task.ts`
  - 统一定义 Provider 生成任务类型、执行模式、状态、结果结构、任务 payload 摘要。
- Modify: `packages/shared/src/index.ts`
  - 对外导出新的任务 contract 类型。

### API Layer

- Create: `apps/api/src/provider-generation-task-service.ts`
  - 负责后台发布模型的任务提交、任务状态读取、任务取消、payload 归一化。
- Modify: `apps/api/src/server.ts`
  - 挂载图片/视频/音频标准任务路由；收口旧发布模型路径到新 service。
- Modify: `apps/api/src/external-proxy.ts`
  - 保留同步 fallback 与上游直接调用逻辑，但抽出公共 payload 归一化能力。
- Modify: `apps/api/src/task-lifecycle.ts`
  - 若现有取消 patch 不够，需要补齐标准任务取消语义。

### Worker Layer

- Modify: `apps/worker/src/worker.ts`
  - 把后台发布模型图片/视频/音频任务都收口到统一 dispatch。
- Create: `apps/worker/src/provider-generation-worker.ts`
  - 执行图片/视频/音频后台发布模型任务，复用已有 adapter。
- Modify: `apps/worker/src/output-materials.ts`
  - 确保图片/视频/音频任务成功后统一素材化，并记录统一结果字段。

### Web Layer

- Modify: `apps/web/src/services/generation.ts`
  - 新增标准图片/音频任务 submit/query helper，统一返回结果结构。
- Modify: `apps/web/src/components/nodes/ImageNode.tsx`
  - 后台发布图片模型改为短提交 + 轮询任务表。
- Modify: `apps/web/src/components/nodes/AudioNode.tsx`
  - 后台发布音频模型改为短提交 + 轮询任务表。
- Modify: `apps/web/src/components/nodes/VideoNode.tsx`
  - 对齐当前已做的视频任务模式，抽象成统一 helper。
- Modify: `apps/web/src/components/nodes/NodeRuntimeCard.tsx`
  - 统一展示 `queued/running/succeeded/failed/cancelled` 与标准错误信息。

### Admin Layer

- Modify: `apps/admin/src/admin-types.ts`
  - 增加 `executionMode`、任务能力配置、AI 协助配置结构化字段。
- Modify: `apps/admin/src/admin-model-editor.tsx`
  - 从“自由 JSON 优先”升级为“结构化执行模式 + 高级 JSON 补充”。
- Modify: `apps/admin/src/admin-api-settings-panel.tsx`
  - AI 协助配置输出标准化模板，能推荐 `sync_inline / async_poll / worker_queue`。
- Modify: `apps/admin/src/admin-task-panel.tsx`
  - 增加 capability/provider/model/status 过滤与标准失败原因展示。

### Verification And Docs

- Create: `scripts/verify-provider-generation-task-contract.ts`
- Create: `scripts/verify-provider-generation-task-service.mjs`
- Create: `scripts/verify-provider-generation-worker.mjs`
- Create: `scripts/verify-provider-generation-admin-contract.mjs`
- Modify: `package.json`
  - 注册新 verify 命令。
- Modify: `DEVLOG.md`
- Modify: `MEMORY.md`
- Modify: `docs/prd/v0.1.0/progress.md`
- Modify: `ops/README.md`

---

## Standards To Lock Before Coding

### Standard Execution Modes

- `sync_inline`
  - 仅用于真正短时、同步、无上游 taskId 的能力。
- `async_poll`
  - API 提交上游任务，前端轮询我方 task 状态，Worker 负责轮询上游。
- `async_poll_then_final_lookup`
  - 类似 Agnes，轮询任务状态后还需二段查询最终结果。
- `worker_queue`
  - 我方标准默认值。前端只与任务表交互，后台异步执行。

### Standard Task Status

- `queued`
- `running`
- `succeeded`
- `failed`
- `cancelled`

### Standard Result Fields

- `resourceItemIds`
- `resourceCount`
- `materializedImageUrls`
- `materializedVideoUrls`
- `materializedAudioUrls`
- `remoteImageUrls`
- `remoteVideoUrls`
- `remoteAudioUrls`
- `failureReason`
- `workerId`
- `adapter`

### Default Policy

- 后台发布模型的 `video`：默认 `worker_queue`
- 后台发布模型的 `audio`：默认 `worker_queue`
- 后台发布模型的 `image`：默认 `worker_queue`
- 后台发布模型的 `chat`：默认保留 `sync_inline`，仅为长耗时后台助手分析类预留后续任务化入口

---

### Task 1: Lock Shared Task Contract

**Files:**
- Create: `packages/shared/src/provider-generation-task.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `scripts/verify-provider-generation-task-contract.ts`

- [ ] **Step 1: Write the failing contract test**

```ts
import assert from "node:assert/strict";
import {
  PROVIDER_GENERATION_EXECUTION_MODES,
  PROVIDER_GENERATION_TASK_STATUSES,
} from "../packages/shared/dist/index.js";

assert.deepEqual(PROVIDER_GENERATION_EXECUTION_MODES, [
  "sync_inline",
  "async_poll",
  "async_poll_then_final_lookup",
  "worker_queue",
]);

assert.deepEqual(PROVIDER_GENERATION_TASK_STATUSES, [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/verify-provider-generation-task-contract.ts`  
Expected: FAIL with missing export or missing file.

- [ ] **Step 3: Add the shared contract**

```ts
export const PROVIDER_GENERATION_EXECUTION_MODES = [
  "sync_inline",
  "async_poll",
  "async_poll_then_final_lookup",
  "worker_queue",
] as const;

export type ProviderGenerationExecutionMode =
  (typeof PROVIDER_GENERATION_EXECUTION_MODES)[number];

export const PROVIDER_GENERATION_TASK_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const;

export type ProviderGenerationTaskStatus =
  (typeof PROVIDER_GENERATION_TASK_STATUSES)[number];
```

- [ ] **Step 4: Export from shared entrypoint**

```ts
export * from "./provider-generation-task.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx tsx scripts/verify-provider-generation-task-contract.ts`  
Expected: PASS with no output or `{ ok: true }`.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/provider-generation-task.ts packages/shared/src/index.ts scripts/verify-provider-generation-task-contract.ts
git commit -m "feat: add provider generation task contract"
```

### Task 2: Build Generic API Task Service For Published Provider Models

**Files:**
- Create: `apps/api/src/provider-generation-task-service.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/external-proxy.ts`
- Test: `scripts/verify-provider-generation-task-service.mjs`

- [ ] **Step 1: Write the failing API service contract test**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("apps/api/src/server.ts", "utf8");
assert.match(source, /\/api\/proxy\/external\/image\/task/);
assert.match(source, /\/api\/proxy\/external\/audio\/task/);
assert.match(source, /\/api\/proxy\/external\/video\/task/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-provider-generation-task-service.mjs`  
Expected: FAIL because image/audio task routes do not yet exist.

- [ ] **Step 3: Create generic service**

```ts
export async function submitProviderGenerationTask(input: {
  capability: "image" | "video" | "audio";
  rawBody: unknown;
  user: CurrentUser;
  publicOrigin: string;
}) {
  // 1. locate enabled provider/model
  // 2. normalize parameter schema and input capabilities
  // 3. normalize provider file signed URLs
  // 4. build task payload
  // 5. insert task row and enqueue
  // 6. return taskId/status/provider metadata
}

export async function readProviderGenerationTaskStatus(taskId: string, user: CurrentUser) {
  // owner check + normalized result
}
```

- [ ] **Step 4: Mount image/audio task routes in `server.ts`**

```ts
if (url.pathname === "/api/proxy/external/image/task" && request.method === "POST") {
  sendT8(response, await submitProviderGenerationTask({
    capability: "image",
    rawBody: await readJsonBody(request),
    user: currentUser!,
    publicOrigin: providerFilePublicOrigin(request),
  }));
  return;
}

if (url.pathname === "/api/proxy/external/audio/task" && request.method === "POST") {
  sendT8(response, await submitProviderGenerationTask({
    capability: "audio",
    rawBody: await readJsonBody(request),
    user: currentUser!,
    publicOrigin: providerFilePublicOrigin(request),
  }));
  return;
}
```

- [ ] **Step 5: Add task query routes**

```ts
const externalImageTaskMatch = url.pathname.match(/^\/api\/proxy\/external\/image\/task\/([^/]+)$/);
if (externalImageTaskMatch && request.method === "GET") {
  sendT8(response, await readProviderGenerationTaskStatus(decodeURIComponent(externalImageTaskMatch[1]), currentUser!));
  return;
}
```

- [ ] **Step 6: Run API build and contract test**

Run:

```bash
npm run build -w @xinghuan/api
node scripts/verify-provider-generation-task-service.mjs
```

Expected: build PASS, contract PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/provider-generation-task-service.ts apps/api/src/server.ts apps/api/src/external-proxy.ts scripts/verify-provider-generation-task-service.mjs
git commit -m "feat: add provider generation task api service"
```

### Task 3: Route Published Provider Image/Video/Audio Tasks Through Worker

**Files:**
- Create: `apps/worker/src/provider-generation-worker.ts`
- Modify: `apps/worker/src/worker.ts`
- Modify: `apps/worker/src/output-materials.ts`
- Test: `scripts/verify-provider-generation-worker.mjs`

- [ ] **Step 1: Write the failing worker contract test**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("apps/worker/src/worker.ts", "utf8");
assert.match(source, /executeProviderGenerationTask/);
assert.match(source, /task\.capability === "audio"/);
assert.match(source, /task\.capability === "image"/);
assert.match(source, /task\.capability === "video"/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-provider-generation-worker.mjs`  
Expected: FAIL because generic worker entry does not exist.

- [ ] **Step 3: Create generic worker executor**

```ts
export async function executeProviderGenerationTask(task: TaskRow): Promise<Record<string, unknown>> {
  if (task.capability === "image") return executeProviderImageTask(task);
  if (task.capability === "video") return executeProviderVideoTask(task);
  if (task.capability === "audio") return executeProviderAudioTask(task);
  throw new Error(`Unsupported capability: ${task.capability}`);
}
```

- [ ] **Step 4: Replace inline dispatch in `worker.ts`**

```ts
async function executeTask(task: TaskRow): Promise<Record<string, unknown>> {
  if (!task.providerId && !task.modelRecordId) {
    return { adapter: "noop", note: "未绑定 Provider/Model，按后台队列健康检查任务完成" };
  }
  return executeProviderGenerationTask(task);
}
```

- [ ] **Step 5: Normalize worker result patch for all capabilities**

```ts
return {
  adapter: "provider-audio",
  providerId: task.providerId,
  modelId: task.providerModelId,
  audioUrls: result.audioUrls,
  remoteAudioUrls: result.remoteAudioUrls,
  audioCount: result.audioUrls.length,
};
```

- [ ] **Step 6: Extend output materializer for audio result patch parity**

```ts
resultPatch: {
  resourceItemIds: resourceItems.map((item) => item.id),
  resourceCount: resourceItems.length,
  materializedImageUrls: ...,
  materializedVideoUrls: ...,
  materializedAudioUrls: resourceItems.filter((item) => item.kind === "audio").map((item) => item.fileUrl || item.url).filter(Boolean),
}
```

- [ ] **Step 7: Run worker build and contract test**

Run:

```bash
npm run build -w @xinghuan/worker
node scripts/verify-provider-generation-worker.mjs
```

Expected: build PASS, contract PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/worker/src/provider-generation-worker.ts apps/worker/src/worker.ts apps/worker/src/output-materials.ts scripts/verify-provider-generation-worker.mjs
git commit -m "feat: unify provider generation worker execution"
```

### Task 4: Standardize Web Generation Service Task Helpers

**Files:**
- Modify: `apps/web/src/services/generation.ts`
- Test: `scripts/verify-generation-json-response-contract.mjs`
- Test: `scripts/verify-provider-generation-task-contract.ts`

- [ ] **Step 1: Write the failing helper presence test**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("apps/web/src/services/generation.ts", "utf8");
assert.match(source, /submitExternalImageTask/);
assert.match(source, /queryExternalImageTask/);
assert.match(source, /submitExternalAudioTask/);
assert.match(source, /queryExternalAudioTask/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-generation-json-response-contract.mjs`  
Expected: FAIL or helper not found.

- [ ] **Step 3: Add image/audio task helpers**

```ts
export async function submitExternalImageTask(req: GenerateExternalImageRequest) {
  const r = await fetch("/api/proxy/external/image/task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const data = await readJsonResponse(r, "后台图像任务提交接口");
  if (!r.ok || !data.success) throw new Error(data?.error || `HTTP ${r.status}`);
  return data.data || {};
}
```

- [ ] **Step 4: Add common task status shape**

```ts
export interface ExternalProviderTaskStatusResult {
  taskId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled" | string;
  progress?: string;
  imageUrls?: string[];
  videoUrls?: string[];
  audioUrls?: string[];
  error?: string;
  raw?: any;
  logs?: string[];
}
```

- [ ] **Step 5: Run web build**

Run: `npm run build -w @xinghuan/web`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/services/generation.ts
git commit -m "feat: add standard provider task helpers"
```

### Task 5: Move Published Provider Image And Audio Nodes To Task Mode

**Files:**
- Modify: `apps/web/src/components/nodes/ImageNode.tsx`
- Modify: `apps/web/src/components/nodes/AudioNode.tsx`
- Modify: `apps/web/src/components/nodes/VideoNode.tsx`
- Modify: `apps/web/src/components/nodes/NodeRuntimeCard.tsx`
- Test: `scripts/verify-video-node-backend-inputs-contract.ts`
- Test: `scripts/verify-audio-provider-model-selection-contract.ts`

- [ ] **Step 1: Write node contract tests**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const imageSource = readFileSync("apps/web/src/components/nodes/ImageNode.tsx", "utf8");
const audioSource = readFileSync("apps/web/src/components/nodes/AudioNode.tsx", "utf8");

assert.match(imageSource, /submitExternalImageTask/);
assert.match(audioSource, /submitExternalAudioTask/);
assert.match(audioSource, /queryExternalAudioTask/);
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx tsx scripts/verify-audio-provider-model-selection-contract.ts
npx tsx scripts/verify-video-node-backend-inputs-contract.ts
```

Expected: existing tests may pass, but new contract assertions fail until task helpers are wired.

- [ ] **Step 3: Update backend image model path**

```ts
const submit = await submitExternalImageTask({
  providerId: backendModel.providerId,
  providerModel: backendModel.modelId,
  model: backendModel.modelId,
  prompt: finalPrompt,
  images: refs,
  providerParams: { ...(d?.providerParams || {}), modelRecordId: backendModel.id, sourceNodeId: id },
});
if (!submit.taskId) throw new Error("后台图像任务没有返回 taskId");
update({ status: "polling", taskId: submit.taskId, progress: submit.progress || "5%" });
```

- [ ] **Step 4: Update backend audio model path**

```ts
const submit = await submitExternalAudioTask({
  providerId: backendAudioModel.providerId,
  providerModel: backendAudioModel.modelId,
  model: backendAudioModel.modelId,
  mode,
  text: finalPrompt,
  sampleDataUrl,
  providerParams: { ...(d?.providerParams || {}), modelRecordId: backendAudioModel.id, sourceNodeId: id },
});
```

- [ ] **Step 5: Extract unified task polling UI behavior**

```ts
if (status === "queued") return "排队中";
if (status === "running") return progress || "执行中";
if (status === "failed") return error || "任务失败";
```

- [ ] **Step 6: Run web build and node verifiers**

Run:

```bash
npm run build -w @xinghuan/web
npx tsx scripts/verify-video-node-backend-inputs-contract.ts
npx tsx scripts/verify-audio-provider-model-selection-contract.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/nodes/ImageNode.tsx apps/web/src/components/nodes/AudioNode.tsx apps/web/src/components/nodes/VideoNode.tsx apps/web/src/components/nodes/NodeRuntimeCard.tsx
git commit -m "feat: move provider image and audio nodes to task mode"
```

### Task 6: Upgrade Admin Model Editor To Standard Execution Modes

**Files:**
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/admin-model-editor.tsx`
- Test: `scripts/verify-provider-generation-admin-contract.mjs`

- [ ] **Step 1: Write failing admin contract test**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("apps/admin/src/admin-model-editor.tsx", "utf8");
assert.match(source, /executionMode/);
assert.match(source, /worker_queue/);
assert.match(source, /async_poll_then_final_lookup/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-provider-generation-admin-contract.mjs`  
Expected: FAIL because execution mode UI is absent.

- [ ] **Step 3: Add structured model execution mode**

```ts
export type ProviderGenerationExecutionMode =
  | "sync_inline"
  | "async_poll"
  | "async_poll_then_final_lookup"
  | "worker_queue";

export interface ModelRecord {
  executionMode?: ProviderGenerationExecutionMode;
}
```

- [ ] **Step 4: Render structured execution mode selector**

```tsx
<select
  value={executionMode}
  onChange={(event) => setExecutionMode(event.target.value as ProviderGenerationExecutionMode)}
>
  <option value="sync_inline">同步直返</option>
  <option value="async_poll">异步轮询</option>
  <option value="async_poll_then_final_lookup">异步轮询 + 最终结果查询</option>
  <option value="worker_queue">后台任务队列</option>
</select>
```

- [ ] **Step 5: Save execution mode into advanced config bridge**

```ts
advancedConfig.mode = executionMode === "worker_queue" ? "worker_queue" : advancedConfig.mode;
```

- [ ] **Step 6: Run admin build and contract test**

Run:

```bash
npm run build -w @xinghuan/admin
node scripts/verify-provider-generation-admin-contract.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/admin-types.ts apps/admin/src/admin-model-editor.tsx scripts/verify-provider-generation-admin-contract.mjs
git commit -m "feat: add structured execution mode editor"
```

### Task 7: Upgrade AI-Assisted Provider Configuration To Emit Standard Templates

**Files:**
- Modify: `apps/admin/src/admin-api-settings-panel.tsx`
- Modify: `apps/api/src/server.ts`
- Test: `scripts/verify-admin-assistant-structured-analysis-contract.mjs`

- [ ] **Step 1: Write failing template contract assertions**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("apps/api/src/server.ts", "utf8");
assert.match(source, /recommendedLayer/);
assert.match(source, /chainTemplate/);
assert.match(source, /executionMode/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-admin-assistant-structured-analysis-contract.mjs`  
Expected: FAIL until `executionMode` is emitted end-to-end.

- [ ] **Step 3: Extend assistant analysis result**

```ts
{
  recommendedLayer: "default" | "advanced" | "adapter";
  chainTemplate: "sync_inline_result" | "async_task_poll_result" | "async_task_poll_then_final_lookup" | "adapter_manual_model_catalog";
  executionMode: "sync_inline" | "async_poll" | "async_poll_then_final_lookup" | "worker_queue";
}
```

- [ ] **Step 4: Render explicit recommendation in admin UI**

```tsx
<dd>{assistantValue(assistantResult?.executionMode, "未建议")}</dd>
<dd>{assistantValue(assistantResult?.chainTemplate, "未建议")}</dd>
```

- [ ] **Step 5: Auto-fill model draft from assistant result**

```ts
executionMode: assistantResult?.executionMode || existingModel?.executionMode || "worker_queue",
advancedConfig: modelDraft.advancedConfig || existingModel?.advancedConfig || {},
```

- [ ] **Step 6: Run admin build + assistant contract test**

Run:

```bash
npm run build -w @xinghuan/admin
npm run build -w @xinghuan/api
node scripts/verify-admin-assistant-structured-analysis-contract.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/admin-api-settings-panel.tsx apps/api/src/server.ts
git commit -m "feat: standardize ai provider configuration templates"
```

### Task 8: Strengthen Admin Task Panel And Operator Workflows

**Files:**
- Modify: `apps/admin/src/admin-task-panel.tsx`
- Modify: `apps/admin/src/main.tsx`
- Test: `scripts/verify-admin-task-panel-contract.mjs`

- [ ] **Step 1: Add failing UI contract assertions**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("apps/admin/src/admin-task-panel.tsx", "utf8");
assert.match(source, /providerId/);
assert.match(source, /modelId/);
assert.match(source, /failureReason|error/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-admin-task-panel-contract.mjs`  
Expected: FAIL because new filters or failure blocks are absent.

- [ ] **Step 3: Add list filters**

```tsx
const filtered = tasks.filter((task) => {
  if (selectedCapability && task.capability !== selectedCapability) return false;
  if (selectedProvider && task.providerId !== selectedProvider) return false;
  if (selectedStatus && task.status !== selectedStatus) return false;
  return true;
});
```

- [ ] **Step 4: Surface failure reason and logs**

```tsx
{task.status === "failed" ? (
  <pre>{task.result?.failureReason || task.result?.error || task.logs?.slice(-1)[0] || "未知失败"}</pre>
) : null}
```

- [ ] **Step 5: Run admin build and task panel verifier**

Run:

```bash
npm run build -w @xinghuan/admin
node scripts/verify-admin-task-panel-contract.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/admin-task-panel.tsx apps/admin/src/main.tsx
git commit -m "feat: improve admin task observability"
```

### Task 9: Update Verification Matrix, Docs, And Release Checklist

**Files:**
- Modify: `package.json`
- Modify: `DEVLOG.md`
- Modify: `MEMORY.md`
- Modify: `docs/prd/v0.1.0/progress.md`
- Modify: `ops/README.md`
- Create: `ops/provider-generation-task-rollout-checklist-2026-06-12.md`

- [ ] **Step 1: Register all new verify commands**

```json
{
  "verify:provider-generation-task-contract": "npx tsx scripts/verify-provider-generation-task-contract.ts",
  "verify:provider-generation-task-service": "node scripts/verify-provider-generation-task-service.mjs",
  "verify:provider-generation-worker": "node scripts/verify-provider-generation-worker.mjs",
  "verify:provider-generation-admin-contract": "node scripts/verify-provider-generation-admin-contract.mjs"
}
```

- [ ] **Step 2: Write rollout checklist doc**

```md
- gray deploy first
- verify api/worker active
- verify redis queue depth
- verify submit returns taskId
- verify status reaches succeeded
- verify output node receives material
- verify admin task panel shows logs
- verify cancel/retry behavior
```

- [ ] **Step 3: Update memory and progress docs**

```md
- 已将后台发布模型统一任务化标准确定为默认方案。
- 图片/视频/音频后台模型后续默认走 worker_queue。
- sync_inline 仅保留给真正短时同步能力。
```

- [ ] **Step 4: Run final verification batch**

Run:

```bash
npm run build:single-port
npm run verify:provider-generation-task-contract
npm run verify:provider-generation-task-service
npm run verify:provider-generation-worker
npm run verify:provider-generation-admin-contract
```

Expected: all local contracts PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json DEVLOG.md MEMORY.md docs/prd/v0.1.0/progress.md ops/README.md ops/provider-generation-task-rollout-checklist-2026-06-12.md
git commit -m "docs: add provider generation task rollout checklist"
```

---

## Gray Rollout Sequence

1. Deploy API + Worker + Web + Admin to gray only.
2. Verify `https://canvas-next.hhh2121.xyz/api/status`.
3. Log into gray admin and confirm:
   - model editor shows `executionMode`
   - AI assist panel shows chain template and execution mode recommendation
   - task panel shows capability/provider/model/error
4. In gray canvas, run:
   - one backend image model task
   - one backend video model task
   - one backend audio model task
5. Confirm each task:
   - returns `taskId`
   - enters `queued/running`
   - lands output into output node
   - lands material into generation/resource library
6. Only after all three pass, consider production cutover.

## Production Release Gate

- Gray release and manual acceptance completed
- `systemctl is-active` for API and Worker both `active`
- Redis queue healthy
- No repeated `failed` tasks caused by new contract mismatch
- One low-cost production smoke for each standardized capability
- Production static bundle version verified after deploy

## Open Questions To Resolve During Execution

1. Whether backend published image models with truly synchronous upstream should still be forced through `worker_queue`, or allow `sync_inline` opt-out.
2. Whether backend published audio `tts` should always queue, or only `voice_clone / voice_design`.
3. Whether standard task status query should expose numeric progress or keep text-only progress first.
4. Whether task cancellation should remain “best effort” until each provider defines explicit upstream cancel path.

## Self-Review

- Spec coverage:
  - 后台发布图片、视频、音频任务化：covered by Tasks 2, 3, 4, 5
  - 后台管理与 AI 协助配置升级：covered by Tasks 6, 7, 8
  - 标准方案与 rollout checklist：covered by Tasks 1 and 9
- Placeholder scan:
  - No `TODO/TBD/implement later`
  - Each task has file paths, commands, and code examples
- Type consistency:
  - Execution modes are consistently named `sync_inline`, `async_poll`, `async_poll_then_final_lookup`, `worker_queue`
  - Task statuses are consistently named `queued`, `running`, `succeeded`, `failed`, `cancelled`

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-12-provider-generation-task-standardization.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
