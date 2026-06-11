# Multimodal Model Tags And MiMo Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reliable multimodal model capability tagging, per-model connectivity tests, and a provider-backed audio generation / voice clone path using MiMo, while keeping MiniMax out of scope for this iteration.

**Architecture:** Extend the existing provider model registry instead of creating a parallel registry. Keep `capability` as the broad routing category and add fine-grained `capabilityTags` / `testState` for image understanding, video understanding, audio understanding, reasoning, TTS, voice clone, and music generation. Add an `audio` provider path modeled after the existing external image/video proxy, then migrate the old Suno node toward the same provider-backed audio node contract.

**Tech Stack:** TypeScript, React, Vite, Node HTTP API, PostgreSQL admin model table, existing `@xinghuan/model-core`, existing admin panel, existing worker/provider adapter patterns.

---

## Scope

Included:
- Model capability tags for LLM and media models.
- Automatic model tag inference during provider model import.
- Manual tag editing in the admin provider model management UI.
- Per-model test buttons grouped by model type and tag.
- Production-safe model connectivity test endpoints.
- MiMo text-to-speech and MiMo voice clone support.
- A new provider-backed audio generation / voice clone node.
- Suno node audit and migration plan into the new audio path.

Excluded:
- MiniMax provider integration.
- A full music composition provider rewrite beyond preserving or migrating existing Suno behavior.
- Long-term object storage changes.
- Billing / quota UI.

---

## Data Model Design

### Broad Capability

Extend the broad model capability union:

```ts
export type ModelCapability = "chat" | "image" | "video" | "audio";
```

Broad capability remains the first routing decision:
- `chat`: text and multimodal understanding models.
- `image`: image generation / image editing models.
- `video`: video generation models.
- `audio`: TTS, voice clone, audio/music generation, cover, extend.

### Fine-Grained Tags

Add model tags as an array field:

```ts
export type ModelCapabilityTag =
  | "text_chat"
  | "image_understanding"
  | "video_understanding"
  | "audio_understanding"
  | "reasoning"
  | "long_context"
  | "web_search"
  | "image_generation"
  | "image_edit"
  | "video_generation"
  | "tts"
  | "voice_design"
  | "voice_clone"
  | "music_generation"
  | "audio_cover"
  | "audio_extend";
```

Example records:

```json
{
  "capability": "chat",
  "capabilityTags": ["text_chat", "image_understanding", "video_understanding", "reasoning"],
  "inputCapabilities": {
    "prompt": true,
    "imageReference": true,
    "videoReference": true
  }
}
```

```json
{
  "capability": "audio",
  "capabilityTags": ["tts", "voice_clone"],
  "inputCapabilities": {
    "prompt": true,
    "audioReference": true
  },
  "advancedConfig": {
    "mode": "openai_audio_chat",
    "submitPath": "chat/completions",
    "audioFormat": "wav",
    "voiceFieldMode": "preset_or_data_url"
  }
}
```

### Test State

Add test state to the model record:

```ts
export interface ModelTestState {
  chat?: ModelTestResult;
  imageUnderstanding?: ModelTestResult;
  videoUnderstanding?: ModelTestResult;
  imageGeneration?: ModelTestResult;
  videoGeneration?: ModelTestResult;
  audioGeneration?: ModelTestResult;
  voiceClone?: ModelTestResult;
}

export interface ModelTestResult {
  ok: boolean;
  status: number;
  message: string;
  checkedAt: number;
  latencyMs?: number;
  inferredTags?: ModelCapabilityTag[];
  sampleOutput?: string;
}
```

Store `capability_tags` and `test_state` in PostgreSQL and in JSON fallback storage.

---

## File Structure

Modify:
- `packages/model-core/src/index.ts`
  - Add `audio` capability, `ModelCapabilityTag`, `ModelTestState`, audio schema defaults, `videoReference` input capability.
- `apps/api/src/provider-model-catalog.ts`
  - Infer tags from upstream model names such as `qwen3-vl`, `vl`, `vision`, `thinking`, `reasoning`, `tts`, `voiceclone`, `suno`.
