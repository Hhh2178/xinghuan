# Starflow Production v0.9.3 validation

## Build and package

- `npm run type-check` — exit 0.
- `npm run build:single-port` — exit 0; Vite reported local `caniuse-lite` data is 6 months old.
- `npm run verify:file-hotspot-budgets` — exit 0; Worker was at 1,757 lines under its 1,765-line budget.
- `npm run verify:old-server-release-target -- --target-profile=old-server --env=production` — exit 0; target is Starflow Production and database `xinghuan_canvas_next`.
- `node scripts/verify-release-version-alignment.mjs` — exit 0 for `0.9.3`.
- APIMart image contract tests — 4/4 passed after the compatibility fix. Code-node tests — 5/5 passed using the process-scoped `XINGHUAN_PYTHON_BIN` pointing to an official portable Python runtime in the ignored `.tmp` directory.
- Plaintext archive SHA-256: `0088ea727f343cd662fe1753177fff1cabc2d9a8bff46943f18456b2db4a1365`. Server-side encrypted/decrypted round-trip matched the plaintext archive; encrypted SHA-256 and sidecar: `25fd3aef6af5ebb60818a12105d42cde32fd4f917986bb115c4312bcdbdc4da8`.

## Production runtime

- Deployment to `old-server / production` exited 0, applied no pending database migrations, and restarted API and Worker.
- Runtime verification exited 0 for expected version `0.9.3`, environment `production`, permission mode `enforced`, and ready permissions.
- API and Worker are active; internal and public status both report `0.9.3 / production`.
- Permission readiness: 193 subjects (145 published, 26 restricted, 22 retired), 2,614 rules, 11 principals, 0 failures.

## Remaining verification

- The repository pre-push hook runs full `npm run ci`. The user authorized that CI run; it and remote push are pending at the time of this record.
- No paid APIMart generation request was made. GPT-Image-2.6 GIF image-to-image acceptance by the upstream remains unverified.
