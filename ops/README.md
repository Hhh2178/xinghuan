# ops - 无限画布 2.0 运维记录

本目录用于记录服务器、域名、部署、服务、日志、回滚和验收。

当前状态：

- 2.0 已部署到灰度服务器。
- 灰度目标已确定为 `canvas-next.hhh2121.xyz` 和 `127.0.0.1:18200`。
- 生产目标预留为 `canvas.hhh2121.xyz` 和 `127.0.0.1:18100`。
- 旧项目服务不要在未确认前停止或覆盖。

当前灰度部署材料：

- `gray-deploy-runbook.md`
- `gray-acceptance-checklist.md`
- `gray-deploy-2026-06-05.md`
- `gray-auth-deploy-2026-06-05.md`
- `gray-admin-deploy-2026-06-05.md`
- `gray-admin-security-2026-06-05.md`
- `gray-db-readiness-2026-06-05.md`
- `postgresql-gray-migration-2026-06-05.md`
- `postgresql-repository-cutover-2026-06-05.md`
- `worker-queue-gray-deploy-2026-06-05.md`
- `nginx/canvas-next.hhh2121.xyz.conf.example`
- `systemd/xinghuan-canvas-next.service.example`
- `systemd/xinghuan-canvas-next-worker.service.example`

后续需要补充：

- PostgreSQL repository 切换和文件数据迁移记录。
- 灰度回滚演练记录。
- 生产切换记录。
