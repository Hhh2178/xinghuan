# DEVLOG.md - 无限画布 2.0 开发日志台账

## 日志规则

- 最新记录放在最上方。
- 每次真实推进都必须记录：目标、变更范围、验证证据、影响、风险、下一步。
- 任何选型、部署、回滚、数据结构、节点规范和后台规范变化都要记录。
- 禁止记录真实 API Key、Token、Cookie、SSH Key 和数据库密码。

## 2026-06-05

### PostgreSQL readiness 灰度部署完成

目标:

- 为统一后台补齐 PostgreSQL 表结构和迁移入口。
- 在后台系统页展示数据库配置、连接和迁移状态。
- 将数据库 readiness 部署到灰度环境，但不在 PostgreSQL 尚未启用时强制切换数据源。

变更范围:

- 新增 `apps/api/db/001_admin_core.sql`，覆盖用户、会话、项目、画布、素材、Provider、模型、任务、审计和迁移表。
- 新增 `scripts/db-migrate.mjs` 和根脚本 `npm run db:migrate`。
- `apps/api` 新增数据库状态探测，`/api/admin/system` 返回 `database` 状态对象。
- `apps/admin` 系统页新增数据库状态、迁移状态和错误展示。
- `scripts/verify-single-port.mjs` 覆盖后台系统数据库状态字段。
- `config` 模板预留 `XINGHUAN_DATABASE_URL`。
- 新增运维记录 `ops/gray-db-readiness-2026-06-05.md`。

验证证据:

- 本机 `node --check scripts\db-migrate.mjs` 通过。
- 本机 `node --check scripts\verify-single-port.mjs` 通过。
- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run type-check -w @xinghuan/admin` 通过。
- 本机 `npm run build:single-port` 通过。
- 本机未配置数据库时 `npm run db:migrate` 返回 `DATABASE_NOT_CONFIGURED`，退出码 2，符合预期。
- 本机 `npm run verify:single-port` 通过。
- 本机后台系统页可见 `数据库状态 not_configured`。
- 服务器 release `20260605-1315-xinghuan-db-ready-gray` 已部署。
- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- 服务器 `npm run verify:single-port` 通过。
- 服务器未配置数据库时 `npm run db:migrate` 返回 `DATABASE_NOT_CONFIGURED`，退出码 2，符合预期。
- 公网 `/api/status` 返回 `service=xinghuan-api`、`environment=gray`。
- 公网 `/api/admin/system` 未登录返回 401。
- 管理员登录后 `/api/admin/system` 返回 `databaseStatus=not_configured`、`databaseConfigured=false`、`migrations=0`。

影响:

- 后台已经具备数据库接入前的可观测状态。
- 迁移脚本已经可以作为 PostgreSQL 启用后的标准入口。
- 当前仍保持文件型运行数据，不影响灰度服务连续性。

风险:

- 灰度服务器 PostgreSQL 当前尚未配置连接，因此还没有真实落库。
- 后续切库需要数据迁移策略，不能直接丢弃现有文件型 auth/admin/canvas 数据。
- 数据库连接串属于密钥，不能写入文档、Git 或聊天。

下一步:

- 启用 PostgreSQL 服务、创建灰度数据库和最小权限账号。
- 写入服务器环境变量后执行 `npm run db:migrate`。
- 实现 repository 层和文件数据迁移/切换策略。
- 接入 Redis/worker 任务队列。

### PostgreSQL 灰度启用和首轮迁移完成

目标:

- 在灰度服务器启用 PostgreSQL。
- 创建灰度数据库和专用应用账号。
- 将数据库连接串写入服务器环境文件。
- 执行首轮 schema migration。

变更范围:

- 服务器安装 PostgreSQL 16.14。
- PostgreSQL 仅监听 `127.0.0.1:5432`。
- 创建数据库 `xinghuan_canvas_next`。
- 创建应用账号 `xinghuan_canvas_next`。
- 将 `XINGHUAN_DATABASE_URL` 写入 `/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`，明文未写入仓库和文档。
- 执行 `npm run db:migrate`，应用 `001_admin_core.sql`。
- 新增运维记录 `ops/postgresql-gray-migration-2026-06-05.md`。

验证证据:

- `systemctl is-active postgresql` 返回 `active`。
- `psql --version` 返回 PostgreSQL 16.14。
- `ss -ltnp` 确认 PostgreSQL 监听 `127.0.0.1:5432`。
- `npm run db:migrate` 返回 `ok: true`，`applied: ["001_admin_core.sql"]`。
- 管理员登录后 `/api/admin/system` 返回 `databaseStatus=connected`、`databaseConfigured=true`、`migrations=["001_admin_core.sql"]`。
- 服务器 `npm run verify:single-port` 全部 PASS。
- 数据库 `xh_schema_migrations` 包含 `001_admin_core.sql`。

影响:

- 灰度环境已经具备真实 PostgreSQL schema。
- 后台系统页可以实时观测数据库连接和迁移状态。
- 现有文件型运行数据未被破坏。

风险:

- auth/admin/canvas 仍未切换到 PostgreSQL repository。
- 后续需要设计数据导入、双写或切换策略。
- 数据库账号密码需要纳入后续备份和轮换流程。

下一步:

- 实现 PostgreSQL repository 层。
- 将 auth/admin/canvas 数据迁移进数据库。
- 接入 Redis/worker 和真实任务表。

### 后台 auth/admin PostgreSQL repository 切换完成

目标:

- 将统一后台的用户、会话、Provider、模型、任务和审计数据切到 PostgreSQL repository。
- 保留文件型 fallback，确保本地开发和回滚路径可用。
- 导入灰度现有文件型后台数据。

变更范围:

- `apps/api` 新增 auth/admin PostgreSQL repository。
- `apps/api` 保留 file repository fallback。
- `/api/admin/system` 新增 `storageDriver`。
- `apps/admin` 系统页新增“存储驱动”。
- 新增 `scripts/db-import-files.mjs`。
- 新增 `npm run db:import-files`。
- `config` 模板新增 `XINGHUAN_STORAGE_DRIVER=file`。
- 新增运维记录 `ops/postgresql-repository-cutover-2026-06-05.md`。

验证证据:

- 本机 `node --check scripts\db-import-files.mjs` 通过。
- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run type-check -w @xinghuan/admin` 通过。
- 本机 `npm run build:single-port` 通过。
- 本机 file driver 下 `npm run verify:single-port` 通过。
- 服务器 release `20260605-1410-xinghuan-pg-repo-gray` 已部署。
- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- 服务器 `npm run db:import-files` 导入 users=2、sessions=2、providers=5、models=2、tasks=1、auditLogs=3。
- 服务器设置 `XINGHUAN_STORAGE_DRIVER=postgres` 后服务 active。
- 服务器 `npm run verify:single-port` 全部 PASS。
- 管理员登录后 `/api/admin/system` 返回 `storageDriver=postgres`、`databaseStatus=connected`、`migrations=["001_admin_core.sql"]`。
- 数据库复核 `users=2`、`providers=6`、`audit=4`。
- PostgreSQL `xh_providers` 明文测试 Key 计数为 0，`enc:v1` 加密 Key 计数为 4。

