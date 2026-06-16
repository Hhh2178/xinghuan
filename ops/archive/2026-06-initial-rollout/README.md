# 2026-06 Initial Rollout 归档批次

本批次用于收纳 2.0 初始落地阶段已经完成、但不再属于当前运行态入口的材料。

本批次主要包含：

- 服务器初始状态与磁盘清理
- 首轮灰度部署、认证与后台接入
- PostgreSQL 仓储切换与迁移准备
- Worker 队列接线与 Phase 2 首轮灰度收口
- 首轮生产预检材料

建议按下面顺序查看：

- `server-state-2026-06-04.md`
- `server-disk-usage-2026-06-04.md`
- `old-canvas-cleanup-2026-06-04.md`
- `gray-deploy-2026-06-05.md`
- `gray-auth-deploy-2026-06-05.md`
- `gray-admin-deploy-2026-06-05.md`
- `gray-admin-security-2026-06-05.md`
- `gray-db-readiness-2026-06-05.md`
- `postgresql-gray-migration-2026-06-05.md`
- `postgresql-repository-cutover-2026-06-05.md`
- `worker-queue-gray-deploy-2026-06-05.md`
- `phase2-complete-gray-2026-06-06.md`
- `grsai-worker-gray-2026-06-06.md`
- `production-preflight-2026-06-06.md`

归档原因：

- 这些记录仍有审计价值，但当前 active release、当前放行判断和当前值守都不再直接依赖它们。
- 如果继续平铺在 `ops/README.md` 的当前入口里，会干扰对 `2026-06-12` 之后治理与发布状态的判断。
