# Operations

This directory is the operational entry point for the current deployment. Release history and validation evidence remain in `../docs/logbooks/`.

## Current Runtime

- New-server Gray: `gray.zezhen.xyz`, `0.8.34`, release `20260811-provider-media-batch-status-v0834-r1`.
- New-server Production: `zezhen.xyz`, `0.8.34`, release `20260811-provider-media-batch-status-v0834-r1`.
- Both environments reuse encrypted artifact `1a65e0a19829341c73b91ffeeee802c9fc1a1bab1edc124de26ece91abacc601`.
- The current release keeps workflow-region dissolve non-destructive: only the region is removed; internal nodes, locations, data, and connections remain.
- Old-server Gray is decommissioned; `canvas-next.starflow.xin` redirects to Starflow Production.
- Old-server Production `canvas.starflow.xin` runs `0.9.1` release `20261105-apimart-26-account-delete-v091-r2`; API, Worker, public status, and permission readiness are active/ready.

## Canonical Entry Points

1. `current/release-state.json`
2. `current/gray.md`
3. `current/production.md`
4. `current/starflow-production.md`
5. `../docs/logbooks/releases/current-release-index.md`
6. `../docs/logbooks/validations/2026-11-05-apimart-gpt-image-2.6-account-delete-v091-r2.md`

## Runbooks

- Gray deployment: `gray-deploy-runbook.md`
- Production deployment: `production-deploy-runbook.md`
- Gray acceptance: `gray-release-standard-checklist.md`
- Production acceptance: `production-acceptance-checklist.md`

Do not record secrets, environment values, SSH key contents, or database URLs in this directory.
