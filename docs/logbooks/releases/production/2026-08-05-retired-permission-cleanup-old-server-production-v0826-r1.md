# 退役权限规则清理 v0.8.26 旧服务器 Production

- release: `20260805-retired-permission-cleanup-v0826-r1`
- version: `0.8.26`
- target: `old-server (ubuntu@101.33.75.38:728)`
- source commit: `ff1064d`
- encrypted archive SHA-256: `5fc01d4e778abd5079fed02845be1a8205bfc26f37cd2e467fbfbce60d32881d`
- inner sealed archive SHA-256: `8e962a740bf7f6c37f3f8d8a0a64fdab8ccdc423cd04ba49fe4485694c98e17d`
- database backup: `/opt/apps/xinghuan-canvas/shared/backups/20260805-before-retired-permission-cleanup-v0826-r1.dump`

## Result

- The production database target was verified before deployment and the backup completed successfully.
- The same encrypted Gray artifact was decrypted and installed; database migrations reported `applied=[]`, `skipped=49`.
- API and Worker are active. Internal and HTTPS status report `0.8.26 / production / enforced`.
- Permission readiness is `true`, with zero failures.

## Target Boundary

- New-server Production was not changed: SSH public-key authentication was unavailable before backup or upload.
- This is a partial target release, not a dual-server synchronization milestone.
