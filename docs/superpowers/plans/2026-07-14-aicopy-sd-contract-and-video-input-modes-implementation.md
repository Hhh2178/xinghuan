# AICopy SD Contract And Universal Video Input Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver `v0.6.4` with AICopy protocol-scoped SD request contracts, model-level opt-in, and universal reference-image/first-frame/first-last-frame modes whose image and audio limits are enforced consistently from admin configuration through canvas submission and Worker payload generation.

**Architecture:** Treat `provider.protocol === "aicopy"` as the only activation boundary for the AICopy transport; provider names and URLs do not select runtime behavior. A video model under that provider may independently opt into the SD supplement through `advancedConfig.aicopyRequestContractEnabled`. Model input capabilities decide which universal image modes are visible, parameter schema decides image/audio limits, a pure input resolver produces ordered media and `modeType`, and both the canvas and API enforce the same rules before the Worker applies the optional request contract.

**Tech Stack:** TypeScript, React, Zustand, Node.js HTTP API, PostgreSQL JSONB model configuration, Vitest, existing contract scripts, npm workspaces.

---

## Confirmed Current Failure

The gray `sd2-720p-fast` record currently stores:

```json
{
  "inputCapabilities": {
    "imageReference": true,
    "multiImage": true,
    "firstFrame": false,
    "lastFrame": false,
    "audioReference": false
  },
  "parameterSchema": {
    "duration": {
      "type": "range",
      "min": 4,
      "max": 15,
      "step": 1,
      "default": 6
    }
  }
}
```

This explains the reported behavior:

- only the reference-image mode is generated;
- first-frame and first-last-frame modes are absent;
- `referenceImages.max` is missing, so the backend path falls back to one image;
- `audioReference` is disabled, so the existing Worker `audios` support cannot be reached from the backend-model canvas flow;
- first and last frames are removed from `refs`, but the AICopy `images` contract currently receives only `refs`, so selected frame modes can submit no corresponding frame image.

## Product Rules Locked By This Plan

1. Provider name and Base URL never activate AICopy behavior. The explicit provider protocol `aicopy` is authoritative.
2. Selecting protocol `aicopy` exposes AICopy model controls but does not enable the SD supplement for every model.
3. Each video model has an explicit `aicopyRequestContractEnabled` switch. Default is `false`.
4. The explicit boolean is the only model-level activation source. Existing `requestContract.bindings` without `aicopyRequestContractEnabled=true` remain dormant; no model ID, display name, URL, or stale binding may imply activation.
5. The universal image modes are exactly:
   - `reference`: zero to `referenceImages.max` images; zero images means text-to-video.
   - `first`: exactly one image.
   - `firstlast`: exactly two ordered images, first frame then last frame.
6. Mode availability is model-controlled:
   - `reference` requires `imageReference=true`.
   - `first` requires `firstFrame=true`.
   - `firstlast` requires both `firstFrame=true` and `lastFrame=true`.
7. A model with `audioReference=true` may accept up to `referenceAudio.max` audio URLs. AICopy SD defaults to three.
8. AICopy SD always submits `metadata.enableSound="on"` through a fixed contract binding, even when `audios` is empty.
9. The browser limit is ergonomic; the API limit is authoritative. Excess or invalid media returns a clear 400 error and is never silently truncated for frame modes.
10. Production remains `v0.5.22` until gray configuration, request payload, UI, and one controlled generation are accepted.

## File Map

- `packages/model-core/src/aicopy-video-adapter.ts`: protocol predicate, explicit SD-contract enablement, and payload rendering.
- `packages/model-core/src/index.ts`: shared video input mode, audio-limit, schema, and UI metadata contracts.
- `apps/admin/src/admin-api-settings-panel.tsx`: pass selected Provider protocol into model sections.
- `apps/admin/src/admin-model-editor.tsx`: AICopy-only SD toggle, video audio capability, schema guidance, compatibility normalization, and save validation.
- `apps/admin/src/admin-types.ts`: admin-facing advanced config and model metadata types.
- `apps/web/src/components/nodes/videoNodeBackendInputs.ts`: pure universal mode options, exact slot counts, ordered image resolution, and mode type.
- `apps/web/src/components/nodes/VideoNode.tsx`: render valid modes, constrain connected media, show audio inputs, and submit normalized media.
- `apps/web/src/services/api.ts`: public catalog types for input modes and audio limits.
- `apps/api/src/provider-generation-task-service.ts`: authoritative mode/capability/count validation and queued payload normalization.
- `apps/api/src/external-proxy.ts`: synchronous compatibility path using the same normalized mode and contract gate.
- `apps/worker/src/worker.ts`: apply AICopy transport for protocol `aicopy`, apply SD contract only when enabled, and preserve ordered images/audios.
- `scripts/verify-aicopy-video-adapter-contract.ts`: protocol and SD-contract activation regression coverage.
- `scripts/verify-video-node-backend-inputs-contract.ts`: exact image mode and count regression coverage.
- `scripts/configure-aicopy-sd-model-capabilities.mjs`: dry-run/apply configuration for explicitly selected SD models only.
- `docs/systems/admin/`, `docs/systems/canvas/`, `docs/logbooks/releases/`: system and release records.

