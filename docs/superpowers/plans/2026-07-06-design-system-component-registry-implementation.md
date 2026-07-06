# Design System Component Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the current frontend/admin visual guidelines from principle-level documents into a concrete design-system and reusable-component registry with tokens, component contracts, and RH/ComfyUI deduplication guidance.

**Architecture:** Add concrete token documents and component registries under `docs/systems/canvas/frontend-design/` and `docs/systems/admin/frontend-design/`, then add lightweight verification scripts that require those registries to stay indexed. Use the registry to plan later code extraction into `@xinghuan/ui`, `apps/web/src/components/nodes/common/`, and `apps/admin/src/components/common/` without immediately rewriting all nodes.

**Tech Stack:** Markdown design docs, existing CSS token extraction, Node.js ESM verification scripts, React 19, Vite, `@xinghuan/ui`, canvas node components, admin common components.

---

## Why This Plan Exists

The current visual docs correctly define direction, but they are too abstract:

- They do not include enough numeric tokens such as color values, radius, spacing, font sizes, icon sizes, menu dimensions, and motion durations.
- They do not define a reusable visual component inventory for new nodes and admin pages.
- They do not define a functional component inventory for repeated behavior such as workflow selection, parameter rendering, run controls, output summaries, permission gates, and save/publish actions.
- RH and ComfyUI already show the risk: similar node systems can drift into separate local abstractions instead of sharing a common node shell, selector, parameter renderer, runtime state, and output summary.

This plan fixes that in two layers:

- Documentation layer: concrete tokens, visual components, functional components, ownership, and verification.
- Code extraction layer: small shared components introduced gradually after the docs lock the target shape.

## Current Evidence

Current reusable layer:

- `packages/ui/src/index.tsx`
  - Has `themeTokens` and `XinghuanShell`.
  - Does not yet contain reusable node shells, parameter rows, runtime cards, admin panels, or selector primitives.

Current canvas candidates:

- `apps/web/src/components/nodes/NodeRuntimeCard.tsx`
- `apps/web/src/components/nodes/RunningHubNodeParamSection.tsx`
- `apps/web/src/components/nodes/RunningHubNodeConfigSection.tsx`
- `apps/web/src/components/nodes/RHToolsNodeParamSection.tsx`
- `apps/web/src/components/nodes/RHToolsNodeRuntimeSection.tsx`
- `apps/web/src/components/nodes/ComfyUINodeSelectorSection.tsx`
- `apps/web/src/components/nodes/ComfyUINodeParamSection.tsx`
- `apps/web/src/components/nodes/ComfyUINodeRunSection.tsx`
- `apps/web/src/components/nodes/ComfyUINodeOutputSummarySection.tsx`
- `apps/web/src/components/nodes/useUpstreamMaterials.ts`
- `apps/web/src/components/nodes/useUpdateNodeData.ts`

Current admin candidates:

- `apps/admin/src/admin-common-components.tsx`
  - `AdminTable`
  - `FormPanel`
  - `StatusPill`
  - `AdminWorkspaceBand`
  - `AdminBandTabButton`
- `apps/admin/src/admin-confirm-action-dialog.tsx`
- `apps/admin/src/admin-media-preview-modal.tsx`
- `apps/admin/src/admin-comfyui-workflow-card.tsx`
- `apps/admin/src/admin-runninghub-item-editor.tsx`

Current token sources:

- `packages/ui/src/index.tsx`
  - `themeTokens`
- `apps/admin/src/styles.css`
  - `--starlight-*`
  - `--admin-*`
- `apps/web/src/styles/index.css`
  - `--xh-cyber-*`
  - `--t8-*`
  - `--node-runtime-*`

## Non-Goals

- Do not resume ComfyUI feature development.
- Do not install Ant Design or Radix in this plan.
- Do not rewrite all canvas nodes in one batch.
- Do not move unstable feature-specific UI into `@xinghuan/ui` until the component has at least two real consumers or a clear upcoming second consumer.
- Do not freeze the design system forever; this plan creates a versioned baseline and a change process.

## Target Document Additions

Canvas:

```text
docs/systems/canvas/frontend-design/
  design-tokens.md
  visual-component-registry.md
  functional-component-registry.md
  node-composition-patterns.md
  rh-comfyui-deduplication-map.md
```

Admin:

```text
docs/systems/admin/frontend-design/
  design-tokens.md
  visual-component-registry.md
  functional-component-registry.md
  ant-design-pilot-component-map.md
```

Harness:

```text
scripts/verify-design-token-docs-contract.mjs
scripts/verify-component-registry-docs-contract.mjs
```

