# Canvas Agent Governance Gray v0.7.20 Validation

## Local Gates

- Full Vitest: 116 files passed, 1 skipped; 421 tests passed, 4 skipped.
- Project Harness passed after the final governance and Tool Gateway changes.
- Full workspace type-check/build, CodeGraph sync, hotspot budgets, release governance and version alignment passed.
- Authenticated Gray UI, service state, database migration, concurrent Run and rollback evidence are appended after deployment.

## Runtime Boundary

- Expected Gray version: `0.7.20`.
- Expected rollback release: `20260722-canvas-agent-runtime-gray-r1-v0719`.
- Production predeploy baseline: healthy `0.7.18`, permission mode `enforced`.
