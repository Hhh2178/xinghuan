# 退役权限规则清理 新服务器 Production 验证 v0.8.26

- target: new-server Production
- release: `20260805-retired-permission-cleanup-v0826-r1`
- Database backup completed before deploy; database `xinghuan_canvas_next`.
- Internal status: `0.8.26 / production / enforced`
- API/Worker: `active / active`
- Permission readiness: `ready=true`, failures `0`
- Retention: guarded dry-run/apply retained five releases, including current and rollback.
- Public DNS: local resolver returned `ENOTFOUND canvas.zezhen.online`; public HTTPS requires domain-side DNS repair before final browser acceptance.
