# Configurable Image Sizes and GIF Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add administrator-configurable per-model image size rules and GIF capability, expose preset/exact-pixel and static/GIF modes in the canvas, then push and deploy the release to Starflow Production.

**Architecture:** Extend the existing model `parameterSchema` with normalized `imageOutput` metadata, keeping old fields and saved canvas data compatible. The API validates and snapshots the selected model's effective image-output rules into each queued task; the shared APIMart builder and Worker enforce the frozen rules and preserve GIF references. The Admin model editor provides structured controls for maintaining this configuration.

**Tech Stack:** TypeScript, React, npm workspaces, shared/model-core packages, PostgreSQL-backed model catalog, existing release archive and Starflow deployment scripts.

**Spec:** `docs/superpowers/specs/2026-11-05-configurable-image-size-and-gif-mode-design.md`

## Global Constraints

- Keep existing `aspectRatio`, `sizeLevel`, and `providerParams` data readable and preserve preset behavior for models without `imageOutput`.
- APIMart GPT-Image-2.6 exact static dimensions use 16-pixel multiples, 3,840 maximum edge, 655,360–8,294,400 total pixels, and at most a 3:1 aspect ratio.
- GIF references are passed upstream when the model enables them; allow at most 16 references, never strip them and retry automatically.
- Keep GIF mask, markup, and compression fields out of APIMart requests.
- Store image-output capability configuration in task payload snapshots so queued work does not change when an administrator later edits a model.
- Do not add or run automated test suites; verify with type-check, production build, release gates, and runtime deployment checks.
- Deploy only to Starflow Production; Starflow Gray stays decommissioned and Zezhen targets remain untouched.
- The current deployed version is `0.9.1`; increment PATCH to `0.9.2` for this release.

---

### Task 1: Normalize model image-output capabilities

**Files:**
- Modify: `packages/model-core/src/index.ts`
- Modify: `apps/web/src/services/api.ts`

**Interfaces:**
- Add `ModelImageOutputCapabilities` with preset/exact-pixel configuration, static formats, and optional GIF rules.
- Add optional `imageOutput` to `ModelUiMetadata` and `PublicModelUi`.
- `uiMetadataFromSchema(schemaValue, "image", inputCapabilitiesValue?)` returns normalized metadata or `undefined` for legacy models.

- [ ] Add typed schema interfaces for `imageOutput.size.allowExactPixels`, exact-pixel step/bounds/area/aspect rules, static formats, and GIF frame/size rules.
- [ ] Normalize arrays, defaults, positive integer steps, and numeric bounds without mutating the stored parameter schema.
- [ ] Preserve the existing default GPT-Image-2.6 preset ratios and reference-image maximum while setting its exact-pixel default step to 16 and provider hard limits.
- [ ] Add the optional normalized metadata shape to the browser's `PublicModelUi` interface.
- [ ] Run `npm run type-check -w @xinghuan/model-core` and `npm run type-check -w @xinghuan/web`.

### Task 2: Add structured Admin controls for image-output settings

**Files:**
- Modify: `apps/admin/src/admin-model-editor.tsx`
- Create: `apps/admin/src/admin-model-image-output.ts`

**Interfaces:**
- Admin helper `readImageOutputConfig(parameterSchema: string)` reads the optional nested config and returns safe form values.
- Admin helper `writeImageOutputConfig(parameterSchema: string, formValue)` updates only `imageOutput`, preserving unrelated schema fields.
- Save validation rejects invalid bounds, non-positive/non-integer steps, malformed preset lists, and GIF defaults outside configured ranges.

- [ ] Show the image-output section only for `capability === "image"`.
- [ ] Provide controls for preset ratios/sizes, exact-pixel enablement, step, width/height bounds, total-pixel limits, and maximum aspect ratio.
- [ ] Provide static-format choices and a GIF enable toggle with frame count, duration, default frame size, and GIF reference-image enablement.
- [ ] Keep the JSON schema editor usable; synchronize the structured section with its JSON value without dropping unknown keys.
- [ ] Save the validated configuration through the existing model update API and show errors inline without persisting invalid schema.
- [ ] Run `npm run type-check -w @xinghuan/admin`.

### Task 3: Add shared image-output normalization and validation

**Files:**
- Create: `packages/shared/src/image-output-config.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/apimart-image-request.ts`

**Interfaces:**
- `normalizeExactImageSize(input, config)` returns canonical `"WIDTHxHEIGHT"` or a user-readable validation error.
- `validateImageOutputRequest(input, config)` enforces model-configured format and GIF settings.
- `buildApimartImageRequest(base, payload, imageOutputConfig?)` preserves the current two-argument call contract and accepts optional model rules.

- [ ] Validate exact dimensions as positive safe integers, within configured bounds, on the configured step, and within configured area/aspect constraints.
- [ ] Keep APIMart 2.6's documented static hard limits enforced even if a model configuration is accidentally more permissive.
- [ ] Allow APIMart GIF requests to retain up to 16 reference URLs when GIF reference support is enabled; continue rejecting mask, markup, and output-compression fields with GIF.
- [ ] Validate GIF frame count, duration, single-frame dimensions, and APIMart sprite-sheet limits using the same function for API preflight and Worker dispatch.
- [ ] Ensure internal `imageOutputConfig` never becomes an upstream body field.
- [ ] Run `npm run type-check -w @xinghuan/shared`.