### Task 1: Lock Provider And Model Activation Contracts

**Files:**
- Modify: `scripts/verify-aicopy-video-adapter-contract.ts`
- Modify: `packages/model-core/src/aicopy-video-adapter.ts`

- [x] **Step 1: Add failing activation assertions**

Add these cases before changing production code:

```ts
assert.equal(shouldUseAicopyVideoAdapter({ protocol: "aicopy", providerBaseUrl: "https://api.aicopy.top" }), true);
assert.equal(shouldUseAicopyVideoAdapter({ protocol: "openai", providerBaseUrl: "https://api.aicopy.top" }), false);
assert.equal(shouldUseAicopyVideoAdapter({ protocol: "aicopy", providerBaseUrl: "https://renamed.example.com" }), true);

const disabledContractPayload = createAicopyVideoAdapterPayload({
  modelId: "grok-imagine-video-1.5-preview",
  prompt: "test",
  duration: 6,
  requestContractEnabled: false,
  requestContract: {
    bindings: [{ path: "metadata.enableSound", value: "on", type: "string" }],
  },
});
assert.equal("metadata" in disabledContractPayload, false);

const enabledContractPayload = createAicopyVideoAdapterPayload({
  modelId: "sd2-720p-fast",
  prompt: "test",
  duration: 6,
  requestContractEnabled: true,
  requestContract: {
    bindings: [{ path: "metadata.enableSound", value: "on", type: "string" }],
  },
});
assert.deepEqual(enabledContractPayload.metadata, { enableSound: "on" });
```

- [x] **Step 2: Run the contract and verify RED**

Run:

```powershell
npx tsx scripts/verify-aicopy-video-adapter-contract.ts
```

Expected: FAIL because URL fallback still activates AICopy and payload input has no explicit contract switch.

- [x] **Step 3: Make protocol and model switch authoritative**

Change the adapter input and predicate to:

```ts
interface AicopyVideoAdapterPayloadInput {
  requestContractEnabled?: boolean;
  requestContract?: unknown;
  // keep all existing fields unchanged
}

export function shouldUseAicopyVideoAdapter(input: { protocol?: string }) {
  return String(input.protocol || "").trim().toLowerCase() === "aicopy";
}

export function resolveAicopyRequestContractEnabled(config: unknown) {
  const row = plainObject(config);
  return row.aicopyRequestContractEnabled === true;
}

const requestContract = input.requestContractEnabled
  ? normalizeRequestContract(input.requestContract)
  : { bindings: [], resultPaths: undefined };
```

Do not use provider name, model name, or Base URL in the predicate.

- [x] **Step 4: Re-run and verify GREEN**

Run:

```powershell
npx tsx scripts/verify-aicopy-video-adapter-contract.ts
npm run type-check -w @xinghuan/model-core
```

Expected: both commands pass.

- [x] **Step 5: Commit the activation boundary**

```powershell
git add packages/model-core/src/aicopy-video-adapter.ts scripts/verify-aicopy-video-adapter-contract.ts
git commit -m "fix: scope aicopy sd contracts per model"
```

### Task 2: Add Shared Universal Video Input Mode Contracts

**Files:**
- Modify: `packages/model-core/src/index.ts`
- Modify: `apps/web/src/services/api.ts`
- Test: `scripts/verify-video-node-backend-inputs-contract.ts`

- [x] **Step 1: Define exact shared contracts**

Add these types and metadata fields:

```ts
export type VideoInputMode = "reference" | "first" | "firstlast";

export interface ModelParameterSchema {
  referenceImages?: { type?: string; max?: number };
  referenceAudio?: { type?: string; max?: number; formats?: string[] };
  // preserve existing fields
}

export interface ModelUiMetadata {
  maxReferenceImages: number;
  maxReferenceAudios: number;
  inputCapabilities: {
    imageReference: boolean;
    multiImage: boolean;
    firstFrame: boolean;
    lastFrame: boolean;
    audioReference: boolean;
    // preserve existing fields
  };
}
```

Compute `maxReferenceAudios` with the same finite/clamped policy as images, capped at 8 globally; SD configuration will set it to 3.