## Phase 1: Concrete Design Tokens

### Task 1.1: Add canvas design tokens

**Files:**
- Create: `docs/systems/canvas/frontend-design/design-tokens.md`
- Modify: `docs/systems/canvas/frontend-design/README.md`

Required sections:

```markdown
# Canvas Design Tokens

## Token Sources

- `apps/web/src/styles/index.css`
- `apps/web/src/styles/theme-core.css`
- `packages/ui/src/index.tsx`

## Core Color Tokens

| Token | Value | Usage |
| --- | --- | --- |
| `--t8-accent` | `#38bdf8` | Selected node, active ports, primary canvas actions |
| `--t8-bg-panel` | `#020617` | Node body and dark panel base |
| `--t8-bg-panel-elevated` | `#111827` | Raised node sections, menus, floating panels |
| `--t8-text-main` | `#f8fafc` | Primary node text |
| `--t8-text-muted` | `rgba(148, 163, 184, 0.78)` | Helper text and secondary metadata |
| `--t8-danger` | `#ef4444` | Destructive action and failed state |
| `--xh-cyber-accent` | `#69f7c7` | Login/entry cyber accent |
| `--xh-cyber-accent-2` | `#1fd5ff` | Secondary cyber accent |

## Node Geometry Tokens

| Token | Value | Usage |
| --- | --- | --- |
| Node minimum width | `280px` recommended baseline | Small utility node |
| Node standard width | `320px` to `380px` | Provider/generation nodes |
| Node wide width | `420px` to `520px` | Parameter-heavy workflow nodes |
| Node radius | `12px` baseline | Shell and section radius |
| Section radius | `10px` baseline | Parameter and runtime sections |
| Port size | `10px` to `12px` | React Flow handle |
| Header icon size | `18px` to `22px` | Node title icon |

## Spacing Tokens

| Token | Value | Usage |
| --- | --- | --- |
| Node shell padding | `12px` to `14px` | Outer node content |
| Header gap | `8px` | Icon/title/status alignment |
| Section gap | `10px` to `12px` | Between node sections |
| Parameter row gap | `6px` to `8px` | Label/control/helper stack |

## Typography Tokens

| Token | Value | Usage |
| --- | --- | --- |
| Node title | `14px`, `600` | Header title |
| Node subtitle | `11px` to `12px`, `500` | Provider/workflow metadata |
| Parameter label | `12px`, `600` | Param row label |
| Helper text | `11px`, `400` | Description and validation help |
| Runtime text | `11px` to `12px` | Queue/running/success/error |

## Motion Tokens

| Token | Value | Usage |
| --- | --- | --- |
| Hover transition | `160ms` to `200ms ease` | Buttons, menu items, selectable cards |
| Running pulse | `1.1s` to `1.4s ease-in-out` | Long-running state |
| Expansion transition | `180ms ease` | Collapsible sections |
```

Acceptance:

- `README.md` links `design-tokens.md`.
- Token values are grounded in existing CSS when possible.
- Any new recommended value is marked as a baseline, not a currently implemented token.

### Task 1.2: Add admin design tokens

**Files:**
- Create: `docs/systems/admin/frontend-design/design-tokens.md`
- Modify: `docs/systems/admin/frontend-design/README.md`

Required sections:

```markdown
# Admin Design Tokens

## Token Sources

- `apps/admin/src/styles.css`
- `packages/ui/src/index.tsx`

## Core Color Tokens

| Token | Value | Usage |
| --- | --- | --- |
| `--starlight-bg` | `#0b0c10` | App background |
| `--starlight-panel` | `#1f2128` | Primary panel |
| `--starlight-panel-2` | `#171920` | Secondary panel |
| `--starlight-border` | `#2d2f36` | Panel and input border |
| `--starlight-cyan` | `#66fcf1` | Primary accent |
| `--starlight-cyan-dim` | `rgba(102, 252, 241, 0.16)` | Soft accent surface |
| `--starlight-text` | `#f4f7fb` | Primary text |
| `--starlight-muted` | `#9aa7ad` | Secondary text |
| `--starlight-warning` | `#f1c40f` | Warning |
| `--starlight-danger` | `#e74c3c` | Danger |
| `--starlight-success` | `#2ecc71` | Success |

## Layout Tokens

| Token | Value | Usage |
| --- | --- | --- |
| `--admin-page-gap` | `18px` | Page section gap |
| `--admin-sticky-offset` | `120px` | Sticky panel offset |
| Sidebar nav item height | `64px` | Domain navigation |
| Topbar pill height | `32px` | Environment/version/status pills |
| Workspace band padding | `18px` | Page band content |
| Panel radius | `4px` current starlight baseline | Data panel and form panel |

