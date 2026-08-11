# Validation: v0.8.34 Media Batch Status and Workflow Region Dissolve

## Local verification

- The focused workflow-region test verifies that dissolving a region removes only the workflow document and retains its nodes.
- Full CI passed: 269 test files passed, 1 skipped; 1,004 tests passed, 4 skipped.
- Web type-check passed. ESLint completed with zero errors and two pre-existing warnings.
- The encrypted release contract passed against the deployed `.tar.gz.enc` artifact.

## New-server Gray

- Current release: `20260811-provider-media-batch-status-v0834-r1`.
- API and worker were active.
- Internal and public status both returned version `0.8.34`, environment `gray`, and permission mode `enforced`.
- Permission readiness was true: 132 subjects, 1,180 rules, 5 principals, and 0 failures.

## New-server Production

- The same encrypted artifact accepted by Gray was deployed without rebuilding.
- API and worker were active.
- Internal and public status both returned version `0.8.34`, environment `production`, and permission mode `enforced`.
- Permission readiness was true: 180 subjects, 2,718 rules, 12 principals, and 0 failures.
