# Canvas Connectivity And Navigation Gray v0.7.32

- release: `20260724-canvas-navigation-gray-r2-v0732`
- source commit: `353bad8`
- rollback: `20260724-canvas-navigation-gray-r1-v0731`

## Scope

- Makes Workflow Region backgrounds translucent below edges, and renders selected-node direct/transitive dependency emphasis.
- Adds advisory AI supervision readiness and repair-oriented Canvas Run errors without changing server authority.
- Restores the single global minimap and anchors copied node sets at the last valid Canvas pointer while preserving their relative layout and internal edges.

## Boundary

- Gray only. Production was not restarted, reconfigured or mutated. No GitHub push occurred.

## Runtime

- Release scripts deployed the package and applied no new database migrations (`41` skipped).
- Public and internal `/api/status` both returned `0.7.32 / gray / enforced`; API and Worker services were active and permission readiness was `true` for database `xinghuan_canvas_gray`.
