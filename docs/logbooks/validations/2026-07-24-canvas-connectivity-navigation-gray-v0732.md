# Canvas Connectivity And Navigation Gray v0.7.32 Validation

## Runtime

- Release `20260724-canvas-navigation-gray-r2-v0732` passed public/internal status, API service, Worker service, permission mode and permission readiness verification.
- No database migration was applied; all `41` known migrations were already current.

## PC Visual Evidence

- At `1920x1080`, the selected canvas showed visible edges across the translucent Workflow Region fill. Computed region background was 20% alpha and its layer was below the edge layer.
- Selected dependency classification reached the rendered edge classes. The release fixes React Flow inline stroke precedence so direct and transitive emphasis can override default edge styles.
- At Gray `v0.7.32`, exactly one `.react-flow__minimap` was present, displayed at `202x152` with `z-index: 20`.

## AI Supervision Lifecycle

- Authenticated Gray UI smoke on a disposable Canvas confirmed the advisory guard blocks a `code` node before plan creation with `CANVAS_RUN_LEGACY_NODE_UNSUPPORTED` and directs the user to supported `native-server` nodes.
- A separate Workflow Region containing only a `text` native-server node reached the ready state, created an immutable one-step Run Plan, connected the event stream, and was cancelled through the formal UI before start.
- After entering `Gray native text run validation`, a new revision-2 plan was created and started through the formal UI. The Run reached `已完成` with `1 / 1` steps complete and four ordered event records: plan created, start, step completed, and run completed. Cost limit and actual provider spend remained `0`.
- The explicitly created disposable Canvas was then deleted through its own Gray Canvas confirmation flow; the Canvas count returned from `14` to `13`.
