# PostgreSQL 后台 repository 切换记录 - 2026-06-05

## 目标

- 将统一后台的 auth/admin 运行数据从文件型 repository 切到 PostgreSQL repository。
- 保留文件型 fallback，避免本地开发和回滚路径被破坏。
- 导入灰度现有用户、会话、Provider、模型、任务和审计数据。
- 验证切换后后台、认证、权限、Provider Key 加密和审计仍可用。

## Release

- Release ID: `20260605-1410-xinghuan-pg-repo-gray`
- 当前 release 路径: `/opt/apps/xinghuan-canvas-next/releases/20260605-1410-xinghuan-pg-repo-gray`
- 存储驱动: `XINGHUAN_STORAGE_DRIVER=postgres`
- 数据库: `xinghuan_canvas_next`

## 变更范围

- `apps/api` 新增 auth/admin PostgreSQL repository。
- `apps/api` 保留 file repository fallback。
- `/api/admin/system` 新增 `storageDriver`。
- `apps/admin` 系统页新增“存储驱动”显示。
- 新增 `scripts/db-import-files.mjs`。
- 新增 `npm run db:import-files`。
- 配置模板新增 `XINGHUAN_STORAGE_DRIVER=file`。

## 导入结果

服务器执行 `npm run db:import-files` 后返回:

- users: 2
- sessions: 2
- providers: 5
- models: 2
- skippedModels: 0
- tasks: 1
- auditLogs: 3

切换后自动验收脚本新增了一条 Provider 和一条审计，因此数据库复核时为:

- users=2
- providers=6
- audit=4

## 验证证据

- 本机 `node --check scripts\db-import-files.mjs` 通过。
- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run type-check -w @xinghuan/admin` 通过。
- 本机 `npm run build:single-port` 通过。
- 本机 file driver 下 `npm run verify:single-port` 通过。
- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- 服务器 `npm run db:migrate` 返回 `skipped: 1`。
- 服务器 `npm run db:import-files` 通过。
- `xinghuan-canvas-next.service` 返回 `active`。
- `/opt/apps/xinghuan-canvas-next/current` 指向 `20260605-1410-xinghuan-pg-repo-gray`。
- 服务器 `npm run verify:single-port` 全部 PASS。
- 管理员登录后 `/api/admin/system` 返回 `storageDriver=postgres`、`databaseStatus=connected`、`migrations=["001_admin_core.sql"]`。
- 数据库表计数复核: `users=2`、`providers=6`、`audit=4`。

## 安全检查

- 本地代码、文档和配置模板未命中管理员密码片段、数据库连接串、环境密钥明文或测试 Key 明文。
- 服务器文件型历史数据不包含管理员密码片段。
- 服务器文件型历史 Provider Key 仍为 `enc:v1` 加密字段。
- PostgreSQL `xh_providers` 中明文 `verify-secret-*` 计数为 0。
- PostgreSQL `xh_providers` 中 `enc:v1` 加密 Key 计数为 4。

## 当前结论

统一后台的用户、会话、Provider、模型、任务和审计数据已经切到 PostgreSQL repository。画布内容、素材文件和资源库仍保留文件型存储；下一步应推进 Redis/worker 任务队列和 Provider Adapter。

## 回滚方式

- 将服务器环境文件中的 `XINGHUAN_STORAGE_DRIVER` 改回 `file`。
- 将 `/opt/apps/xinghuan-canvas-next/current` 指向上一版 release。
- 重启 `xinghuan-canvas-next.service`。

不要删除 PostgreSQL 数据库；保留用于对比和恢复。