影响:

- 后台核心数据已进入 PostgreSQL。
- 现有自动验收仍覆盖登录、后台权限、Provider Key 脱敏、审计、画布保存、用户隔离和文件上传。
- 画布内容、素材文件和资源库仍保留文件型存储。

风险:

- 画布和资源库 repository 尚未切 PostgreSQL。
- Redis/worker 任务队列尚未接入，`xh_tasks` 当前只承接后台任务记录。
- Provider Adapter 尚未接入真实模型调用。

下一步:

- 设计并接入 Redis/worker 任务队列。
- 实现 Provider Adapter。
- 后续再推进画布/素材元数据 PostgreSQL repository。

### Redis/worker 任务队列灰度部署完成

目标:

- 后台任务从静态记录升级为真实队列闭环。
- API 创建 queued 任务后进入 Redis。
- worker 常驻领取任务并回写 PostgreSQL 状态和日志。

变更范围:

- `apps/api` 新增 Redis 入队和状态探测。
- `/api/admin/system` 新增 `redis` 状态对象。
- `apps/admin` 系统页展示 Redis 状态、队列名、队列深度和错误。
- `apps/admin` 任务页展示更多日志和更新时间。
- `apps/worker` 从占位服务升级为 Redis 队列消费者。
- 新增 `scripts/verify-worker-queue.mjs` 和 `npm run verify:worker`。
- `build:single-port` 纳入 `@xinghuan/worker`。
- 新增 worker systemd 示例和灰度实际服务 `xinghuan-canvas-next-worker.service`。
- 新增运维记录 `ops/worker-queue-gray-deploy-2026-06-05.md`。

验证证据:

