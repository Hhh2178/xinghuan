# Canvas Run Live Progress Gray v0.7.38

- release: `20260724-canvas-run-live-progress-gray-r1-v0738`
- source commit: `590b4f7`
- rollback: `20260724-canvas-hosted-run-projection-gray-r1-v0737`

## Scope

- Keeps the active Workflow Region Run projected onto Canvas nodes even while the AI supervision panel is closed.
- Persists Worker batch progress as durable Canvas Run events so image/video nodes visibly advance from `0/N` through completion.
- Treats a configured batch count as an exact count of independently submitted provider requests, bounded to `1..4`.

## Boundary

- Gray deployment only. Production remains untouched and no GitHub push is permitted.
