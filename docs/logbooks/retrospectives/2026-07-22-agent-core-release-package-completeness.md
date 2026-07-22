# Agent Core Release Package Completeness Retrospective

## Context

Gray release `20260722-canvas-agent-runtime-gray-r1-v0719` successfully uploaded, applied migrations and switched `current`, but runtime verification failed because the Web service could not resolve `@xinghuan/agent-core` from the API build output.

## Diagnosis

The server journal deterministically reported `ERR_MODULE_NOT_FOUND` for `@xinghuan/agent-core` imported by `apps/api/dist/canvas-run-repository.js`. The release archive manifest included the existing workspace packages but omitted the newly introduced Agent Core package. Server `npm ci` could not create the workspace link because the package directory was absent from the archive.

## Adjustment

`scripts/package-release.mjs` now treats `packages/agent-core/package.json` and `packages/agent-core/dist` as both required build outputs and included runtime files. `scripts/verify-release-package-contract.mjs` explicitly guards those entries.

No Agent runtime behavior, Canvas task path, Provider/model routing, migration, user data, or production deployment is changed by this packaging correction.

## Verification

- The package contract is rerun.
- The same `v0.7.19` archive is rebuilt and inspected for Agent Core entries.
- The same Gray release ID is redeployed and runtime-verified.
- The failure occurred only on Gray; Production was never touched.

## Prevention

Every new runtime workspace dependency must be added to both the package manifest's required and included paths, with an explicit release-package contract assertion before its first deployment.