- 本机 `node --check scripts\verify-worker-queue.mjs` 通过。
- 本机 `node --check scripts\verify-single-port.mjs` 通过。
- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run type-check -w @xinghuan/admin` 通过。
- 本机 `npm run type-check -w @xinghuan/worker` 通过。
- 本机 `npm run build:single-port` 通过，包含 worker 构建。
- 本机无 Redis/file driver 下 `npm run verify:single-port` 通过。
- 服务器 Redis 为 `active`，`redis-cli ping` 返回 `PONG`。
- 服务器 release `20260605-1505-xinghuan-worker-queue-gray` 已部署。
- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过，`apps/worker/dist/worker.js` 存在。
- 服务器 API 和 worker systemd 服务均为 `active`。
- 服务器 `npm run verify:worker` 通过，worker 将验收任务回写为 `succeeded`。
- 服务器 `npm run verify:single-port` 全部 PASS。
- 公网管理员登录后 `/api/admin/system` 返回 `redisStatus=connected`、`redisQueue=xinghuan:tasks`、`redisDepth=0`。

影响:

- 后台任务已经具备排队、领取、执行、成功/失败回写和日志链路。
- worker 已作为独立 systemd 服务常驻运行。
- 当前执行器仍为 mock，真实模型调用由下一步 Provider Adapter 接入。

风险:

- 当前还没有任务超时、重试次数、取消中断和死信队列。
- worker 执行器尚未接入真实 Provider。
- 输出素材落库还未接入任务结果。

下一步:

- 实现 Provider Adapter 和后台连接测试。
- worker 根据 provider/model 调用 Adapter。
- 任务成功后写入输出素材和资源库。

### 后台安全增强灰度部署完成

目标:

- 补齐统一后台安全底座。
- Provider Key 不明文落盘。
- 管理员可以通过后台重置用户密码。
- 后台关键操作可审计。

变更范围:

- `apps/api` 新增 Provider Key AES-256-GCM 加密存储。
- `apps/api` 新增 `/api/admin/audit`。
- 后台用户、Provider、模型、任务变更写入审计日志。
- `apps/admin` 用户管理增加密码重置。
- `apps/admin` Provider 管理增加 Key 更新和清除。
- `apps/admin` 新增审计页面。
- `config` 模板新增 `XINGHUAN_SECRET_KEY`。
- 新增运维记录 `ops/gray-admin-security-2026-06-05.md`。

验证证据:

- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run type-check -w @xinghuan/admin` 通过。
- 本机 `npm run build:single-port` 通过。
- 本机 `npm run verify:single-port` 通过，包含 Key 脱敏和审计验收。
- 本机 `admin.json` 不包含测试 Key 明文，包含 `enc:v1` 和 `provider.create`。
- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- 服务器 `npm run verify:single-port` 通过。
- 服务器 `admin.json` 不包含测试 Key 明文，包含 `enc:v1` 和 `provider.create`。
- 公网审计页截图 `output/playwright/gray-admin-audit-https.png` 通过。

影响:

- 灰度后台的 Provider Key 已从文件明文升级为加密字段。
- 后台关键操作可在审计页查看。
- 后台具备基础密码重置能力。

风险:

- 当前仍是文件型后台数据。
- `XINGHUAN_SECRET_KEY` 后续需要正式备份和轮换流程。
- 审计日志仍缺少 IP、User-Agent 和请求 ID。

下一步:

- 进入 PostgreSQL 迁移。
- 补充生产级审计字段。
- 接入真实任务队列和 Provider Adapter。

### 统一后台灰度部署完成

目标:

- 完成统一后台 `/admin` 的真实可用版本。
- 后台采用星幻科技风。
- 后台接口必须管理员登录后访问。
- 部署到灰度服务器并完成命令与视觉验收。

变更范围:

- `apps/api` 新增 `/api/admin/*` 管理接口。
- 新增文件型后台数据 `admin.json`。
- 新增管理员守卫：未登录 401，成员 403。
- `apps/admin` 从占位页升级为真实后台应用。
- 单端口服务新增 `/admin` 和 `/admin/assets/*` 静态托管。
- `build:single-port` 纳入 `@xinghuan/admin`。
- 新增部署记录 `ops/gray-admin-deploy-2026-06-05.md`。

验证证据:

- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run type-check -w @xinghuan/admin` 通过。
- 本机 `npm run build:single-port` 通过。
- 本机 `npm run verify:single-port` 通过，包含后台 API 和权限验收。
- 本机 Chrome 截图 `output/playwright/admin-dashboard-local-2.png` 通过。
- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- `xinghuan-canvas-next.service` 为 `active`。
- `/opt/apps/xinghuan-canvas-next/current` 指向 `20260605-1215-xinghuan-admin-gray`。
- 服务器 `npm run verify:single-port` 全部 PASS。
- 公网 Chrome 截图 `output/playwright/gray-admin-dashboard-https.png` 通过。

影响:

- 灰度域名现在可通过 `/admin` 访问统一后台。
- 管理员可查看和维护用户、Provider、模型、任务和系统状态。
- 普通成员不能访问后台数据接口。
- 后台仍使用文件型数据，后续迁移 PostgreSQL。

风险:

- Provider Key 目前仍是文件型存储，后续必须加密。
- 模型 schema 目前是文本配置，后续需要结构化编辑器。
- 任务监控是骨架，后续要接 Redis/worker。

下一步:

- 进入 PostgreSQL 数据模型和迁移层。
- 进入真实任务队列和 Provider Adapter。

### 灰度认证版部署完成

目标:

- 将最小登录、退出、用户隔离和科技风登录门禁部署到 `canvas-next.hhh2121.xyz`。
- 完成服务器命令验收和公网视觉验收。
- 不切换生产域名，不修改内部代理服务。

变更范围:

- 新增灰度认证版 release `20260605-1135-xinghuan-auth-gray`。
- 服务器 `/opt/apps/xinghuan-canvas-next/current` 已指向新 release。
- 服务器 `canvas-next.env` 已配置管理员和成员 bootstrap secret。
- 新增运维记录 `ops/gray-auth-deploy-2026-06-05.md`。
- 更新 `docs/prd/v0.1.0/progress.md`、`changelog.md` 和 `release.md`。

验证证据:

- 本机 `npm run build:single-port` 通过。
- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- `systemctl is-active xinghuan-canvas-next.service` 返回 `active`。
- `readlink /opt/apps/xinghuan-canvas-next/current` 返回新 release 目录。
- `curl -fsS http://127.0.0.1:18200/api/status` 返回 `environment: gray`。
- 服务器 `npm run verify:single-port` 全部 PASS，包含认证和用户隔离验收。
- `sudo nginx -t` 通过。
- `systemctl is-active nginx` 返回 `active`。
- `https://canvas-next.hhh2121.xyz/api/status` 返回 200。
- `https://canvas-next.hhh2121.xyz/api/canvas` 未登录返回 401 `AUTH_REQUIRED`。
- Chrome headless 公网未登录截图 `output/playwright/gray-auth-login-gate-https-cdp.png` 通过。
- Chrome headless 公网登录后截图 `output/playwright/gray-auth-logged-canvas-https.png` 通过。

影响:

- 灰度域名已进入认证版。
- 未登录用户只能看到星幻科技风登录门禁。
- 登录后仍进入 T8 成熟无限画板主体。
- 画布、素材和资源库已按账号隔离。

风险:

- 当前认证仍是文件型最小实现，不是最终数据库认证。
- bootstrap 密码只适合初始化阶段，后续需要正式后台用户管理和密码重置。
- Web bundle 仍存在大 chunk 警告。

下一步:

- 建立统一后台骨架和管理员权限守卫。
- 建立 PostgreSQL 数据模型。
- 建立 Redis/worker 任务队列。
- 接入真实 Provider 调用。

### 本机登录隔离和科技风门禁完成

目标:

- 在保留 T8 成熟无限画板主体 UI 的前提下，补齐星幻平台最小登录能力。
- 先完成本机认证、用户隔离和自动验收，再进入灰度服务器部署。
- 新增平台界面统一采用星幻科技风。

变更范围:

- `apps/api` 新增最小账号、session cookie、登录、退出和当前用户接口。
- `/api/canvas`、`/files`、`/input`、`/output` 等工作区能力需要登录后访问。
- 画布、输入素材、输出素材和资源库改为按用户目录隔离。
- `apps/web` 新增科技风登录门禁和顶部用户/退出入口。
- 前端设置预加载改为登录后执行，避免未登录时产生认证接口噪声。
- `scripts/verify-single-port.mjs` 升级为认证验收流。
- `config/.env.example` 和 `config/canvas-next.env.example` 补充 bootstrap 管理员变量占位。
- `docs/prd/v0.1.0/plan.md` 和 `design.md` 记录任务级计划、视觉验收和统一科技风后台方向。

验证证据:

- `npm run type-check -w @xinghuan/api` 通过。
- `npm run type-check -w @xinghuan/web` 通过。
- `node --check scripts/verify-single-port.mjs` 通过。
- `npm run build:single-port` 通过。
- `npm run verify:single-port` 通过，包含未登录拒绝、管理员登录、成员登录和跨用户画布不可见。
- Chrome headless 本机截图 `output/playwright/auth-login-gate.png` 确认未登录时展示科技风登录页，不渲染画布。

影响:

