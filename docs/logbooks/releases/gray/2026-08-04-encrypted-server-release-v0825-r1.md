# 加密服务器封装发布 v0.8.25 Gray

- release: `20260804-encrypted-server-release-v0825-r1`
- version: `0.8.25`
- environment: `gray`
- targets: `old-server (ubuntu@101.33.75.38:728)` and `new-server (ubuntu@43.131.246.222:22)`
- source commit: `ee31a4bea12af70367dc165a3b95b451b4ccdd0b`
- encrypted archive SHA-256: `4bf374ae8c5d98e1aba8fcdb7a787ae602b41196c0b1b827d88e4534f7ce3e3a`
- inner sealed archive SHA-256: `f93a9d1f47faf7adaa76209aef91c8a09fbba09bd9262487ca9e31c3caa19f04`
- deployedAt: `2026-08-04`

## Scope

- Add the server-only AES-256-GCM encrypted envelope around the source-free, minified runtime archive.
- Keep the development worktree source-based; `dev`, `build`, type-check, tests and ordinary `package:release` remain unchanged.
- Deploy the same encrypted artifact to both old and new Gray environments; no second build was created.

## Verification

- Encrypted release contract passed; inner manifest contains 188 files and 214 archive entries.
- Source isolation passed on both Gray targets: non-`node_modules` TypeScript/TSX files `0`, source maps `0`, `src/` directories `0`.
- Both Gray API/Worker services active; internal and HTTPS status report `0.8.25 / gray / enforced`.
- Permission readiness passed on both databases with zero failures; migrations reported `applied=[]`, `skipped=49`.
- Remote decrypt helper, ciphertext and plaintext temporary archive were removed after installation.

## Boundaries

- The encryption key remains only in the target server environment and local credential storage; it is not recorded here.
- Production promotion reuses this exact encrypted artifact and inner payload identity.
