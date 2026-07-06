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
| `themeTokens.background` | `#07100f` | Shared dark app background baseline |
| `themeTokens.surface` | `#0d1a1c` | Shared surface baseline |
| `themeTokens.panel` | `#102326` | Shared panel baseline |
| `themeTokens.accent` | `#31f0b3` | Shared green accent baseline |

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
| Runtime card radius | `10px` baseline | Runtime state card |
| Context menu radius | `10px` current default | Canvas right-click menu |

## Spacing Tokens

| Token | Value | Usage |
| --- | --- | --- |
| Node shell padding | `12px` to `14px` | Outer node content |
| Header gap | `8px` | Icon/title/status alignment |
| Section gap | `10px` to `12px` | Between node sections |
| Parameter row gap | `6px` to `8px` | Label/control/helper stack |
| Menu item horizontal padding | `10px` to `12px` | Context menu action rows |
| Floating panel gap | `12px` | Assistant/context floating panels |

## Typography Tokens

| Token | Value | Usage |
| --- | --- | --- |
| Node title | `14px`, `600` | Header title |
| Node subtitle | `11px` to `12px`, `500` | Provider/workflow metadata |
| Parameter label | `12px`, `600` | Param row label |
| Helper text | `11px`, `400` | Description and validation help |
| Runtime text | `11px` to `12px` | Queue/running/success/error |
| Context menu label | `13px`, `500` | Right-click action labels |

## Motion Tokens

| Token | Value | Usage |
| --- | --- | --- |
| Hover transition | `160ms` to `200ms ease` | Buttons, menu items, selectable cards |
| Running pulse | `1.1s` to `1.4s ease-in-out` | Long-running state |
| Expansion transition | `180ms ease` | Collapsible sections |
| Nearest-node pulse | `1.15s ease-out` current behavior | Connection assistance highlight |

## Usage Rule

New canvas nodes must start from these token ranges before adding custom visual values. If a new node needs values outside these ranges, record the reason in `visual-component-registry.md` or the relevant system document before implementation.