## Typography Tokens

| Token | Value | Usage |
| --- | --- | --- |
| Kicker text | `11px`, mono, uppercase | Section metadata |
| Table body | `12px` to `13px` | Dense admin tables |
| Panel title | `16px` to `18px`, `600` | Data and form panels |

## Icon Tokens

| Token | Value | Usage |
| --- | --- | --- |
| Navigation icon | `20px` | Sidebar module icon |
| Button icon | `16px` to `18px` | Inline action icon |
| KPI icon | `20px` to `24px` | Metric cards |
```

Acceptance:

- README links `design-tokens.md`.
- Values reflect existing CSS.
- Ant Design pilot must map AntD tokens to these values before broader use.

## Phase 2: Visual Component Registries

### Task 2.1: Add canvas visual component registry

**Files:**
- Create: `docs/systems/canvas/frontend-design/visual-component-registry.md`
- Modify: `docs/systems/canvas/frontend-design/README.md`

Registry entries:

```markdown
# Canvas Visual Component Registry

| Component | Owner | Current source | Target home | Purpose | Reuse rule |
| --- | --- | --- | --- | --- | --- |
| `CanvasNodeShell` | Canvas | Node-specific wrappers | `@xinghuan/ui` or `apps/web/src/components/nodes/common/` | Standard node shell, selected state, radius, shadow, border | Use for every new provider/generation node |
| `CanvasNodeHeader` | Canvas | RH/ComfyUI local headers | `apps/web/src/components/nodes/common/` | Icon, title, subtitle, selector slot, status slot | Required for workflow/provider nodes |
| `CanvasNodeSection` | Canvas | RH/ComfyUI section components | `apps/web/src/components/nodes/common/` | Section title, helper, collapsible grouping | Use before adding custom parameter blocks |
| `CanvasParamRow` | Canvas | RH/ComfyUI param sections | `apps/web/src/components/nodes/common/` | Label/control/helper/error/default row | Required for exposed parameters |
| `CanvasSelectorBar` | Canvas | ComfyUI/RH selectors | `apps/web/src/components/nodes/common/` | Machine/provider/workflow/model selector | Use for any selectable execution target |
| `CanvasRuntimeCard` | Canvas | `NodeRuntimeCard.tsx` | `@xinghuan/ui` after second consumer | Queue/running/success/error state | Use for long-running node tasks |
| `CanvasOutputPreview` | Canvas | output preview helpers | `apps/web/src/components/nodes/common/` | Generated result preview and output summary | Use for generation nodes |
| `CanvasContextMenuAction` | Canvas | context menu CSS/classes | `@xinghuan/ui` after stabilization | Menu icon/text/permission/danger states | Use for right-click actions |
```

Acceptance:

- Registry names target components even before extraction.
- Every component has current source and target home.
- RH/ComfyUI shared needs are explicitly covered.

### Task 2.2: Add admin visual component registry

**Files:**
- Create: `docs/systems/admin/frontend-design/visual-component-registry.md`
- Modify: `docs/systems/admin/frontend-design/README.md`

Registry entries:

```markdown
# Admin Visual Component Registry

