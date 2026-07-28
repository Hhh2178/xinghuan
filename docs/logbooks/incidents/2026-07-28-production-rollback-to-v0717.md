# Production 回退到 v0.7.17（旧服务器）

- 时间：`2026-07-28`
- 目标：`ubuntu@101.33.75.38:728`，旧服务器 Production
- 回退 release：`20260721-admin-health-visual-resource-domain-prod-r1-v0717`
- 回退原因：用户要求在继续修复和压力测试前，先恢复到 0.7 系列最后一个已记录版本。

## 执行与验证

- 已确认目标 release 目录存在，未删除当前 r18 或任何历史 release。
- 已将 `/opt/apps/xinghuan-canvas/current` 指向 v0.7.17，并重启 `xinghuan-canvas.service` 与 `xinghuan-canvas-worker.service`。
- 内部 `/api/status` 与公网 `https://canvas.hhh2121.xyz/api/status` 均返回 `version=0.7.17`、`environment=production`、`permissionMode=enforced`。
- 后续修复按用户要求先只部署旧服务器 Gray；Production 保持 v0.7.17，直至另行批准晋级。
