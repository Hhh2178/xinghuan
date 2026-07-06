# Ant Design Pilot Component Map

This document maps future Ant Design 6 pilot usage to project-owned admin component names. It does not install Ant Design and does not authorize raw Ant Design usage in feature pages.

## Pilot Boundary

- Ant Design 6 may be piloted only inside a project wrapper.
- The wrapper must map AntD tokens to `design-tokens.md`.
- The wrapper must preserve starlight dark-console styling.
- The pilot must not affect canvas nodes.

## Component Mapping

| Project Component | Possible Ant Design Primitive | Notes |
| --- | --- | --- |
| `AdminTable` | `Table` | Must keep project toolbar, empty, loading, error, and pagination conventions |
| `AdminFormPanel` | `Form`, `Input`, `Select`, `Switch` | Must preserve project label/help/error density |
| `AdminInspectorDrawer` | `Drawer` | Must keep project title/action layout |
| `AdminConfirmDialog` | `Modal` | Must preserve destructive confirmation copy and permission states |
| `AdminToolbar` | `Space`, `Segmented`, `Button`, `Select` | Must preserve icon/text alignment and compact height |
| `ResourceUploadDropzone` | `Upload` | Must preserve validation and permission messaging |
| `AdminStatusPill` | `Tag` or project span | Project CSS may be better than raw Tag for starlight style |

## Pilot Acceptance

- The pilot builds with `npm run build -w @xinghuan/admin`.
- The pilot passes `npm run type-check -w @xinghuan/admin`.
- The pilot documents bundle size, theme mapping, and style conflicts before broader migration.
