# Canvas Reset v0.8.6 Gray Validation

- release: `20260729-canvas-reset-v086-r1`
- environment: `gray`
- target profile: `old-server`
- archive SHA-256: `6E116AF86FC00D153BC24723A8990166956C95238CCDA918302075E82360D711`

## Passed

- `verify:old-server-release-target` locked Gray to the governed old-server profile.
- `verify:agent-environment-readiness-contract` and `harness:verify:release` passed.
- `release:gray:prepare` completed the full single-port build and release package.
- `release:gray:verify` confirmed API and Worker active, current release `20260729-canvas-reset-v086-r1`, public/internal `0.8.6 / gray`, and permission `enforced / ready` with zero failures.
- Database migration applied no new migrations and skipped 46 existing migrations.

## Pending Visual Acceptance

- Browser acceptance was performed at `1920x1080` after a forced reload confirmed `v0.8.6` rather than the stale pre-deploy `v0.8.5` page.
- Passed: the top bar no longer exposes the canvas presentation selector; the original React Flow background and MiniMap render; no modern node marker remains; the document is exactly `1920x1080` without page-level overflow.
- Failed: hovering the 56px rail sets `data-expanded=true` and the 232px panel becomes interactive, but the parent `<aside>` still resolves to `overflow: hidden`, so the overlay panel is clipped outside the rail boundary and remains invisible.
- Root cause: `Sidebar.tsx` retains the `overflow-hidden` utility, which overrides the focused `canvas-modern.css` `overflow: visible` rule in the built CSS order.
- Result: `v0.8.6` runtime verification remains valid, but browser visual acceptance is rejected. A tested `v0.8.7` Gray patch is required before closing the canvas rollback.

## Not Performed

- No billed Agent or Provider canary.
- No Production deployment.
- No retention apply.
