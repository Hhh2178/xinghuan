# Canvas Agent Governance Gray v0.7.20 Validation

## Local Gates

- Full Vitest: 116 files passed, 1 skipped; 421 tests passed, 4 skipped.
- Project Harness passed after the final governance and Tool Gateway changes.
- Full workspace type-check/build, CodeGraph sync, hotspot budgets, release governance and version alignment passed.
- Authenticated Gray UI and concurrent Run evidence remain for the user/automated regression pass.

## Runtime Boundary

- Expected Gray version: `0.7.20`.
- Expected rollback release: `20260722-canvas-agent-runtime-gray-r1-v0719`.
- Production predeploy baseline: healthy `0.7.18`, permission mode `enforced`.

## Deployment Evidence

- Release deployment completed successfully; remote `npm ci` audited 562 packages with 0 vulnerabilities.
- Migration `035_agent_knowledge_snapshots.sql` applied successfully; 34 prior migrations were skipped as already applied.
- `current` resolves to `/opt/apps/xinghuan-canvas-next/releases/20260723-canvas-agent-governance-gray-r1-v0720`.
- API service and Worker service both report `active`.
- Internal and public `/api/status` report healthy `0.7.20`, environment `gray`, permission mode `enforced`.
- Rollback release `20260722-canvas-agent-runtime-gray-r1-v0719` exists.
- Retention dry-run kept the current and rollback releases, found exactly five retained releases and required no deletion.
- Production public `/api/status` remained healthy `0.7.18`, environment `production`, permission mode `enforced`; no Production service or configuration was changed.
