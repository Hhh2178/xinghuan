# v0.8.34 New-server Gray Release

- release: `20260811-provider-media-batch-status-v0834-r1`
- source commit: `b4f7ac0a5d32dff8072f874b442840b7a8150af1`
- encrypted artifact SHA-256: `1a65e0a19829341c73b91ffeeee802c9fc1a1bab1edc124de26ece91abacc601`
- plaintext archive SHA-256: `e2c4f82873b8615a82a4f0bb34fed6aefbc3ce768a99069209ff07d449857a68`
- deployed target: new-server Gray `gray.zezhen.xyz`
- rollback release: `20260811-generation-retention-v0832-r2`

This release stabilizes image, video, audio, and Seedance batch task status updates when provider results return before the first React render is committed. It also adds an explicit workflow-region dissolve action.

Dissolving a workflow region deletes only its region document and associated region-level bindings. Nodes inside the former region, their positions, stored data, and all node-to-node connections remain unchanged.

Gray deployed the encrypted archive after its encrypted-release contract passed. API, worker, internal status, public HTTPS status, enforced permission mode, and permission readiness all passed at version `0.8.34`.
