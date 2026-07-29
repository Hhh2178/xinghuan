# Admin Foundation A v0.8.8 Gray Validation

- release: `20260729-admin-foundation-a-v088-r1`
- environment: `gray`
- target profile: `old-server`
- archive SHA-256: `26A7F953797C60B48C4ACCB1378B371285C79A0A6B706C6093E820AB5021572C`

## Automated Gates

- A fresh worktree initially failed full Vitest because internal workspace `dist` entrypoints had not been built after dependency installation. Building `shared`, `canvas-core`, `model-core`, `agent-core`, and `ui` restored the documented package boundary; the unchanged full suite then passed with 218 files passed, 1 skipped, 843 tests passed, and 4 skipped.
- Admin/Web single-port builds, readiness contract, release harness, archive prepare, deployment, 0 applied/46 skipped migrations, and runtime verification passed.
- Permission readiness: 132 subjects, 125 published, 932 rules, 5 principals, 0 failures.

## Browser Rejection

- Viewport was exactly `1920x1080`; data, tables, status pills, long-text wrapping, main scroll, and assistant dock were functional.
- The page still exposed four competing identity layers before the summary. This contradicted the A-layer single-identity requirement, so visual acceptance was rejected and a new patch was required.
