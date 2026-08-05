# 退役权限规则清理 Production 验证 v0.8.26

- targets: old-server Production and new-server Production
- release: `20260805-retired-permission-cleanup-v0826-r1`
- Production database target checks and backups completed before deployment on both targets.
- Internal API status: `0.8.26 / production / enforced` on both targets.
- API/Worker: active on both targets.
- Permission readiness: `ready=true`, failures `0` on both databases.
- Retention: five releases retained on each target with current and rollback protected.
- New Production public DNS: `ENOTFOUND canvas.zezhen.online` from the local resolver; internal runtime is healthy.
