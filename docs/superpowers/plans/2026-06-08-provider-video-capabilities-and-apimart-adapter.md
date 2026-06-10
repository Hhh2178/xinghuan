# Provider Video Capabilities And APIMart Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复当前发布模型视频节点对 APIMart 异步视频协议的失败链路，并完成后台视频模型能力开关与画布动态输入联动。

**Architecture:** 先用测试锁定当前失败路径，再把模型元数据从仅有 `inputProfile` 扩展为结构化 `inputCapabilities` 与 `advancedConfig`。后端视频代理新增 APIMart 异步 adapter，后台模型编辑器新增视频输入能力开关，画布视频节点改为按后台能力动态展示参考图、首帧、尾帧输入。

**Tech Stack:** Node.js HTTP API, TypeScript, React, monorepo workspaces, `tsx` verification scripts, existing admin/web single-port verification flow.

---

### Task 1: Lock APIMart Async Video Behavior With Failing Tests

**Files:**
- Create: `scripts/verify-apimart-video-adapter-contract.ts`
- Modify: `scripts/verify-external-video-proxy.mjs`
- Modify: `package.json`
- Reference: `apps/api/src/server.ts`

- [ ] **Step 1: Write the failing adapter contract test**

```ts
import { strict as assert } from "node:assert";
import { createApimartVideoAdapterPayload, extractApimartTask, extractApimartVideoResult } from "../apps/api/src/apimart-video-adapter.js";

const payload = createApimartVideoAdapterPayload({
  modelId: "grok-imagine-1.5-video-apimart",
  prompt: "demo",
  ratio: "16:9",
  duration: 6,
  resolution: "720p",
  images: ["https://example.com/a.png"],
});

assert.equal(payload.size, "16:9");
assert.equal(payload.quality, "720p");
assert.deepEqual(payload.image_urls, ["https://example.com/a.png"]);

const task = extractApimartTask({ code: 200, data: [{ task_id: "task_123", status: "submitted" }] });
assert.equal(task.taskId, "task_123");

const result = extractApimartVideoResult({
  code: 200,
  data: { status: "completed", result: { videos: ["https://example.com/out.mp4"] } },
});
assert.deepEqual(result.videoUrls, ["https://example.com/out.mp4"]);
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `npx tsx scripts/verify-apimart-video-adapter-contract.ts`

Expected: FAIL with module-not-found for `apps/api/src/apimart-video-adapter.js` or missing exported functions.

- [ ] **Step 3: Extend external video proxy verification with async APIMart expectation**

Add a second mock path in `scripts/verify-external-video-proxy.mjs`:

```js
if (request.url === "/v1/videos/generations") {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ code: 200, data: [{ task_id: "task_verify_123", status: "submitted" }] }));
  return;
}
if (request.url === "/v1/tasks/task_verify_123") {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ code: 200, data: { status: "completed", result: { videos: [`http://127.0.0.1:${address.port}/asset.mp4`] } } }));
  return;
}
```

- [ ] **Step 4: Run the video proxy verification and verify RED**

Run: `npm run verify:external-video-proxy`

Expected: FAIL on APIMart branch with `上游未返回可用视频 URL` or payload/endpoint mismatch.

- [ ] **Step 5: Add npm script entry**

Add to `package.json`:

```json
"verify:apimart-video-adapter-contract": "npx tsx scripts/verify-apimart-video-adapter-contract.ts"
```


### Task 2: Add Structured Video Capabilities Metadata

**Files:**
- Modify: `packages/model-core/src/index.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/db/002_provider_model_framework.sql`
- Modify: `scripts/verify-model-catalog.mjs`
- Modify: `apps/web/src/services/api.ts`
- Modify: `apps/admin/src/admin-types.ts`

- [ ] **Step 1: Write the failing catalog expectation**

Extend `scripts/verify-model-catalog.mjs` patch body:

```js
body: JSON.stringify({
  inputProfile: "prompt,image_reference,multi_image",
  inputCapabilities: {
    prompt: true,
    imageReference: true,
    multiImage: true,
    firstFrame: false,
    lastFrame: false,
  },
  advancedConfig: {
    requestMapping: { resolution: "size", referenceImages: "image_urls" },
  },
  parameterSchema: JSON.stringify(customSchema),
}),
```

And add assertions:

```js
results.push(["GET /api/models exposes input capabilities", verifyImageModel?.inputCapabilities?.multiImage === true]);
results.push(["GET /api/models exposes advanced config", verifyImageModel?.advancedConfig?.requestMapping?.resolution === "size"]);
```

- [ ] **Step 2: Run the catalog verification and verify RED**

Run: `npm run verify:model-catalog`

Expected: FAIL because `/api/admin/models/:id` and `/api/models` do not yet preserve `inputCapabilities` and `advancedConfig`.

- [ ] **Step 3: Extend shared model-core types**

In `packages/model-core/src/index.ts`, add:

```ts
export interface ModelInputCapabilities {
  prompt?: boolean;
  imageReference?: boolean;
  multiImage?: boolean;
  firstFrame?: boolean;
  lastFrame?: boolean;
  mask?: boolean;
  audioReference?: boolean;
}

