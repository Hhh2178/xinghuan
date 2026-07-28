# Canvas Flow Height Fix v0.8.3 Gray

- release: `20260728-canvas-height-fix-v083-r19`
- version: `0.8.3`
- source commit: `953038faabd9d3ba67dec72a26e8b2c429c68b5b`
- archive SHA-256: `1455B1820AD7C7887059EB2A504DE8491E45C69C43861676EACB8A6AD69B1BC0`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas-next`
- previous current: `20260728-image-task-cancellation-v083-r18`
- rollback: `20260728-image-task-cancellation-v083-r18`
- retentionApplyRun: `false`

## Scope

- Preserve a vertical flex/height contract through `WorkspaceErrorBoundary`, allowing the ReactFlow shell to occupy the workspace instead of collapsing to `0px`.
- This restores the canvas background, nodes, controls and MiniMap positioning; r18 task cancellation compatibility is carried forward.

## Verification

- Focused CSS regression test and Web type-check passed before packaging.
- Release prepare, build, package and governance gates passed for 0.8.3.
- Gray strict runtime verification passed: current r19, API/Worker active, internal and public status matched version/environment, permission mode enforced and readiness true.
- Production remains explicitly held at v0.7.17 per user instruction; no Production deployment ran for r19.
