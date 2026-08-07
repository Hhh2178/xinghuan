# Web 版本显示修正 v0.8.28 验证

- release: `20260807-web-version-correction-v0828-r2`
- target: old-server Production
- environment: `production / enforced`

## Runtime Evidence

- Internal `/api/status`: `0.8.28 / production / enforced`.
- Public `https://canvas.hhh2121.xyz/api/status`: `0.8.28 / production / enforced`.
- API and Worker systemd services: `active`.
- Home page now references `/assets/index-Do0HzquT.js`.
- Public Web entry bundle contains `0.8.28` and contains zero occurrences of `0.8.27`.
- HTML response is `no-store`; fingerprinted assets remain cacheable, so the new asset filename invalidates the stale browser asset.

## Repository Evidence

- `node scripts/verify-release-version-alignment.mjs` passed locally before packaging.
- `npm test -- --run scripts/package-release.test.ts` passed.
- Encrypted archive decryption and checksum verification passed on the old server.
- Database migration reported `applied: []`; no schema or data change was made.
