# Canvas Resize Materialized Output Gray v0.7.35 Validation

## Runtime

- Release `20260724-canvas-resize-materialized-gray-r1-v0735` passed public/internal `0.7.35 / gray / enforced` status checks. API and Worker were active; all 41 migrations were already current.

## Full Paid Canvas Chain

- Canvas Run `canvas_run_81f913b6-e967-4b2d-ba07-667a145af1c1` succeeded with four ordered steps: image, smart candidate selector, image, resize.
- Both image steps completed with `providerRequestCount=3`, proving each produced the requested three candidates through the hosted Canvas Run path.
- The selector ledger recorded `sourceArtifactIds=3`, `selectedArtifactIds=1`, and `policy=single`; only one chosen Artifact unblocked the downstream image step.
- The resize step succeeded from a materialized owner-scoped input and wrote `/files/output/canvas_resize_1784883503138_8is07o.png`. Server-side Sharp metadata confirms PNG `768x768`.
