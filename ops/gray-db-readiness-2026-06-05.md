# 灰度数据库 readiness 部署记录 - 2026-06-05

## 目标

- 为统一后台补齐 PostgreSQL 数据模型和迁移入口。
- 后台系统状态页展示数据库配置、连接和迁移状态。
- 在灰度环境上线 readiness 版本，但不在未准备好数据库服务时强行切换数据源。

## Release

- Release ID: `20260605-1315-xinghuan-db-ready-gray`
- 灰度域名: `https://canvas-next.hhh2121.xyz/`
- 灰度后台: `https://canvas-next.hhh2121.xyz/admin`
- 服务: `xinghuan-canvas-next.service`
- 内部端口: `127.0.0.1:18200`
- 当前 release 路径: `/opt/apps/xinghuan-canvas-next/releases/20260605-1315-xinghuan-db-ready-gray`

## 变更范围

- 新增 PostgreSQL schema: `apps/api/db/001_admin_core.sql`。
- 新增迁移脚本: `scripts/db-migrate.mjs`。
- 根脚本新增 `npm run db:migrate`。
- `apps/api` 新增 `pg` 依赖和数据库状态探测。
- `/api/admin/system` 返回 `database.status`、`configured`、`migrations` 和错误信息。
- `apps/admin` 系统页展示数据库状态、迁移状态和数据库错误。
- 自动验收脚本覆盖 `/api/admin/system` 数据库状态字段。
- `config/.env.example` 和 `config/canvas-next.env.example` 预留 `XINGHUAN_DATABASE_URL`。

## 验证证据

本机:

- `node --check scripts\db-migrate.mjs` 通过。
- `node --check scripts\verify-single-port.mjs` 通过。
- `npm run type-check -w @xinghuan/api` 通过。
- `npm run type-check -w @xinghuan/admin` 通过。
- `npm run build:single-port` 通过。
- 未配置数据库时 `npm run db:migrate` 返回 `DATABASE_NOT_CONFIGURED`，退出码为 2，符合预期。
- `npm run verify:single-port` 通过，包含 `GET /api/admin/system database status`。
- 本地后台系统页可见 `数据库状态 not_configured` 和 `数据库迁移 未配置`。

服务器:

- `npm ci` 通过，0 vulnerabilities。
- `npm run build:single-port` 通过。
- `systemctl is-active xinghuan-canvas-next.service` 返回 `active`。
- `/opt/apps/xinghuan-canvas-next/current` 指向 `20260605-1315-xinghuan-db-ready-gray`。
- 服务器 `npm run verify:single-port` 通过。
- 未配置数据库时服务器 `npm run db:migrate` 返回 `DATABASE_NOT_CONFIGURED`，退出码为 2，符合预期。
- `https://canvas-next.hhh2121.xyz/api/status` 返回 `service=xinghuan-api`、`environment=gray`。
- 未登录访问 `https://canvas-next.hhh2121.xyz/api/admin/system` 返回 401。
- 管理员登录后 `/api/admin/system` 返回 `databaseStatus=not_configured`、`databaseConfigured=false`、`migrations=0`。

安全检查:

- 本地代码、文档和配置模板未命中管理员密码片段、测试 Key 明文或环境密钥明文模式。
- 服务器 `shared/data/admin/admin.json` 不包含测试 Key 明文，包含 `enc:v1` 加密字段和 `provider.create` 审计记录。
- 服务器 `shared/data/auth/auth.json` 不包含管理员密码明文片段。

## 当前结论

数据库 readiness 已完成灰度部署。当前状态是 PostgreSQL 接入前的准备态：代码、schema、迁移命令、后台状态和验收脚本已经就绪，但灰度服务器仍未启用真实 PostgreSQL 连接。

## 后续动作

- 在服务器安装/启用 PostgreSQL。
- 创建灰度数据库和专用最小权限账号。
- 将数据库连接串写入服务器环境文件，不能写入 Git 或文档。
- 执行 `npm run db:migrate`，确认 `001_admin_core.sql` 进入 `xh_schema_migrations`。
- 逐步实现文件型 auth/admin/canvas 数据到 PostgreSQL repository 的迁移和双写/切换策略。
- Redis/worker 任务队列接入后，将任务状态迁入 `xh_tasks`。
