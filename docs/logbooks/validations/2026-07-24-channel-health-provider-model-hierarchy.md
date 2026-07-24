# Channel Health Provider And Model Hierarchy Validation

## Scope

- Branch: `feature/canvas-agent-runtime`.
- Baseline: Gray `v0.7.42`.
- Gray deployment: paused.
- Production: untouched.
- GitHub push: none.
- Data contract and aggregation: unchanged.

## Implementation

- The shared report exposes `surface="member" | "admin"`, named Provider regions, stable four-column headers and cell hooks.
- Admin explicitly selects `surface="admin"` and renders each Provider as one repeated panel with an opaque header, bounded model table, fixed tracks and visible row separators.
- Member feedback actions and the 24/72-hour feedback windows remain shared and unchanged.
- The Admin auto-refresh checkbox is fixed at `14x14` so global input styles cannot expand it.

## Automated Verification

```powershell
npx vitest run packages/ui/src/channel-health-report.test.tsx apps/admin/src/admin-channel-health-refresh.test.ts
npm run verify:channel-health-contract
npm run build -w @xinghuan/ui
npm run build -w @xinghuan/admin
npm run build -w @xinghuan/web
npm run type-check
git diff --check
```

Result: PASS. `2` test files and `5` tests passed; the channel-health contract and UI/Admin/Web builds passed. The existing Vite `node:crypto` browser-externalization warning remained non-fatal.

## Isolated PostgreSQL Acceptance

A temporary local PostgreSQL 16 container bound only to `127.0.0.1:55432` ran migrations `001` through `043`. Anonymous fixture data contained:

- 2 Providers.
- 4 image models, including long Provider/model names.
- 26 succeeded/failed tasks across recent and older two-hour buckets.
- 8 anonymous feedback rows.

No Gray or Production database was connected or modified.

| Viewport | Providers/models | Track alignment | Overflow | Empty buckets | Checkbox |
| --- | --- | --- | --- | --- | --- |
| `1920x1080` | 2 / 4 | Both headers and rows: `220px 124px 895px 156px` | 0 overflowing cells; document `1920/1920` | 137 visible empty positions | `14x14` |
| `2560x1440` | 2 / 4 | Both headers and rows: `220px 124px 1002px 156px` | 0 overflowing cells; document `2560/2560` | Visible and aligned | `14x14` |

Steady-state application console errors/warnings from the local origin: `0`.

Evidence:

- `.tmp/validation-evidence/2026-07-24-channel-health-hierarchy/admin-channel-health-1920x1080.png`
- `.tmp/validation-evidence/2026-07-24-channel-health-hierarchy/admin-channel-health-2560x1440.png`
- `.tmp/validation-evidence/2026-07-24-channel-health-hierarchy/admin-channel-health-stale-1920x1080.png`

Final PNG dimensions were verified from the files and match the named PC viewports exactly.

## Failure And Recovery

The isolated database table was briefly renamed to force a report query failure after valid data had loaded. Admin displayed `显示上次成功数据` with the prior Provider/model report still present. After restoring the table and changing the filter again, the warning cleared and both Providers returned. This fault was limited to the disposable local database.

## Decision

Task 3 implementation was committed locally as `173f697` (`fix(channel-health): clarify provider and model hierarchy`). This validation does not authorize Gray deployment.
