# v0.8.34 New-server Production Release

- release: `20260811-provider-media-batch-status-v0834-r1`
- source commit: `b4f7ac0a5d32dff8072f874b442840b7a8150af1`
- artifact: reuses the Gray-verified encrypted archive
- encrypted artifact SHA-256: `1a65e0a19829341c73b91ffeeee802c9fc1a1bab1edc124de26ece91abacc601`
- plaintext archive SHA-256: `e2c4f82873b8615a82a4f0bb34fed6aefbc3ce768a99069209ff07d449857a68`
- deployed target: new-server Production `zezhen.xyz`
- rollback release: `20260811-generation-retention-v0831-r1`

Production reused the exact encrypted artifact accepted by Gray; no second build was produced. The release includes stable media batch completion accounting and workflow-region dissolve semantics that preserve all internal nodes and their connections.

API, worker, internal status, public HTTPS status, enforced permission mode, and permission readiness all passed at version `0.8.34`.
