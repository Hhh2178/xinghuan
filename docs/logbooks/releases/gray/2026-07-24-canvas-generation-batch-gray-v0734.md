# Canvas Generation Batch Gray v0.7.34

- release: `20260724-canvas-generation-batch-gray-r1-v0734`
- source commit: `d53c474`
- rollback: `20260724-canvas-native-media-gray-r1-v0733`

## Scope

- Preserves the requested image and video generation batch count at the queued-task API boundary. `generationCount` takes precedence over legacy `n`, is bounded to `1..4`, and both fields are persisted for compatibility.
- Refreshes the Worker task Harness so its assertions track the shared capability queue and lifecycle implementation.

## Boundary

- Gray only. Production was not restarted, reconfigured or mutated. No GitHub push occurred.
