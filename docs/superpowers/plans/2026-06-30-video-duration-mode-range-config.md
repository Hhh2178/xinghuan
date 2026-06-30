# Video Duration Mode And Range Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make video models support editable duration tiers and duration ranges, while keeping old duration option behavior working.

**Architecture:** Extend the shared model metadata first so the admin UI, API catalog, and canvas node can all read the same duration contract. Keep the legacy `durationOptions` path as a compatibility layer, but add explicit duration mode metadata so models can opt into tiered or ranged duration selection without hard-coding UI lists.

**Tech Stack:** TypeScript, React, shared model-core package, API catalog endpoints, canvas node UI, admin model editor, verification scripts

---

### Task 1: Extend shared video duration metadata

**Files:**
- Modify: `packages/model-core/src/index.ts`
- Test: `scripts/verify-model-catalog.mjs`
- Test: `scripts/verify-generic-node-catalog.mjs`

- [ ] **Step 1: Write the failing test**

Add assertions that a video model can expose:
- `durationMode: "tiers" | "range"`
- `durationRange: { min: number; max: number; step?: number; default?: number }`
- legacy `durationOptions` still works when `durationMode` is absent

Example:

```ts
import assert from "node:assert/strict";
import { uiMetadataFromSchema } from "../packages/model-core/src/index.ts";

const tierUi = uiMetadataFromSchema(
  { duration: { type: "select", options: [4, 8, 12], default: 8 } },
  "video",
);
assert.deepEqual(tierUi.durationOptions, [4, 8, 12]);
assert.equal(tierUi.defaultDuration, 8);

const rangeUi = uiMetadataFromSchema(
  {
    duration: {
      type: "range",
      min: 4,
      max: 20,
      step: 1,
      default: 8,
    },
  },
  "video",
);
assert.equal(rangeUi.durationMode, "range");
assert.deepEqual(rangeUi.durationRange, { min: 4, max: 20, step: 1, default: 8 });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run verify:model-catalog`

Expected: fail because `durationMode` / `durationRange` are not yet exposed.

- [ ] **Step 3: Write minimal implementation**

Add new shared types and metadata resolution in `packages/model-core/src/index.ts`:
- preserve `durationOptions` / `defaultDuration`
- derive `durationMode` from schema when present
- derive integer `durationRange` for range mode
- keep fallback behavior for old configs

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm run verify:model-catalog
npm run verify:generic-node-catalog
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/model-core/src/index.ts scripts/verify-model-catalog.mjs scripts/verify-generic-node-catalog.mjs
git commit -m "feat: add video duration mode metadata"
```

### Task 2: Make API catalog and task services understand range mode

**Files:**
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/external-proxy.ts`
- Modify: `apps/api/src/provider-generation-task-service.ts`
- Modify: `apps/web/src/services/api.ts`
- Test: `scripts/verify-provider-generation-task-contract.ts` or the existing task contract script
- Test: `scripts/verify-provider-generation-web-task-consumption.mjs`

- [ ] **Step 1: Write the failing test**

Add coverage that a model with `durationMode: "range"`:
- exposes `durationRange` in `/api/models`
- accepts any integer duration inside the range
- rejects or normalizes values outside the range
- keeps legacy tiered models unchanged

Example assertion shape:

```ts
assert.equal(model.ui.durationMode, "range");
assert.deepEqual(model.ui.durationRange, { min: 4, max: 20, step: 1, default: 8 });
assert.equal(submitPayload.duration, 8);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run verify:provider-generation-task-contract`

Expected: model catalog / task payload assertions fail until range metadata is wired through.

- [ ] **Step 3: Write minimal implementation**