- `apps/api/src/server.ts`
  - Normalize/store tags and test state.
  - Add migrations for `capability_tags` and `test_state`.
  - Add admin test endpoints.
  - Add assistant analysis support for audio providers.
- `apps/api/src/external-proxy.ts`
  - Add `generateExternalAudioProxy`.
  - Add chat proxy safeguards for models without image/video tags.
- `apps/admin/src/admin-types.ts`
  - Add `audio`, tags, test state types.
- `apps/admin/src/admin-api-settings-panel.tsx`
  - Show tags, manual tag editor, per-category test buttons.
- `apps/admin/src/admin-model-editor.tsx`
  - Add compact tag chips and test controls inside model sections.
- `apps/admin/src/admin-view-model.ts`
  - Add audio label and test label helpers.
- `apps/web/src/services/generation.ts`
  - Add `generateExternalAudio`.
- `apps/web/src/config/nodeRegistry.ts`
  - Add new audio generation / voice clone node entry.
- `apps/web/src/config/portTypes.ts`
  - Ensure audio input/output ports support audio references.
- `apps/web/src/components/nodes/AudioNode.tsx`
  - Either split old Suno node into legacy mode or rewire to provider-backed audio.
- `apps/web/src/components/nodes/ProviderAudioNode.tsx`
  - Preferred new focused node for MiMo TTS / voice clone.
- `apps/web/src/components/nodes/useUpstreamMaterials.ts`
  - Ensure upstream audio references are collected consistently.
- `apps/worker/src/worker-provider-utils.ts`
  - Add audio model helper if worker-side materialization is needed.

Create:
- `apps/api/src/audio-provider-adapter.ts`
  - Build MiMo audio payloads and parse base64 / URL audio outputs.
- `scripts/verify-model-capability-tags-contract.mjs`
  - Static contract for tag inference and admin UI controls.
- `scripts/verify-external-audio-proxy.mjs`
  - Local mock verification for MiMo-style TTS and voice clone.
- `scripts/verify-provider-model-tests-contract.mjs`
  - Contract for admin model test endpoints.

---

## Task 1: Capability Types And Tag Normalization

**Files:**
- Modify: `packages/model-core/src/index.ts`
- Modify: `apps/api/src/provider-model-catalog.ts`
- Modify: `apps/admin/src/admin-types.ts`
- Test: `scripts/verify-model-capability-tags-contract.mjs`

- [ ] Add `"audio"` to `ModelCapability`.
- [ ] Add `ModelCapabilityTag`.
- [ ] Add `videoReference?: boolean` to `ModelInputCapabilities`.
- [ ] Add `capabilityTags?: ModelCapabilityTag[]` and `testState?: ModelTestState` to admin model records.
- [ ] Update `normalizeCapability()` to accept `audio`, `tts`, `speech`, `voice`, and `music`.
- [ ] Update import inference:
  - `qwen3-vl`, `vl`, `vision`, `omni` => `image_understanding`
  - `video-understanding`, `video`, `vl` plus known video-capable model name => `video_understanding`
  - `thinking`, `reason`, `r1`, `qwq` => `reasoning`
  - `tts`, `speech`, `voice`, `mimo-v2.5-tts` => broad `audio`, tag `tts`
  - `voiceclone`, `voice_clone`, `mimo-v2.5-tts-voiceclone` => broad `audio`, tags `tts`, `voice_clone`
  - `suno`, `music` => broad `audio`, tag `music_generation`
- [ ] Keep generated image/video model detection unchanged except for returning tags as well as broad capability.

Acceptance:
- Qwen/Qwen3-VL-8B-Instruct imports as `chat` with `image_understanding`.
- Qwen/Qwen3-VL-8B-Thinking imports as `chat` with `image_understanding` and `reasoning`.
- MiMo TTS imports as `audio` with `tts`.
- MiMo voice clone imports as `audio` with `tts` and `voice_clone`.

---

## Task 2: Persistence Migration

**Files:**
- Modify: `apps/api/src/server.ts`
- Modify: database migration logic in `apps/api/db` if schema files are present.
- Test: existing admin DB read/write tests plus `scripts/verify-provider-model-tests-contract.mjs`