- [x] **Step 2: Update public catalog DTOs**

Add `maxReferenceAudios` and preserve all existing optional fields in `apps/web/src/services/api.ts`. The client must not synthesize a provider-specific default.

- [x] **Step 3: Type-check shared consumers**

Run:

```powershell
npm run type-check -w @xinghuan/model-core
npm run type-check -w @xinghuan/web
```

Expected: PASS after every catalog consumer receives the new field or treats it as optional during the transition.

- [x] **Step 4: Commit shared contracts**

```powershell
git add packages/model-core/src/index.ts apps/web/src/services/api.ts
git commit -m "feat: define universal video input mode metadata"
```

### Task 3: Make The Admin Editor Protocol-Aware And Model-Scoped

**Files:**
- Modify: `apps/admin/src/admin-api-settings-panel.tsx`
- Modify: `apps/admin/src/admin-model-editor.tsx`
- Modify: `apps/admin/src/admin-types.ts`
- Create: `scripts/verify-admin-aicopy-sd-contract-scope.mjs`

- [x] **Step 1: Write a failing admin scope verifier**

The verifier must assert all of these source contracts:

```js
assert.match(apiSettingsSource, /providerProtocol=\{selected\?\.protocol/);
assert.match(modelEditorSource, /providerProtocol === "aicopy"/);
assert.match(modelEditorSource, /aicopyRequestContractEnabled/);
assert.doesNotMatch(modelEditorSource, /draft\.capability === "video" \? \([\s\S]*?AIFork 视频请求契约/);
```

Run:

```powershell
node scripts/verify-admin-aicopy-sd-contract-scope.mjs
```

Expected: FAIL because all video models currently receive the AIFork guide.

- [x] **Step 2: Pass Provider protocol through the model components**

Use this prop flow:

```tsx
<ModelSection
  providerProtocol={selected?.protocol || "openai"}
  capability={cap}
  models={selectedModels.filter((model) => model.capability === cap)}
  // existing callbacks
/>
```

`ModelSection` passes `providerProtocol` to every `ModelEditorRow`.

- [x] **Step 3: Add the SD supplement switch**

Use the strict shared resolver without mutating the stored model. A stale `requestContract` must not implicitly enable the control:

```ts
const initialContractEnabled = resolveAicopyRequestContractEnabled(model.advancedConfig);
```

Only when `providerProtocol === "aicopy" && draft.capability === "video"` render:

```tsx
<label className="capability-toggle">
  <input
    type="checkbox"
    checked={aicopyRequestContractEnabled}
    onChange={(event) => setAicopyRequestContractEnabled(event.target.checked)}
  />
  <span>启用 SD 补充请求契约</span>
</label>
```

Render the AIFork guide and example only while that switch is enabled.

- [x] **Step 4: Save and validate the explicit switch**

Before `onUpdate`, write:

```ts
advancedConfig.aicopyRequestContractEnabled = aicopyRequestContractEnabled;
```

Validate `requestContract` only when the switch is true. When false, preserve the stored contract for reversible editing but runtime must ignore it.

- [x] **Step 5: Expose audio reference for video models**

Change the capability metadata condition so `audioReference` is visible for `video` as well as `audio` and `chat`:

```ts
visible: capability === "video" || capability === "audio" || capability === "chat";
```

Use the label `参考音频` and description `允许视频模型接入最多由参数 Schema 限定的公网音频素材。`

- [x] **Step 6: Run admin verification**

```powershell
node scripts/verify-admin-aicopy-sd-contract-scope.mjs
npm run type-check -w @xinghuan/admin
npm run build -w @xinghuan/admin
```

Expected: all pass; non-AICopy video models contain no visible AIFork contract panel.

- [x] **Step 7: Commit admin behavior**

```powershell
git add apps/admin/src/admin-api-settings-panel.tsx apps/admin/src/admin-model-editor.tsx apps/admin/src/admin-types.ts scripts/verify-admin-aicopy-sd-contract-scope.mjs
git commit -m "feat: add model-scoped aicopy sd controls"
```

### Task 4: Replace Ambiguous Frame Assignment With Exact Universal Modes

**Files:**
- Modify: `apps/web/src/components/nodes/videoNodeBackendInputs.ts`
- Modify: `scripts/verify-video-node-backend-inputs-contract.ts`

- [x] **Step 1: Replace current expectations with failing exact-mode tests**

Cover these cases:

