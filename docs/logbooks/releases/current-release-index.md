# Current Release Index

- release：`20260811-provider-media-batch-status-v0834-r1` (current New-server Gray)

## v0.9.1 APIMart GPT-Image-2.6 and account deletion repair (2026-11-05)

- Old-server Production (`canvas.starflow.xin`) runs `20261105-apimart-26-account-delete-v091-r2` from source commit `4d6d56ca`.
- Runtime and permission readiness verified: API/Worker active, version `0.9.1`, enforced mode, 192 subjects, 2,614 rules, 11 principals, 0 failures.
- Migration `051_deleted_user_permission_rules.sql` applied. Release archive SHA-256: `59b9210259dc675bf24c08cf9c14947c50b97e6c1b07135bc53ee219287214df`.
- Evidence: `production/2026-11-05-apimart-gpt-image-2.6-account-delete-v091-r2.md` and `../../validations/2026-11-05-apimart-gpt-image-2.6-account-delete-v091-r2.md`.

## v0.8.34 New-server media batch status and workflow-region dissolve (2026-08-11)

- New-server Gray and Production run the same `20260811-provider-media-batch-status-v0834-r1` AES-256-GCM encrypted artifact.
- The release fixes early media batch task completions that could leave aggregate state queued, and adds workflow-region dissolve.
- Dissolve is non-destructive for internal canvas content: nodes, positions, data, and node-to-node connections are retained.
- Encrypted artifact SHA-256: `1a65e0a19829341c73b91ffeeee802c9fc1a1bab1edc124de26ece91abacc601`.
- Evidence: `gray/2026-08-11-provider-media-batch-status-v0834-r1.md`, `production/2026-08-11-provider-media-batch-status-v0834-r1.md`, and `../validations/2026-08-11-provider-media-batch-status-v0834-r1.md`.

## Active Environments

- New-server Gray: `gray.zezhen.xyz`, version `0.8.34`, rollback `20260811-generation-retention-v0832-r2`.
- New-server Production: `zezhen.xyz`, version `0.8.34`, rollback `20260811-generation-retention-v0831-r1`.
- Old-server Gray: decommissioned; `canvas-next.starflow.xin` redirects to Production.
- Old-server Production: `canvas.starflow.xin`, version `0.9.1`, release `20261105-apimart-26-account-delete-v091-r2`.

Historical release records remain under `docs/logbooks/releases/gray/`, `docs/logbooks/releases/production/`, and `docs/logbooks/validations/`.
