# Current Release Index

## v0.8.34 New-server media batch status and workflow-region dissolve (2026-08-11)

- New-server Gray and Production run the same `20260811-provider-media-batch-status-v0834-r1` AES-256-GCM encrypted artifact.
- The release fixes early media batch task completions that could leave aggregate state queued, and adds workflow-region dissolve.
- Dissolve is non-destructive for internal canvas content: nodes, positions, data, and node-to-node connections are retained.
- Encrypted artifact SHA-256: `1a65e0a19829341c73b91ffeeee802c9fc1a1bab1edc124de26ece91abacc601`.
- Evidence: `gray/2026-08-11-provider-media-batch-status-v0834-r1.md`, `production/2026-08-11-provider-media-batch-status-v0834-r1.md`, and `../validations/2026-08-11-provider-media-batch-status-v0834-r1.md`.

## Active Environments

- New-server Gray: `gray.zezhen.xyz`, version `0.8.34`, rollback `20260811-generation-retention-v0832-r2`.
- New-server Production: `zezhen.xyz`, version `0.8.34`, rollback `20260811-generation-retention-v0831-r1`.
- Old-server environments remain unchanged by this release.

Historical release records remain under `docs/logbooks/releases/gray/`, `docs/logbooks/releases/production/`, and `docs/logbooks/validations/`.