```ts
const fullCapabilities = {
  prompt: true,
  imageReference: true,
  multiImage: true,
  firstFrame: true,
  lastFrame: true,
  audioReference: true,
};

assert.deepEqual(getBackendFrameModeOptions({
  ...fullCapabilities,
}).map((item) => item.value), ["reference", "first", "firstlast"]);

assert.deepEqual(resolveBackendVideoInputAssignment({
  imageUrls: ["a", "b", "c"],
  frameMode: "first",
  maxReferenceImages: 9,
  inputCapabilities: fullCapabilities,
}), {
  refs: [],
  orderedImages: ["a"],
  firstFrameUrl: "a",
  modeType: "image2video",
  requiredImageCount: 1,
  maxImageCount: 1,
});

assert.deepEqual(resolveBackendVideoInputAssignment({
  imageUrls: ["a", "b", "c"],
  frameMode: "firstlast",
  maxReferenceImages: 9,
  inputCapabilities: fullCapabilities,
}), {
  refs: [],
  orderedImages: ["a", "b"],
  firstFrameUrl: "a",
  lastFrameUrl: "b",
  modeType: "frames2video",
  requiredImageCount: 2,
  maxImageCount: 2,
});
```

Also assert reference mode keeps at most nine and zero images resolves `text2video`.

- [x] **Step 2: Run the verifier and confirm RED**

```powershell
npx tsx scripts/verify-video-node-backend-inputs-contract.ts
```

Expected: FAIL because current values are `auto/first/last/firstlast`, frame images are shifted out of `refs`, and there is no `orderedImages` result.

- [x] **Step 3: Implement one pure resolver**

Use these result fields:

```ts
export interface BackendVideoInputAssignment {
  refs: string[];
  orderedImages: string[];
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  modeType: "text2video" | "image2video" | "frames2video";
  requiredImageCount: 0 | 1 | 2;
  maxImageCount: number;
}
```

Rules:

```ts
const referenceLimit = inputCapabilities.multiImage
  ? Math.max(0, maxReferenceImages)
  : Math.min(1, Math.max(0, maxReferenceImages));

if (frameMode === "first") {
  const firstFrameUrl = imageUrls[0];
  return {
    refs: [],
    orderedImages: firstFrameUrl ? [firstFrameUrl] : [],
    firstFrameUrl,
    modeType: "image2video",
    requiredImageCount: 1,
    maxImageCount: 1,
  };
}
if (frameMode === "firstlast") {
  const firstFrameUrl = imageUrls[0];
  const lastFrameUrl = imageUrls[1];
  return {
    refs: [],
    orderedImages: [firstFrameUrl, lastFrameUrl].filter(Boolean),
    firstFrameUrl,
    lastFrameUrl,
    modeType: "frames2video",
    requiredImageCount: 2,
    maxImageCount: 2,
  };
}
const refs = imageUrls.slice(0, referenceLimit);
return {
  refs,
  orderedImages: refs,
  modeType: refs.length > 0 ? "image2video" : "text2video",
  requiredImageCount: 0,
  maxImageCount: referenceLimit,
};
```

The resolver must not silently use a third image in frame modes. It returns the first one or two for preview, while validation reports an excess count before submission.

- [x] **Step 4: Preserve legacy canvas state safely**

Normalize persisted values as follows:

```ts
auto -> reference
first -> first
firstlast -> firstlast
last -> firstlast when both firstFrame and lastFrame are supported, otherwise reference
```

- [x] **Step 5: Re-run and verify GREEN**

```powershell
npx tsx scripts/verify-video-node-backend-inputs-contract.ts
```

Expected: PASS.

- [x] **Step 6: Commit the resolver**

```powershell
git add apps/web/src/components/nodes/videoNodeBackendInputs.ts scripts/verify-video-node-backend-inputs-contract.ts
git commit -m "feat: enforce universal video image modes"
```

### Task 5: Make The Canvas Render And Enforce Model-Driven Inputs

**Files:**
- Modify: `apps/web/src/components/nodes/VideoNode.tsx`
- Modify: `apps/web/src/components/nodes/videoNodeBackendInputs.ts`
- Modify: `apps/web/src/components/nodes/MaterialPreviewSection.tsx` only if it lacks a per-kind maximum prop
- Test: `scripts/verify-canvas-node-render-smoke.mjs`
- Test: `scripts/verify-video-node-backend-inputs-contract.ts`

- [x] **Step 1: Render only modes enabled by the model**

The select labels must be exactly:

```ts
reference: "参考图"
first: "首帧"
firstlast: "首尾帧"
```

Hide the selector when zero or one mode exists; retain the single valid mode in node state.

- [x] **Step 2: Apply mode-specific UI limits**

Compute:

```ts
const imageLimit = frameMode === "first"
  ? 1
  : frameMode === "firstlast"
    ? 2
    : backendModel.ui.maxReferenceImages;
```