- 本机已经具备最小公司内部登录隔离形态。
- 后台和后续管理页面的视觉方向固定为星幻科技风。
- T8 原画板主体 UI 保持稳定，不重做节点和画布交互。

风险:

- 当前认证仍是文件型最小实现，后续需要迁移 PostgreSQL。
- 灰度服务器部署认证版本前必须设置真实 bootstrap 管理员密码。
- 真实密码不能写入仓库、文档、日志或聊天输出。

下一步:

- 配置灰度服务器 bootstrap 管理员密码并部署认证版本。
- 补齐独立统一后台骨架和管理员权限守卫。
- 继续推进 PostgreSQL 数据模型和任务队列。

### 灰度服务器部署完成

目标:

- 将星幻无限画布部署到灰度域名 `canvas-next.hhh2121.xyz`。
- 使用服务器单端口服务 `127.0.0.1:18200`。
- 不修改内部代理项目，不切换生产域名。

变更范围:

- 新增灰度部署记录 `ops/gray-deploy-2026-06-05.md`。
- 服务器 release：`20260605-0903-xinghuan-gray`。
- 服务器目录：`/opt/apps/xinghuan-canvas-next/releases/20260605-0903-xinghuan-gray`。
- systemd 服务：`xinghuan-canvas-next.service`。
- Nginx 站点：`canvas-next.hhh2121.xyz`。
- HTTP/HTTPS 均代理到 `127.0.0.1:18200`。

验证证据:

- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- 首次 systemd 启动失败后，修复 `build:single-port` 未构建 workspace 运行时依赖的问题。
- `systemctl is-active xinghuan-canvas-next` 返回 `active`。
- `systemctl is-active nginx` 返回 `active`。
- `sudo nginx -t` 通过。
- 服务器 `npm run verify:single-port` 8 项全部 PASS。
- `http://canvas-next.hhh2121.xyz/` 返回 200。
- `http://canvas-next.hhh2121.xyz/api/status` 返回 `xinghuan-api`。
- `https://canvas-next.hhh2121.xyz/` 返回 200。
- `https://canvas-next.hhh2121.xyz/api/status` 返回 `xinghuan-api`。
- Chrome headless 截图 `output/playwright/gray-canvas-next-https.png`。
- Chrome DOM dump 确认 `星幻无限画布`、`后端已连接` 和 `react-flow` 存在，并且不包含旧开发端口。

影响:

- 灰度域名已可用于后续真实用户流和后台/登录/任务队列联调。
- 生产域名仍未切换。
- 内部代理服务未修改。

风险:

- 当前灰度仍是无登录、无数据库、无任务队列的 POC 服务。
- Web bundle 仍存在大 chunk 警告，后续需要分包优化。
- RH 节点分组仍按用户要求暂不处理。

下一步:

- 进入登录、用户隔离、数据库、任务队列和真实 Provider 调用阶段。

### 灰度部署准备材料完成

目标:

- 在本机单端口验收后，补齐灰度部署前的可执行材料。
- 让后续部署到 `canvas-next.hhh2121.xyz` 时有明确启动脚本、环境模板、Nginx/systemd 示例、runbook 和验收清单。

变更范围:

- 根 `package.json` 新增：
  - `build:single-port`
  - `start:single-port`
  - `verify:single-port`
- 新增 `scripts/start-single-port.mjs`，跨平台启动 `apps/api/dist/server.js` 并设置单端口默认环境。
- 新增 `scripts/verify-single-port.mjs`，自动验证 Web、API、画布保存读取、文件上传访问和 SPA fallback。
- 更新 `config/.env.example`，默认端口改为 `18200` 并补充 `XINGHUAN_WEB_DIST_DIR`。
- 新增 `config/canvas-next.env.example`。
- 新增 `ops/gray-deploy-runbook.md`。
- 新增 `ops/gray-acceptance-checklist.md`。
- 新增 `ops/nginx/canvas-next.hhh2121.xyz.conf.example`。
- 新增 `ops/systemd/xinghuan-canvas-next.service.example`。
- 更新 `ops/README.md` 的灰度材料索引。

验证证据:

- `node --check scripts/start-single-port.mjs` 通过。
- `node --check scripts/verify-single-port.mjs` 通过。
- `npm run build:single-port` 通过。
- 使用 `npm run start:single-port` 启动后，`127.0.0.1:18200` 监听。
- `npm run verify:single-port` 全部 PASS：
  - `GET /`
  - `GET /api/status`
  - `POST /api/canvas`
  - `PUT /api/canvas/:id`
  - `GET /api/canvas/:id`
  - `POST /api/files/upload`
  - `GET uploaded file`
  - `SPA fallback`
