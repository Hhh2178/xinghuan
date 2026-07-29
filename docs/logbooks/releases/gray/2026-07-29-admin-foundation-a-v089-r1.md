# Admin Foundation A v0.8.9 Gray

- release: `20260729-admin-foundation-a-v089-r1`
- version: `0.8.9`
- source branch: `release/admin-foundation-a-v089`
- source commit: `97309b0524208913c73936a27cdbdd497e1d55c8`
- archive SHA-256: `68E5D127955780B6A3DD984E501175B0AF8B52B334D41FC7051B794F33E346F8`
- target: `old-server` / Gray
- rollback: `20260729-canvas-sidebar-overflow-v087-r1`
- retention apply: `false`

## Scope

- Retain the v0.8.8 Foundation token, frame, summary, table, empty-state, and semantic-status work.
- Move the only page H1 into the shared workspace band, convert the topbar to global runtime context, remove the duplicate current-page focus card, and omit navigation when a workspace exposes only one choice.
- Keep `/admin/overview` data sources, APIs, permissions, refresh, error/loading boundary, and ComfyUI behavior unchanged.

## Verification

- Full Vitest: 218 files passed, 1 skipped; 844 tests passed, 4 skipped.
- Focused Admin tests, common/overview contracts, Admin/Web builds, Foundation/Token/Registry contracts, readiness contract, release harness, and packaging passed.
- Old-server Gray API and Worker are active; public/internal status report `0.8.9 / gray`.
- Permission readiness is `enforced / ready`: 132 subjects, 125 published, 932 rules, 5 principals, and 0 failures.
- Authenticated `1920x1080` acceptance passed with one H1, no topbar H1, no duplicate focus card or single-page tab, the five-item summary in the first viewport, three neutral data panels, semantic statuses, no page-level overflow, and a functional assistant dock.

## Known Warning

- Package installation reported 6 high-severity audit findings. No forced dependency upgrade was included in this visual release.

## Not Performed

- No billed Agent or Provider canary.
- No Production deployment.
- No retention apply.