export interface ModelAdvancedConfig {
  mode?: string;
  requestMapping?: Record<string, string>;
  fixedBody?: Record<string, unknown>;
  taskStatusPath?: string;
  taskIdPath?: string;
  resultVideoPath?: string;
  pollPathTemplate?: string;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
}
```

And extend `ModelUiMetadata`:

```ts
inputCapabilities: Required<Pick<ModelInputCapabilities, "prompt" | "imageReference" | "multiImage" | "firstFrame" | "lastFrame">>;
```

- [ ] **Step 4: Add parsing helpers in model-core**

Add:

```ts
export function parseInputCapabilities(value: unknown, capability: ModelCapability): ModelInputCapabilities { /* normalize booleans */ }
export function parseAdvancedConfig(value: unknown): ModelAdvancedConfig { /* object or JSON string */ }
```

Update `uiMetadataFromSchema(...)` to return normalized capability flags.

- [ ] **Step 5: Add persistence fields to API model records**

In `apps/api/src/server.ts` model type, extend:

```ts
inputCapabilities?: Record<string, boolean>;
advancedConfig?: Record<string, unknown>;
```

Read/write them in file-mode and postgres-mode paths.

- [ ] **Step 6: Add migration columns**

In `apps/api/db/002_provider_model_framework.sql`, add:

```sql
alter table xh_models add column if not exists input_capabilities jsonb not null default '{}'::jsonb;
alter table xh_models add column if not exists advanced_config jsonb not null default '{}'::jsonb;
```

- [ ] **Step 7: Expose new metadata through `/api/models`**

In `publicModelCatalog()` return:

```ts
inputCapabilities,
advancedConfig,
ui: {
  ...uiMetadataFromSchema(parameterSchema, capability, inputCapabilities),
}
```

- [ ] **Step 8: Run focused verification for GREEN**

Run:
- `npm run verify:model-catalog`
- `npm run type-check -w @xinghuan/model-core`
- `npm run type-check -w @xinghuan/api`

Expected: PASS.


### Task 3: Implement APIMart Async Video Adapter In API

**Files:**
- Create: `apps/api/src/apimart-video-adapter.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `scripts/verify-external-video-proxy.mjs`
- Test: `scripts/verify-apimart-video-adapter-contract.ts`

- [ ] **Step 1: Create the adapter module**

Add `apps/api/src/apimart-video-adapter.ts` with:

```ts
export function createApimartVideoAdapterPayload(args: {
  modelId: string;
  prompt: string;
  ratio?: string;
  duration?: string | number;
  resolution?: string;
  images?: string[];
}) {
  return {
    model: args.modelId,
    prompt: args.prompt,
    ...(args.ratio ? { size: args.ratio } : {}),
    ...(args.duration ? { duration: Number(args.duration) } : {}),
    ...(args.resolution ? { quality: args.resolution } : {}),
    ...(args.images?.length ? { image_urls: args.images } : {}),
  };
}
```