The image material area must display `当前数量/上限`. Reject direct drag, paste, or manual addition after the limit. Upstream connections may expose more media than a node accepts; in that case display the excess count and disable/reject RUN with the same validation message. Never silently truncate during submission.

- [x] **Step 3: Require exact frame counts before RUN**

Use explicit Chinese errors:

```ts
if (frameMode === "first" && imageUrls.length !== 1) {
  throw new Error("首帧模式需要且只能使用 1 张图片");
}
if (frameMode === "firstlast" && imageUrls.length !== 2) {
  throw new Error("首尾帧模式需要且只能使用 2 张图片");
}
```

Reference mode allows zero through the schema maximum.

- [x] **Step 4: Enable backend-model audio materials**

Extend `BackendVideoInputCapabilities` with `audioReference`. When the selected backend model enables it, `resolveVideoPreviewGroups` must include `audio`, and VideoNode must send at most `backendModel.ui.maxReferenceAudios` URLs as `audios`.

- [x] **Step 5: Submit resolved media, not raw media**

Use:

```ts
const assignment = resolveBackendVideoInputAssignment(...);

await submitExternalVideoTask({
  images: assignment.orderedImages,
  first_frame: assignment.firstFrameUrl,
  last_frame: assignment.lastFrameUrl,
  audios: audioUrls.slice(0, backendModel.ui.maxReferenceAudios),
  providerParams: {
    ...existingParams,
    videoInputMode: frameMode,
  },
});
```

- [ ] **Step 6: Verify render and behavior contracts**

Targeted resolver tests, web type-check, web build, and provider-task consumption contract pass locally. Browser render smoke is deferred to the deployed `v0.6.4` gray session because the local gray port is not running and the script's fallback gray credentials are not valid.

```powershell
npx tsx scripts/verify-video-node-backend-inputs-contract.ts
node scripts/verify-canvas-node-render-smoke.mjs
npm run type-check -w @xinghuan/web
npm run build -w @xinghuan/web
```

Expected: all pass.

- [x] **Step 7: Commit canvas behavior**

```powershell
git add apps/web/src/components/nodes/VideoNode.tsx apps/web/src/components/nodes/videoNodeBackendInputs.ts apps/web/src/components/nodes/MaterialPreviewSection.tsx scripts/verify-canvas-node-render-smoke.mjs scripts/verify-video-node-backend-inputs-contract.ts
git commit -m "feat: bind canvas video inputs to model capabilities"
```

Only stage `MaterialPreviewSection.tsx` if the implementation actually requires its maximum-count API.

### Task 6: Enforce The Same Rules In The API Queue Boundary

**Files:**
- Modify: `apps/api/src/provider-generation-task-service.ts`
- Create: `apps/api/src/video-input-validation.ts`
- Create: `apps/api/src/video-input-validation.test.ts`
- Modify: `apps/api/src/external-proxy.ts`

- [x] **Step 1: Write API validation tests**

Create table-driven tests. Validation failures use a dedicated `VideoInputValidationError`; route/service integration must convert it to the repository `HttpError(400, message)` so invalid media never becomes an HTTP 500:

```ts
const fullCaps = {
  prompt: true,
  imageReference: true,
  multiImage: true,
  firstFrame: true,
  lastFrame: true,
  audioReference: true,
};
const tenImages = Array.from({ length: 10 }, (_, index) => `https://example.test/${index}.jpg`);

