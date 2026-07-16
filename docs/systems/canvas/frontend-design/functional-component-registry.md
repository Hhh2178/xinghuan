# Canvas Functional Component Registry

This registry tracks reusable behavior for future canvas nodes. It is intentionally separate from visual components so a module can share behavior without forcing one visual layout.

| Module | Current candidates | Target home | Responsibility | Reuse trigger |
| --- | --- | --- | --- | --- |
| `MachineWorkflowSelector` | `ComfyUINodeSelectorSection.tsx`, RH catalog selectors | `apps/web/src/components/nodes/common/` | Machine-first workflow selection when workflows belong to machines | Any machine-scoped workflow node |
| `WorkflowTargetSelector` | RH/ComfyUI selectors | `apps/web/src/components/nodes/common/` | Provider/workflow/app/model selection | Any provider-backed node |
| `ExposedParameterEditor` | RH/ComfyUI param sections | `apps/web/src/components/nodes/common/` | Render exposed parameter schema, defaults, required state, hidden state | Any backend-defined parameter schema |
| `NodeRunControls` | RH/ComfyUI run sections | `apps/web/src/components/nodes/common/` | Run/cancel/retry controls and disabled reasons | Any long-running task node |
| `NodeRuntimeStateAdapter` | `NodeRuntimeCard.tsx`, task status helpers | `apps/web/src/components/nodes/common/` | Normalize idle/submitting/polling/success/error/cancelled | Any async generation node |
| `GeneratedOutputSummary` | ComfyUI output summary, output preview helpers | `apps/web/src/components/nodes/common/` | Summarize output URLs/materials and expose one output port | Any generation node |
| `SaveToLibraryAction` | resource library menu/action flows | `apps/web/src/components/nodes/common/` | Save workflow/output/resource to personal library | Any resource-producing node |
| `PublishToPublicLibraryAction` | public library actions | `apps/web/src/components/nodes/common/` | Admin-only publish to public library | Any admin-publishable node |
| `PermissionGate` | scattered permission checks | `packages/shared` plus UI wrapper | Action visibility and disabled reason | Any permission-sensitive action |
| `UpstreamMaterialResolver` | `useUpstreamMaterials.ts` | existing hook plus docs | Resolve connected media/materials | Any node consuming upstream assets |
| `NodeRunTrigger` | `useRunTrigger.ts` | existing hook | Share manual, batch and group-triggered node execution completion state | Any synchronous utility node that can run in a group |
| `GroupNodeRetryRunner` | `useCanvasRuntime.ts::runNodeWithRetries` | canvas runtime | Initial attempt plus at most three retries, then fail the batch | Every group or canvas batch execution |
| `WorkflowTemplateSource` | `WorkflowTemplateModal.tsx`, shared resource API | shared resource service | Load categories and `kind=workflow` items from the same source as the resource library | Every workflow template browser |
| `LockedGroupPositionGuard` | `groupBoxGuards.ts` | existing helper | Filter position changes and restore drag-start position for locked members | Every React Flow position update path |
| `ViewportFloatingPanel` | `ViewportFloatingPanel.tsx` | existing component | Measure pointer overlays, prefer cursor-right placement, flip/clamp to viewport and scroll oversized content | Every canvas context menu or pointer-anchored action panel |
| `TextSplitGeneratedGraph` | `textSplitGeneratedGraph.ts` | existing helper | Build ordered OutputNode or explicit TextNode batches, source edges and replacement IDs | Text segmentation manual, loop and group execution paths |

## New Node Rule

Before building a new provider or workflow node, check this registry. If the node needs workflow selection, backend-exposed parameters, task runtime, output materialization, or library actions, it should reuse the matching module instead of adding local one-off behavior.

## Current Boundary

This registry does not require refactoring existing RH or ComfyUI logic immediately. It defines the path for future nodes and future deduplication.
