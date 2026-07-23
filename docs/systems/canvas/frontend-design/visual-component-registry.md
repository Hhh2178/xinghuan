# Canvas Visual Component Registry

This registry defines visual building blocks that future canvas nodes should use. Some entries are not extracted yet; they are still the target shape for new work.

| Component | Owner | Current source | Target home | Purpose | Reuse rule |
| --- | --- | --- | --- | --- | --- |
| `CanvasNodeShell` | Canvas | Node-specific wrappers | `@xinghuan/ui` or `apps/web/src/components/nodes/common/` | Standard node shell, selected state, radius, shadow, border | Use for every new provider/generation node |
| `CanvasNodeHeader` | Canvas | RH/ComfyUI local headers | `apps/web/src/components/nodes/common/` | Icon, title, subtitle, selector slot, status slot | Required for workflow/provider nodes |
| `CanvasNodeSection` | Canvas | RH/ComfyUI section components | `apps/web/src/components/nodes/common/` | Section title, helper, collapsible grouping | Use before adding custom parameter blocks |
| `CanvasParamRow` | Canvas | RH/ComfyUI param sections | `apps/web/src/components/nodes/common/` | Label/control/helper/error/default row | Required for exposed parameters |
| `CanvasSelectorBar` | Canvas | ComfyUI/RH selectors | `apps/web/src/components/nodes/common/` | Machine/provider/workflow/model selector | Use for any selectable execution target |
| `CanvasRuntimeCard` | Canvas | `NodeRuntimeCard.tsx` | `@xinghuan/ui` after second stable consumer | Queue/running/success/error state | Use for long-running node tasks |
| `NodeCostBadge` | Canvas | `components/nodes/common/NodeCostBadge.tsx` | current shared location | Current model quote and immutable task-cost settlement metadata | Use for priced backend catalog generation nodes; hide entirely without valid pricing |
| `CanvasOutputPreview` | Canvas | output preview helpers | `apps/web/src/components/nodes/common/` | Generated result preview and output summary | Use for generation nodes |
| `CanvasContextMenuAction` | Canvas | context menu CSS/classes | `@xinghuan/ui` after stabilization | Menu icon/text/permission/danger states | Use for right-click actions |
| `CanvasPermissionHint` | Canvas | scattered disabled text | `apps/web/src/components/nodes/common/` | Permission-denied or admin-only hints | Use when an action exists but is blocked |
| `CanvasEmptyState` | Canvas | scattered empty panels | `apps/web/src/components/nodes/common/` | No workflow, no output, no upstream input states | Use for empty node sections |
| `WorkflowTopologyCard` | Canvas resources | `components/resource-library/WorkflowTopologyCard.tsx` | current shared location | Shared workflow thumbnail or topology fallback | Resource library and template modal must reuse it |
| `CodeNode` | Canvas nodes | `components/nodes/CodeNode.tsx` | current node location | Orange utility node with Python editor, presets, run state and output preview | Keep utility color, header density and port treatment aligned with existing tool nodes |
| `LabelNode` | Canvas nodes | `components/nodes/LabelNode.tsx` | current node location | Slate auxiliary annotation board with typography, free width/height resize and lock controls | Keep portless, persist size, hide resize handles while locked and stay visually aligned with auxiliary nodes |
| `CanvasAssistantLauncher` | Canvas AI | `components/canvas-assistant/CanvasAssistantShell.tsx` | current feature location | Floating conversation, knowledge reference and patch-proposal entry | Must not contain Canvas Run supervision tabs or controls |
| `CanvasSupervisionTrigger` | Canvas AI | `App.tsx` | implemented top header action | Independent AI hosting status and panel toggle beside announcements | Must remain independent from assistant visibility and conversation state |
| `CanvasSupervisionPanel` | Canvas AI | `components/canvas-agent/CanvasSupervisionDock.tsx` + `CanvasRunSupervisor.tsx` | implemented controller and projection | Run Plan, topology, step state, approvals, budget and event timeline | Reads server projection; closing the panel never cancels a run |
| `AssistantMarkdown` | Shared AI content | `@xinghuan/ui` | implemented for Canvas/Admin | Safe `markdown-v1` renderer with GFM and reasoning-free final content | Canvas and Admin must share one URL/HTML policy and typography contract |

## Extraction Rule

Do not move a component into `@xinghuan/ui` only because it is visually attractive. Move it when it is stable, has at least two consumers, or is required by a committed node family design.

## New Node Rule

New provider/workflow nodes should start with:

1. `CanvasNodeShell`
2. `CanvasNodeHeader`
3. `CanvasNodeSection`
4. `CanvasParamRow`
5. `CanvasRuntimeCard`
6. `CanvasOutputPreview`

Utility and auxiliary nodes may use a lighter shell, but must keep the registry category color, shared radius, header density, icon button pattern, selection ring and control sizing. They must not introduce a separate palette or panel category.