expect(validateVideoInputs({ mode: "first", images: ["a"], capabilities: fullCaps, maxReferenceImages: 9 })).toMatchObject({ modeType: "image2video", images: ["a"] });
expect(() => validateVideoInputs({ mode: "first", images: [], capabilities: fullCaps, maxReferenceImages: 9 })).toThrow("首帧模式需要且只能使用 1 张图片");
expect(() => validateVideoInputs({ mode: "first", images: ["a", "b"], capabilities: fullCaps, maxReferenceImages: 9 })).toThrow("首帧模式需要且只能使用 1 张图片");
expect(() => validateVideoInputs({ mode: "firstlast", images: ["a"], capabilities: fullCaps, maxReferenceImages: 9 })).toThrow("首尾帧模式需要且只能使用 2 张图片");
expect(() => validateVideoInputs({ mode: "firstlast", images: ["a", "b", "c"], capabilities: fullCaps, maxReferenceImages: 9 })).toThrow("首尾帧模式需要且只能使用 2 张图片");
expect(() => validateVideoInputs({ mode: "reference", images: tenImages, capabilities: fullCaps, maxReferenceImages: 9 })).toThrow("参考图最多允许 9 张");
expect(() => validateVideoInputs({ mode: "first", images: ["a"], capabilities: { ...fullCaps, firstFrame: false }, maxReferenceImages: 9 })).toThrow("当前模型未开启首帧能力");
```

- [x] **Step 2: Run and verify RED**

```powershell
npx vitest run apps/api/src/video-input-validation.test.ts
```

Expected: FAIL because the validation module does not exist.

- [x] **Step 3: Implement a pure validation module**

Return:

```ts
interface ValidatedVideoInputs {
  mode: "reference" | "first" | "firstlast";
  modeType: "text2video" | "image2video" | "frames2video";
  images: string[];
  firstFrame?: string;
  lastFrame?: string;
  audios: string[];
}
```

Validate capabilities before counts. Validate audio count against `maxReferenceAudios`; reject audio when `audioReference=false`.

- [x] **Step 4: Normalize the queued task payload**

In `submitVideoTask`, read `body.images`, `body.audios`, and `params.videoInputMode`, validate non-empty source counts before normalization or slicing, normalize public URLs, call `validateVideoInputs`, and queue:

```ts
{
  images: validated.images,
  first_frame: validated.firstFrame,
  last_frame: validated.lastFrame,
  audios: validated.audios,
  videoInputMode: validated.mode,
  modeType: validated.modeType,
  aicopyRequestContractEnabled: resolveAicopyRequestContractEnabled(advancedConfig)
}
```

Do not use `.slice(...)` to hide excess reference, frame, or audio inputs. Preserve `first_frame` and `last_frame` for generic Provider compatibility while `images` remains the ordered, contract-neutral media sequence.

- [x] **Step 5: Reuse validation in the synchronous proxy path**

Make `apps/api/src/external-proxy.ts` use the same helper so queued and inline requests cannot disagree.

- [ ] **Step 6: Verify API behavior**

Vitest, API type-check/build, task-service, provider-generation contract, and Worker contract pass locally. The synchronous proxy's live verification is deferred until the gray service is deployed because it requires a running API on port `18200`.

```powershell
npx vitest run apps/api/src/video-input-validation.test.ts
npm run type-check -w @xinghuan/api
node scripts/verify-external-video-proxy.mjs
```

Expected: all pass.

- [x] **Step 7: Commit API enforcement**

```powershell
git add apps/api/src/video-input-validation.ts apps/api/src/video-input-validation.test.ts apps/api/src/provider-generation-task-service.ts apps/api/src/external-proxy.ts
git commit -m "fix: enforce video input modes at api boundary"
```

### Task 7: Gate Worker Request Contracts And Preserve Ordered Media

**Files:**
- Modify: `apps/worker/src/worker.ts`
- Modify: `scripts/verify-aicopy-video-adapter-contract.ts`

- [ ] **Step 1: Add Worker source and payload assertions**

Assert the Worker passes:

```ts
requestContractEnabled: resolveAicopyRequestContractEnabled(task.payload)
images: validated ordered task.payload.images
audios: at most three normalized URLs
modeType: task.payload.modeType
```

Add a disabled AICopy Grok fixture containing a stale `requestContract` and prove the contract fields are absent from the built request.

- [ ] **Step 2: Pass explicit enablement into the adapter**

Use:

```ts
const requestContractEnabled = resolveAicopyRequestContractEnabled(task.payload);

