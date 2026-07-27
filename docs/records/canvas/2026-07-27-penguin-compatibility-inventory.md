# Penguin Compatibility Inventory

## Classification rules

| Category | Rule | r2 action |
|---|---|---|
| `visible-copy` | A user can see the text as sample/template content or an error fallback. | Remove only product-brand fallback copy; preserve intentional editable examples. |
| `compatibility-contract` | Persisted Canvas data, exported data, settings, a CustomEvent, or a hidden historical node can consume the identifier. | Keep the exact value; do not rename without a dual-read migration. |
| `dead-code` | No runtime/import/persisted-data consumer remains, proven by CodeGraph plus behavior/import tests. | No candidate is approved in r2. |

## Visible-copy inventory

| Identifier / location | Category | Consumers / reason | Rule |
|---|---|---|---|
| Legacy `ErrorBoundary.tsx` penguin fallback | `visible-copy` | A legacy import could render it after an exception. | Replaced by `ErrorRecoveryPanel`; raw errors, URLs and component stacks are not rendered. |
| `tpl-text-to-image` penguin prompt | `visible-copy` | Editable built-in text-to-image example. | Retain as sample content; it is not a brand or fallback. |
| `tpl-llm-rewrite` penguin prompt | `visible-copy` | Editable built-in LLM rewrite example. | Retain as sample content; it is not a brand or fallback. |
| `tpl-suno` penguin lyric | `visible-copy` | Editable built-in audio example. | Retain as sample content; it is not a brand or fallback. |
| `penguin-portrait` title and preset copy | `visible-copy` + `compatibility-contract` | A persisted historical node renders this label. | Preserve while historical node rendering remains supported; do not reuse as a new product fallback. |

## Persisted identifiers and local schemas

| Identifier | Category | Consumers / reason | Rule |
|---|---|---|---|
| `t8-penguin-canvas-export` | `compatibility-contract` | Canvas JSON export/import schema. | Preserve exact serialized schema value. |
| `t8-penguin-canvas-settings` | `compatibility-contract` | API settings backup schema. | Preserve exact serialized schema value. |
| `T8-penguin-canvas` local path | `compatibility-contract` | Historical local Canvas save location and operator-facing path guidance. | Preserve path compatibility until an explicit data migration. |
| `T8-penguin-canvas` source comments | `compatibility-contract` | Historical format/API documentation markers. | Do not surface as new product branding. |

## CustomEvent inventory

| Event | Category | Producer → consumer | Rule |
|---|---|---|---|
| `penguin:append-assistant-context` | `compatibility-contract` | Canvas/Supervisor → Assistant shell/session | Preserve event payload compatibility. |
| `penguin:assistant-open-change` | `compatibility-contract` | Assistant shell → App shell | Preserve panel collision coordination. |
| `penguin:canvas-run-node-projection` | `compatibility-contract` | Supervision dock → Canvas | Preserve runtime projection updates. |
| `penguin:canvas-workflows-changed` | `compatibility-contract` | Canvas → Supervision dock | Preserve workflow editor synchronization. |
| `penguin:comfyui-app-manifest-updated` | `compatibility-contract` | ComfyUI manifest helper → node consumers | Preserve manifest refresh behavior. |
| `penguin:generation-library-changed` | `compatibility-contract` | Canvas/material actions → Generation library drawer | Preserve generation library refresh behavior. |
| `penguin:highlight-workflow-stage-conflict` | `compatibility-contract` | Workflow stage editor → Canvas | Preserve conflict highlighting. |
| `penguin:material-drop` | `compatibility-contract` | Material drag overlay → node drop-target hook | Preserve material placement behavior. |
| `penguin:open-channel-health` | `compatibility-contract` | Canvas toolbar → App shell | Preserve channel-health entry point. |
| `penguin:open-material-set-resource-menu` | `compatibility-contract` | Canvas → material context menu | Preserve resource-menu entry point. |
| `penguin:open-run-supervisor` | `compatibility-contract` | Historical Agent node → supervision dock | Preserve historical run navigation. |
| `penguin:open-send-materials` | `compatibility-contract` | Resource drawer → Canvas send flow | Preserve send-materials entry point. |
| `penguin:open-workflow-templates` | `compatibility-contract` | Canvas toolbar → App shell | Preserve workflow-template entry point. |
| `penguin:resources-changed` | `compatibility-contract` | Resource-producing views → resource drawer | Preserve resource refresh behavior. |
| `penguin:rh-toolbox-manifest-updated` | `compatibility-contract` | RH toolbox helper → RH toolbox node | Preserve manifest refresh behavior. |
| `penguin:supervision-open-change` | `compatibility-contract` | App shell → assistant shell | Preserve panel collision coordination. |
| `penguin:update-workflow-stages` | `compatibility-contract` | Supervision dock → Canvas | Preserve workflow-stage persistence. |

## Hidden historical-node inventory

All entries remain registered in `NODE_REGISTRY` while excluded from creation groups. The registry, Canvas node-type map, port/capability maps and targeted behavior tests are the evidence that r2 has **no approved `dead-code` candidate**.

| Node type | Category | Consumer / retention rule |
|---|---|---|
| `seedance` | `compatibility-contract` | Old Canvas metadata stays readable; omit from the creation catalog. |
| `runninghub-wallet` | `compatibility-contract` | Historical RunningHub workflow node; retain registry metadata. |
| `rh-config` | `compatibility-contract` | Historical RH parameter-injection node; retain registry metadata. |
| `rh-tools` | `compatibility-contract` | Historical RH launcher node; retain registry metadata. |
| `rh-toolbox` | `compatibility-contract` | Historical RH toolbox node; retain registry metadata. |
| `comfyui-app` | `compatibility-contract` | Migrates into the unified ComfyUI workflow model. |
| `comfyui-store` | `compatibility-contract` | Migrates into the unified ComfyUI workflow model. |
| `comfyui-app-maker` | `compatibility-contract` | Migrates into the unified ComfyUI workflow model. |
| `multi-angle-3d` | `compatibility-contract` | Historical preset node remains renderable. |
| `panorama-720` | `compatibility-contract` | Historical preset node remains renderable. |
| `penguin-portrait` | `compatibility-contract` | Historical preset/node/port/capability identifier remains renderable. |
| `portrait-metadata` | `compatibility-contract` | Historical portrait workflow node remains renderable. |
| `storyboard-grid` | `compatibility-contract` | Historical storyboard workflow node remains renderable. |
| `canvas-agent` | `compatibility-contract` | Historical Agent node still opens the supervision dock. |
| `browser` | `compatibility-contract` | Historical tool node remains registered. |
| `frame-extractor` | `compatibility-contract` | Historical tool node remains registered. |
| `remove-bg` | `compatibility-contract` | Historical tool node remains registered. |
| `upscale` | `compatibility-contract` | Historical tool node remains registered. |
| `edit` | `compatibility-contract` | Historical auxiliary node remains registered. |
| `remove-ai-watermark` | `compatibility-contract` | Historical auxiliary node remains readable. |
| `video-output` | `compatibility-contract` | Historical result-display node remains readable. |

## Guard

`npm run verify:penguin-compatibility-inventory` derives every `penguin:*` event and every `hidden: true` registry type from Web source, and checks that this inventory covers them. It also checks the historical schema values, template IDs and the legacy safe-error fallback. A new identifier must be classified here before it can pass the release gate.
