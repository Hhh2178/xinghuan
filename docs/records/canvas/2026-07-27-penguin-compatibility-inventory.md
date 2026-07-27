# Penguin Compatibility Inventory

## Classification rules

| Category | Rule | r2 action |
|---|---|---|
| `visible-copy` | A user sees the string as product branding or an error fallback. | Replace with neutral Canvas wording and safe diagnostics. |
| `compatibility-contract` | A saved canvas, exported file, setting, CustomEvent, or hidden historical node can consume the identifier. | Keep exact value; do not rename without a dual-read migration. |
| `sample-content` | The word is part of a deliberately editable template or example prompt, not product branding. | Retain unless product content separately changes. |

## Current inventory

| Location / identifier | Category | Consumers / reason | Rule |
|---|---|---|---|
| `components/ErrorBoundary.tsx` legacy penguin fallback | `visible-copy` | Legacy boundary could still be imported. | r2 replaces it with `ErrorRecoveryPanel`; raw errors and component stacks are not rendered. |
| `App.tsx` / `types/canvas.ts` `T8-penguin-canvas` comments | `compatibility-contract` | Historical code annotations and export-path documentation. | Do not use as visible product copy; retain until a full historical-format migration. |
| `penguin:*` CustomEvent names | `compatibility-contract` | Canvas, drawers, assistant, material drag and workflow supervision communicate through these exact event strings. | Preserve exact names. |
| `penguin-portrait` node type and preset | `compatibility-contract` | Node registry, port map, placement, execution set and persisted Canvas nodes. | Keep hidden from new-node UI and continue rendering historical nodes. |
| `t8-penguin-canvas-export` / settings schema and local paths | `compatibility-contract` | Existing exports, backups and local folders may use the identifier. | Preserve exact serialized values. |
| Template prompts / lyrics mentioning `企鹅` | `sample-content` | Editable example content, not a fallback or brand label. | Preserve in r2. |

## Guard

`npm run verify:penguin-compatibility-inventory` verifies that this inventory remains present, the legacy error boundary does not reintroduce a penguin fallback or raw error rendering, and the historical event/node/schema identifiers remain explicitly documented.
