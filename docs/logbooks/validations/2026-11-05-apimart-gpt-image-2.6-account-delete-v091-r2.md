# Starflow Production v0.9.1 validation

## Build and package

- `npm run type-check` — exit 0.
- `npm run build:single-port` — exit 0. Vite reported that the local `caniuse-lite` data is 6 months old.
- `npm run verify:file-hotspot-budgets` — exit 0; `apps/api/src/server.ts` is exactly at its 11,960-line budget.
- `npm run verify:old-server-release-target -- --target-profile=old-server --env=production` — exit 0; target resolved to Starflow production and database `xinghuan_canvas_next`.
- `node scripts/verify-release-version-alignment.mjs` — exit 0.
- `npm run package:release -- 20261105-apimart-26-account-delete-v091-r2` — exit 0; artifact SHA-256 `59b9210259dc675bf24c08cf9c14947c50b97e6c1b07135bc53ee219287214df`.

## Production runtime

- `node scripts/release/deploy-gray-release.mjs --target-profile=old-server --env=production --release=20261105-apimart-26-account-delete-v091-r2 ...` — exit 0; migration 051 applied and both services restarted.
- `node scripts/release/verify-gray-runtime.mjs --target-profile=old-server --env=production --expected-version=0.9.1 --expected-environment=production --expected-permission-mode=enforced --expected-permission-ready=true ...` — exit 0.
- API and Worker are active. Internal and public status both report `0.9.1`, `production`, and `enforced`.
- Permission readiness: 192 subjects, 145 published, 26 restricted, 21 retired, 2,614 rules, 11 principals, 0 failures.
- Migration 051 applied successfully. The orphan-rule count is zero after the cleanup.

The strict runtime command had one transient public HTTPS connect timeout; a retry passed all checks. Automated test suites and real APIMart generation/account-deletion UI flows were not run.