- [ ] Add nullable `capability_tags jsonb not null default '[]'::jsonb`.
- [ ] Add nullable `test_state jsonb not null default '{}'::jsonb`.
- [ ] Read/write both fields in:
  - PostgreSQL `select` from `xh_models`
  - PostgreSQL `insert into xh_models`
  - PostgreSQL `update xh_models`
  - JSON fallback normalization
- [ ] Backfill existing records by deriving tags from `model_id`, `display_name`, `capability`, and `input_capabilities`.
- [ ] Special backfill:
  - Existing `Qwen/Qwen3-VL-*` gets `image_understanding`.
  - Existing `Qwen/Qwen3-VL-*Thinking*` gets `reasoning`.
  - If a model already has `inputCapabilities.imageReference=true`, add `image_understanding` only when broad capability is `chat`.

Acceptance:
- Existing production records survive migration.
- Existing model IDs do not change.
- Existing image/video generation models keep their current behavior.

---

## Task 3: Admin Manual Tag Editor

**Files:**
- Modify: `apps/admin/src/admin-model-editor.tsx`
- Modify: `apps/admin/src/admin-api-settings-panel.tsx`
- Modify: `apps/admin/src/admin-view-model.ts`
- Modify: `apps/admin/src/styles.css`
- Test: `scripts/verify-model-capability-tags-contract.mjs`

- [ ] Render tags as compact chips on each model row.
- [ ] Add an "编辑能力" control per model.
- [ ] Provide checkboxes grouped as:
  - 理解: image_understanding, video_understanding, audio_understanding, reasoning, long_context, web_search
  - 生成: image_generation, image_edit, video_generation, tts, voice_design, voice_clone, music_generation, audio_cover, audio_extend
- [ ] Keep the current broad `capability` dropdown.
- [ ] When broad capability changes:
  - `chat` defaults to `text_chat`
  - `image` defaults to `image_generation`
  - `video` defaults to `video_generation`
  - `audio` defaults to `tts`
- [ ] Save tags through existing model PATCH endpoint.

Acceptance:
- Admin can manually mark a ModelScope Qwen VL model as image/video understanding.
- UI does not force the model into image/video generation just because it understands images/videos.

---

## Task 4: Per-Model Connectivity Tests

