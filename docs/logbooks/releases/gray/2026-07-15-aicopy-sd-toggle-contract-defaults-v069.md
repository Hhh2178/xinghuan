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

- Focused adapter, Admin, type, and three-model serializer checks: passed.
- Full workspace checks and single-port build: passed.
- Gray API and Worker are active; public and internal status endpoints report `0.6.9 / gray`.
- Free Worker mock passed through submit, poll, authenticated content download, output materialization, and final `succeeded` state.
- FAST and plain 720P post-deploy configuration dry-runs are idempotent; temporary verification Provider cleanup was confirmed.
- No paid model request will be submitted by this release process.
