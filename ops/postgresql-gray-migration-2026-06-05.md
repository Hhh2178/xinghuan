# PostgreSQL 灰度启用与首轮迁移记录 - 2026-06-05

## 目标

- 在灰度服务器启用 PostgreSQL。
- 创建无限画布 2.0 灰度数据库和专用最小权限账号。
- 将连接串写入服务器环境文件。
- 执行首轮 schema migration。
- 验证后台系统页数据库状态为 connected。

## 服务器状态

- OS: Ubuntu 24.04.4 LTS
- PostgreSQL: 16.14
- 监听地址: `127.0.0.1:5432`
- 服务: `postgresql`
- 画布服务: `xinghuan-canvas-next.service`
- 画布 release: `20260605-1315-xinghuan-db-ready-gray`

## 数据库

- 数据库名: `xinghuan_canvas_next`
- 应用账号: `xinghuan_canvas_next`
- 连接串位置: `/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`
- 连接串密钥未写入 Git、文档或聊天。

## 验证证据

- `systemctl is-active postgresql` 返回 `active`。
- `psql --version` 返回 PostgreSQL 16.14。
- `ss -ltnp` 确认 PostgreSQL 监听 `127.0.0.1:5432`。
- `npm run db:migrate` 返回:
  - `ok: true`
  - `applied: ["001_admin_core.sql"]`
  - `skipped: 0`
- 管理员登录后 `/api/admin/system` 返回:
  - `databaseStatus: connected`
  - `databaseConfigured: true`
  - `migrations: ["001_admin_core.sql"]`
- 服务器 `npm run verify:single-port` 全部 PASS。
- 数据库 `xh_schema_migrations` 包含 `001_admin_core.sql`。

## 当前结论

灰度 PostgreSQL 已启用并完成首轮 schema migration。当前应用已经可以观测数据库连接和迁移状态，但认证、后台、画布和素材运行数据仍主要使用文件型 repository。下一步需要实现 repository 层迁移，避免直接切换导致现有灰度数据丢失。

## 后续动作

- 实现 auth/admin/canvas 数据的 PostgreSQL repository。
- 设计文件数据到 PostgreSQL 的一次性导入脚本。
- 为切换期设计只读校验或双写策略。
- Redis/worker 接入后将任务写入 `xh_tasks`。
- 为数据库连接串补充备份、轮换和恢复流程。
