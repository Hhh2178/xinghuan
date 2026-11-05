# Configurable Image Sizes and GIF Generation Mode

**Status:** Design for review  
**Date:** 2026-11-05  
**Scope:** Canvas image generation, model catalog configuration, API/Worker provider execution

## Problem

Image size choices are currently split between model parameter-schema presets and node-local model lists. The model editor does not provide a focused way to manage exact-pixel constraints. APIMart GPT-Image-2.6 also exposes output controls through a model-name-specific UI branch, so another image model cannot declare GIF support through model configuration.

Users need model-specific size presets, an optional exact-pixel mode with configurable increments such as 8 or 16 pixels, and a model-level GIF capability that can be enabled or disabled by an administrator.

## Goals

- Let administrators maintain image size presets and exact-pixel rules for each model.
- Let canvas users choose a preset or enter exact width and height when the selected model allows it.
- Let administrators enable GIF generation per model; show GIF controls only for enabled models.
- Keep provider-specific API validation authoritative, including APIMart GPT-Image-2.6 constraints.
- Preserve existing model schemas, saved canvases, queued task payloads, and image-generation endpoints.

## Out of Scope

- Adding a separate GIF generation service or endpoint.
- Claiming APIMart GPT-Image-2.6 accepts GIF image-to-image requests. Its published contract says GIF is text-to-image only; this design follows the explicit product request to send references for an upstream trial.
- Automatically removing GIF reference images and retrying after an upstream rejection.
- Changing image resize/crop operations or video size controls.

## Proposed Model Configuration

Extend each image model's existing `parameterSchema` with an optional `imageOutput` object. Existing `aspectRatio` and `size` schema entries remain the source for current preset choices; `imageOutput` describes how those choices are presented and validated.

```json
{
  "imageOutput": {
    "size": {
      "allowExactPixels": true,
      "exactPixels": {
        "step": 16,
        "minWidth": 16,
        "maxWidth": 3840,
        "minHeight": 16,
        "maxHeight": 3840,
        "minTotalPixels": 655360,
        "maxTotalPixels": 8294400,
        "maxAspectRatio": 3
      }
    },
    "staticFormats": ["png", "jpeg", "webp", "svg"],
    "gif": {
      "enabled": true,
      "allowReferenceImages": true,
      "frameCount": { "min": 2, "max": 16, "step": 1, "default": 9 },
      "frameDurationMs": { "min": 20, "max": 2000, "step": 10, "default": 200 },
      "size": { "step": 16, "default": "512x512" }
    }
  }
}
```

The model editor will expose these values in a structured image-capability section instead of requiring administrators to edit the JSON blob directly. It will preserve unrelated schema keys when saving. Exact numeric limits are model/provider-specific; the values above are the APIMart GPT-Image-2.6 defaults. Provider adapters may enforce stricter published constraints than the configurable UI rules and must never accept configuration that weakens a provider's hard contract.

For APIMart GPT-Image-2.6, exact static dimensions must be multiples of 16, each side no greater than 3,840 pixels, total pixels between 655,360 and 8,294,400, and the aspect ratio no greater than 3:1. GIF frame dimensions and frame count must continue to satisfy APIMart's sprite-sheet limits. The UI step defaults to 16 for this model; administrators may use another step for models whose provider permits it.

## Canvas Interaction

- The image node presents the selected model's configured preset choices and, when enabled, a `预设尺寸 / 精确像素` selector.
- Exact mode renders width and height numeric inputs using the configured step and bounds. The selected values persist with the canvas node.
- Static output formats are limited to the model's configured `staticFormats`.
- When `gif.enabled` is true, the node offers a separate `静态图 / GIF 动图` mode. GIF frame count, duration, and frame size controls appear only in GIF mode.
- When the selected model disables GIF, the GIF mode and its fields are not shown. Switching models preserves compatible node settings and resets values that are invalid for the new model.
- GIF reference images remain enabled when `allowReferenceImages` is true. For the APIMart GPT-Image-2.6 trial configuration, this is true and the request carries those references to the upstream. Mask and markup remain incompatible with GIF. Upstream rejection is shown to the user; references are not silently discarded and the request is not automatically retried.