Also add extractors for submit/status/final video URLs.

- [ ] **Step 2: Verify the new contract test turns GREEN**

Run: `npm run verify:apimart-video-adapter-contract`

Expected: PASS.

- [ ] **Step 3: Route APIMart async video generation through adapter**

In `generateExternalVideoProxy(...)`, branch before default sync extraction:

```ts
if (protocol === "apimart" && shouldUseApimartAsyncVideo(model, body, params)) {
  return generateApimartAsyncVideoProxy({ provider, model, prompt, ratio: requestedRatio, duration: requestedDuration, resolution: requestedResolution, images, user });
}
```

- [ ] **Step 4: Implement polling flow**

Inside `generateApimartAsyncVideoProxy(...)`:

```ts
const submit = await fetch(openAiEndpoint(provider.baseUrl, "videos/generations"), ...);
const { taskId } = extractApimartTask(rawSubmit);
for (let attempt = 0; attempt < maxPolls; attempt += 1) {
  const status = await fetch(openAiEndpoint(provider.baseUrl, `tasks/${taskId}`).replace("/v1/tasks/", "/v1/tasks/"), ...);
  const result = extractApimartVideoResult(rawStatus);
  if (result.status === "completed") { /* download and save */ }
  if (result.status === "failed" || result.status === "cancelled") throw new Error(...);
  await delay(pollIntervalMs);
}
throw new Error("APIMart 视频任务轮询超时");
```

- [ ] **Step 5: Preserve default sync proxy behavior**

Keep existing path for OpenAI-like providers:

```ts
const remoteVideoUrls = extractVideoUrls(raw);
```

Do not regress sync providers.

- [ ] **Step 6: Run video proxy verification for GREEN**

Run: `npm run verify:external-video-proxy`

Expected: PASS with both sync and APIMart async branches saving local `/files/output/...` videos.


### Task 4: Add Backend Video Capability Toggles To Admin Model Editor

**Files:**
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/admin-model-editor.tsx`
- Modify: `apps/admin/src/admin-api-settings-panel.tsx`
- Modify: `apps/admin/src/main.tsx`

- [ ] **Step 1: Extend admin-facing model type**

Add to `ModelRecord`:

```ts
inputCapabilities?: {
  prompt?: boolean;
  imageReference?: boolean;
  multiImage?: boolean;
  firstFrame?: boolean;
  lastFrame?: boolean;
};
advancedConfig?: Record<string, any>;
```

- [ ] **Step 2: Default manual/imported video models conservatively**

In `admin-api-settings-panel.tsx`, change video defaults from:

```ts
"prompt,first_frame,last_frame"
```

to:

```ts
"prompt,image_reference"
```

and include:

```ts
inputCapabilities: {
  prompt: true,
  imageReference: true,
  multiImage: false,
  firstFrame: false,
  lastFrame: false,
}
```

- [ ] **Step 3: Add video capability toggles in `admin-model-editor.tsx`**

Render only for `draft.capability === "video"`:

```tsx
<label><input type="checkbox" checked={draft.inputCapabilities?.multiImage ?? false} ... /> 多参考图</label>
<label><input type="checkbox" checked={draft.inputCapabilities?.firstFrame ?? false} ... /> 首帧</label>
<label><input type="checkbox" checked={draft.inputCapabilities?.lastFrame ?? false} ... /> 尾帧</label>
```

- [ ] **Step 4: Keep `inputProfile` compatible while saving**

Before submit:

```ts
const inputProfile = buildInputProfileFromCapabilities(draft.capability, draft.inputCapabilities);
```

Where video examples become:
- `prompt,image_reference`
- `prompt,image_reference,multi_image`
- `prompt,first_frame`
- `prompt,first_frame,last_frame`

- [ ] **Step 5: Add advanced config JSON editor**

Add a second textarea:

```tsx
<label>
  高级配置（JSON）
  <textarea value={draft.advancedConfigText} ... />
