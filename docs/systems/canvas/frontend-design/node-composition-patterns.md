# Node Composition Patterns

## Provider Workflow Node

Use for RH, ComfyUI, and future provider workflow nodes.

Composition:

1. `CanvasNodeShell`
2. `CanvasNodeHeader`
3. `MachineWorkflowSelector` when machine-scoped
4. `WorkflowTargetSelector`
5. `ExposedParameterEditor`
6. `NodeRunControls`
7. `NodeRuntimeStateAdapter`
8. `GeneratedOutputSummary`
9. One normal output port

Rules:

- Machine-scoped workflow nodes select machine before workflow.
- Backend exposure rules decide hidden parameters.
- Runtime diagnostics stay in details, not extra output ports.
- Internal scroll is not the default for required execution parameters.
- New provider nodes should not copy RH or ComfyUI layout directly; they should compose from the registry.

## Simple Utility Node

Use for local canvas helpers that do not call a provider.

Composition:

1. `CanvasNodeShell`
2. `CanvasNodeHeader`
3. `CanvasNodeSection`
4. `CanvasParamRow` only when user-configurable parameters exist
5. One output port if it transforms or produces data

Rules:

- Keep width near the node minimum baseline unless the utility requires previews.
- Avoid runtime sections unless the node performs async work.

## Media Transform Node

Use for resize, crop, background removal, watermark removal, and future media utilities.

Composition:

1. `CanvasNodeShell`
2. `CanvasNodeHeader`
3. `UpstreamMaterialResolver`
4. `CanvasNodeSection` for transform parameters
5. `NodeRunControls` when async
6. `GeneratedOutputSummary`
7. One normal output port

Rules:

- Upstream material state must be explicit.
- Missing upstream input should use `CanvasEmptyState`, not a silent disabled button.
