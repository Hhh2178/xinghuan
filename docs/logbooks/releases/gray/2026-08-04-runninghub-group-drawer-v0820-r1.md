# RunningHub Group Drawer v0.8.20 Gray

- release: `20260804-runninghub-group-drawer-v0820-r1`
- version: `0.8.20`
- environment: `gray`
- target: `old-server / ubuntu@101.33.75.38:728`
- source commit: `412ca1cabbbdf14f0812c796939d2fedb08f8c17`
- archive SHA-256: `ca8e5c755d3c450f5188b2cc94f782828b2028f7b3d719d8594e3e8b48ba90e8`
- deployedAt: `2026-08-04`

## Scope

- Move RunningHub group management out of the permanent item rail into an opaque, independently scrollable drawer.
- Keep item-card width and text density unchanged; preserve existing group CRUD, filtering, and permission semantics.
- Add trigger, backdrop, Escape/overlay close behavior, and drawer accessibility semantics.

## Verification

- Focused Admin drawer tests: `4 passed`.
- Workspace type-check: passed.
- Admin build and single-port build: passed.
- RunningHub group permission, Admin workspace split, and API route split contracts: passed.
- Release package contract and version alignment: passed; archive contains 213 entries and manifest contains 187 files.
- Runtime: API/Worker active; internal and public status report `0.8.20 / gray / enforced`.
- Permission readiness: `137 subjects / 125 published / 3 restricted / 9 retired / 1195 rules / 5 principals / 0 failures`.

## Operational note

- Initial startup entered a restart loop because Gray contained permission drift: 3 subject updates, 271 rule upserts, and 8 rule deletes were required.
- A dry-run and then `permissions:reconcile --missing-policy=unresolved --apply` were executed against `xinghuan_canvas_gray`; the second plan was idempotent and unresolved principals were `0`.
- API and Worker were restarted after reconciliation, then runtime and readiness verification passed.
- Retention dry-run and apply passed on the old-server Gray target; exactly 5 release directories remain, including current `20260804-runninghub-group-drawer-v0820-r1` and rollback `20260803-runninghub-groups-v0818-r1`.

## Boundaries

- Production was not touched.
- Browser visual acceptance at 1920x1080 remains pending because the local Chromium runtime is unavailable.
