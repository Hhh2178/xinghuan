# Operations

This directory is the operational entry point for the current deployment. Release history and validation evidence remain in `../docs/logbooks/`.

## Current Runtime

- New-server Gray: `gray.zezhen.xyz`, `0.8.34`, release `20260811-provider-media-batch-status-v0834-r1`.
- New-server Production: `zezhen.xyz`, `0.8.34`, release `20260811-provider-media-batch-status-v0834-r1`.
- Both environments reuse encrypted artifact `1a65e0a19829341c73b91ffeeee802c9fc1a1bab1edc124de26ece91abacc601`.
- The current release keeps workflow-region dissolve non-destructive: only the region is removed; internal nodes, locations, data, and connections remain.
- Old-server environments are unchanged by this release.

## Canonical Entry Points

1. `current/release-state.json`
2. `current/gray.md`
3. `current/production.md`
4. `../docs/logbooks/releases/current-release-index.md`
5. `../docs/logbooks/validations/2026-08-11-provider-media-batch-status-v0834-r1.md`

## Runbooks

- Gray deployment: `gray-deploy-runbook.md`
- Production deployment: `production-deploy-runbook.md`
- Gray acceptance: `gray-release-standard-checklist.md`
- Production acceptance: `production-acceptance-checklist.md`

Do not record secrets, environment values, SSH key contents, or database URLs in this directory.
