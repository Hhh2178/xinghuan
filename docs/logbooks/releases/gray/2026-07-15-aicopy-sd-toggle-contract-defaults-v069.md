# v0.6.9 AICopy SD Toggle Contract Defaults Gray Release

## Release

- Version: `v0.6.9`
- Environment: gray only
- Release: `20260715-aicopy-sd-toggle-contract-defaults-v069`
- Production remains `v0.5.22`.

## Changes

- Make the Admin SD supplement toggle populate the canonical AICopy request contract when the model is saved.
- Replace conflicting canonical paths while preserving unrelated custom bindings and result paths.
- Add a mini/FAST/plain 720P serializer matrix regression.
- Repair the FAST and plain 720P gray model records with guarded backups and an idempotent configuration pass.

## Verification

- Focused adapter, Admin, and type checks: passed.
- Full workspace checks and single-port build: pending release preparation.
- Gray runtime and free Worker mock: pending deployment.
- No paid model request will be submitted by this release process.
