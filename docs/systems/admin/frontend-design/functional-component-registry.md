# Admin Functional Component Registry

This registry tracks reusable admin behavior. It should be checked before adding new admin pages or workflow/provider governance tools.

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
| `ObservabilityTimeRangeController` | analytics range controls | `apps/admin/src/components/observability/` | Shared range, bucket size, URL state and request cancellation | Any health or analytics chart group |
| `HealthStatusExplanation` | system health status text | `apps/admin/src/components/observability/` | State, threshold, baseline, sample size and freshness explanation | Any computed health status |
| `ObservabilityDrilldownRouter` | scattered page links | `apps/admin/src/components/observability/` | Preserve environment/range/filter context when opening tasks, providers or releases | Any actionable metric or alert |
| `StaleDataBoundary` | page-level loading/error states | `apps/admin/src/components/observability/` | Keep last successful data, label stale, retry without zeroing charts | Any auto-refreshed observability block |

## New Admin Feature Rule

Before adding an admin feature page, identify whether it needs permission editing, workflow mapping, machine selection, task logs, metric cards, save bars, or upload. If yes, reuse or formalize the module in this registry.

Health and analytics pages must also declare their time-range controller, health explanation, stale-data and drill-down behavior before implementation.

## Current Boundary

This registry does not require changing RH or ComfyUI admin pages immediately. It prevents future pages from copying those flows into more one-off implementations.