Update API response shaping and task validation so:
- `durationOptions` still works for tiered models
- range models accept integer seconds within `[min, max]`
- node submission keeps sending numeric seconds to the provider layer
- out-of-range values fall back to the declared default

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm run verify:provider-generation-task-contract
npm run verify:provider-generation-web-task-consumption
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/server.ts apps/api/src/external-proxy.ts apps/api/src/provider-generation-task-service.ts apps/web/src/services/api.ts
git commit -m "feat: support ranged video duration metadata"
```

### Task 3: Add admin controls for duration mode, tiers, and ranges

**Files:**
- Modify: `apps/admin/src/admin-model-editor.tsx`
- Modify: `apps/admin/src/admin-types.ts`
- Test: `scripts/verify-provider-generation-admin-contract.mjs`

- [ ] **Step 1: Write the failing test**

Add checks that the admin model editor renders:
- duration mode selector
- tier list editor
- range editor with min/max/step/default
- preserves current JSON schema editing for older models

Example intent:

```ts
assert.match(source, /durationMode/);
assert.match(source, /durationRange/);
assert.match(source, /duration tiers/);
assert.match(source, /duration range/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run verify:provider-generation-admin-contract`

Expected: fail until the editor exposes the new controls.

- [ ] **Step 3: Write minimal implementation**

Add a compact admin UI section that lets editors choose:
- `tiers`
- `range`

For tiers, edit the allowed seconds list.
For range, edit min / max / step / default.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm run verify:provider-generation-admin-contract
npm run type-check -w @xinghuan/admin
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/admin-model-editor.tsx apps/admin/src/admin-types.ts scripts/verify-provider-generation-admin-contract.mjs
git commit -m "feat: add admin video duration controls"
```

### Task 4: Update canvas video node selection for range mode

**Files:**
- Modify: `apps/web/src/components/nodes/VideoNode.tsx`
- Modify: `apps/web/src/providers/models.ts`
- Modify: `apps/web/src/services/generation.ts`
- Test: `scripts/verify-generic-node-catalog.mjs`
- Test: `scripts/verify-generation-count-contract.mjs`

- [ ] **Step 1: Write the failing test**

Add assertions that when a backend model reports `durationMode: "range"`:
- the node renders integer-second options for every second in the range
- the current duration is clamped to the model range
- tiered models still render their explicit tier list

Example:

```ts
assert.deepEqual(getDurationOptions({ durationMode: "range", durationRange: { min: 4, max: 8, step: 1 } }), [4, 5, 6, 7, 8]);
assert.deepEqual(getDurationOptions({ durationMode: "tiers", durationOptions: [4, 8, 12] }), [4, 8, 12]);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run verify:generic-node-catalog`

Expected: fail until the node can interpret range metadata.

- [ ] **Step 3: Write minimal implementation**

Teach `VideoNode` to:
- derive options from `durationRange` when present
- preserve old `durationOptions`
- normalize stale node state to the nearest valid second
- keep the visual style unchanged

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm run verify:generic-node-catalog
npm run verify:generation-count-contract
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/nodes/VideoNode.tsx apps/web/src/providers/models.ts apps/web/src/services/generation.ts
git commit -m "feat: support ranged video durations in canvas"
```

### Task 5: Verify runtime behavior and sync repository index

**Files:**
- Modify: `docs/logbooks/releases/gray/2026-06-30-video-duration-mode-range-gray.md`
- Modify: `docs/logbooks/releases/current-release-index.md`
- Modify: `ops/README.md`
- Modify: `ops/current/gray.md`

- [ ] **Step 1: Write the verification checklist**

Check:
- `npm run type-check -w @xinghuan/web`
- `npm run type-check -w @xinghuan/admin`
- `npm run type-check -w @xinghuan/api`
- `npm run build`
- `npm run codegraph:sync`

- [ ] **Step 2: Run the checks**

Expected: all pass before gray rollout.

- [ ] **Step 3: Update release and ops docs**

Record:
- what changed
- which models were converted to range mode
- whether the gray service responded successfully
- any remaining user verification needed

- [ ] **Step 4: Commit**

```bash
git add docs/logbooks/releases/gray/2026-06-30-video-duration-mode-range-gray.md docs/logbooks/releases/current-release-index.md ops/README.md ops/current/gray.md
git commit -m "docs: record video duration mode rollout"
```
