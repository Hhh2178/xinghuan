# Admin Visual Component Registry

This registry defines admin visual components and their intended home. Some entries already exist in `admin-common-components.tsx`; future work should formalize them instead of creating parallel one-off panels.

| Component | Current source | Target home | Purpose | Reuse rule |
| --- | --- | --- | --- | --- |
| `AdminPageShell` | `apps/admin/src/main.tsx` | `apps/admin/src/components/common/` | Sidebar, topbar, main area, assistant dock boundary | Use for all admin pages |
| `AdminWorkspaceFrame` | `admin-common-components.tsx` + `styles/admin-foundation.css` | current shared source | Shell-owned H1 labelled page-content boundary | Wrap migrated page content; never render another page H1 or own data loading |
| `AdminWorkspaceBand` | `admin-common-components.tsx` | `apps/admin/src/components/common/` | Page intro, focus block, actions, tabs | Use for feature workspaces |
| `AdminSummaryStrip` | `admin-common-components.tsx` + `styles/admin-foundation.css` | current shared source | Compact key summary with text-backed semantic tones | Use once near the top of data/realtime templates; do not use gradient for status meaning |
| `AdminConfigurationWorkbench` | `admin-configuration-workbench.tsx` + `styles/admin-configuration-workbench.css` | current shared source | Presentation-only boundary for configuration pages | Wrap Provider/model, RH, ComfyUI visual-only, runtime settings, and environment sync; never own loaders, drafts, revisions, conflicts, or writes |
| `AdminConfigurationContext` | `admin-configuration-workbench.tsx` | current shared source | Selected object/section context below the shell-owned page identity | Use a `strong` object title and semantic `StatusPill`; never add another page H1 |
| `AdminConfigurationLayout` | `admin-configuration-workbench.tsx` | current shared source | Stable neutral rail/editor/optional-inspector desktop tracks | Pass existing feature content through slots; do not move feature state into the layout |
| `AdminConfigurationSaveBar` | `admin-configuration-workbench.tsx` | current shared source | Caller-controlled dirty/synchronized status with reset and save actions | Caller remains authoritative for dirty comparison and callbacks; disabled state follows `dirty` and `saving` props |
| `AdminDataWorkbench` | `admin-data-workbench.tsx` + `styles/admin-data-workbench.css` | current shared source | Presentation-only boundary for overview, realtime, and analytics pages | Wrap C data pages; never own requests, polling, filters, calculations, task actions, navigation, or Inspector state |
| `AdminDataContext` | `admin-data-workbench.tsx` | current shared source | Local data window, freshness, status, and actions below the shell-owned page identity | Use semantic `StatusPill` and compact metadata; never render another page H1 |
| `AdminDataToolbar` | `admin-data-workbench.tsx` | current shared source | Accessible unframed boundary for filters and compact data controls | Keep control values and callbacks in the feature owner; do not turn the toolbar into a nested card |
| `AdminDataPanel` | `AdminTable` / `.data-panel` | `apps/admin/src/components/common/` | Data cards and tables | Use before custom data panels |
| `AdminTable` | `admin-common-components.tsx` | `apps/admin/src/components/common/` | Table wrapper and toolbar | Use for dense data lists |
| `AdminFormPanel` | `FormPanel` | `apps/admin/src/components/common/` | Form card shell | Use for create/edit panels |
| `AdminStatusPill` | `StatusPill` | `apps/admin/src/components/common/` | Status labels | Use for online/failed/running/success |
| `AdminTableEmptyState` | `DataTable` / `.admin-table-empty` | current shared source | In-table empty result with preserved columns and panel geometry | Pass a page-specific `emptyLabel`; loading and route errors remain owned by the existing shell/loader |
| `AdminConfirmDialog` | `admin-confirm-action-dialog.tsx` | `apps/admin/src/components/common/` | Dangerous or permission-sensitive confirmation | Required for destructive actions |
| `AdminEmptyState` | scattered `.empty-state` | `apps/admin/src/components/common/` | Empty and no-permission states | Use for missing data or denied access |
| `AdminToolbar` | scattered toolbar classes | `apps/admin/src/components/common/` | Filters, batch actions, refresh | Use above tables |
| `AdminInspectorDrawer` | scattered detail panels | `apps/admin/src/components/common/` | Inspect/edit side panel | Use for table row details and secondary edits |
| `AdminHealthSummaryRail` | system health alert rows | `apps/admin/src/components/observability/` | Critical/warning summary, impact and recommended action | Use at the top of health and operations pages |
| `AdminHealthDomainCard` | system health rows | `apps/admin/src/components/observability/` | API/DB/Redis/Worker/Storage status and key metrics | Use for domain health summaries |
| `AdminServiceTopology` | not formalized | `apps/admin/src/components/observability/` | Stable request and task execution topology | Use for system relationship and link health |
| `AdminMetricTrendChart` | usage/cost chart patterns | `apps/admin/src/components/observability/` | Time-series value, baseline, threshold and stale interval | Use for throughput, latency, success and wait trends |
| `AdminQueueCapacityChart` | runtime queue summaries | `apps/admin/src/components/observability/` | Queue depth, wait and configured/effective capacity | Use for capability queues and worker capacity |
| `AdminProviderHealthHeatmap` | not formalized | `apps/admin/src/components/observability/` | Provider/model health comparison with sample size | Use for provider and capability comparisons |
| `AdminIncidentTimeline` | audit/event lists | `apps/admin/src/components/observability/` | Alerts, deploys, config changes, restarts and recovery | Use for health-correlated events |
| `AdminObservabilityInspector` | scattered technical tables | `apps/admin/src/components/observability/` | Metrics, thresholds, related events and technical details | Use for health chart/card drill-down |
| `AdminVersionedConfigEditor` | `admin-agent-role-configuration-editor.tsx`, `admin-agent-pool-editor.tsx`, `admin-agent-quality-editor.tsx` | `apps/admin/src/components/agent-governance/` | Structured Agent, route, quality and recovery draft editing with dirty-state reporting, sticky save action and separated history | Never expose raw JSON as the primary editing surface; save creates a new draft version and workspace navigation must protect unsaved edits |
| `AdminKnowledgeEditor` | basic fields in `admin-agent-governance-workspace.tsx` | `apps/admin/src/components/agent-governance/` | Markdown edit/preview, audience, reference validation, publication and index status | Use published-document lifecycle; preview uses shared `AssistantMarkdown` policy |
| `AdminAssistantDock` | `admin-assistant-panel.tsx` + `packages/ui/src/assistant-chat-ui.tsx` | current feature location + shared UI | Optional page-context assistant | Reuse the shared conversation, status, attachment and composer behavior; keep Admin context collection and permissions local; remain collapsible without pushing the main form below the desktop viewport |

## Ant Design Boundary

Ant Design components may implement these registry components during a controlled pilot. They should not bypass the registry by appearing directly in feature pages as raw, unthemed business controls.

## New Admin Page Rule

New admin pages should declare which registry components they use before implementation. If a page needs a new repeated visual pattern, add it to this registry first.
