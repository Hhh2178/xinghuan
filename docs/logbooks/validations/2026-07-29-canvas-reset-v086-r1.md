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

- At `1920x1080`, confirm the top bar has no canvas presentation selector.
- Confirm the sidebar rail expands on hover/focus and exposes only canvas list, create, node search, and AI supervision actions.
- Confirm existing/new Image, Video, and LLM nodes use the original structure and width; dot grid, MiniMap, overlays, materials, and task actions remain usable.
- Confirm Admin documentation entry points are reachable; Admin A-batch UI is not part of this release.

## Not Performed

- No billed Agent or Provider canary.
- No Production deployment.
- No retention apply.