## Request and Execution Contract

- Extend the existing model-directory response with normalized image-output metadata: preset/exact modes, exact-pixel constraints, configured static formats, and GIF parameters/capability.
- Extend the existing image-task submission request with explicit size mode and exact dimensions. The API normalizes exact dimensions to the provider's canonical `size: "WIDTHxHEIGHT"` and validates them against the selected model's metadata and provider hard constraints.
- The existing image task route remains the sole task-creation endpoint. No parallel GIF endpoint is introduced; GIF uses `output_format: "gif"` plus its frame fields.
- The API freezes the effective image-output configuration into the queued task payload so later model edits do not change an already queued task. The Worker uses that snapshot for final provider request validation.
- The APIMart request builder continues to translate references to `image_urls`. For GIF, it will permit up to the GPT-Image-2.6 general reference limit of 16 when model configuration enables references, despite the published GIF text-to-image restriction. It will not send mask, markup, or compression fields with GIF.
- Existing APIMart result polling, MIME handling, and output materialization remain unchanged.

## Compatibility

- Models without `imageOutput` continue to use their current aspect-ratio and size controls; no exact-pixel or GIF UI is added by default.
- Existing saved nodes without a size mode remain in preset mode.
- Existing `providerParams.output_format` values are migrated in-memory to the corresponding static format or GIF mode when the selected model supports them; no destructive canvas rewrite is needed.
- Existing model endpoints and task records remain readable. New task fields are optional and the Worker retains compatibility for historical payloads.

## Validation and Error Handling

- Validate administrator configuration before save: positive integer pixel step, ordered min/max bounds, valid total-pixel and aspect-ratio limits, and legal GIF frame ranges/defaults.
- Validate exact dimensions synchronously before queue creation; return a user-readable HTTP 400 error for unsupported dimensions.
- Validate GIF format and frame values in both API and Worker. If references are enabled, preserve them through the APIMart builder. If the upstream rejects the combination, surface the upstream's readable error without fallback mutation or re-submission.
- Keep APIMart provider-specific constraints in the shared request validator so API preflight and Worker execution use the same rules.

## Main Files Expected to Change During Implementation

- `packages/model-core/src/index.ts` — parse and normalize model image-output metadata.
- `apps/web/src/services/api.ts` — type the normalized model UI metadata.
- `apps/admin/src/admin-model-editor.tsx` and related model-editor helpers — structured size/GIF capability configuration.
- `apps/web/src/components/nodes/ImageNode.tsx` — model-driven preset, exact-pixel, static/GIF controls and persisted node state.
- `apps/api/src/provider-generation-task-service.ts` — request normalization, configuration snapshot, and synchronous validation.
- `packages/shared/src/apimart-image-request.ts` — provider contract validation with opt-in GIF references.
- `apps/worker/src/worker-provider-utils.ts` and/or the Worker provider request boundary — validate and send the frozen settings.
- `docs/systems/providers/` and `docs/systems/canvas/` — implementation facts after delivery.

The implementation plan must re-check these paths and split helpers where needed; `ImageNode.tsx` and API entry files are large and should not absorb avoidable new logic.

## Acceptance Criteria

1. An administrator can configure per-model supported presets, exact-pixel enablement, pixel step and bounds, and GIF enablement/constraints in the model editor.
2. A canvas user sees only the selected model's supported controls and can submit a valid exact size using the configured step.
3. An invalid exact size is rejected before a task is queued, with a clear error.
4. A model with GIF disabled cannot submit GIF; a model with GIF enabled can select GIF and provide frame settings.
5. APIMart GPT-Image-2.6 GIF requests with references preserve up to 16 images in `image_urls`; upstream rejection remains visible and does not trigger a reference-stripping retry.
6. Existing models and saved canvases without the new metadata retain their current behavior.
7. API and Worker use matching request validation and an immutable per-task configuration snapshot.

## Verification Boundaries

Implementation should run the repository's requested build/type and relevant non-test release checks. Automated test suites and a real paid APIMart generation request are outside this design's release gate unless separately requested. The APIMart GIF image-to-image behavior must be verified with a deliberate upstream request before being described as supported in practice.