- 相关监听端口确认仅 `18200` 存在。
- 静态扫描灰度文档和配置，未发现禁止使用的批量删除命令。

影响:

- 后续灰度部署可以直接按 runbook 进入服务器执行。
- 本机和服务器都可以复用同一套单端口启动/验收脚本。

风险:

- 当前仍未实际部署到服务器。
- HTTPS 证书配置需要在 HTTP 灰度可用后单独处理。
- systemd 和 Nginx 示例仍需在服务器实际路径上二次确认。

下一步:

- 进入服务器灰度部署实施，目标为 `canvas-next.hhh2121.xyz`。

### 本机单端口生产服务验收

目标:

- 将本机迁移期的 Web/API/T8 兼容后端多端口形态收敛为 `18200` 单端口生产服务。
- 证明关闭 Vite dev server 和 T8 兼容后端后，星幻仍可打开 Web、访问 API、保存画布和访问素材文件。

变更范围:

- `apps/api/src/server.ts` 增加 `apps/web/dist` 静态文件托管。
- 增加 SPA fallback，非 API/文件路径的 GET 请求回退到 `index.html`。
- 扩展静态资源 MIME，覆盖 HTML、JS、CSS、SVG、JSON、字体和 MIDI。
- 保留 `/api/*`、`/files/*`、`/input/*`、`/output/*` 优先匹配，避免前端 fallback 吞掉接口错误。

验证证据:

- `npm run type-check -w @xinghuan/api` 通过。
- `npm run build -w @xinghuan/api` 通过。
- `npm run build -w @xinghuan/web` 通过，存在大 chunk 警告但不阻塞生产服务验收。
- 启动 `127.0.0.1:18200`，显式指定 `XINGHUAN_WEB_DIST_DIR` 和 `XINGHUAN_DATA_DIR`。
- 停止 `18300`、`18310`、`18766` 后，仅 `18200` 保持监听。
- `GET /` 返回 200 且包含 React root。
- `GET /assets/*.js` 返回 200。
- `GET /api/status` 返回 `xinghuan-api`。
- `POST /api/canvas` 创建 `单端口验收画布`。
- `PUT /api/canvas/:id` 保存 1 个测试节点，随后 `GET /api/canvas/:id` 读取到 1 个节点。
- `POST /api/files/upload` 上传文件成功，返回 `/files/input/up_*.json`，该文件通过同端口返回 200。
- `GET /workspace/deep/link` 通过 SPA fallback 返回 200。
- Chrome headless 截图保存到 `output/playwright/single-port-18200-chrome.png`。
- Chrome DOM dump 确认包含 `星幻无限画布`、`后端已连接` 和 `react-flow`，且不包含 `18300`、`18310`、`18766`。

影响:

- 本机已经具备后续服务器灰度所需的单 upstream 形态。
- Nginx 后续可以只代理 `127.0.0.1:18200` 到灰度域名。
- 画板仍继续采用 T8 成熟 UI，不在本阶段重做画板。

风险:

- 真实模型执行、用户登录、数据库隔离和任务队列仍未进入本阶段。
- Web 构建存在大 chunk 警告，后续需要做代码分包和资源体积优化。
- RH 节点分组仍可见，本阶段按用户要求暂不处理。

下一步:

- 进入灰度部署准备：整理启动脚本、Nginx upstream、systemd 服务和回滚清单。
- 补充服务器部署前密钥、数据目录和日志目录规范。

## 2026-06-04

### T8 成熟画板 UI 迁移方向纠偏

目标:

- 根据用户需求明确 `apps/web` 不从头重做画板 UI。
- 将当前占位画板降级为工程骨架验证，正式方向改为迁移 T8 成熟前端。

变更范围:

- 新增 `development/t8-ui-migration.md`。

验证证据:

- 已确认 T8 前端入口为 `src/main.tsx` 和 `src/App.tsx`。
- 已确认 T8 画板核心为 `src/components/Canvas.tsx`。
- 已确认 T8 前端包含 `components`、`stores`、`services`、`theme`、`types`、`utils` 等完整结构。

影响:

- 后续不继续强化当前占位画板。
- `apps/web` 下一步迁入 T8 前端成熟 UI，再做星幻品牌、主题和 API 适配。

风险:

- T8 前端仍包含大量旧品牌和旧后端 API 绑定。
- 迁入后可能出现依赖和路径别名问题。

下一步:

- 将 T8 `src/` 迁入 `apps/web/src/`。
- 补齐依赖和 Vite 配置。
- 先让 T8 画板 UI 在星幻 worktree 中跑起来。

进展补充:

- 已完成 T8 `src/` 到 `apps/web/src/` 的迁入。
- 已补齐前端依赖和 Vite alias/proxy。
- `npm run type-check -w @xinghuan/web` 通过。
- `npm run build -w @xinghuan/web` 通过。
- `apps/web` 已在 `127.0.0.1:18310` 显示 T8 成熟画板 UI。
- 当前仍存在旧品牌词和 T8 后端依赖，下一步进入品牌与 API 适配。

修复补充:

- 补齐 `apps/web/tailwind.config.js`、`apps/web/postcss.config.js` 和 Tailwind/PostCSS 依赖，修复迁移后页面散乱问题。
- 默认主题改为 `tech-default`，并使用新的星幻主题缓存 key。
- 浏览器确认科技风 token 生效：`#09090b`、`#0a0a0b`、`#38bdf8`。
- 顶部品牌已统一为 `星幻无限画布`。
- 顶部外部推广入口已不再渲染。
- 侧栏底部版本标识已改为星幻。
- 当前 `RH`、`RunningHub` 仍作为节点分组/节点名称出现，下一步单独处理。
- 新增星幻 API 兼容层，画布列表、创建、读取、保存已从 T8 后端切换到 `apps/api`。
- Web `/api` 代理已切到 `127.0.0.1:18300`。
- 浏览器确认 `apps/web` 通过星幻 API 显示 `星幻测试画布` 和 `1 个节点`。
- 补充服务器部署演进记录：先本机单端口生产服务，再部署灰度 `canvas-next.hhh2121.xyz`，最后再生产切换。
- 新增文件与资源接口迁移：`/files`、`/input`、`/output` 和资源库最小 CRUD 已接入星幻 API。
- Web `/files`、`/input`、`/output` 代理已切到 `127.0.0.1:18300`。
- 命令验证文件上传、文件访问、资源写入和资源查询通过。

### Milestone B 星幻工程基线

目标:

- 创建星幻正式工程骨架，不再以 T8 研究仓库作为产品主干。
- 建立 Web、Admin、API、Worker 和共享包边界。
- 验证默认科技风工作台和统一后台首屏。

变更范围:

- 新增根 `package.json` 和 `tsconfig.base.json`。
- 新增 `config/.env.example`。
- 新增 `apps/web`。
- 新增 `apps/admin`。
- 新增 `apps/api`。
- 新增 `apps/worker`。
- 新增 `packages/shared`、`packages/ui`、`packages/canvas-core`、`packages/model-core`。
- 新增 `development/milestone-b-baseline.md`。

验证证据:

- `npm install` 成功，审计结果 0 vulnerabilities。
- `npm run type-check` 通过。
- `npm run build` 通过。
- `npm run start -w @xinghuan/worker` 通过。
- API `/health` 和 `/api/version` 返回 `ok: true`。
- Web `http://127.0.0.1:18310` 可打开。
- Admin `http://127.0.0.1:18320` 可打开。
- 浏览器 DOM 验证 Web/Admin 均包含星幻核心文案，且不包含 T8、企鹅、贞贞、RunningHub、RH风格。

影响:

- 星幻正式工程从独立 worktree 起步，避免污染主项目文档仓库和 T8 研究仓库。
- 服务器开发策略保持为本机开发、灰度服务器验收。
- 后续可以在此基线上引入真实画布、认证、数据库、后台 CRUD 和任务队列。

风险:

- 当前只是工程基线，占位 UI 未接入真实 ReactFlow。
- 截图文件落盘时出现浏览器截图超时，需后续补充稳定截图脚本。
- 尚未实现登录、数据库、Redis、对象存储和真实 Provider 调用。

下一步:

- 增加稳定浏览器截图验收。
- 接入真实画布核心组件。
- 设计并实现 API 路由边界和认证中间件。

### 本机真实测试密钥落地

目标:

- 将用户提供的 GRSAI 和 ToAPIs 测试 Key 放入 2.0 本机环境文件，方便后续 POC 直接读取。

变更范围:

- 新建 `.env.local`，写入 GRSAI 与 ToAPIs 的本机测试环境变量。
- 验证 `.env.local` 被 `.gitignore` 忽略。
- 文档和 Git 提交中不记录真实 Key 值。

验证证据:

- `git check-ignore -v .env.local` 确认 `.env.local` 命中忽略规则。

影响:

- 后续本机开发和 POC 可以从 `.env.local` 读取 `GRSAI_API_KEY`、`TOAPIS_API_KEY` 等变量。
- Git 仓库不会追踪 `.env.local`。

风险:

- 若后续手动强制添加被忽略文件，仍可能造成密钥泄露；提交前必须继续做密钥扫描。