createAicopyVideoAdapterPayload({
  // existing fields
  requestContractEnabled,
  requestContract: plainObject(task.payload.requestContract),
});
```

The API task builder must copy `advancedConfig.aicopyRequestContractEnabled` into the queued payload as a strict boolean.

- [ ] **Step 3: Trust normalized mode data, with a compatibility fallback**

Use `task.payload.modeType` when it is one of the three legal runtime values. Only old queued tasks may fall back to inference from `first_frame`, `last_frame`, and `images`.

- [ ] **Step 4: Verify Worker behavior**

```powershell
npx tsx scripts/verify-aicopy-video-adapter-contract.ts
npm run type-check -w @xinghuan/worker
```

Expected: PASS.

- [ ] **Step 5: Commit Worker behavior**

```powershell
git add apps/worker/src/worker.ts scripts/verify-aicopy-video-adapter-contract.ts
git commit -m "fix: apply aicopy sd contracts only when enabled"
```

### Task 8: Configure Explicit SD Models Without Affecting Other AICopy Models

**Files:**
- Create: `scripts/configure-aicopy-sd-model-capabilities.mjs`
- Create: `scripts/verify-aicopy-sd-model-config.mjs`
- Modify: `package.json`

- [ ] **Step 1: Build a dry-run-first configuration tool**

The command interface must be:

```powershell
node scripts/configure-aicopy-sd-model-capabilities.mjs --provider-id=custom-api-1782805467175 --model-id=sd2-720p-fast --dry-run=true
node scripts/configure-aicopy-sd-model-capabilities.mjs --provider-id=custom-api-1782805467175 --model-id=sd2-720p-fast --apply=true
```

Reject a Provider whose protocol is not `aicopy`. Reject a model whose capability is not `video`. Never select models by Provider name.

- [ ] **Step 2: Apply this exact model configuration merge**

```json
{
  "inputCapabilities": {
    "prompt": true,
    "imageReference": true,
    "multiImage": true,
    "firstFrame": true,
    "lastFrame": true,
    "audioReference": true
  },
  "parameterSchema": {
    "referenceImages": { "type": "image[]", "max": 9 },
    "referenceAudio": { "type": "audio[]", "max": 3 },
    "duration": { "type": "range", "min": 4, "max": 15, "step": 1, "default": 15 }
  },
  "advancedConfig": {
    "aicopyRequestContractEnabled": true,
    "requestContract": {
      "bindings": [
        { "path": "duration", "source": "duration", "type": "number" },
        { "path": "metadata.modeType", "source": "modeType", "type": "string" },
        { "path": "metadata.ratio", "source": "ratio", "type": "string" },
        { "path": "metadata.enableSound", "value": "on", "type": "string" },
        { "path": "images", "source": "images", "type": "string[]", "omitWhenEmpty": true },
        { "path": "audios", "source": "audios", "type": "string[]", "omitWhenEmpty": true }
      ],
      "resultPaths": ["result_url", "data.metadata.url", "data.output"]
    }
  }
}
```

Preserve existing ratio options, polling settings, display names, and enablement. Merge the exact SD request bindings by path and preserve unrelated safe bindings/result paths; rerunning must be idempotent. Do not infer SD models by substring during apply; every model ID must be passed explicitly.

- [ ] **Step 3: Verify dry-run diff and exact scope**

The verifier must prove:

- selected SD model receives the merged fields;
- a non-selected AICopy Grok model is byte-for-byte unchanged;
- running the apply twice produces no second diff;
- no API key or cipher field is printed.

Run:

```powershell
node scripts/verify-aicopy-sd-model-config.mjs
```

Expected: PASS.

- [ ] **Step 4: Add package scripts and commit**

```json
{
  "scripts": {
    "verify:aicopy-sd-model-config": "node scripts/verify-aicopy-sd-model-config.mjs"
  }
}
```

```powershell
git add scripts/configure-aicopy-sd-model-capabilities.mjs scripts/verify-aicopy-sd-model-config.mjs package.json package-lock.json
git commit -m "chore: add scoped aicopy sd model configurator"
```

### Task 9: Run Cross-Layer Regression And Responsive UI Acceptance

**Files:**
- Modify only failing tests or implementation files already named above
- Create: `docs/logbooks/validations/2026-07-14-aicopy-sd-video-input-modes.md`

- [ ] **Step 1: Run targeted behavior tests**

```powershell
npx tsx scripts/verify-aicopy-video-adapter-contract.ts
npx tsx scripts/verify-video-node-backend-inputs-contract.ts
npx vitest run apps/api/src/video-input-validation.test.ts
node scripts/verify-admin-aicopy-sd-contract-scope.mjs
node scripts/verify-aicopy-sd-model-config.mjs
node scripts/verify-external-video-proxy.mjs
```

Expected: every command passes.

- [ ] **Step 2: Run workspace checks**

```powershell
npm run type-check -w @xinghuan/model-core
npm run type-check -w @xinghuan/api
npm run type-check -w @xinghuan/worker
npm run type-check -w @xinghuan/admin
npm run type-check -w @xinghuan/web
npm run build:single-port
```

Expected: all pass; existing bundle-size warnings may remain warnings only.

- [ ] **Step 3: Run project governance**

```powershell
npm run verify:file-hotspot-budgets
npm run verify:hotspot-watchlist-contract
npm run harness:verify:project
npm run harness:verify:workspace
```

Expected: all pass.

- [ ] **Step 4: Verify canvas interaction at required widths**

At 1920x1080 and 2560x1440, with the AI assistant both closed and open, verify:

- mode selector text never overlaps neighboring controls;
- reference mode displays `0/9` through `9/9` and rejects the tenth image;
- first mode displays exactly one image slot and rejects a second image;
- first-last mode displays exactly two ordered slots and rejects a third image;
- audio appears only when the selected model enables it and stops at `3/3`;
- switching models immediately recalculates valid modes and limits;
- switching from a broader mode to a narrower mode asks for confirmation before excluding excess material;
- no hidden material remains in the submitted payload.

Record screenshots and network payload evidence in the validation file. Do not include cookies, API keys, signed URLs, or private media URLs.

- [ ] **Step 5: Commit validation evidence**

```powershell
git add docs/logbooks/validations/2026-07-14-aicopy-sd-video-input-modes.md
git commit -m "docs: record aicopy sd input mode validation"
```

### Task 10: Release v0.6.4 To Gray And Perform End-To-End Acceptance

**Files:**
- Modify: root and workspace `package.json` files
- Modify: `package-lock.json`
- Modify: `packages/shared/src/index.ts`
- Create: `docs/logbooks/releases/gray/2026-07-14-aicopy-sd-video-input-modes-v064.md`
- Modify: release entrypoints required by `verify:current-release-entry-consistency`

- [ ] **Step 1: Set version and release identity**

Use:

```text
version: 0.6.4
release: 20260714-aicopy-sd-video-input-modes-v064
```

Update all workspace versions, internal workspace dependency versions, lockfile entries, and `appVersion`.

- [ ] **Step 2: Prepare the gray release**

```powershell
npm run release:gray:prepare -- --release=20260714-aicopy-sd-video-input-modes-v064
```

Expected: version alignment, builds, governance checks, and release package contract all pass.

- [ ] **Step 3: Deploy gray only**

```powershell
npm run release:gray:deploy -- --release=20260714-aicopy-sd-video-input-modes-v064 --archive=dist-release/20260714-aicopy-sd-video-input-modes-v064.tar.gz --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem
```

Do not modify `/opt/apps/xinghuan-canvas/`, port `18100`, or production systemd services.

- [ ] **Step 4: Verify gray runtime**

```powershell
npm run release:gray:verify -- --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem --expected-version=0.6.4 --expected-environment=gray
```

Expected: API and Worker active; internal and public status both return `0.6.4 / gray`.

- [ ] **Step 5: Apply selected model configuration in gray**

First run dry-run for every explicitly approved SD model ID. Review that no Grok or other AICopy model appears in the diff. Then run apply and re-read the model catalog.

For the current reported model, the minimum apply set includes:

```text
sd2-720p-fast
```

Additional SD IDs from the six-model family are applied only when they exist in the selected Provider and the operator lists them explicitly.

- [ ] **Step 6: Run gray end-to-end acceptance**

Verify all of the following through a gray admin and canvas session:

1. A non-AICopy video model has no SD supplement control.
2. An AICopy Grok model with the switch off does not apply `metadata.enableSound` or SD bindings.
3. `sd2-720p-fast` with the switch on exposes reference, first, and first-last modes.
4. First mode submits one ordered image and `modeType=image2video`.
5. First-last mode submits two ordered images and `modeType=frames2video`.
6. Reference mode submits up to nine images and rejects the tenth.
7. With no audio reference, the request still contains `metadata.enableSound="on"` and omits `audios`.
8. With one valid public audio reference, the request contains one `audios` URL.
9. A controlled `15` second, `9:16` generation reaches success, the canvas polling path receives and renders the playable returned video after refresh, and media inspection confirms duration, aspect ratio, and generated audio.
10. Production status still reports `0.5.22 / production`.

- [ ] **Step 7: Update release evidence and push**

Record the gray deployment path, service state, status responses, scoped model configuration diff, UI screenshots, sanitized request shape, result duration/aspect/audio evidence, and rollback target. Commit and push `xinghuan-integration-clean` only after all required acceptance checks pass.

## Rollback And Data Safety

- Code rollback target is the gray release active immediately before `v0.6.4`; record its resolved path before deployment.
- Model configuration changes are JSONB updates. The configurator must capture the previous values for each explicitly selected model and print a sanitized rollback command that restores only those model records.
- Never update every AICopy model in one statement.
- Never select target models by mutable Provider name.
- Do not expose API keys, cookies, signed material URLs, or raw user prompts in logs or validation records.
- Existing queued tasks retain only media-mode compatibility inference. SD request-contract activation is never inferred: tasks without literal `aicopyRequestContractEnabled=true` use the ordinary AICopy transport payload.

## Self-Review Results

- Spec coverage: Provider protocol activation, strict model opt-in, three universal modes, exact 1/2/N image limits, reference audio, fixed sound generation, media ordering, HTTP 400 API enforcement, Worker gating, scoped and idempotent data configuration, result delivery to canvas, responsive UI, gray release, and production protection are each assigned to an implementation task.
- Placeholder scan: no deferred implementation markers are present; every task defines concrete files, behavior, commands, and expected results.
- Type consistency: the plan consistently uses `VideoInputMode = "reference" | "first" | "firstlast"`, `aicopyRequestContractEnabled`, `maxReferenceImages`, `maxReferenceAudios`, and `audioReference` across admin, catalog, canvas, API, and Worker layers.