### Task 4: Enforce and snapshot capabilities at image-task submission

**Files:**
- Modify: `apps/api/src/provider-generation-task-service.ts`
- Modify: `apps/api/src/server.ts`

**Interfaces:**
- Existing image-task submission route accepts optional `sizeMode`, `width`, and `height` in its request/provider parameters.
- `provider-generation-task-service` normalizes these into `size`, validates against the selected model's normalized `imageOutput`, and writes an immutable `imageOutputConfig` snapshot into the task payload.
- Existing model-directory response returns the normalized `ui.imageOutput` object.

- [ ] Resolve model configuration once when submitting a task, preserving old defaults if `imageOutput` is absent.
- [ ] Reject disabled formats, invalid dimensions, invalid GIF settings, and unsupported settings before task creation.
- [ ] Preserve reference URLs for GIF when the model config enables them and enforce the 16-reference limit.
- [ ] Freeze the normalized config in the task payload; do not use later catalog edits to reinterpret queued payloads.
- [ ] Run `npm run type-check -w @xinghuan/api`.

### Task 5: Build model-driven Canvas size and GIF controls

**Files:**
- Modify: `apps/web/src/components/nodes/ImageNode.tsx`
- Create: `apps/web/src/components/nodes/ImageOutputControls.tsx`
- Modify: `apps/web/src/services/generation.ts` only to type and serialize the new task fields.

**Interfaces:**
- `ImageOutputControls` receives normalized model capabilities, current node settings, reference-image count, and a typed change callback.
- Persist `imageSizeMode`, `imageWidth`, and `imageHeight` on image nodes; persist `output_format` and GIF settings in the existing `providerParams` object.
- Submission sends normalized settings to the existing image-task endpoint.

- [ ] Replace the model-name-only size/GIF presentation branch with capability-driven controls while preserving the current 2.6 settings through normalized defaults.
- [ ] Implement preset/exact-pixel selection and width/height controls with configured step, bounds, and visible validation feedback.
- [ ] Implement static/GIF mode selection only when enabled, with configured static formats and GIF frame controls.
- [ ] Preserve all connected/reference image inputs in GIF mode and submit them normally; do not silently drop references.
- [ ] Reset only values invalid for the newly selected model and retain compatible node settings.
- [ ] Keep `ImageNode.tsx` under its existing file-hotspot budget by moving validation/display helpers into focused modules.
- [ ] Run `npm run type-check -w @xinghuan/web`.

### Task 6: Update system docs, version, package, push, and deploy

**Files:**
- Modify: `docs/systems/providers/request-body-and-file-strategy.md`
- Modify: `docs/systems/canvas/node-and-data-model.md`
- Modify: `docs/logbooks/daily/2026/2026-11/2026-11-05.md`
- Modify: `docs/logbooks/releases/current-release-index.md`
- Modify: `ops/current/release-state.json` and the Starflow production status page after deployment
- Modify: root `package.json` and `package-lock.json` to version `0.9.2`
- Create: production release and validation records for this release

- [ ] Document model-driven size settings, exact-pixel rules, GIF request behavior, and upstream uncertainty for GIF references.
- [ ] Set root package version and lockfile version to `0.9.2`.
- [ ] Run `npm run type-check`, `npm run build:single-port`, `npm run verify:file-hotspot-budgets`, `npm run verify:old-server-release-target -- --target-profile=old-server --env=production`, version alignment, and release package checks.
- [ ] Commit all implementation and version changes; verify `git status --short` is clean before creating the sealed runtime artifact.
- [ ] Build release `20261105-image-size-gif-mode-v092-r1`, verify its SHA-256 sidecar, and push `feature/canvas-agent-runtime` to `origin` without force.
- [ ] Deploy the artifact using `scripts/release/deploy-gray-release.mjs --target-profile=old-server --env=production`, then run `scripts/release/verify-gray-runtime.mjs` expecting version `0.9.2`, environment `production`, enforced permission mode, and ready permission checks.
- [ ] Update Starflow current state and release/validation records with observed values; do not change Starflow Gray or Zezhen state.

## Final Acceptance

- Admin can configure each image model's supported presets, exact-pixel step/bounds, static formats, and GIF capability.
- Canvas reflects only the selected model's capabilities and sends valid exact dimensions or GIF frame settings.
- API rejects invalid requests before queue creation; Worker revalidates from the frozen configuration.
- APIMart GIF references are preserved up to 16 and passed to `image_urls`; upstream errors remain visible with no reference-stripping retry.
- Existing models and saved nodes without `imageOutput` keep their current preset behavior.
- The feature branch is pushed and Starflow Production reports `0.9.2 / production` with API, Worker, and permission readiness passing.
