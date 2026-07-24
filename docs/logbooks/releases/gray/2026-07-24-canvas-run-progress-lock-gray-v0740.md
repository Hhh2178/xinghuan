# Canvas Run Progress Lock Gray v0.7.40

- release: `20260724-canvas-run-progress-lock-gray-r1-v0740`
- source commit: `88a75ad`
- rollback: `20260724-canvas-run-progress-dedup-gray-r1-v0739`

## Scope

- Locks the Canvas Run step row while comparing and appending batch progress events, making deduplication atomic across concurrent coordinator passes.

## Boundary

- Gray only. Production and GitHub are untouched.
