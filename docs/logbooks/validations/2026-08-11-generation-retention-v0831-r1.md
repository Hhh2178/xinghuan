# Validation: v0.8.31 Generation Retention

## Local verification

- Focused retention tests: 23 passed.
- Full Vitest suite: 1,001 passed, 4 skipped.
- Full type-check, `build:single-port`, workspace Harness, release Harness, generation-library layout contract, generation-artifact framework contract, and release package source contract passed.
- Staged source, hotspot, runtime-artifact, documentation-sync, and current-release consistency gates passed.
- Encrypted archive contract passed against the real `.tar.gz.enc` artifact; manifest version is `0.8.31`, source commit is `a4dbdf137907155ef33b1c12ffacd70a6fee9c50`, and the reconciliation script is present.

## New-server Gray

- Internal and public status returned `0.8.31`, environment `gray`, permission mode `enforced`.
- API and Worker were active; permission readiness was true with 132 subjects, 1,180 rules, 5 principals, and 0 failures.
- Database and environment fallback retention both returned 15 days.
- Reconciliation dry-run scanned 99 artifacts and 13 uploads with no candidates; the output-prune service completed with result `success` and exit status 0.

## New-server Production

- Internal and public status returned `0.8.31`, environment `production`, permission mode `enforced`.
- API and Worker were active; permission readiness was true with 180 subjects, 2,718 rules, 12 principals, and 0 failures.
- Database and environment fallback retention both returned 15 days. After backfill, active artifacts with expiry below `created_at + 15 days` were 0.
- The production Web bundle contains the generation-library settings route and no hardcoded `最多保留 3 天` string. The Worker bundle contains the configured retention marker.
- Reconciliation dry-run scanned 5,811 artifacts and 377 uploads. It found 1,399 `mark_missing` candidates caused by the intentional generated-output migration exclusion and 75 `expire_input` candidates. No manual Production apply was run.
- Unauthenticated requests to the settings route returned 401 in both environments, confirming that the runtime setting remains protected by the existing session boundary.
