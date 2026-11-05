# Starflow Production v0.9.2 validation

## Build and package

- `npm run type-check` — exit 0 across all workspaces.
- `npm run build:single-port` — exit 0. Vite reported that local `caniuse-lite` data is 6 months old.
- `npm run verify:file-hotspot-budgets` — exit 0; Worker remains at 1,757 lines under its 1,765-line budget.
- `npm run verify:hotspot-watchlist-contract` — exit 0; the 1,300-line Admin model editor is recorded in the hotspot ledger.
- `npm run verify:old-server-release-target -- --target-profile=old-server --env=production` — exit 0; target is Starflow Production and database `xinghuan_canvas_next`.
- `node scripts/verify-release-version-alignment.mjs` — exit 0 for `0.9.2`.
- `npm run package:release -- 20261105-image-size-gif-mode-v092-r1` — exit 0; plaintext archive SHA-256 `1b8ee8a704fd3533436cfff4b584b60bd2954609ef634fb53a5de8f0f7784f1d`.
- The archive was encrypted on Starflow using the server-only release key. Server-side decrypt round-trip matched the plaintext archive; encrypted SHA-256 and sidecar: `7ca5cc9ae8bd514e5c8acb299cc1ffd5fd13b50e707f4933969ccf26ecb195df`.

## Production runtime

- `node scripts/release/deploy-gray-release.mjs --target-profile=old-server --env=production --release=20261105-image-size-gif-mode-v092-r1 ...` — exit 0; deployment applied no pending database migrations and restarted both services.
- `node scripts/release/verify-gray-runtime.mjs --target-profile=old-server --env=production --expected-version=0.9.2 --expected-environment=production --expected-permission-mode=enforced --expected-permission-ready=true ...` — exit 0.
- API and Worker are active; internal and public status both report `0.9.2 / production`, `permissionMode=enforced`.
- Permission readiness: 193 subjects (145 published, 26 restricted, 22 retired), 2,614 rules, 11 principals, 0 failures.
- Automated test suites and real APIMart generation/GIF-reference requests were not run.

## Push status

- The source commit is `468e6b5752438a223f20b190fc51a8a315f77456`.
- The push hook invokes `npm run ci`, which includes the automated test suite. It was stopped during `verify:important` before the test stage, in accordance with the no-tests instruction. The source commit has not yet been confirmed on `origin`.
