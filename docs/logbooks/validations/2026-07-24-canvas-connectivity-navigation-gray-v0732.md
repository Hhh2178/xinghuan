# Canvas Connectivity And Navigation Gray v0.7.32 Validation

## Runtime

- Release `20260724-canvas-navigation-gray-r2-v0732` passed public/internal status, API service, Worker service, permission mode and permission readiness verification.
- No database migration was applied; all `41` known migrations were already current.

## PC Visual Evidence

- At `1920x1080`, the selected canvas showed visible edges across the translucent Workflow Region fill. Computed region background was 20% alpha and its layer was below the edge layer.
- Selected dependency classification reached the rendered edge classes. The release fixes React Flow inline stroke precedence so direct and transitive emphasis can override default edge styles.
- At Gray `v0.7.32`, exactly one `.react-flow__minimap` was present, displayed at `202x152` with `z-index: 20`.

## Remaining Runtime Evidence

- This release record does not claim a new full isolated Canvas Run lifecycle. The existing Gray v0.7.28 lifecycle evidence remains historical; a new disposable workflow lifecycle check is still required before final AI supervision completion.
- Authenticated Gray UI smoke on a disposable Canvas confirmed the advisory guard blocks a `code` node before plan creation with `CANVAS_RUN_LEGACY_NODE_UNSUPPORTED` and directs the user to supported `native-server` nodes. The test Canvas was not used for a paid provider request.
- Browser automation could create and select the disposable Canvas, but its repeated creation flow did not expose a second fresh Canvas ID reliably enough to claim a current successful Run lifecycle. This is an evidence limitation, not a successful lifecycle result.
