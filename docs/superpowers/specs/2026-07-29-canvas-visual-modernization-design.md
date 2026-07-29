# Canvas Visual Modernization Design

**Status:** User-approved direction; pending written-spec review before implementation

**Scope:** Desktop Canvas frontend only (`1920×1080` design target)

## 1. Outcome

Modernize the Canvas into a calmer, more legible professional creation workbench without changing Canvas data, node execution, material ownership, Provider payloads, task lifecycle, keyboard behavior, or existing material-management semantics.

The default experience remains the current **Legacy Canvas**. A user can opt into **Modern Canvas** and return to Legacy Canvas at any time. The mode switch changes presentation and layout only; a Canvas project, its nodes, edges, materials, runs, revision, and task history are identical in both modes.

## 2. Hard Boundaries

- Do not replace React Flow, Canvas persistence, node data schemas, edge/port semantics, task APIs, Provider adapters, or Worker behavior.
- Do not introduce a second material-input model. Upstream materials continue to merge into the existing node material collection and retain the current add, replace, delete, preview, select, and execution behavior.
- Upstream text continues to use the existing parameter/prompt path. Modern Canvas may show a concise visual indicator but must not change how text is resolved into a task payload.
- Do not add automatic prompt concatenation, hidden input binding, material copying, or new server-side preference data.
- Do not remove, rename, or silently omit any existing Canvas control, node capability, context menu, overlay, shortcut, MiniMap, or task action.
- Legacy Canvas is the fallback and the initial default for every user with no explicit preference.
- No production deployment follows this design alone. The implementation requires separate approval after this document is reviewed.

## 3. Chosen Product Shape

### 3.1 Canvas surface switch

Use one Canvas runtime and one set of interaction handlers. Add a presentation preference with two values:

| Value | User label | Default | Meaning |
| --- | --- | --- | --- |
| `legacy` | 经典画布 | Yes | Existing shell and visual composition, preserved as-is. |
| `modern` | 新版画布（预览） | No | New shell, typography, node chrome and overlay layout. |

The preference is browser-local and stored through the existing persisted Canvas client-store pattern under a key namespaced by signed-in user ID. It never writes an API setting or Canvas Project field. An absent, malformed, or unsupported value resolves to `legacy`. Switching modes must preserve viewport, selection, open project, undo history and active task subscriptions; it must not reload or migrate Canvas data. The visible switch belongs in the existing user-facing Canvas settings/appearance surface, not as a debug-only query parameter.

Modern Canvas remains visibly marked as “新版画布（预览）” until a later explicit promotion decision. The switch must be keyboard accessible and must show which mode is active in text, not color alone.

### 3.2 Workbench shell

| Area | Modern behavior |
| --- | --- |
| Top bar | Fixed 56px identity/status/action strip. It contains project identity, save/runtime state, global destinations and one contextual primary action; secondary controls move to an overflow or existing menus. |
| Left rail | 56px icon rail by default. Hovering or focusing it expands an overlay to 288px; it never changes Canvas viewport width or shifts nodes. It closes after a short leave delay, except while focus is inside. A visible pin control can keep it open. |
| Canvas | The primary visual field. It begins beside the collapsed rail and retains its dimensions during rail expansion. Grid-dot contrast increases by exactly 40% relative to Legacy Canvas’s effective dot opacity, with no competing watermark above nodes. |
| Inspector | Closed by default. A selected-node, task-detail or advanced-parameter action opens a right overlay inspector. It is a presentation of existing configuration and diagnostic controls, not a new data model. |
| Navigation | MiniMap is always rendered and reachable. Zoom, fit-view and locate-current-selection form the same lower-corner navigation group. Assistant, support widgets and MiniMap use a shared collision-safe stack and cannot cover one another. |

### 3.3 Layering and collision rules

The shell must publish an explicit Canvas overlay z-index contract. Node content and edges remain above the grid; temporary menus, inspector, tooltips, assistant and MiniMap have distinct tiers. No visual pseudo-element, theme watermark or loading surface may sit over nodes, edges, the MiniMap, handles, material cards or pointer interaction.

## 4. Node Composition

### 4.1 Shared reading order

Generation nodes use the same visual order, adapted to their existing fields:

1. **Header:** node identity, type icon and runtime state.
2. **Primary instruction:** node-type-specific name: `生成描述` for image/video, `任务说明` for LLM, `声音描述` for audio, and `处理目标` for utility nodes. This is an existing prompt/description field presented more clearly, not a new persisted concept.
3. **Model:** selected model, capability summary, availability and cost/estimate where already available.
4. **Key controls:** two to four result-shaping controls in a compact two-column grid; for example image aspect ratio/count, video duration/quality/camera, or LLM output format/creative strength.
5. **Materials:** the existing merged material collection, rendered as a compact visual rail or grid with existing management controls.
6. **Primary action and runtime state:** existing run/generate/retry/cancel behaviors, restyled only.

All remaining existing parameters remain available in grouped “more controls” sections or the existing configuration/inspector presentation. They must not be deleted merely because they are not in the default compact node body.

### 4.2 Model selection

Model selection remains bound to the existing model catalog and permission checks. Modern Canvas only changes its presentation:

