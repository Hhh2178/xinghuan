# 退役权限规则清理 v0.8.26 旧服务器 Gray

- release: `20260805-retired-permission-cleanup-v0826-r1`
- version: `0.8.26`
- target: `old-server (ubuntu@101.33.75.38:728)`
- source commit: `ff1064d`
- encrypted archive SHA-256: `5fc01d4e778abd5079fed02845be1a8205bfc26f37cd2e467fbfbce60d32881d`
- inner sealed archive SHA-256: `8e962a740bf7f6c37f3f8d8a0a64fdab8ccdc423cd04ba49fe4485694c98e17d`

## Scope

- Retired permission Subjects remain available for historical references; their authorization rules are reconciled away.
- The permission platform hides retired Subjects by default and exposes an explicit lifecycle filter.

## Result

- The encrypted archive decrypted on the target and the sealed payload identity matched the local verification.
- `npm ci --omit=dev` completed; database migrations reported `applied=[]`, `skipped=49`.
- API and Worker are active. Internal and HTTPS status report `0.8.26 / gray / enforced`.
- Permission readiness is `true`, with zero failures.

## Target Boundary

- New-server Gray was not changed: SSH public-key authentication was unavailable before upload.
- This is a partial target release, not a dual-server synchronization milestone.