下一步:

- 进入候选基底评估和 POC 准备。

### Git 仓库初始化与密钥忽略规则补充

目标:

- 将无限画布 2.0 初始化为独立 Git 仓库。
- 明确真实 API Key 的忽略规则和放置方式。

变更范围:

- 更新 `.gitignore`，用中文标注本机密钥、运行期输出、依赖、构建产物和系统噪音。
- 新增 `config/secrets-placement.md`，说明 GRSAI 和 ToAPIs 测试密钥应进入 `.env.local`、服务器环境变量或后台加密字段。
- 不把真实 Key 写入 Markdown 文档。

验证证据:

- Git 仓库已初始化。
- 本仓库本地提交身份设置为 `Codex <codex@local>`，不影响全局 Git 配置。
- 初始提交：`5f1dc08 docs: initialize infinite canvas 2 project`。
- `.env`、`.env.local`、`config/.env.local` 已验证会被 `.gitignore` 忽略。
- 提交前密钥扫描无命中。

影响:

- 2.0 文档可以进入 Git 追踪。
- 真实密钥文件默认不被 Git 追踪。

风险:

- 若手动强制 `git add -f .env.local` 仍可能泄露；后续应增加提交前密钥扫描。

下一步:

- 建立候选基底评估表。
- 创建后续 POC 分支或工作区。

### 测试服务商与服务器状态记录

目标:

- 将 2.0 首批测试服务商、文档地址、模型名称和密钥存放策略落到项目文件夹。
- 将当前腾讯云服务器、旧项目服务和磁盘空间状态写入 2.0 运维记录。

变更范围:

- 新增 `config/.env.local.example`，用于本地填写真实密钥。
- 新增 `config/provider-test-matrix.md`，记录 GRSAI 和 ToAPIs 的测试用途、文档地址、模型和验收重点。
- 新增 `ops/server-state-2026-06-04.md`，记录服务器磁盘、旧项目目录占用、服务状态、端口和对 2.0 的影响。
- 更新 `MEMORY.md`，补充测试服务商和服务器状态快照索引。
- 新增 `.gitignore`，默认忽略 `.env` 和 `.env.*`，避免真实密钥进入 Git。

验证证据:

- 通过 SSH 采集服务器状态：旧灰度 release 为 `5148170`，Web、worker、Redis、Nginx 和内部代理服务均为 `active`。
- 根分区当前约 `59G`，已用 `46G`，可用 `11G`，使用率 `81%`。
- 旧灰度项目 `/opt/apps/canvas-enterprise-next` 当前约 `23G`。
- 本地密钥扫描无命中。

影响:

- 真实 API Key 未写入 Markdown 文档。
- 2.0 后续接入 Provider 时可直接参考测试矩阵和 `.env.local.example`。

风险:

- 磁盘空间偏紧，后续部署 2.0 前需要决定是否清理旧 release。
- 清理旧项目必须逐项确认，禁止批量删除。

下一步:

- 建立候选基底评估表。
- 决定 2.0 POC 是否复用旧灰度域名或使用新端口/新子域名。

### v0.1.0 新项目立项文档初始化

目标:

- 放弃旧 Node Banana 改造路线，建立“无限画布 2.0”新项目文档和治理入口。
- 将完整需求、关键经验、限制条件、验收标准和后续选型路线沉淀为可执行文件。

变更范围:

- 新增 `AGENTS.md`，定义项目协作规则、工程规则、安全规则和当前状态。
- 新增 `MEMORY.md`，记录 2.0 项目记忆、旧项目放弃原因、核心需求、关键决策和服务器信息。
- 新增 `DEVLOG.md`，建立开发日志台账。
- 新增 `docs/prd/v0.1.0/` 初始 PRD、SPEC、设计、计划、进度、发布、变更和决策文档。
- 新增 `ops/`、`config/`、`development/`、`research/` 目录，为后续运维、配置、开发和调研留出位置。

验证证据:

- 文件已创建在 `D:\codex\无限画布2.0`。
- 当前不涉及代码构建、测试或服务器部署。

影响:

- 2.0 从文档层面成为新的项目主线。
- 旧 `D:\codex\服务器\无限画布` 不再作为后续功能开发主干。

风险:

- 还未完成候选基底 POC，技术路线尚未锁定。
- 旧项目中已完成的后端能力不能直接视为可复用，需要逐项评估迁移价值。

下一步:

- 建立候选基底评估表。
- 对候选项目进行许可证、节点体系、执行引擎、前后端结构和部署可行性评估。
- 选择 1-2 个候选做最小 POC。
