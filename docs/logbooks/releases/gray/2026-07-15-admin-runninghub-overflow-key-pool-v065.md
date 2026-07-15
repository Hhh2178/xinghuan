# v0.6.5 Admin RunningHub Overflow And Key Pool Gray Release

## Release

- Version: `v0.6.5`
- Release ID: `20260715-admin-runninghub-overflow-key-pool-v065`
- Deploy path: `/opt/apps/xinghuan-canvas-next/releases/20260715-admin-runninghub-overflow-key-pool-v065`
- Domain: `canvas-next.hhh2121.xyz`
- Internal endpoint: `127.0.0.1:18200`
- Previous gray release: `20260715-aicopy-sd-video-input-modes-v064`
- Production remains: `v0.5.22 / 20260702-envsync-admin-sections-prod-r1-v0522`

## Scope

- Move RH Key pool management from the selected workflow/application editor to the RunningHub Provider level.
- Keep the Key pool collapsed by default and expose mutation controls only when expanded.
- Give RunningHub catalog cards explicit title, note, capability summary, warning, and Provider footer tracks.
- Clamp long title/summary text and bound note/warning text so adjacent cards cannot overlap.
- Add scoped Admin shrink guards without changing table-owned horizontal scrolling.
- Keep AICopy paid generation frozen; this release does not call or modify the expensive SD upstream model.

## Deployment Verification

- `xinghuan-canvas-next.service`: active.
- `xinghuan-canvas-next-worker.service`: active.
- Internal and public status endpoints return `0.6.5 / gray`.
- Database migration applied no new migration and skipped the existing 22 migrations.

## Browser Acceptance

| Viewport | Assistant | Horizontal overflow | AI app card overlap | Key pool hierarchy |
| --- | --- | ---: | ---: | --- |
| `1920x1080` | open | `0px` | `0 / 7` | before filters, outside editor |
| `1920x1080` | closed | `0px` | `0 / 7` | before filters, outside editor |
| `2560x1440` | open | `0px` | `0 / 7` | before filters, outside editor |
| `2560x1440` | closed | `0px` | `0 / 7` | before filters, outside editor |

- Seven AI application cards render at a stable `132px` height.
- A long title is truncated inside its card and remains available through its native tooltip.
- Expanded Key pool renders two bounded rows; each row has equal client and scroll width and does not create page overflow.
- API settings, public resources, users, tasks, and environment sync all render with `0px` page horizontal overflow at `1920x1080` with the assistant open.
- Browser console reports zero errors and zero warnings during the final regression pass.

## Local Verification

- RunningHub workspace and Key pool source contracts passed.
- RunningHub gray preset contracts passed.
- Admin and all-workspace type checks passed.
- `build:single-port`, project harness, and workspace harness passed.
- Release package alignment and package contract passed.

## Rollback

- Previous release: `/opt/apps/xinghuan-canvas-next/releases/20260715-aicopy-sd-video-input-modes-v064`
- Restore the previous `current` symlink and restart both gray services.

Detailed evidence: `../../validations/2026-07-15-admin-runninghub-overflow-key-pool.md`.
