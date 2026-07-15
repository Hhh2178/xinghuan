# AICopy SD Toggle Contract Defaults Validation

## Scope

- Environment: gray
- Version: `v0.6.9`
- Models: `sd2-720p-mini`, `sd2-720p-fast`, `sd2-720p`
- Production remains `v0.5.22`.
- No paid generation is permitted in this validation batch.

## Gray Evidence Before Repair

- FAST and plain 720P both had `aicopyRequestContractEnabled=true` with zero request bindings.
- Their latest sanitized request summaries reported empty ratio, empty mode, and sound disabled despite task payload values containing `duration=6`, `ratio=9:16`, and `modeType=image2video`.
- Mini had all six canonical bindings and its sanitized summary contained duration 6, ratio `9:16`, image-to-video mode, and sound enabled.

## Root Cause

- The Admin toggle persisted only the boolean activation flag.
- Missing `requestContract` was considered valid, so saving the enabled toggle did not create the official nested AICopy SD fields.
- The model configurator created the complete contract, which is why mini worked while manually toggled models did not.

## Repair

- Enabling and saving the SD supplement now merges canonical bindings for duration, mode, ratio, generated sound, images, and audios.
- Canonical paths replace stale conflicting definitions; non-conflicting custom bindings and result paths remain intact.
- FAST and plain 720P gray records were repaired through the guarded model configurator with transaction-scoped updates and private per-model backups.
- A second dry-run returned `changed=false` for both repaired records.

## Verification

- AICopy adapter contract regression: passed.
- Admin AICopy SD scope regression: passed.
- Mini/FAST/plain 720P serializer matrix: passed with duration 6, ratio `9:16`, `image2video`, sound on, and one image.
- Workspace type checks and single-port build: passed.
- Gray API and Worker are active; public and internal status endpoints report `0.6.9 / gray`.
- Free long-running Worker mock passed with one submit, one poll, one authenticated content download, local materialization, and final `succeeded` state.
- Captured mock request contained duration 6, `image2video`, ratio `9:16`, sound on, and one image.
- Post-deploy dry-run returned `changed=false` for FAST and plain 720P; temporary verification Provider count returned zero.
- Paid provider generation: intentionally not run.
