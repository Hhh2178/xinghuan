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
| `--admin-assistant-dock-width` | `clamp(320px, 29vw, 420px)` | Assistant dock width |
| Sidebar nav item height | `52px` | Ten-domain navigation |
| Topbar pill height | `32px` | Environment/version/status pills |
| Workspace band padding | `18px` | Page band content |
| Workspace band gap | `12px` | Page band internal rhythm |
| Panel radius | `4px` current starlight baseline | Data panel and form panel |

## Typography Tokens

| Token | Value | Usage |
| --- | --- | --- |
| Kicker text | `11px`, mono, uppercase | Section metadata |
| Sidebar subtitle | `10px`, mono | Navigation secondary label |
| Table body | `12px` to `13px` | Dense admin tables |
| Panel title | `16px` to `18px`, `600` | Data and form panels |
| Status pill | `11px`, mono or compact text | Version/environment/status labels |

## Icon Tokens

| Token | Value | Usage |
| --- | --- | --- |
| Navigation icon | `20px` | Sidebar module icon |
| Button icon | `16px` to `18px` | Inline action icon |
| KPI icon | `20px` to `24px` | Metric cards |
| Panel title icon | `18px` to `20px` | Form and data panel headers |

## Motion Tokens

| Token | Value | Usage |
| --- | --- | --- |
| `--admin-motion-fast` | `100ms` | Press and focus feedback |
| `--admin-motion-standard` | `180ms` | Navigation and control state changes |
| `--admin-motion-panel` | `240ms` | Panel and route content transitions |
| `--admin-ease-standard` | project cubic-bezier | Shared easing |

All decorative transitions must be disabled under `prefers-reduced-motion: reduce`; state changes must remain understandable without movement.

## Ant Design Pilot Mapping

Ant Design 6 may be piloted only after its theme tokens are mapped back to this table:

| AntD Token Area | Project Mapping |
| --- | --- |
| colorBgBase | `--starlight-bg` |
| colorBgContainer | `--starlight-panel` |
| colorBorder | `--starlight-border` |
| colorPrimary | `--starlight-cyan` |
| colorText | `--starlight-text` |
| colorTextSecondary | `--starlight-muted` |
| borderRadius | `4px` starlight baseline unless the page explicitly opts into a larger radius |

## Usage Rule

Admin pages should use these values through shared classes, project components, or a theme provider. Raw one-off colors, spacing, or icon sizes should be treated as temporary and must be added to the registry if they become repeated.
