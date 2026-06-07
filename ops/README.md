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
- `phase3-output-prune-gray-2026-06-06.md`
- `phase3-lifecycle-gray-2026-06-06.md`
- `nginx/canvas-next.hhh2121.xyz.conf.example`
- `systemd/xinghuan-canvas-next.service.example`
- `systemd/xinghuan-canvas-next-worker.service.example`
- `systemd/xinghuan-canvas-next-output-prune.service.example`
- `systemd/xinghuan-canvas-next-output-prune.timer.example`

当前生产准备材料：

- `production-preflight-2026-06-06.md`
- `production-prep-2026-06-07.md`
- `production-cutover-2026-06-06.md`
- `production-user-accounts-2026-06-06.md`
- `production-deploy-runbook.md`
- `production-acceptance-checklist.md`
- `nginx/canvas.hhh2121.xyz.conf.example`
- `systemd/xinghuan-canvas.service.example`
- `systemd/xinghuan-canvas-worker.service.example`
- `systemd/xinghuan-canvas-output-prune.service.example`
- `systemd/xinghuan-canvas-output-prune.timer.example`

后续需要补充：

- PostgreSQL repository 切换和文件数据迁移记录。
- 灰度回滚演练记录。
- 生产发布后的观察记录。
