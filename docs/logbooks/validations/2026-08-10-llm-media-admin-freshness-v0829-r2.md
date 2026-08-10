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

## Post-migration remote recheck

- Read-only probes on old Production (`101.33.75.38:728`) and new Production (`43.131.246.222:22`) both resolved the same release `20260810-llm-media-admin-freshness-v0829-r2`; API and Worker were `active` on both sides.
- Core database counts matched again: users `34`, canvases `83`, tasks `13,871`, assets `279`, generation artifacts `5,590`, providers `12`, models `72`, permission rules `2,718`, ephemeral uploads `318`.
- Public-resource materialization CLI returned `totalItems=8`, `candidates=4`, `ready=4`, `missing=[]` on both Production data directories. The shared-assets file manifest hash matched on both sides.
- New Production retained `outputRetentionDays=15`; generated output files remained excluded there (`0` output files and `0` output archives). Old Production retained its existing generated output files and was not pruned.

## Real Gray acceptance

- MIMO `mimo-v2.5` on old Gray: 10 primary interactions (5 text, 5 image-analysis) returned HTTP 200; 9/10 produced usable text with `max_tokens=1024`. The one non-usable response ended with upstream `finishReason=length`; a supplementary image-analysis call with `max_tokens=2048` succeeded. The shipped LLM node default remains `4096`, so this boundary is above the tested truncation point.
- GRSAI `gpt-image-2` on old Gray: the current Worker canary succeeded with `adapter=grsai-image`, a materialized `/files/output/` artifact, and a successful file read-back. Four current-version image-to-image Worker probes produced 3 succeeded tasks with materialized artifacts and 1 failed task (`generate image failed`); a subsequent task query showed no remaining running test task. The historical controlled Gray run remains the broader 20-request evidence for this provider, while this record confirms the current `v0.8.29` Worker path and records the intermittent upstream failure for follow-up.
