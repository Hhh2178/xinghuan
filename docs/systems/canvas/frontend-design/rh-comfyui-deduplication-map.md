# RH / ComfyUI Deduplication Map

This document is a future-facing map only. It does not resume ComfyUI development and does not require changing RH or ComfyUI logic in the current documentation batch.

## Shared Problems

- Select a backend-governed workflow/app.
- Render exposed parameters and defaults.
- Run a long task.
- Poll or subscribe to runtime status.
- Materialize output.
- Show one normal output port.
- Save/publish resources with permission checks.

## First Extraction Candidates

| Shared module | RH current source | ComfyUI current source | First target |
| --- | --- | --- | --- |
| Selector | `RunningHubNodeConfigSection.tsx` | `ComfyUINodeSelectorSection.tsx` | `WorkflowTargetSelector` |
| Parameter editor | `RunningHubNodeParamSection.tsx` | `ComfyUINodeParamSection.tsx` | `ExposedParameterEditor` |
| Run controls | `RunningHubNode.tsx` local controls | `ComfyUINodeRunSection.tsx` | `NodeRunControls` |
| Runtime display | `NodeRuntimeCard.tsx` | `ComfyUINodeRunSection.tsx` | `NodeRuntimeStateAdapter` |
| Output summary | RH output state helpers | `ComfyUINodeOutputSummarySection.tsx` | `GeneratedOutputSummary` |

## Migration Order

1. Document common props.
2. Extract visual shell and section wrappers.
3. Extract runtime state normalization.
4. Extract parameter renderer.
5. Extract selector.
6. Replace RH and ComfyUI local copies one at a time.

## Guardrails

- Do not change RH or ComfyUI execution behavior while establishing the design-system docs.
- Do not extract a shared module until its props are documented.
- Do not let future provider nodes copy RH or ComfyUI files directly.
- Prefer one shared provider workflow composition over one-off node families.
