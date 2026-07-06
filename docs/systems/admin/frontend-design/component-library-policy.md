# Admin Component Library Policy

## Decision

Admin may adopt Ant Design 6 through a controlled pilot. It is the preferred business component layer for tables, forms, drawers, modals, upload, pagination, tabs, segmented controls, notifications, empty states, and skeleton loading.

## Why

- Admin is a business governance surface with dense tables and forms.
- Ant Design has mature enterprise components and strong Chinese enterprise ecosystem adoption.
- Ant Design 6 supports React 18 and newer React versions and has modern token-based theming.
- The current admin package already uses React and Vite, so a scoped pilot can be isolated without touching canvas nodes.

## Rollout Rule

Start with one low-risk admin page or component island. Wrap theme and tokens before spreading usage.

## Theme Boundary

- Ant Design must be wrapped by a project theme provider before broader use.
- The pilot must use project colors, radius, density, and dark technology-console styling.
- Default Ant Design light theme must not appear as a raw visual surface in production pages.

## Boundary

Do not use Ant Design as the canvas node visual system.

## Acceptance

- The pilot page builds with `npm run build -w @xinghuan/admin`.
- The pilot does not change canvas bundle behavior.
- The pilot documents bundle, theme, style-conflict, and interaction findings before broader migration.
