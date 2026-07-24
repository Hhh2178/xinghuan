# Task Identity And Provider Rail Validation

## Scope

- Branch: `feature/canvas-agent-runtime`.
- Baseline: Gray `v0.7.42`.
- Environment writes: isolated local fixtures only.
- Gray deployment: paused.
- Production: untouched.
- GitHub push: none.

## Behavior

- New PostgreSQL tasks freeze `TaskExecutionIdentitySnapshot`; migration 043 backfills existing rows and adds an insert trigger for every task writer.
- Local file tasks freeze the same projection on insert; legacy rows use the catalog and then stable IDs as read fallback.
- Admin task rows present Provider/model names first and raw IDs second. Provider filters retain stable IDs as values.
- Admin model catalog Provider rows no longer spend width on protocol badges; protocol remains available in the selected Provider editor.
- Admin JSON reads and writes are serialized per path in-process. Only `ENOENT` creates defaults; malformed JSON is surfaced. This does not make separate read-modify-write transactions atomic across processes.

## Automated Verification

```powershell
npx vitest run apps/api/src/serialized-json-file.test.ts apps/api/src/admin-db-file-write.test.ts apps/api/src/task-execution-identity.test.ts apps/api/src/task-execution-identity-migration.test.ts apps/api/src/task-lifecycle.test.ts apps/api/src/task-repository.test.ts apps/api/src/admin-task-list-routes.test.ts
npm run verify:admin-task-panel-contract
npm run verify:admin-provider-rail-layout
npm run type-check
npm run build -w @xinghuan/api
npm run build -w @xinghuan/admin
npm run verify:file-hotspot-budgets
git diff --check
```

Result: PASS. `7` test files and `25` tests passed; both Admin contracts, all workspace type checks, API/Admin builds, hotspot budgets and whitespace checks passed. The Admin build emitted the existing Vite browser externalization warning for `node:crypto`; it did not fail the build.

## Browser Acceptance

Authenticated local Admin fixture: `http://127.0.0.1:18207`.

| Viewport | Task identity | Provider rail | Layout and diagnostics |
| --- | --- | --- | --- |
| `1920x1080` | `GRSAI` primary, `grsai` secondary; `GRSAI gpt-image-2` primary, `gpt-image-2` secondary | ModelScope, RunningHub, GRSAI and ToAPIs names visible; protocol badges `0` | Document width `1920`; identity cells had equal client/scroll dimensions; Provider rows `204/204`; application console errors/warnings `0` |
| `2560x1440` | Same identity hierarchy and stable refresh | Same four Provider names visible; protocol badges `0` | Document width `2560`; identity cells had equal client/scroll dimensions; Provider rows `204/204`; application console errors/warnings `0` |

PNG dimensions were read from the final files with `System.Drawing` and match the requested viewports exactly:

- `.tmp/validation-evidence/2026-07-24-task-identity-provider-rail/task-identity-1920x1080.png`
- `.tmp/validation-evidence/2026-07-24-task-identity-provider-rail/task-identity-2560x1440.png`
- `.tmp/validation-evidence/2026-07-24-task-identity-provider-rail/provider-rail-1920x1080.png`
- `.tmp/validation-evidence/2026-07-24-task-identity-provider-rail/provider-rail-2560x1440.png`

The local task fixture remained visible after the task page refresh interval. Browser logs contained extension diagnostics only; entries from the local application origin were empty.

## Decision

Task 2 implementation was committed locally as `d230a0b` (`fix(admin): make provider and task identities readable`). This record does not approve or perform Gray deployment.
