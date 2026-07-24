# Canvas Resize Materialized Output Gray v0.7.35

- release: `20260724-canvas-resize-materialized-gray-r1-v0735`
- source commit: `b07ebcc`
- rollback: `20260724-canvas-generation-batch-gray-r1-v0734`

## Scope

- Makes native Canvas Run resize prefer a completed upstream task's owner-scoped `materializedImageUrls` over remote Provider URLs.
- Keeps the transform's existing owner directory and path traversal boundary unchanged.

## Boundary

- Gray only. Production was not restarted, reconfigured or mutated. No GitHub push occurred.
