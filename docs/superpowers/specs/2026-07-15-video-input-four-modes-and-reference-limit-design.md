# Video Input Four Modes And Reference Limit Design

## Goal

Extend the universal backend-video input contract to four explicit modes while replacing the duplicated single-reference and multi-reference controls with one configurable reference-image mode.

## Product Contract

The canvas exposes these model-driven modes:

| Mode | Availability | Image count | Ordered payload |
| --- | --- | --- | --- |
| `reference` | `imageReference=true` | `0..referenceImages.max` | `images` in user order |
| `first` | `firstFrame=true` | exactly 1 | `images[0]`, `first_frame` |
| `last` | `lastFrame=true` | exactly 1 | `images[0]`, `last_frame` |
| `firstlast` | `firstFrame=true && lastFrame=true` | exactly 2 | first image then last image |

Zero images in reference mode remains text-to-video. A model may expose any subset of the four modes. Pure text-to-video models with no image capability remain valid with zero images.

## Admin Design

The video-model input capability area no longer renders separate `参考图` and `多参考图` cards. It renders one `参考图模式` card. When enabled, the card contains a numeric maximum-reference-image control with a supported range of `1..16`. The stored value remains `parameterSchema.referenceImages.max`; AICopy SD uses `9`.

`首帧`, `尾帧`, and `首尾帧` are not stored as separate redundant flags. The first two capability switches control mode availability, and the combined mode is derived when both are enabled.

The legacy `inputCapabilities.multiImage` field remains readable for compatibility but is no longer editable or authoritative. New saves derive it from `imageReference && referenceImages.max > 1` so older consumers remain stable. Runtime limits always use `referenceImages.max`.

## Data Flow

1. Admin saves `imageReference`, `firstFrame`, `lastFrame`, and `referenceImages.max`.
2. Public model metadata exposes the four available modes and `maxReferenceImages`.
3. Canvas limits visible and connected materials before submission and sends `videoInputMode` plus ordered `images`.
4. API performs authoritative capability and exact-count validation.
5. Worker preserves `images`, `first_frame`, `last_frame`, and `modeType` without inferring Provider-specific behavior.
6. AICopy SD request bindings consume the normalized generic fields only when its model-level contract switch is true.

## Compatibility And Migration

- Existing `auto` values normalize to the first available model mode, preferring `reference`.
- Existing `last` values remain `last`; they must no longer be coerced to `firstlast`.
- Existing `multiImage=false` does not cap a model at one image when `referenceImages.max` is greater than one.
- Existing models without `referenceImages.max` retain the current schema-derived fallback.
- Provider protocol selection, request mapping, polling, and result extraction are unchanged.

## Validation

- Shared and canvas contracts cover all four modes and the `1/1/2/N` count rules.
- API tests reject missing or excess first, last, first-last, reference, and audio inputs with HTTP 400-compatible errors.
- Admin source/render contracts prove that the separate multi-reference card is absent and the maximum control is present only for video reference mode.
- Gray acceptance verifies model metadata, canvas mode switching, ordered payloads, AICopy SD sound/duration/ratio behavior, and that non-AICopy Providers are unchanged.