| Component | Current source | Target home | Purpose | Reuse rule |
| --- | --- | --- | --- | --- |
| `AdminPageShell` | `apps/admin/src/main.tsx` | `apps/admin/src/components/common/` | Sidebar, topbar, main area, assistant dock boundary | Use for all admin pages |
| `AdminWorkspaceBand` | `admin-common-components.tsx` | `apps/admin/src/components/common/` | Page intro, focus block, actions, tabs | Use for feature workspaces |
| `AdminDataPanel` | `AdminTable` / `.data-panel` | `apps/admin/src/components/common/` | Data cards and tables | Use before custom data panels |
| `AdminTable` | `admin-common-components.tsx` | `apps/admin/src/components/common/` | Table wrapper and toolbar | Use for dense data lists |
| `AdminFormPanel` | `FormPanel` | `apps/admin/src/components/common/` | Form card shell | Use for create/edit panels |
| `AdminStatusPill` | `StatusPill` | `apps/admin/src/components/common/` | Status labels | Use for online/failed/running/success |
| `AdminConfirmDialog` | `admin-confirm-action-dialog.tsx` | `apps/admin/src/components/common/` | Dangerous or permission-sensitive confirmation | Required for destructive actions |
| `AdminEmptyState` | scattered `.empty-state` | `apps/admin/src/components/common/` | Empty and no-permission states | Use for missing data or denied access |
| `AdminToolbar` | scattered toolbar classes | `apps/admin/src/components/common/` | Filters, batch actions, refresh | Use above tables |
```

Acceptance:

- Existing components are not renamed immediately.
- Registry identifies extraction target and reuse rule.
- Ant Design pilot components map to these registry names instead of bypassing them.

## Phase 3: Functional Component Registries

### Task 3.1: Add canvas functional component registry

**Files:**
- Create: `docs/systems/canvas/frontend-design/functional-component-registry.md`
- Modify: `docs/systems/canvas/frontend-design/README.md`

Registry entries:

```markdown
# Canvas Functional Component Registry

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
| `PermissionGate` | scattered permission checks | `packages/shared` + UI wrapper | Action visibility/disabled reason | Any permission-sensitive action |
| `UpstreamMaterialResolver` | `useUpstreamMaterials.ts` | existing hook + docs | Resolve connected media/materials | Any node consuming upstream assets |
```

Acceptance:

- RH and ComfyUI are explicitly treated as first deduplication targets.
- Registry separates visual component from functional behavior.
- Each entry says when reuse is mandatory.

### Task 3.2: Add admin functional component registry

**Files:**
- Create: `docs/systems/admin/frontend-design/functional-component-registry.md`
- Modify: `docs/systems/admin/frontend-design/README.md`

Registry entries:

```markdown
# Admin Functional Component Registry

