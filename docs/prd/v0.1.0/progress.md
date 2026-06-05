# v0.1.0 Progress

## 当前状态

状态：灰度统一后台、后台安全底座、PostgreSQL repository 和 Redis/worker 任务队列已部署并验收通过；下一步进入 Provider Adapter 和输出素材闭环阶段。

无限画布 2.0 已作为新项目初始化文档。旧 Node Banana 改造项目被明确放弃作为后续主干。当前已建立星幻正式工程基线，并将 T8 成熟画板 UI 迁入 `apps/web`。本机生产形态已收敛为 `apps/api` 单端口服务，后续可进入服务器灰度部署准备。

## 已完成

- 创建 2.0 项目目录。
- 建立 `AGENTS.md`。
- 建立 `MEMORY.md`。
- 建立 `DEVLOG.md`。
- 建立 `docs/prd/v0.1.0/` 文档集。
- 明确旧项目不再作为继续开发主干。
- 明确核心产品方向：通用生成节点、模型后台、云端项目、用户隔离、任务系统和素材空间。
- 建立首批测试服务商矩阵：GRSAI `gpt-image-2` 和 ToAPIs Grok Video。
- 建立 `.env.local.example`，明确真实 Key 只进本地未提交环境文件、服务器环境变量或后台加密字段。
- 记录 `2026-06-04` 腾讯云服务器状态和旧项目空间占用。
- 创建 Milestone B 独立 worktree：`D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b`。
- 建立星幻 monorepo 工程骨架。
- 建立 Web 工作台占位页。
- 建立 Admin 统一后台占位页。
- 建立 API health/version。
- 建立 Worker 占位服务。
- 建立共享包：`shared`、`ui`、`canvas-core`、`model-core`。
- 迁入 T8 成熟画板 UI 到 `apps/web`。
- 修复 T8 前端迁移后的 Tailwind/PostCSS 样式散乱问题。
- 默认主题切换为星幻科技风。
- 顶部品牌改为 `星幻无限画布`，顶部外部推广入口不再渲染。
- 实现星幻 API 兼容层，画布列表、创建、读取、保存已切到 `apps/api`。
- `/files`、`/input`、`/output` 和资源库最小 CRUD 已切到星幻 API。
- 实现 `apps/api` 托管 `apps/web/dist` 的本机单端口生产服务。
- 关闭 `18300`、`18310`、`18766` 后，`18200` 单端口命令验收和 Chrome 浏览器验收通过。
- 新增 `build:single-port`、`start:single-port`、`verify:single-port` 脚本。
- 新增本机/服务器复用的单端口启动脚本和自动验收脚本。
- 新增灰度环境模板 `config/canvas-next.env.example`。
- 新增灰度部署 runbook、灰度验收清单、Nginx 示例和 systemd 示例。
- 已部署灰度 release `20260605-0903-xinghuan-gray` 到 `canvas-next.hhh2121.xyz`。
- 已启用服务器 systemd 服务 `xinghuan-canvas-next.service`。
- 已配置 Nginx HTTP/HTTPS 到 `127.0.0.1:18200`。
- 已完成公网 HTTP/HTTPS、API、Web、文件上传、SPA fallback 和 Chrome 视觉验收。
- 已实现本机最小登录、退出和当前用户接口。
- 已实现 Web 登录守卫，未登录时展示星幻科技风登录页。
- 已实现画布、输入素材、输出素材和资源库的用户目录隔离。
- 已将自动验收脚本升级为认证流，覆盖未登录拒绝、管理员登录、成员登录和跨用户画布不可见。
- 已明确登录、后台和新增管理界面统一采用星幻科技风；T8 画板主体暂不重做 UI。
- 已部署灰度认证版 release `20260605-1135-xinghuan-auth-gray`。
- 已在服务器灰度环境配置管理员/成员 bootstrap secret，未写入仓库和文档明文。
- 已完成服务器认证流验收和公网 HTTPS 视觉验收。
- 已实现统一后台 `/admin`。
- 已实现后台管理员权限守卫，未登录返回 401，成员返回 403。
- 已实现用户管理、Provider 管理、模型目录、任务监控和系统状态。
- 已部署灰度后台版 release `20260605-1215-xinghuan-admin-gray`。
- 已完成服务器后台自动验收和公网后台视觉验收。
- 已实现 Provider Key 加密落盘和脱敏返回。
- 已实现后台用户密码重置入口。
- 已实现后台审计日志 API 和审计页面。
- 已部署灰度后台安全增强 release `20260605-1245-xinghuan-admin-sec-gray`。
- 已验证本机和服务器 `admin.json` 不包含测试 Key 明文，并包含 `enc:v1` 加密字段。
- 已新增 PostgreSQL 基础 schema `apps/api/db/001_admin_core.sql`。
- 已新增数据库迁移脚本 `scripts/db-migrate.mjs` 和 `npm run db:migrate`。
- 已在 `/api/admin/system` 和后台系统页展示数据库状态。
- 已将自动验收脚本扩展到后台系统数据库状态字段。
- 已部署灰度数据库 readiness release `20260605-1315-xinghuan-db-ready-gray`。
- 已验证本机和服务器未配置数据库时 `npm run db:migrate` 返回 `DATABASE_NOT_CONFIGURED`，退出码 2，符合预期。
- 已验证灰度公网管理员登录后 `/api/admin/system` 返回 `databaseStatus=not_configured`。
- 已在灰度服务器安装并启用 PostgreSQL 16.14。
- 已创建灰度数据库 `xinghuan_canvas_next` 和应用账号 `xinghuan_canvas_next`。
- 已将数据库连接串写入服务器环境文件，未写入仓库或文档。
- 已执行服务器 `npm run db:migrate`，应用 `001_admin_core.sql`。
- 已验证公网管理员登录后 `/api/admin/system` 返回 `databaseStatus=connected`、`databaseConfigured=true`、`migrations=["001_admin_core.sql"]`。
- 已实现 auth/admin PostgreSQL repository，并保留 file fallback。
- 已新增 `scripts/db-import-files.mjs` 和 `npm run db:import-files`。
- 已在后台系统页展示 `storageDriver`。
- 已部署灰度 repository release `20260605-1410-xinghuan-pg-repo-gray`。
- 已导入灰度现有 users=2、sessions=2、providers=5、models=2、tasks=1、auditLogs=3。
- 已将灰度 `XINGHUAN_STORAGE_DRIVER` 切换为 `postgres`。
- 已验证服务器 `npm run verify:single-port` 在 PostgreSQL repository 下全部 PASS。
- 已实现 Redis 任务入队和系统状态探测。
- 已将 `apps/worker` 升级为 Redis 队列消费者。
- 已新增 `npm run verify:worker`。
- 已部署灰度任务队列 release `20260605-1505-xinghuan-worker-queue-gray`。
- 已新增并启用 `xinghuan-canvas-next-worker.service`。
- 已验证服务器 `npm run verify:worker` 通过，worker 将任务回写为 `succeeded`。
- 已验证公网系统接口返回 `redisStatus=connected`、`redisQueue=xinghuan:tasks`、`redisDepth=0`。

