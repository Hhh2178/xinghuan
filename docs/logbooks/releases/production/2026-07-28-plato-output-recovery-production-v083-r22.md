# Plato Output Recovery v0.8.3 Production

- release: `20260728-plato-output-recovery-v083-r22`
- version: `0.8.3`
- source commit: `5a7456ab40f8a91d11873b967aa2e9a6e80d0c5a`
- archive SHA-256: `8F0DCDF561920A0D0897E2193BF288F4E817EFC58F00F8B6F489F84E4FED9837`
- target: old-server Production (`/opt/apps/xinghuan-canvas`)
- deployed: `2026-07-28`
- previous current / rollback: `20260721-admin-health-visual-resource-domain-prod-r1-v0717`
- retentionApplyRun: `false`

## Promotion scope

- Promote the exact Gray-accepted r22 archive; no Production rebuild, version increment, paid Provider submission, or release-package cleanup occurred.
- Include same-upstream-task polling recovery, polling/materialization heartbeats, conditional stale recovery, HTTP Range continuation, `.part` atomic promotion, and provider-versus-local failure classification.

## Pre-release readiness repair

- A strict Production readiness check found 22 historical permission rules attached to one retired Plato model subject.
- The generic reconciliation dry-run would have changed 19 subjects and created 242 rules, so it was not run.
- Each of the 22 retired-subject rules was removed through the audited admin API with revision checking. No active model policy was widened or changed.

## Deployment and rollback

- `npm ci` completed; dependency audit reported 6 high severity advisories. No unreviewed dependency upgrade was attempted in the production window.
- Database migration completed idempotently: 46 migrations already registered, 0 newly applied.
- `current` now points to `/opt/apps/xinghuan-canvas/releases/20260728-plato-output-recovery-v083-r22`.
- The prior r0.7.17 release remains intact as the explicit rollback anchor; old release packages were retained.