| Module | Current candidates | Target home | Responsibility | Reuse trigger |
| --- | --- | --- | --- | --- |
| `PermissionMatrixEditor` | permissions panel sections | `apps/admin/src/components/common/` | Group/user permission toggles and denied ids | Any permission page |
| `WorkflowInputOutputMapper` | RH item editor, ComfyUI workflow card | `apps/admin/src/components/common/` | Exposed input/output mapping and defaults | Any workflow/app governance page |
| `MachineInstanceSelector` | ComfyUI instance panels | `apps/admin/src/components/common/` | Machine selection and health display | Any machine-scoped provider page |
| `TaskLogTable` | task panel/log sections | `apps/admin/src/components/common/` | Task status, pagination, retry/cancel affordance | Any task/audit page |
| `AuditMetricCard` | usage dashboard/overview cards | `apps/admin/src/components/common/` | Metric title, value, delta, tone | Any analytics panel |
| `RevisionConflictNotice` | revision/ownership guards | `apps/admin/src/components/common/` | Conflict, stale revision, save blocked reason | Any editable settings page |
| `AdminSaveBar` | permissions savebar and page save controls | `apps/admin/src/components/common/` | Dirty state, save, reset, conflict | Any multi-field edit page |
| `ResourceUploadDropzone` | resource/workflow upload areas | `apps/admin/src/components/common/` | File upload state, validation, permission | Any upload page |
```

Acceptance:

- Registry covers workflow management, permissions, tasks, audit, and upload.
- Entries point to current candidates and target home.

## Phase 4: Node Composition Patterns And RH/ComfyUI Deduplication

### Task 4.1: Add node composition patterns

**Files:**
- Create: `docs/systems/canvas/frontend-design/node-composition-patterns.md`
- Modify: `docs/systems/canvas/frontend-design/README.md`

Required pattern:

```markdown
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
```

Acceptance:

- Pattern is explicit enough for a new provider node.
- It names visual and functional modules from registries.

### Task 4.2: Add RH/ComfyUI deduplication map

**Files:**
- Create: `docs/systems/canvas/frontend-design/rh-comfyui-deduplication-map.md`
- Modify: `docs/systems/canvas/frontend-design/README.md`

Required sections:

```markdown
# RH / ComfyUI Deduplication Map

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
```

Acceptance:

- Map does not require ComfyUI feature development.
- Map defines future deduplication route only.
- It prevents future provider nodes from copying RH or ComfyUI directly.

## Phase 5: Verification Scripts

### Task 5.1: Add design token docs contract

**Files:**
- Create: `scripts/verify-design-token-docs-contract.mjs`
- Modify: `package.json`
- Modify: `scripts/verify-visual-design-docs-contract.mjs`

Contract requirements:

- Canvas `design-tokens.md` exists and includes `--t8-accent`, `--t8-bg-panel`, `Node standard width`, `Node title`.
- Admin `design-tokens.md` exists and includes `--starlight-bg`, `--starlight-cyan`, `--admin-page-gap`, `Navigation icon`.
- Existing visual docs contract calls or asserts the token docs.

Expected output:

```text
design token docs contract: ok
```

### Task 5.2: Add component registry docs contract

**Files:**
- Create: `scripts/verify-component-registry-docs-contract.mjs`
- Modify: `package.json`
- Modify: `scripts/verify-visual-design-docs-contract.mjs`

Contract requirements:

- Canvas visual registry exists and includes `CanvasNodeShell`, `CanvasParamRow`, `CanvasRuntimeCard`.
- Canvas functional registry exists and includes `MachineWorkflowSelector`, `ExposedParameterEditor`, `GeneratedOutputSummary`.
- Canvas node composition doc exists and includes `Provider Workflow Node`.
- RH/ComfyUI map exists and includes `RunningHubNodeParamSection.tsx`, `ComfyUINodeParamSection.tsx`.
- Admin visual registry exists and includes `AdminTable`, `AdminFormPanel`, `AdminConfirmDialog`.
- Admin functional registry exists and includes `WorkflowInputOutputMapper`, `PermissionMatrixEditor`, `ResourceUploadDropzone`.

Expected output:

```text
component registry docs contract: ok
```

### Task 5.3: Wire contracts into harness

**Files:**
- Modify: `package.json`
- Modify: `docs/systems/harness/README.md`
- Modify: `docs/systems/harness/workspace-verify-release-map.md`
- Modify: `scripts/verify-harness-doc-sync-contract.mjs`

Add scripts:

```json
"verify:design-token-docs-contract": "node scripts/verify-design-token-docs-contract.mjs",
"verify:component-registry-docs-contract": "node scripts/verify-component-registry-docs-contract.mjs"
```

Update `harness:verify:project` to include the new docs contracts after `verify:visual-design-docs-contract`.

Acceptance:

- `npm run verify:design-token-docs-contract` passes.
- `npm run verify:component-registry-docs-contract` passes.
- `npm run verify:visual-design-docs-contract` passes.
- `npm run verify:harness-doc-sync-contract` passes.
- `npm run harness:verify:project` passes.

## Phase 6: Code Extraction Preparation

This phase prepares future implementation but should not extract everything at once.

### Task 6.1: Create component extraction audit

**Files:**
- Create: `docs/records/architecture/2026-07-06-design-system-component-extraction-audit.md`

Required sections:

- Canvas current duplicates.
- Admin current duplicates.
- First extraction candidates.
- Files to avoid touching in the first code batch.
- Validation commands for first extraction.

### Task 6.2: First code extraction proposal

First recommended implementation batch after this plan:

Canvas:

- Create `apps/web/src/components/nodes/common/CanvasNodeSection.tsx`
- Create `apps/web/src/components/nodes/common/CanvasParamRow.tsx`
- Create `apps/web/src/components/nodes/common/NodeRunControls.tsx`
- Use them in one low-risk node or one RH/ComfyUI section only after tests/contracts are ready.

Admin:

- Move `AdminTable`, `FormPanel`, `StatusPill`, `AdminWorkspaceBand`, `AdminBandTabButton` from `admin-common-components.tsx` to `apps/admin/src/components/common/`.
- Keep re-export compatibility from `admin-common-components.tsx`.

Acceptance:

- `npm run type-check -w @xinghuan/web`
- `npm run type-check -w @xinghuan/admin`
- Relevant existing contracts:
  - `npm run verify:admin-common-components-contract`
  - `npm run verify:runninghub-node-section-split-contract`
  - `npm run verify:comfyui-unified-node-contract`

## Commit Boundaries

1. `docs: add concrete design token docs`
2. `docs: add visual and functional component registries`
3. `docs: add node composition and RH ComfyUI dedupe map`
4. `chore: enforce design system registry docs`
5. `docs: record design system extraction audit`

## Final Verification

Run:

```bash
npm run verify:design-token-docs-contract
npm run verify:component-registry-docs-contract
npm run verify:visual-design-docs-contract
npm run verify:harness-doc-sync-contract
npm run harness:verify:project
git status --short
```

Expected:

- All commands pass.
- Worktree is clean after final commit.

## Open Decision

Before implementation, confirm whether the first code extraction should target:

1. Canvas first: RH/ComfyUI shared node sections.
2. Admin first: move existing `admin-common-components.tsx` into a formal common component folder.
3. Documentation and verification only: lock tokens/registries/contracts first, then do code extraction in a separate plan.

Recommended: choose option 3 for the next immediate batch, then start with admin extraction because it is lower risk than provider node behavior.