- The selected model is always visible as a single 40px selector row.
- The row shows model display name, a concise compatible-capability summary, readiness state, and existing price/estimate when present.
- Search, grouping, disabled-model explanations, permission outcomes, Provider health and fallback information continue to use the current data and actions.
- Long Provider/model names truncate in the compact row, expose the full value on focus/tooltip, and wrap only in the Inspector.

### 4.3 Existing material and upstream-input behavior

Materials arriving through upstream edges continue to be merged into the node’s current material area exactly as today. Modern Canvas may show a small, non-interactive source indicator such as a link icon and “来自连线”, but it must not create separate input slots, duplicate copies, alter ordering, or introduce a new binding operation.

The same existing material-management entry point remains responsible for add, preview, selection, replacement, removal, material sets and sending/receiving. The compact node shows a count and representative thumbnails; opening management invokes the existing behavior. Upstream text keeps its existing prompt/parameter resolution and receives only a compact visual status treatment.

## 5. Typography, Density and Text Safety

Modern Canvas establishes these minimum visual sizes:

| Element | Size / line-height | Rule |
| --- | --- | --- |
| Node title | `16 / 22px`, 650 | Never ellipsize before the type icon and state have their own fixed area. |
| Primary instruction | `14 / 20px`, 400 | Clamp in compact state; full editable content remains available. |
| Model name and primary field value | `14 / 20px`, 600 | Single-line compact view with full label available on focus. |
| Field label and button label | `13 / 18px`, 600 | Minimum normal interactive text. |
| Helper, source and metadata | `12 / 18px`, 400 | Never used for critical error/action information. |
| Runtime error / warning | `13 / 20px`, 600 | Uses icon and text in addition to semantic color. |

Implementation must use layout containment rather than absolute text placement:

- Every flex/grid child carrying text has `min-width: 0`.
- Compact one-line fields use semantic ellipsis; multi-line instructions use a documented line clamp rather than uncontrolled height.
- Dynamic badges, model names, translated strings and task messages cannot overlap controls, handles, thumbnails or action bars.
- Node sections own their vertical spacing; no negative margins or transformed labels may bridge section boundaries.
- Nodes grow predictably when an explicit expanded section is opened, and React Flow internals are resynchronized after size changes.

## 6. Visual Language

- Preserve the deep, cool Canvas surface and restrained mint/cyan primary affordance.
- Reduce decorative glow, arbitrary theme-specific chrome, excessive capsules and conflicting color accents.
- Color retains semantic meaning: mint/cyan for active/selectable, green for success, amber for attention/queue, red for failure/destructive, and neutral cool gray for non-action metadata.
- Borders indicate containment or focus, not decoration. Nodes use one clear shell border, one header separation and grouped content surfaces.
- The 40% stronger dot grid provides spatial orientation, but nodes, selected edges and selection rectangles remain visually dominant.
- Motion is functional only: 120–180ms hover/focus and 180–240ms rail/inspector transitions. Respect reduced-motion preferences.

## 7. Compatibility and Rollout

1. Implement the preference and shared presentation boundary with `legacy` as the hard default.
2. Add Modern Canvas shell without changing runtime behavior; verify switching while a Canvas is open preserves project state.
3. Migrate shared node chrome first, then high-use image, video and LLM visual composition; each node retains all existing controls before the next migration starts.
4. Leave niche and complex nodes in Legacy presentation until their visual contract and feature inventory are verified; switching modes must never make a node unavailable.
5. Run visual acceptance at `1920×1080` for Legacy and Modern Canvas, including empty Canvas, dense multi-node Canvas, long Chinese/English model names, long prompt text, material collections, errors, active generation, selection, MiniMap and Assistant coexistence.

## 8. Acceptance Criteria

- A first-time user sees Legacy Canvas; selecting Modern Canvas is explicit and reversible.
- Switching modes causes no task cancellation, Canvas reload, data loss, material duplication, edge mutation or history reset.
- Hover/focus expanding the left rail does not resize the React Flow viewport or move nodes.
- The MiniMap is visible and usable in Modern Canvas, including when the Assistant and other corner overlays are present.
- All existing material management actions and upstream material behavior work identically in both modes.
- Image, video and LLM nodes present the approved compact hierarchy and all existing parameters remain reachable.
- No visible text crosses a node section boundary, overlaps controls, falls under a handle, or becomes the sole communication of a critical state.
- Long labels have an accessible full-value path; no key control depends on an unreadable `11px` or smaller label.
- Existing Canvas functional tests, keyboard/shortcut behavior, persistence behavior and node-specific execution tests remain green.

## 9. Explicit Non-goals

- No changes to Provider model configuration, video/image/LLM payload construction, upstream polling, task recovery, storage or billing.
- No new mobile/tablet layout work.
- No permanent deletion of the Legacy Canvas UI during this effort.
- No visual redesign of Admin.

## 10. Decisions Log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-07-29 | Keep Legacy Canvas as default and expose Modern Canvas as an opt-in preview. | Limits release risk and gives users an immediate reversible fallback. |
| 2026-07-29 | Use one Canvas runtime with two presentation modes. | Prevents duplicate execution, material and persistence logic from drifting. |
| 2026-07-29 | Retain upstream-material merge behavior and existing management UI. | The current data flow is accepted; the problem is visual density, not semantics. |
| 2026-07-29 | Adopt a 56px icon rail with 288px overlay expansion. | Reclaims canvas area without hiding navigation or shifting an active project. |
