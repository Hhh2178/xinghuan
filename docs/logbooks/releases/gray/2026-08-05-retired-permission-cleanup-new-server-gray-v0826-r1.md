# 退役权限规则清理 v0.8.26 新服务器 Gray

- release: `20260805-retired-permission-cleanup-v0826-r1`
- target: `new-server (ubuntu@43.131.246.222:22)`
- encrypted archive SHA-256: `5fc01d4e778abd5079fed02845be1a8205bfc26f37cd2e467fbfbce60d32881d`

## Result

- Archive decrypt, `npm ci --omit=dev`, database migration and service restart passed; migrations were `applied=[]`, `skipped=49`.
- Internal API status reports `0.8.26 / gray / enforced`; API and Worker are active.
- Permission readiness reports `ready=true` with zero failures for `xinghuan_canvas_gray`.
- Public hostname verification was blocked by local DNS `ENOTFOUND canvas-next.zezhen.online`; this is recorded separately from the successful internal runtime verification.