</label>
```

Validate JSON before save and send parsed `advancedConfig`.

- [ ] **Step 6: Run admin type/build verification**

Run:
- `npm run type-check -w @xinghuan/admin`
- `npm run build -w @xinghuan/admin`
- `npm run verify:admin-interaction-guards`

Expected: PASS.


### Task 5: Make Video Node Inputs Follow Published Model Capabilities

**Files:**
- Modify: `apps/web/src/services/api.ts`
- Modify: `apps/web/src/components/nodes/VideoNode.tsx`
- Optional Test Update: `scripts/verify-canvas-node-render-smoke.mjs`

- [ ] **Step 1: Extend frontend model types**

In `apps/web/src/services/api.ts`, add to `PublicModelUi` and `PublicModelRecord`:

```ts
inputCapabilities: {
  prompt: boolean;
  imageReference: boolean;
  multiImage: boolean;
  firstFrame: boolean;
  lastFrame: boolean;
};
advancedConfig?: Record<string, any>;
```

- [ ] **Step 2: Derive capability flags in `VideoNode.tsx`**

Add:

```ts
const videoCaps = backendModel?.ui.inputCapabilities || {
  prompt: true,
  imageReference: backendModel?.ui.maxReferenceImages > 0,
  multiImage: (backendModel?.ui.maxReferenceImages || 0) > 1,
  firstFrame: false,
  lastFrame: false,
};
```

- [ ] **Step 3: Split generic image refs from first/last frame**

Use ordered/local images to derive:

```ts
const firstFrameUrl = videoCaps.firstFrame ? imageUrls[0] || "" : "";
const lastFrameUrl = videoCaps.lastFrame ? imageUrls[videoCaps.firstFrame ? 1 : 0] || "" : "";
const referenceImages = videoCaps.multiImage
  ? imageUrls.slice(0, backendModel?.ui.maxReferenceImages || 1)
  : videoCaps.imageReference
  ? imageUrls.slice(0, 1)
  : [];
```

- [ ] **Step 4: Send model-specific payload**

Backend submission body becomes:

```ts
await generateExternalVideo({
  ...,
  images: referenceImages,
  first_frame: firstFrameUrl || undefined,
  last_frame: lastFrameUrl || undefined,
})
```

- [ ] **Step 5: Make the UI reflect model capability**

Add compact capability hints:

```tsx
{videoCaps.multiImage ? <div>参考图 {Math.min(refsCount, maxRefs)}/{maxRefs}</div> : null}
{videoCaps.firstFrame ? <div>首帧: 使用第 1 张图</div> : null}
{videoCaps.lastFrame ? <div>尾帧: 使用第 {videoCaps.firstFrame ? "2" : "1"} 张图</div> : null}
```

Do not display first/last frame text when the model does not support them.

- [ ] **Step 6: Run web verification**

Run:
- `npm run type-check -w @xinghuan/web`
- `npm run build -w @xinghuan/web`
- `npm run verify:generic-node-catalog`

Expected: PASS.


### Task 6: Final Verification And Documentation Sync

**Files:**
- Modify: `docs/prd/v0.1.0/progress.md`
- Modify: `docs/prd/v0.1.0/changelog.md`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Run the focused acceptance suite**

Run:

```bash
npm run verify:apimart-video-adapter-contract
npm run verify:external-video-proxy
npm run verify:model-catalog
npm run type-check -w @xinghuan/model-core
npm run type-check -w @xinghuan/api
npm run type-check -w @xinghuan/admin
npm run type-check -w @xinghuan/web
```

Expected: all PASS.

- [ ] **Step 2: Run build-level validation**

Run:

```bash
npm run build -w @xinghuan/api
npm run build -w @xinghuan/admin
npm run build -w @xinghuan/web
```

Expected: PASS.

- [ ] **Step 3: Update project logs**

Record:
- APIMart async video adapter landed
- `inputCapabilities` / `advancedConfig` landed
- 后台视频模型能力开关 landed
- 视频节点 capability-driven input rendering landed
- Local verification commands and results

- [ ] **Step 4: Stop before deploy if server credentials or live smoke are required**

If local verification passes but deployment requires remote release switching, summarize the exact local acceptance evidence first, then move to灰度发布 separately.
