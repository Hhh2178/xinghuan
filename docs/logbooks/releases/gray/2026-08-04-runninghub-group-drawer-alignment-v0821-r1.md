# RunningHub Group Drawer Rail Alignment v0.8.21 Gray

- release: `20260804-runninghub-group-drawer-alignment-v0821-r1`
- version: `0.8.21`
- environment: `gray`
- target: `old-server / ubuntu@101.33.75.38:728`
- source commit: `f67f5182421e0908615914029ec21a78726de81a`
- archive SHA-256: `5da3015e11a175bfb5216002c6acfac0f258b9fbde30af6b627c121c0b3cffc0`
- deployedAt: `2026-08-04`

## Scope

- Align the group filter trigger, item cards, and drawer to one shared left-rail content track.
- Anchor the drawer inside the rail instead of the viewport edge.
- Reserve the list scrollbar gap consistently so the trigger and item cards share the same right edge.
- Preserve text scale, line height, item-card copy density, and all existing group/catalog behavior.

## Verification

- Focused Admin drawer/alignment tests: `4 passed`.
- Admin type-check and build: passed.
- Single-port build: passed.
- RunningHub workspace helper contract: passed.
- Release package contract and version alignment: passed; archive contains 213 entries and manifest contains 187 files.
- Runtime: API/Worker active; internal and public status report `0.8.21 / gray / enforced`.
- Permission readiness: `137 subjects / 125 published / 3 restricted / 9 retired / 1195 rules / 5 principals / 0 failures`.

## Retention

- Retention dry-run and apply passed on the old-server Gray target; exactly 5 release directories remain, including current `20260804-runninghub-group-drawer-alignment-v0821-r1` and rollback `20260803-runninghub-groups-v0818-r1`.

## Boundaries

- Production was not touched.
- Browser visual acceptance at 1920x1080 remains pending because the local Chromium runtime is unavailable.
