# Media Retention v0.8.1 Production

- release: `20260725-media-retention-v081-r2`
- version: `0.8.1`
- source commit: `85b1993`
- archive SHA-256: `AE5D388A6D8894610C2FE3FDDFBA8229E1D3AA099F193BA7E6F32D35CD186453`
- rollback: `20260725-ai-governance-runtime-current-production-r1-v0744`

## Deployment

- 旧 Production：`canvas.hhh2121.xyz`，current 已切换。
- 新 Production：`canvas.zezhen.online`，current 已切换。
- 两端均应用 `045_ephemeral_upload_retention.sql` 并重启 API/Worker。
- 旧 Production 执行一次受保护的过期制品清理；新 Production 无待清理候选。

## Boundary

- 未执行 release retention prune。
- 未删除既有正式构建包、数据库备份或用户媒体迁移源。
- 旧服务器继续作为回滚来源保持在线。
