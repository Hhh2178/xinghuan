# Validation: LLM Media, Admin Freshness, and Data Migration

## Code

- Full Harness CI: 267 test files passed, 996 tests passed, 4 skipped.
- API/Admin type-check and production builds passed.
- Focused portability/freshness suite: 6 files, 13 tests passed.
- Same encrypted artifact digest was accepted by all four environments.

## Runtime

- Old Gray/Production and new Gray/Production release directory: `20260810-llm-media-admin-freshness-v0829-r2`.
- All four API and Worker services: `active`.
- All four internal and public `/api/status` checks: HTTP 200, version `0.8.29`, correct environment, enforced permission mode.
- All four databases: migration `050_admin_change_revisions.sql` present and 12 revision domains initialized.

## Data/resource migration

- Old/new Production counts matched: users 34, canvases 83, tasks 13,871, assets 279, generation artifacts 5,590, providers 12, models 72, permission rules 2,718, ephemeral uploads 318.
- Excluding `users/*/output` and `users/*/output-archives`, source/target data tarball SHA-256 matched: `5dcb88b8aa77caacc9e3b45ce0a448986f2bf15fcaa46619e0e8fbd2ca7ade95`.
- Shared asset manifest hash matched: `5072d465851fa8def96cc11a19a0ad6aad3c4eeb3a46b4efd380b998dbb4210a`.
- Public-resource materialization: 4/4 ready on both Production servers.
- Old Production generated output remained intact; new Production generated output remained excluded by the agreed migration boundary.
