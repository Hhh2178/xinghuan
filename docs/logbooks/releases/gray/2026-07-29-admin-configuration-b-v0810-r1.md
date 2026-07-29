# Admin Configuration B v0.8.10 Gray

- release: `20260729-admin-configuration-b-v0810-r1`
- version: `0.8.10`
- source branch: `release/admin-configuration-b-v0810`
- source commit: `266e0f03abecf92a68abab11199bab49e3bca154`
- archive SHA-256: `1048df04ac131e9887d94103b4407be9be3155137c13424d8b3d86567173c7f2`
- target: `old-server` / Gray
- rollback: `20260729-admin-foundation-a-v089-r1`
- retention apply: `false`

## Scope

- Add the presentation-only configuration-workbench contract and migrate Provider/model, RunningHub, runtime settings, and environment sync without moving their data, draft, revision, conflict, permission, or write ownership.
- Visually converge the frozen ComfyUI overview/detail surfaces while preserving all existing API call sites and runtime behavior.
- Keep one route-shell H1, neutral editor/data surfaces, stable desktop geometry, and an independent `.admin-main` scroll owner while the assistant dock is open.

## Verification

- B focused Vitest passed: 5 files and 10 tests.
- Full Vitest passed: 223 files passed, 1 skipped; 854 tests passed, 4 skipped.
- Full workspace build, Admin configuration contracts, design/token/registry contracts, Authority/readiness contracts, hotspot/watchlist gates, all three Harness layers, staged guards, packaging, and release-worktree cleanliness passed.
- Old-server Gray API and Worker are active; public/internal status report `0.8.10 / gray`; deployment applied 0 migrations and skipped 46 existing migrations.
- Permission readiness is `enforced / ready`: 132 subjects, 125 published, 3 restricted, 4 retired, 932 rules, 5 principals, and 0 failures.
- Remote preflight, request-chain observability, system observability, and environment-sync no-op smoke passed.
- Authenticated `1920x1080` acceptance passed on all six routes: Provider, model catalog, RunningHub, ComfyUI, runtime settings, and environment sync.

## Known Warnings

- Package installation reported 6 high-severity audit findings. No forced dependency upgrade was included in this visual release.
- The model catalog assistant context currently reports the page key as `providers`; page layout and actions are correct, and the context-label correction is deferred to the later Admin context refactor.
- The ComfyUI machine title intentionally uses single-line ellipsis for a long hostname; it does not create page or main-content horizontal overflow.

## Not Performed

- No billed Agent or Provider canary.
- No Production deployment.
- No retention apply.
