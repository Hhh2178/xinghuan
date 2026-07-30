# Admin Rail Single Owner Footer v0.8.14 Production

- release: `20260730-admin-rail-single-owner-footer-v0814-r1`
- version: `0.8.14`
- source branch: `release/admin-governance-content-d-v0813`
- source commit: `14147ec`
- archive SHA-256: `3644760948fc181ef23fd75c755bbae972b955d6b1211fc4ab15e85a70d79294`
- target: `old-server` / Production
- deployed: `2026-07-30`
- previous current / rollback: `20260728-plato-output-recovery-v083-r22`
- retention apply: `false`

## Promotion scope

- Promote the exact Gray-verified archive; no Production rebuild, version increment, paid Provider submission, or Agent runtime feature-gate change occurred.
- Deliver the Provider and RunningHub shared-rail ownership correction and footer gradient removal, together with the previously accepted environment-isolated Agent governance behavior.

## Deployment and verification

- Dependency installation completed with the pre-existing 6 high-severity audit advisories; no forced dependency upgrade was attempted.
- Database migration completed idempotently: 46 registered migrations skipped and none newly applied.
- `current` now points to `/opt/apps/xinghuan-canvas/releases/20260730-admin-rail-single-owner-footer-v0814-r1`.
- API and Worker are active. Public/internal status report `0.8.14 / production`; permission readiness is `enforced / ready` with 156 subjects, 120 published, 26 restricted, 10 retired, 2810 rules, 11 principals, and 0 failures.
