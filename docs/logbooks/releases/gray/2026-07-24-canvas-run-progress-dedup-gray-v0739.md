# Canvas Run Progress Deduplication Gray v0.7.39

- release: `20260724-canvas-run-progress-dedup-gray-r1-v0739`
- source commit: `8de9ab2`
- rollback: `20260724-canvas-run-live-progress-gray-r1-v0738`

## Scope

- Fixes Canvas Run progress-event comparison so the Worker records each completed batch count once rather than repeatedly appending the same durable event.

## Boundary

- Gray deployment only. Production remains untouched and no GitHub push is permitted.
