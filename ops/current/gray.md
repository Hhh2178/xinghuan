# Current Gray Runtime

- target: new-server Gray `gray.zezhen.xyz`
- version: `0.8.34`
- release: `20260811-provider-media-batch-status-v0834-r1`
- source commit: `b4f7ac0a5d32dff8072f874b442840b7a8150af1`
- encrypted artifact SHA-256: `1a65e0a19829341c73b91ffeeee802c9fc1a1bab1edc124de26ece91abacc601`
- rollback release: `20260811-generation-retention-v0832-r2`
- runtime: API active, worker active, internal and public status `0.8.34 / gray`, permission mode `enforced`
- readiness: 132 subjects, 1,180 rules, 5 principals, 0 failures

Old-server Gray is decommissioned. `canvas-next.starflow.xin` redirects to Starflow Production; see `starflow-production.md` for the current Starflow runtime.

The release fixes early completion state loss for media batches and supports dissolving workflow regions without changing any internal nodes, node locations, node data, or node-to-node connections.

Records:

- `../../docs/logbooks/releases/gray/2026-08-11-provider-media-batch-status-v0834-r1.md`
- `../../docs/logbooks/validations/2026-08-11-provider-media-batch-status-v0834-r1.md`
