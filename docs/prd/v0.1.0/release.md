# v0.1.0 Release

## 版本定位

v0.1.0 是无限画布 2.0 的立项、T8 成熟画板迁移、本机单端口生产服务和灰度认证版 POC 版本，不是最终可上线产品版本。

## 范围内

- 项目治理文件。
- 需求文档。
- 技术 SPEC。
- 设计方向。
- 开发计划。
- 进度记录。
- 决策台账。
- 星幻 monorepo 工程基线。
- T8 成熟画板 UI 迁入 `apps/web`。
- 星幻 API 兼容画布、文件、素材资源的最小接口。
- 本机 `18200` 单端口生产服务。
- 单端口启动脚本和自动验收脚本。
- 灰度部署 runbook、验收清单、Nginx 示例和 systemd 示例。
- 灰度服务器部署到 `canvas-next.hhh2121.xyz`。
- 最小登录、退出和当前用户接口。
- 画布、素材和资源库的用户隔离。
- 星幻科技风登录门禁。
- 灰度认证版部署和公网验收。
- 统一后台 `/admin`。
- 后台管理员权限守卫。
- 用户、Provider、模型、任务和系统状态后台模块。
- Provider Key 加密落盘和脱敏返回。
- 后台密码重置入口。
- 后台审计日志。
- PostgreSQL 基础 schema 和迁移脚本。
- 后台系统页数据库 readiness 状态。
- 灰度 PostgreSQL 服务启用和首轮 schema migration。
- auth/admin PostgreSQL repository。
- 文件型 auth/admin 数据导入 PostgreSQL。
- Redis/worker 任务队列。
- Worker systemd 服务。

## 范围外

- 不包含生产部署。
- 不包含真实 Provider 调用。
- 不包含真实 Provider Adapter。
- 不包含任务输出素材落库。
- 不包含画布内容和素材资源库的 PostgreSQL repository 切换。
- 不包含任务队列。
- 不包含真实异步任务队列。
- 不包含生产级审计扩展、密钥轮换流程和数据库迁移。

## 验收清单

- `AGENTS.md` 存在并包含协作规则。
- `MEMORY.md` 存在并包含旧项目放弃原因和 2.0 核心需求。
- `DEVLOG.md` 存在并包含初始化记录。
- `docs/prd/README.md` 存在并标记当前活跃版本。
- `docs/prd/v0.1.0/` 文档完整。
- `npm run type-check -w @xinghuan/api` 通过。
- `npm run build -w @xinghuan/api` 通过。
- `npm run build -w @xinghuan/web` 通过。
- 关闭 `18300`、`18310`、`18766` 后，仅 `18200` 监听。
- `http://127.0.0.1:18200/` 可打开星幻画板。
- `http://127.0.0.1:18200/api/status` 返回 `xinghuan-api`。
- 单端口画布创建、保存、刷新读取通过。
- 单端口文件上传和访问通过。
- Chrome headless 截图和 DOM dump 确认星幻品牌、后端连接和 ReactFlow 画布。
- `node --check scripts/start-single-port.mjs` 通过。
- `node --check scripts/verify-single-port.mjs` 通过。
- `npm run build:single-port` 通过。
- `npm run start:single-port` 可启动 `127.0.0.1:18200`。
- `npm run verify:single-port` 8 项自动验收全部 PASS。
- 灰度 runbook、Nginx/systemd 示例和验收清单已补齐。
- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- `xinghuan-canvas-next.service` 为 active。
- `nginx` 为 active，`sudo nginx -t` 通过。
- `https://canvas-next.hhh2121.xyz/` 返回 200。
- `https://canvas-next.hhh2121.xyz/api/status` 返回 `xinghuan-api`。
- Chrome headless 公网截图和 DOM dump 确认星幻品牌、后端连接和 ReactFlow 画布。
- 本机认证版 `npm run verify:single-port` 自动验收全部 PASS。
- 灰度 release `20260605-1135-xinghuan-auth-gray` 已部署。
- 灰度环境文件已设置管理员和成员 bootstrap secret，且不包含 `change-me`。
- 灰度服务器 `npm run verify:single-port` 自动验收全部 PASS，包含未登录拒绝、登录、用户隔离和文件上传。
- `https://canvas-next.hhh2121.xyz/api/canvas` 未登录返回 401 `AUTH_REQUIRED`。
- Chrome headless 公网未登录截图确认科技风登录门禁。
- Chrome headless 公网登录后截图确认 T8 画板主体、后端连接和 ReactFlow 存在。
- 灰度 release `20260605-1215-xinghuan-admin-gray` 已部署。
- `/admin` 可通过灰度域名打开。
- 后台接口未登录返回 401，成员返回 403。
- 后台总览、用户、Provider、模型、任务和系统状态可访问。
- Chrome headless 公网后台截图确认科技风总览页面。
- 灰度 release `20260605-1245-xinghuan-admin-sec-gray` 已部署。
- Provider Key 创建验收只返回脱敏预览，后台数据文件不包含测试 Key 明文。
- 后台数据文件包含 `enc:v1` 加密字段。
- `/api/admin/audit` 返回后台审计记录。
- Chrome headless 公网审计页截图确认审计页可访问且不显示测试 Key 明文。
- 灰度 release `20260605-1315-xinghuan-db-ready-gray` 已部署。
- `node --check scripts/db-migrate.mjs` 通过。
- `npm run db:migrate` 在未配置数据库时返回 `DATABASE_NOT_CONFIGURED`，退出码 2。
- `/api/admin/system` 返回数据库状态字段。
- 后台系统页可见数据库状态。
- 公网管理员登录后 `/api/admin/system` 返回 `databaseStatus=not_configured`、`databaseConfigured=false`、`migrations=0`。
- 灰度服务器 PostgreSQL 16.14 已启用。
- `npm run db:migrate` 在服务器返回 `applied: ["001_admin_core.sql"]`。
- 数据库 `xh_schema_migrations` 包含 `001_admin_core.sql`。
- 公网管理员登录后 `/api/admin/system` 返回 `databaseStatus=connected`、`databaseConfigured=true`、`migrations=["001_admin_core.sql"]`。
- 灰度 release `20260605-1410-xinghuan-pg-repo-gray` 已部署。
- `npm run db:import-files` 在服务器导入 auth/admin 文件数据成功。
- 灰度 `XINGHUAN_STORAGE_DRIVER=postgres` 已启用。
- PostgreSQL repository 下服务器 `npm run verify:single-port` 全部 PASS。
- 公网管理员登录后 `/api/admin/system` 返回 `storageDriver=postgres`。
- PostgreSQL `xh_providers` 明文测试 Key 计数为 0。
- 灰度 release `20260605-1505-xinghuan-worker-queue-gray` 已部署。
- `xinghuan-canvas-next-worker.service` 为 `active`。
- 服务器 `npm run verify:worker` 通过。
- 公网管理员登录后 `/api/admin/system` 返回 `redisStatus=connected`、`redisQueue=xinghuan:tasks`、`redisDepth=0`。

## 发布结论

当前版本已完成本机单端口生产服务 POC、灰度部署准备材料、`canvas-next.hhh2121.xyz` 灰度部署、最小登录/用户隔离、统一后台、Provider Key 加密、密码重置、审计日志、PostgreSQL 首轮迁移、auth/admin PostgreSQL repository 和 Redis/worker 任务队列灰度验收；仍不建议直接切生产域名，必须先完成 Provider Adapter、任务输出素材落库、密钥轮换、生产级审计和画布/素材数据迁移能力。