## 进行中

- Phase 1 基础平台。
- Provider Adapter 和后台连接测试。
- 真实画布组件边界与后续节点治理设计。

## 待办

- 实现 Provider Adapter。
- 将任务输出写入输出素材和资源库。
- 建立 Redis/worker 任务队列。
- 生产切换前准备 `canvas.hhh2121.xyz` 和 `127.0.0.1:18100`。

## 风险

- 选型错误会再次导致后续改造失效。
- 旧项目中部分已实现能力可能诱导继续复用，但复用成本未必低。
- 外部 API 文档和模型参数可能经常变化，需要后台 schema 有足够弹性。
- Web 生产包存在大 chunk 警告，后续需要分包和资源体积优化。
- RH 节点分组仍可见，本阶段按用户要求暂不处理。
- 当前认证、后台和画布仍是文件型运行数据，后续需要迁移到 PostgreSQL repository。
- bootstrap 密码只适合初始化阶段，后续需要正式密码轮换、审计扩展和数据库迁移。
- `XINGHUAN_SECRET_KEY` 需要纳入正式密钥备份和轮换流程。

## 验证状态

- 已执行 `npm install`、`npm run type-check`、`npm run build`。
- 已验证 API `/health`、`/api/version`。
- 已验证 Web/Admin 本机浏览器首屏。
- 已执行 `npm run type-check -w @xinghuan/api`。
- 已执行 `npm run build -w @xinghuan/api`。
- 已执行 `npm run build -w @xinghuan/web`。
- 已验证关闭 `18300`、`18310`、`18766` 后仅 `18200` 监听。
- 已验证 `http://127.0.0.1:18200/`、`/api/status`、静态 JS、SPA fallback、画布创建/保存/读取、文件上传/访问。
- 已通过 Chrome headless 生成 `output/playwright/single-port-18200-chrome.png`，DOM dump 确认品牌、后端连接和 ReactFlow 画布存在。
- 已执行 `node --check scripts/start-single-port.mjs`。
- 已执行 `node --check scripts/verify-single-port.mjs`。
- 已执行 `npm run build:single-port`。
- 已使用 `npm run start:single-port` 启动单端口服务。
- 已执行 `npm run verify:single-port`，8 项自动验收全部 PASS。
- 已静态扫描灰度文档和配置，未发现禁止使用的批量删除命令。
- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- `systemctl is-active xinghuan-canvas-next` 返回 `active`。
- `systemctl is-active nginx` 返回 `active`。
- `sudo nginx -t` 通过。
- `https://canvas-next.hhh2121.xyz/` 和 `/api/status` 返回 200。
- Chrome headless 公网截图和 DOM dump 通过。
- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run type-check -w @xinghuan/web` 通过。
- 本机 `node --check scripts/verify-single-port.mjs` 通过。
- 本机 `npm run build:single-port` 通过。
- 本机认证版 `npm run verify:single-port` 通过，包含管理员/成员隔离验收。
- Chrome headless 本机截图 `output/playwright/auth-login-gate.png` 确认科技风登录门禁存在，未登录时画布不渲染。
- 灰度服务器 `npm ci` 通过，0 vulnerabilities。
- 灰度服务器 `npm run build:single-port` 通过。
- 灰度服务器 `npm run verify:single-port` 通过，包含认证和用户隔离验收。
- 灰度公网 `/api/canvas` 未登录返回 401 `AUTH_REQUIRED`。
- 灰度公网未登录截图 `output/playwright/gray-auth-login-gate-https-cdp.png` 通过。
- 本机 `node --check scripts\db-migrate.mjs` 通过。
- 本机 `npm run db:migrate` 在未配置数据库时按预期返回 `DATABASE_NOT_CONFIGURED`。
- 本机后台系统页 DOM 验证可见 `数据库状态 not_configured`。
- 灰度服务器 release `20260605-1315-xinghuan-db-ready-gray` 已部署并 active。
- 灰度服务器 `npm run verify:single-port` 通过，包含 `GET /api/admin/system database status`。
- 灰度服务器 `npm run db:migrate` 在未配置数据库时按预期返回 `DATABASE_NOT_CONFIGURED`。
- 公网管理员登录后 `/api/admin/system` 返回 `databaseStatus=not_configured`、`databaseConfigured=false`、`migrations=0`。
- `systemctl is-active postgresql` 返回 `active`。
- `psql --version` 返回 PostgreSQL 16.14。
- 服务器 `npm run db:migrate` 返回 `applied: ["001_admin_core.sql"]`。
- 数据库 `xh_schema_migrations` 包含 `001_admin_core.sql`。
- 公网管理员登录后 `/api/admin/system` 返回 `databaseStatus=connected`、`databaseConfigured=true`、`migrations=["001_admin_core.sql"]`。
- 本机 `node --check scripts\db-import-files.mjs` 通过。
- 本机 file driver 下 `npm run verify:single-port` 通过。
- 服务器 `npm run db:import-files` 通过。
- 服务器 PostgreSQL repository 下 `npm run verify:single-port` 全部 PASS。
- 公网管理员登录后 `/api/admin/system` 返回 `storageDriver=postgres`。
- PostgreSQL `xh_providers` 明文测试 Key 计数为 0。
- 本机 `node --check scripts\verify-worker-queue.mjs` 通过。
- 本机 `npm run type-check -w @xinghuan/worker` 通过。
- 本机 `npm run build:single-port` 通过，包含 worker 构建。
- 服务器 `xinghuan-canvas-next-worker.service` 为 `active`。
- 服务器 `npm run verify:worker` 通过。
- 公网管理员登录后 `/api/admin/system` 返回 `redisStatus=connected`、`redisDepth=0`。
- 灰度公网登录后截图 `output/playwright/gray-auth-logged-canvas-https.png` 通过。
- 本机 `npm run type-check -w @xinghuan/admin` 通过。
- 本机后台版 `npm run verify:single-port` 通过，包含后台静态页、后台 API 和成员拒绝验收。
- 灰度服务器后台版 `npm run verify:single-port` 通过。
- 公网后台截图 `output/playwright/gray-admin-dashboard-https.png` 通过。
- 灰度服务器后台安全增强版 `npm run verify:single-port` 通过。
- 公网审计页截图 `output/playwright/gray-admin-audit-https.png` 通过。
- 公网审计页 DOM 确认不包含测试 Key 明文。

## 更新日志

- 2026-06-05：完成后台安全增强，Provider Key 加密、密码重置和审计日志已灰度部署并验收。
- 2026-06-05：完成统一后台 `/admin` 和灰度部署，后台总览、用户、Provider、模型、任务和系统状态已通过验收。
- 2026-06-05：完成灰度认证版部署，`canvas-next.hhh2121.xyz` 已通过 HTTPS 登录门禁、用户隔离、文件上传和公网视觉验收。
- 2026-06-05：本机完成最小登录、退出、用户隔离和科技风登录门禁，自动验收脚本升级为认证流。
- 2026-06-05：完成灰度服务器部署，`canvas-next.hhh2121.xyz` 已通过 HTTP/HTTPS、API、Web 和浏览器视觉验收。
- 2026-06-05：完成灰度部署准备材料，补齐启动脚本、自动验收脚本、环境模板、Nginx/systemd 示例、runbook 和验收清单。
- 2026-06-05：完成本机单端口生产服务实现和验收，`18200` 可独立服务 Web、API、文件和前端路由。
- 2026-06-04：补充测试服务商矩阵、密钥存放策略和服务器状态快照。
- 2026-06-04：启动 Milestone B，创建星幻正式工程基线。
- 2026-06-04：初始化 v0.1.0 文档和项目记忆。
