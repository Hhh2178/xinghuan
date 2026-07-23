# Canvas Agent Runtime Phase 14 Predeploy Baseline

## Read-Only Runtime Check

Checked on 2026-07-23 before any new deployment:

- Gray public status: healthy, service `xinghuan-api`, version `0.7.19`, environment `gray`, permission mode `enforced`.
- Production public status: healthy, service `xinghuan-api`, version `0.7.18`, environment `production`, permission mode `enforced`.
- Repository canonical Gray state: release `20260722-canvas-agent-runtime-gray-r1-v0719`.
- Repository canonical Production state: release `20260722-canvas-revision-observability-prod-r1-v0718`.

Only public `/api/status` endpoints and repository runbooks were read. No SSH session, service restart, database query, publication mutation or deployment occurred.

## Required Post-Gray Comparison

After the next authorized Gray PATCH deployment:

- Gray must report the new PATCH version and the expected release evidence.
- Production must remain version `0.7.18` and keep the same canonical release until the user explicitly authorizes Production work.
- Permission mode must remain `enforced` in both environments.
- The Gray rollback anchor must be validated before load testing begins.

## Release Governance Preflight

- `npm run verify:release-governance-contract`: passed; Gray increments are PATCH-only by default and retention is five releases.
- `npm run verify:current-release-entry-consistency`: passed; package version `0.7.19`, Gray release `20260722-canvas-agent-runtime-gray-r1-v0719`, Production release `20260722-canvas-revision-observability-prod-r1-v0718`.
- The next candidate, when authorized after the remaining gates, must therefore use PATCH version `0.7.20`. No version file or release state was changed during this preflight.
