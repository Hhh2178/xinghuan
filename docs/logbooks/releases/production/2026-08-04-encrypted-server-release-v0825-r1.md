# 加密服务器封装发布 v0.8.25 Production

- release: `20260804-encrypted-server-release-v0825-r1`
- version: `0.8.25`
- environment: `production`
- targets: `old-server (ubuntu@101.33.75.38:728)` and `new-server (ubuntu@43.131.246.222:22)`
- source commit: `ee31a4bea12af70367dc165a3b95b451b4ccdd0b`
- encrypted archive SHA-256: `4bf374ae8c5d98e1aba8fcdb7a787ae602b41196c0b1b827d88e4534f7ce3e3a`
- inner sealed archive SHA-256: `f93a9d1f47faf7adaa76209aef91c8a09fbba09bd9262487ca9e31c3caa19f04`
- deployedAt: `2026-08-04`
- promotedFromGray: `true`

## Scope

- Promote the Gray-verified encrypted artifact to both Production targets without rebuilding.
- Keep the encrypted envelope limited to server packaging; the development repository remains runnable from source.

## Verification

- Both Production API/Worker services active; internal and HTTPS status report `0.8.25 / production / enforced`.
- Permission readiness passed on both Production databases with zero failures; migrations reported `applied=[]`, `skipped=49`.
- Source isolation passed on both Production targets: non-`node_modules` TypeScript/TSX files `0`, source maps `0`, `src/` directories `0`.
- The same outer encrypted SHA and inner sealed archive SHA were verified on Gray and Production.

## Boundaries

- No Production-specific rebuild, source copy or secret disclosure was introduced.
- Old-server releases remain available as the rollback path while new-server traffic convergence is evaluated separately.
