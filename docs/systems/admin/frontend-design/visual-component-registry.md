# Admin Visual Component Registry

This registry defines admin visual components and their intended home. Some entries already exist in `admin-common-components.tsx`; future work should formalize them instead of creating parallel one-off panels.

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
| `AdminInspectorDrawer` | scattered detail panels | `apps/admin/src/components/common/` | Inspect/edit side panel | Use for table row details and secondary edits |

## Ant Design Boundary

Ant Design components may implement these registry components during a controlled pilot. They should not bypass the registry by appearing directly in feature pages as raw, unthemed business controls.

## New Admin Page Rule

New admin pages should declare which registry components they use before implementation. If a page needs a new repeated visual pattern, add it to this registry first.