**Files:**
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/external-proxy.ts`
- Create: `scripts/verify-provider-model-tests-contract.mjs`
- Modify: `apps/admin/src/admin-model-editor.tsx`

- [ ] Add endpoint:

```txt
POST /api/admin/models/:id/test
```

Request:

```json
{
  "kind": "chat|image_understanding|video_understanding|image_generation|video_generation|audio_generation|voice_clone"
}
```

Response:

```json
{
  "ok": true,
  "kind": "image_understanding",
  "message": "模型可识别图片",
  "inferredTags": ["image_understanding"],
  "latencyMs": 1234
}
```

- [ ] Test payloads:
  - Chat: one short text question.
  - Image understanding: send a tiny server-hosted PNG and ask for dominant color.
  - Video understanding: send a tiny server-hosted MP4 where supported; otherwise use node's configured video mode and report unsupported clearly.
  - Image generation: one low-cost prompt and verify an image URL/base64 exists.
  - Video generation: do not run automatically by default; require explicit button click and show cost warning.
  - Audio generation: one short sentence.
  - Voice clone: require an uploaded/admin-selected sample audio; do not auto-run without a sample.
- [ ] Store result into `model.testState[kind]`.
- [ ] If test succeeds, suggest or apply inferred tags:
  - Auto-apply only if admin clicked "测试并自动修正标签".
  - Plain "测试" only records suggested tags.

Acceptance:
- Failed tests show upstream status and clear reason.
- A model that rejects `video_url` should say "该模型或网关不支持 video_url 输入", not "生成完成但没有返回".

---

## Task 5: LLM Node Capability-Aware Media Sending

**Files:**
- Modify: `apps/web/src/components/nodes/LLMNode.tsx`
- Modify: `apps/api/src/external-proxy.ts`
- Modify: `apps/web/src/services/generation.ts`
- Test: add or extend a contract script for LLM media capability behavior.

- [ ] Use selected backend model tags to decide media UI:
  - Show image attachment controls only if `image_understanding` is present.
  - Show video attachment controls only if `video_understanding` is present.
  - If the model has no media tags, keep attachments visible but mark them "当前模型未标记支持".
- [ ] Add a clear warning before send if image/video inputs are attached but model lacks matching tag.
- [ ] Backend should also enforce/annotate:
  - If images are sent to model without `image_understanding`, return a warning or reject based on strict flag.
  - If videos are sent to model without `video_understanding`, return a warning or reject based on strict flag.
- [ ] For ModelScope Qwen VL:
  - Default image mode should use OpenAI-compatible `image_url`.
  - Video mode should be tested; if upstream rejects `video_url`, default to keyframe extraction mode and send frames as images.

Acceptance:
- The screenshot flow no longer silently returns empty when video is connected.
- If true video understanding is unsupported by the gateway, the user sees a precise reason and suggested fallback.

---

## Task 6: MiMo Audio Provider Adapter

**Files:**
- Create: `apps/api/src/audio-provider-adapter.ts`
- Modify: `apps/api/src/external-proxy.ts`
- Modify: `packages/model-core/src/index.ts`
- Create: `scripts/verify-external-audio-proxy.mjs`

- [ ] Add mode `openai_audio_chat`.
- [ ] Build MiMo TTS payload:

```json
{
  "model": "mimo-v2.5-tts",
  "messages": [
    { "role": "user", "content": "语气、风格、角色指令" },
    { "role": "assistant", "content": "要合成的文本" }
  ],
  "audio": {
    "format": "wav",
    "voice": "冰糖"
  }
}
```

- [ ] Build MiMo voice clone payload:

```json
{
  "model": "mimo-v2.5-tts-voiceclone",
  "messages": [
    { "role": "user", "content": "可选风格指令" },
    { "role": "assistant", "content": "要合成的文本" }
  ],
  "audio": {
    "format": "wav",
    "voice": "data:audio/mpeg;base64,..."
  }
}
```

- [ ] Accept audio sample from:
  - uploaded file URL under `/files/input`
  - upstream audio material URL
  - direct `data:audio/...;base64`
- [ ] Enforce safe limits before base64 conversion:
  - mp3 or wav only for MiMo voice clone
  - max encoded data URL length under 10 MB
  - reject missing audio sample for voice clone
- [ ] Parse returned audio from common fields:
  - `choices.0.message.audio.data`
  - `choices.0.message.audio.url`
  - `audio.data`
  - `audio.url`
  - `data.audio`
  - `data.url`
- [ ] Save base64 or remote audio output to `/files/output`.

Acceptance:
- Mock MiMo TTS returns one local audio URL.
- Mock MiMo voice clone returns one local audio URL.
- Invalid clone sample returns a clear validation error.

---

## Task 7: Provider-Backed Audio Node

**Files:**
- Create: `apps/web/src/components/nodes/ProviderAudioNode.tsx`
- Modify: `apps/web/src/config/nodeRegistry.ts`
- Modify: `apps/web/src/components/Canvas.tsx`
- Modify: `apps/web/src/services/generation.ts`
- Modify: `apps/web/src/components/nodes/useUpstreamMaterials.ts`

- [ ] Add node label: `语音生成 / 克隆`.
- [ ] Modes:
  - `tts`: text + optional style prompt + voice preset.
  - `voice_clone`: text + required audio sample + optional style prompt.
- [ ] Inputs:
  - text prompt
  - audio reference for clone
- [ ] Outputs:
  - `audioUrl`
  - `audioUrls`
  - `tracks`
- [ ] Provider selection:
  - Use backend published `audio` models.
  - Filter by tags:
    - `tts` models in TTS mode.
    - `voice_clone` models in clone mode.
- [ ] UI fields:
  - mode selector
  - model selector
  - voice selector for preset voices
  - output format
  - style / emotion instruction
  - target text
  - audio sample drop zone for clone
- [ ] Runtime:
  - Use same status card pattern as image/video nodes.
  - Support cancel button locally; upstream cancel can be no-op for sync MiMo.

Acceptance:
- TTS mode works with MiMo preset voices.
- Voice clone mode refuses to run without audio sample.
- Generated audio can be dragged into OutputNode and other audio-aware nodes.

---

## Task 8: Suno Node Decision And Migration

**Files:**
- Modify: `apps/web/src/components/nodes/AudioNode.tsx`
- Modify: `apps/web/src/config/nodeRegistry.ts`
- Modify: `apps/web/src/providers/models.ts`
- Modify: `apps/api/src/server.ts` only if restoring legacy routes is chosen.

- [ ] Confirm current Suno routes:
  - `/api/proxy/audio/submit`
  - `/api/proxy/audio/query`
  - `/api/proxy/audio/upload`
- [ ] If routes are absent, do not pretend the node is available.
- [ ] Rename old node in UI to `音频 Suno（旧）` if kept visible.
- [ ] Preferred path:
  - Hide legacy Suno from default node menu.
  - Keep old canvases renderable.
  - Add a migration banner inside old Suno node: "该节点使用旧音频链路，建议迁移到语音生成 / 克隆或后续音乐生成节点。"
- [ ] If Suno API credentials and upstream route are still known:
  - Add Suno as `audio` Provider with tags `music_generation`, `audio_cover`, `audio_extend`.
  - Implement it through the same audio provider adapter, not standalone frontend-only calls.

Acceptance:
- Existing canvases with Suno nodes do not break.
- New users see the new provider-backed audio node first.
- If Suno is unavailable, the UI says so clearly.

---

## Task 9: Documentation And Hermes/Assistant Contract

**Files:**
- Create: `docs/prd/v0.1.0/model-capability-tags-and-audio-provider-spec.md`
- Modify: `docs/prd/v0.1.0/provider-model-framework.md`
- Modify: `D:\codex\服务器\Hermes\MEMORY.md`

- [ ] Document broad capability vs fine-grained tags.
- [ ] Document admin assistant expected output:

```json
{
  "capability": "audio",
  "capabilityTags": ["tts", "voice_clone"],
  "inputCapabilities": {
    "prompt": true,
    "audioReference": true
  },
  "advancedConfig": {
    "mode": "openai_audio_chat",
    "submitPath": "chat/completions",
    "audioFormat": "wav"
  }
}
```

- [ ] Document ModelScope Qwen VL rule:
  - broad capability stays `chat`
  - tags describe understanding ability
  - image/video generation must not be inferred from VL model names
- [ ] Document MiMo rules:
  - TTS uses assistant message as target text
  - user message is style/instruction
  - voice clone uses `audio.voice` data URL
  - clone sample must be mp3 or wav and within documented size limits

Acceptance:
- Future AI assistant/Hermes can draft audio provider configs from MiMo docs without custom handholding.

---

## Verification Checklist

Run locally:

```bash
npm run build:single-port
npm run verify:model-capability-tags-contract
npm run verify:provider-model-tests-contract
npm run verify:external-audio-proxy
npm run verify:assistant-provider-template-contract
npm run verify:external-video-proxy
```

Manual browser checks:
- Admin Provider page shows model tags and test buttons.
- ModelScope Qwen VL model can be manually tagged as image/video understanding.
- LLM node warns when media is attached to a model without matching tag.
- MiMo TTS node generates playable audio.
- MiMo voice clone node requires an audio sample.
- Old Suno node either works through provider path or clearly shows legacy unavailable status.

Production/gray deploy checks:
- Deploy to gray first.
- Verify `/api/status`.
- Verify admin page loads without console errors.
- Verify one non-costly chat model test.
- Verify one MiMo TTS test if key is configured.
- Promote to production only after gray passes.

---

## Suggested Execution Order

1. Capability types, inference, and persistence.
2. Admin tag editor.
3. Per-model test endpoints and UI.
4. LLM node media capability warnings/fallbacks.
5. MiMo audio adapter.
6. Provider-backed audio node.
7. Suno migration/hide/restore decision.
8. Docs, Hermes memory, gray deploy, production deploy.

