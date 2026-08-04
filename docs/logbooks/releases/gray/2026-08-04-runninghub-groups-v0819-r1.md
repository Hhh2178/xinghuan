# RunningHub Catalog Groups v0.8.19 Gray

- release: `20260804-runninghub-groups-v0819-r1`
- version: `0.8.19`
- source branch: `feature/canvas-agent-runtime`
- source commit: `66ff9efd9766d6edaf3c9030ba110206fde1b541`
- archive SHA-256: `841f061903c32ef32ae98be8f6aa90de22d09502fec4b3e6849feb03c1503688`
- target: `old-server` / Gray
- rollback: `20260803-runninghub-groups-v0818-r1`
- retention apply: `false`

## Scope

- Fix `normalizeRunningHubCatalogItems` so entries assigned to disabled or missing groups are filtered from the public catalog instead of being silently converted to ungrouped entries.
- Preserve provider-scoped RunningHub group CRUD, item assignment, ungrouped fallback and the two-gate group/item visibility boundary.

## Verification

- TDD regression test was observed RED before the production change, then GREEN after the filter fix.
- API Vitest matrix: 90 files passed, 351 tests passed; type-check and full build passed.
- RunningHub release prepare preset, package/version alignment, archive contract and governance checks passed.
- Gray deployment applied 0 migrations and skipped 48 existing migrations.
- Runtime verification: API/Worker active; public/internal status `0.8.19 / gray`; permission mode `enforced`; readiness `136 subjects / 126 published / 3 restricted / 7 retired / 932 rules / 5 principals`; no failures.
- Authenticated Gray behavior acceptance passed for group create, rename, reorder, assignment, disable/enable, item disable/enable, ungroup and delete. No billed execution was performed.

## Not Performed

- Production promotion was intentionally not performed; it must reuse this exact Gray archive after approval.
- Automated 1920x1080 browser screenshot acceptance was blocked because the local Playwright runtime has no installed Chromium distribution.
- Retention prune was not applied; only a dry-run is allowed after canonical state is updated.
