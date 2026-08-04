# RunningHub Catalog Groups v0.8.19 Gray Validation

- release: `20260804-runninghub-groups-v0819-r1`
- environment: `gray`
- target profile: `old-server`
- source commit: `66ff9ef`
- archive SHA-256: `841f061903c32ef32ae98be8f6aa90de22d09502fec4b3e6849feb03c1503688`

## Automated Gates

- TDD regression: RED reproduced the disabled-group leak; GREEN passed after the filter fix.
- API Vitest: 90 files passed, 351 tests passed.
- Workspace type-check, full build, RunningHub prepare preset, release package contract, version alignment and governance checks passed.
- Deployment applied 0 migrations and skipped 48 existing migrations.
- Runtime verification confirmed release `20260804-runninghub-groups-v0819-r1`, API/Worker active, public/internal `0.8.19 / gray`, permission mode `enforced`, readiness `ready=true`, and no failed checks.

## Authenticated Gray Acceptance

- Temporary group creation, rename and sort order persisted.
- Enabled group + enabled item was visible in `/api/runninghub/catalog`.
- Disabled group + enabled item was absent from `/api/runninghub/catalog`.
- Re-enabling the group restored visibility.
- Disabled item + enabled group was absent; re-enabling the item restored visibility.
- Moving the item to ungrouped preserved visibility.
- Deleting the temporary group succeeded and left the item visible and ungrouped.
- Temporary group and item state were restored/cleaned in the acceptance `finally` path; no billed execution was attempted.

## Result

The RunningHub group visibility regression is accepted in Gray at the API/runtime layer. Production remains gated on approval and reuse of the exact archive/SHA above. Browser visual evidence remains pending the local Chromium runtime dependency.
