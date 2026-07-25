# 星幻画布服务器与域名整体迁移执行计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不迁移用户已生成图片、视频、音频等媒体二进制的前提下，把星幻画布的 Gray、Production、PostgreSQL、Redis、Provider/Agent/Admin 配置、域名映射、公网 Provider 文件回抓链路和全部运行功能迁移到新服务器与新域名，并完成可回滚的切换验收。

**Architecture:** 采用“新服务器并行建设、Gray 先验收、Production 后切换、旧服务器保留回滚窗口”的迁移方式。代码使用当前已验收的 release 归档部署，不复制 `node_modules`、运行日志或用户媒体；业务数据库完整备份恢复，但对指向未迁移媒体的 artifact/asset 元数据执行显式清理或 `missing` 标记，避免新站展示悬空 URL。新域名拆出 Production、Gray 和 Provider 文件公网出口三个用途，Provider 文件出口保留 `/api/provider-files/{scope}/...` 的环境隔离和签名校验。

**Tech Stack:** Node.js 20.x、npm lockfile、PostgreSQL 16、Redis 7、Nginx、systemd、Cloudflare DNS/TLS、项目 `release:gray:*` 与 `release:retention:*` Harness。

## Global Constraints

- 只迁移项目，不迁移其他内部代理项目、Hermes、无关 DNS 或无关数据库。
- Gray 和 Production 必须使用独立目录、环境文件、数据库、Redis queue 前缀和端口。
- 真实密钥、数据库连接串、Provider API Key、Cloudflare Token、SSH 私钥只存在目标服务器安全存储，不写入 Git、计划文档、日志或聊天。
- `XINGHUAN_SECRET_KEY` 默认保持不变，否则无法读取数据库中已加密的 Provider Key；如需轮换，必须另立密钥轮换计划。
- 用户生成的图片、视频、音频、上传素材和其他媒体二进制不迁移；新站不能把缺失媒体伪装成可访问文件。
- Redis 中 queued/running 运行态不直接搬迁；切换前必须排空、取消或重新入队，并记录数量。
- 不在本计划中执行 Production 删除；旧服务器在切换后保留只读回滚窗口。
- 视觉验收只做 PC 端 `1920x1080`；不增加手机、平板或其他比例矩阵。

---

## 1. 执行参数与最终映射

迁移前由负责人把以下变量写入**私有执行表**或本地未跟踪环境，不要写入仓库。命令示例统一使用这些变量，禁止把未确认值直接替换进脚本。

```bash
export NEW_SERVER_IP="已确认的新服务器公网 IPv4"
export NEW_SSH_USER="ubuntu"
export NEW_SSH_PORT="728 或目标服务器 SSH 端口"
export NEW_PROD_DOMAIN="Production 新域名"
export NEW_GRAY_DOMAIN="Gray 新域名"
export NEW_FILES_DOMAIN="Provider 文件公网出口新域名"
export NEW_PROD_DB="新 Production PostgreSQL 数据库名"
export NEW_GRAY_DB="新 Gray PostgreSQL 数据库名"
export NEW_PROD_DB_URL="新 Production 数据库连接串，仅在服务器环境中设置"
export NEW_GRAY_DB_URL="新 Gray 数据库连接串，仅在服务器环境中设置"
```

当前源站基线（只读核对，不要直接当作目标值）：

| 项目 | 当前值 | 迁移后要求 |
|---|---|---|
| Production 站点 | `canvas.hhh2121.xyz` -> `127.0.0.1:18100` | `$NEW_PROD_DOMAIN` -> 新服务器 Production 端口 |
| Gray 站点 | `canvas-next.hhh2121.xyz` -> `127.0.0.1:18200` | `$NEW_GRAY_DOMAIN` -> 新服务器 Gray 端口 |
| Provider 文件出口 | `files.hhh2121.xyz`，按 `/gray`、`/production` 分流 | `$NEW_FILES_DOMAIN`，继续按 scope 分流 |
| Production 数据库 | `xinghuan_canvas_next` | `$NEW_PROD_DB`，不能与 Gray 相同 |
| Gray 数据库 | `xinghuan_canvas_gray` | `$NEW_GRAY_DB`，不能与 Production 相同 |
| Production queue | `xinghuan:tasks:prod` | 保持独立前缀 |
| Gray queue | `xinghuan:tasks` | 保持独立前缀 |
| Production 数据目录 | `/opt/apps/xinghuan-canvas/shared/data` | 新服务器 Production shared data |
| Gray 数据目录 | `/opt/apps/xinghuan-canvas-next/shared/data` | 新服务器 Gray shared data |
| Production 回滚 | `20260722-canvas-revision-observability-prod-r1-v0718` | 迁移期间保留旧服务器和新服务器上一版 |
| 当前制品 | `v0.7.44`，`20260725-ai-governance-runtime-current-*` | 复用 Gray 已验收制品，不重新编译出不同代码 |

### 1.1 公网 URL 迁移后的固定语义

- 用户主站：`https://$NEW_PROD_DOMAIN/`。
- Gray 主站：`https://$NEW_GRAY_DOMAIN/`。
- Provider 回抓：`https://$NEW_FILES_DOMAIN/api/provider-files/gray/...` 与 `https://$NEW_FILES_DOMAIN/api/provider-files/production/...`。
- 登录保护文件：`https://$NEW_PROD_DOMAIN/files/input/...`、`https://$NEW_PROD_DOMAIN/files/output/...`，继续走 owner 校验，不改成公开静态目录。
- 健康检查：`https://$NEW_PROD_DOMAIN/api/status`、`https://$NEW_GRAY_DOMAIN/api/status`。
- Nginx 必须转发 `Host`、`X-Forwarded-Proto`、WebSocket Upgrade、SSE 长连接超时；不能把 `/files` 或 `/api/provider-files` 错代理到另一环境。

---

## 2. 数据分类与迁移边界

| 类别 | 是否迁移 | 处理方式 |
|---|---:|---|
| PostgreSQL schema、迁移表、用户、权限、项目、画布、节点/连线、工作流区域、Agent/Assistant 配置、Provider/Model 目录、任务状态、费用、审计 | 是 | 每个环境独立 `pg_dump`/恢复，恢复后执行目标版本迁移并校验行数/约束 |
| Provider 加密字段 | 是 | 连同数据库迁移，目标环境复用完全相同的 `XINGHUAN_SECRET_KEY`；禁止只迁移预览值 |
| Canvas/Workflow JSON 中的 `/files/...` 引用 | 元数据迁移，媒体不迁移 | 迁移前统计引用，迁移后统一标记不可用或清理引用；不保留会导致 404 的“成功输出” |
| `xh_generation_artifacts` | 不迁移可见媒体记录 | 对未迁移二进制的记录标记 `missing`/`deleted` 或按受控脚本排除；保留审计所需最小元数据时必须从用户生成库隐藏 |
| `xh_assets` 资源素材 | 默认不迁移媒体二进制 | 按 `url`/`kind` 分类；指向 `/files/input`、`/files/output` 的媒体行标记不可用或排除。非媒体配置资产需单独确认后再迁移 |
| `/shared/data/users/*/input` | 否 | 不复制用户上传图片、视频、音频；新站只创建空目录 |
| `/shared/data/users/*/output` | 否 | 不复制生成图片、视频、音频；新站只创建空目录 |
| `/shared/data/users/*/resources` 中的媒体文件 | 默认否 | 与 `xh_assets` 元数据同步处理，不能只迁 DB 行 |
| 日志、临时目录、旧 release、`node_modules` | 否 | 目标用新 release 包和 `npm ci` 生成，不复制运行时垃圾 |
| Redis queued/running 状态 | 否 | 切换前排空/取消；新环境从零启动 queue，不恢复旧 worker lease |
| 用户会话 | 默认否 | 迁移后主动失效旧 session；保留数据库用户与密码，不复制 session 表中的有效登录态 |
| 旧服务器 | 保留 | 切换后只读保留 7-14 天，用于回滚和审计，不作为新站存储入口 |

**必须先做的媒体一致性决策：** 默认执行“迁移 DB 业务元数据、不迁媒体二进制、将媒体 artifact/asset 标记不可用”的方案。若负责人希望保留某一类长期资源，必须在迁移前列出明确目录、表、总大小和新 URL，不得在切换当天临时复制。

---

## 3. 阶段 A：盘点与冻结窗口设计

### Task A1：锁定源站与代码基线

- [ ] 读取并保存源站两套 `/api/status`、当前 release、数据库名、Redis queue、服务状态、磁盘容量、PostgreSQL/Redis/Node/Nginx 版本。
- [ ] 在本地执行 `git status --short --branch`、`git rev-parse HEAD`、`npm run verify:authority-state`、`npm run verify:release-worktree-clean`。
- [ ] 记录本次迁移制品 release ID、SHA-256、源提交；Gray/Production 都必须部署同一制品内容。
- [ ] 用 `rg -n "canvas\.hhh2121\.xyz|canvas-next\.hhh2121\.xyz|files\.hhh2121\.xyz|101\.33\.75\.38|18100|18200"` 扫描仓库、配置和发布脚本，生成旧域名/旧 IP 清单。
- [ ] 盘点数据库表行数、数据库大小、`xh_tasks` queued/running 数量、`xh_generation_artifacts` 状态分布、`xh_assets` URL 类型分布；结果写入迁移日志。
- [ ] 盘点 `/opt/apps/xinghuan-canvas*/shared/data` 的目录大小和文件类型，只记录统计，不复制媒体。

**门禁：** 源站、目标变量、制品 checksum、媒体排除范围和负责人均有书面确认；否则不进入备份。

### Task A2：建立冻结和回滚规则

- [ ] 设定维护窗口 `T0`，提前通知用户停止创建画布、上传和发起生成。
- [ ] T0 前至少降低新域名 DNS TTL 到 60-300 秒；Cloudflare 代理、SSL 模式和缓存策略记录在迁移日志。
- [ ] 规定 T0 后源站 API 进入只读/维护模式，禁止新任务写入旧 DB；如果无法全局只读，至少停 API 写入口和两个 Worker。
- [ ] 规定回滚条件：目标 `/api/status` 非 200、数据库目标不匹配、登录/画布读写失败、Provider 文件回抓失败、Worker 队列无法消费或 Nginx 出现 502。
- [ ] 规定回滚方式：DNS 回旧域名/旧 IP、恢复旧 `current`、重启旧 API/Worker；不删除目标失败 release，不覆盖旧数据库。

---

## 4. 阶段 B：源站备份与一致性快照

### Task B1：PostgreSQL 双环境备份

- [ ] 在源站分别执行 `pg_dump --format=custom --no-owner --file=<secure>/gray-<timestamp>.dump "$XINGHUAN_DATABASE_URL"` 和 Production 等价命令。
- [ ] 单独导出全局角色/权限（不把密码写入日志），记录 owner、extension、collation、timezone、PostgreSQL 大版本。
- [ ] 执行 `pg_dump --schema-only` 作为结构审计副本，计算 `sha256sum`，把 checksum 写入迁移日志。
- [ ] 备份完成后执行 `pg_restore --list`，确认包含 `xh_users`、`xh_projects`、`xh_canvases`、`xh_providers`、`xh_models`、`xh_tasks`、`xh_audit_logs`、Agent/Workflow/Channel Health 相关表。
- [ ] 备份 `xh_schema_migrations`，记录两套 DB 当前已应用 migration ID；禁止使用 Gray DB 覆盖 Production DB。

### Task B2：运行态与 Provider 配置快照

- [ ] 以脱敏方式保存 systemd unit、Nginx vhost、当前 env 变量名清单、Cloudflare/DNS 记录清单；不复制真实值到 Git。
- [ ] 记录后台 Provider/Model 的数量、enabled 状态、Provider base URL、模型 capability；API Key 只确认“可解密/可用”，不导出明文。
- [ ] 记录 Agent/Assistant 的 published version、route pool、model record、策略和知识快照数量；目标恢复后必须保持版本可读。
- [ ] 记录 RunningHub/GRSAI/ToAPIs/其他外部服务的回调白名单、出站 IP 白名单和测试模型；目标公网 IP 变更后逐个更新。

### Task B3：任务与 Redis 排空

- [ ] T0 前停止接收新任务，等待 `queued=0`、`running=0` 或明确取消并记录任务 ID。
- [ ] 对无法完成的任务写入可审计的 cancelled/failed 状态，不把旧 worker lease 和 Redis key 直接复制到新环境。
- [ ] 记录 Redis key 前缀、队列长度、延迟队列、并发窗口和任何半开 Provider probe lease；新环境从空 queue 启动。
- [ ] 若业务必须保留未完成任务，另立“任务重放”方案，按任务 payload 和幂等键重建，不直接搬 Redis dump。

**门禁：** 两个 dump checksum 可恢复；源站 queued/running 已处理；Provider 加密密钥和 `XINGHUAN_SECRET_KEY` 迁移方案已确认。

---

## 5. 阶段 C：新服务器基础设施

### Task C1：主机、账号和安全基线

- [ ] 新服务器安装与源站兼容的 Linux、Node.js 20.x、npm、PostgreSQL 16 client/server、Redis、Nginx、Certbot/Cloudflare 工具。
- [ ] 创建非 root `ubuntu`（或已批准运维账号），只允许 SSH 公钥；迁移密钥不写入仓库。
- [ ] 配置防火墙：只开放 SSH、80、443；PostgreSQL/Redis 仅监听本机或内网，不暴露公网。
- [ ] 设置时区、NTP、磁盘告警、日志轮转、systemd restart policy、进程 ulimit 和上传大小限制（当前 Nginx `client_max_body_size 100m`）。
- [ ] 创建 `/opt/apps/xinghuan-canvas/`、`/opt/apps/xinghuan-canvas-next/` 各自的 `releases/`、`shared/data/`、`shared/logs/`；禁止两环境共用目录。

### Task C2：数据库与 Redis 空实例

- [ ] 创建独立的 `$NEW_PROD_DB` 与 `$NEW_GRAY_DB`、角色和最小权限；验证两库名称不同。
- [ ] 恢复 PostgreSQL extension、collation、timezone 和必要角色，连接串只写入目标环境文件。
- [ ] Redis 创建独立实例或至少独立 DB/queue prefix；确认 `$NEW_PROD_DB_URL`、`$NEW_GRAY_DB_URL` 不会指向旧服务器。
- [ ] 为新数据库做空库连接测试、`select current_database()` 测试、迁移前备份测试。

---

## 6. 阶段 D：数据库恢复与媒体引用清理

### Task D1：恢复完整业务数据库

- [ ] 在新服务器先恢复 Gray dump 到 `$NEW_GRAY_DB`，再恢复 Production dump 到 `$NEW_PROD_DB`；使用 `--no-owner` 后按目标角色修复 owner。
- [ ] 运行目标 release 的 `npm run db:migrate`，确认 migration 只新增缺失项，不回退或重写历史数据。
- [ ] 对核心表做源/目标行数比对：用户、项目、画布、Provider、模型、任务、审计、Agent、Workflow、Channel Health、费用快照、权限规则。
- [ ] 执行约束、索引、外键、sequence 和 `select current_database()` 校验；记录失败项，不用“忽略错误”继续切换。

### Task D2：处理不迁移媒体造成的引用

- [ ] 对 `xh_generation_artifacts` 统计 `file_url`、`storage_key`、状态和对应物理文件；未迁移二进制的行统一转为 `missing` 或 `deleted`，并保留来源任务/审计信息。
- [ ] 对 `xh_assets` 按 `url`、`kind`、`mime` 分类；指向 `/files/input`、`/files/output` 的媒体行不进入可见资源列表，非媒体资产需负责人单独确认。
- [ ] 对 `xh_tasks.result`、Canvas 节点输出和 Workflow snapshot 中的媒体 URL 做脱敏/失效标记；不能让 UI 把 404 当作成功结果。
- [ ] 在目标库执行生成产物 reconciliation dry-run，确认没有 active/promoted 记录指向不存在文件；禁止用 GET 触发修复。
- [ ] 新服务器仅创建空的 owner input/output 目录，首个新上传/生成任务必须能正常创建文件。

**门禁：** 用户、项目、画布和配置数据完整；生成库/资源库不会展示悬空媒体；迁移日志明确列出被排除的媒体数量和字节数。

---

## 7. 阶段 E：应用 release、环境文件和服务

### Task E1：部署同一 release

- [ ] 在本地使用已验收 release 包（例如 `npm run package:release -- <release-id>`）并保存 checksum；不把 `dist-release/` 或 `node_modules/` 提交 Git。
- [ ] 上传到新服务器两个环境各自的 `releases/<release-id>`，解压后执行 `npm ci`；不要从旧服务器复制 `node_modules`。
- [ ] 为 Gray 写入 `canvas-next.env`，为 Production 写入 `canvas.env`，至少核对：`XINGHUAN_APP_ENV`、`XINGHUAN_SECRET_KEY`、DB URL/name、Redis URL、queue、worker ID、API port、data dir、web/admin dist dir、retention days、provider file origin。
- [ ] 将 `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN` 设置为 `$NEW_FILES_DOMAIN` 的 HTTPS origin；不要保留旧裸 IP。
- [ ] 设置新域名对应的 `XINGHUAN_GRAY_API_BASE_URL` / `XINGHUAN_PRODUCTION_API_BASE_URL`，只在服务端环境使用。
- [ ] 复制并安装 systemd API、Worker、output-prune service/timer；每个 unit 的 `WorkingDirectory`、`EnvironmentFile` 和端口必须指向对应环境。
- [ ] 启动顺序：PostgreSQL -> Redis -> API -> Worker -> output-prune timer；逐项检查 `systemctl is-active`。

### Task E2：Provider、Agent 和外部回调复核

- [ ] 登录 Admin，确认 Provider/Model 目录、模型 capability、Agent/Assistant route pool、托管策略、知识快照和权限规则数量与源站一致。
- [ ] 通过受控后台动作验证 Provider 加密 Key 可解密；如失败，立即停止，不重新录入或覆盖数据库密文。
- [ ] 更新 RunningHub/GRSAI/ToAPIs 等服务商的回调白名单、上传回抓白名单和新公网 IP；保留旧 IP 直到 DNS/任务窗口收敛。
- [ ] ComfyUI 当前功能冻结；只迁移现有 connector 配置和必要 token，不在迁移批次扩展实例池或跨机器调度。

---

## 8. 阶段 F：新域名、Nginx、TLS 与公网数据 URL

### Task F1：DNS 和证书

- [ ] 在新 DNS/Cloudflare 创建 Production、Gray、Files 三个记录，分别指向 `$NEW_SERVER_IP`；先使用低 TTL，不立即删除旧记录。
- [ ] 明确 Cloudflare 代理模式：主站可橙云；Provider Files 必须允许外部 Provider 机器访问签名 URL，不能被 Access、登录墙或 challenge 页面拦截。
- [ ] 为三个域名签发证书，验证 SNI、自动续期、证书链和到期告警；证书私钥只在目标服务器权限目录。

### Task F2：Nginx 路由

- [ ] 新 Production 域名代理到 `127.0.0.1:18100`；新 Gray 域名代理到 `127.0.0.1:18200`。
- [ ] 新 Files 域名按路径 scope 分流：`/api/provider-files/gray/` -> Gray API，`/api/provider-files/production/` -> Production API；保留正确的 `Host`、超时和响应头。
- [ ] 主站 `/files/input/*`、`/files/output/*` 必须回到对应主站 API，不能落到公开静态文件目录。
- [ ] 执行 `nginx -t` 后 reload；用 `curl -i` 检查 200、301/302、403 和 404 语义，确认没有把 Gray 内容返回给 Production。
- [ ] 如果旧域名需要保留，配置明确 301/维护页或并行代理；回滚窗口内不要直接删除旧 vhost。

### Task F3：旧 URL 与新 URL 一致性

- [ ] 检查数据库任务 payload、Provider 配置、后台公告、模板和环境文件中的旧域名/旧 IP；新产生的签名 URL 必须只出现 `$NEW_FILES_DOMAIN`。
- [ ] 旧签名 URL 不要求永久兼容；因为媒体不迁移且签名带 scope/secret，不能把旧 URL 改写成新 URL 后继续假装有效。
- [ ] 对外部 Provider 只发放新 Files 域名 URL；在途任务保留旧出口直到排空，之后再关闭旧裸 IP 回抓入口。

---

## 9. 阶段 G：分层验收与切换

### Task G1：新服务器内部验收

- [ ] `curl http://127.0.0.1:18200/api/status` 与 `:18100/api/status` 返回正确版本和环境。
- [ ] `select current_database()` 与对应 `XINGHUAN_EXPECTED_DATABASE_NAME` 一致；Gray/Production 不能串库。
- [ ] API、Worker、output-prune timer active；Redis queue prefix 正确且无旧 key。
- [ ] `/`、`/admin`、登录、CSRF/Origin、SSE、WebSocket、文件访问和健康检查通过。
- [ ] 运行 Project/Workspace/Release Harness；在目标 release 目录执行 task pagination、environment sync no-op、request-chain、system observability、Provider task service/worker smoke。

### Task G2：新域名验收（先 Gray）

- [ ] 访问 `https://$NEW_GRAY_DOMAIN/api/status`、`/`、`/admin`，确认响应的 Host、环境和版本正确。
- [ ] 用测试账号创建画布、保存文本节点、刷新恢复；不上传/生成真实用户媒体，只用临时 smoke 文件并在验收后清理单个明确文件。
- [ ] 触发低成本 LLM/文本确定性节点，确认 Worker、SSE、暂停/恢复/取消、Agent 助手、AI 托管状态投影和错误诊断可读。
- [ ] 验证 Provider Files：签名 scope URL 可从公网访问，错误 scope 返回 403；不能把 Gray 文件提供给 Production。
- [ ] PC `1920x1080` 做一次视觉验收，检查主站、Canvas、AI 助手、托管面板、Admin 渠道状态页面。

### Task G3：Production 切换与验收

- [ ] T0 进入冻结，完成最终 Production/Gray 增量 dump（只迁业务 DB，不迁媒体二进制），恢复到目标并执行引用清理。
- [ ] 启动目标 Production/Gray，先用 `--resolve` 或 hosts 临时指向新 IP 验证，不提前让全部公网流量进入目标。
- [ ] 切换 DNS/Cloudflare 记录到新服务器；观察 TTL、证书、HTTP 200、无 502、无旧 IP 回源。
- [ ] 执行 Production checklist：管理员登录、Admin、画布保存/刷新、Provider/Model 可见、助手、AI 托管、渠道健康、审计和公网 Provider Files。
- [ ] 观察 15 分钟、1 小时、4 小时：API/Worker 错误率、Redis queue、Postgres connections、任务终态、Nginx 502、Provider 回抓失败、磁盘增长。
- [ ] 将目标 release、数据库、DNS、证书、验证输出和媒体排除统计写入 `docs/logbooks/releases/production/` 与 `validations/`。

---

## 10. 阶段 H：回滚与收尾

### Task H1：回滚演练和触发条件

- [ ] 在不删除目标数据的前提下演练：旧 DNS 回切、旧 `current` 回指、旧 API/Worker restart、旧 `/api/status` 恢复。
- [ ] 若目标已产生新业务写入，回滚前必须冻结双方并决定是否丢弃目标增量；禁止不一致地双向写数据库。
- [ ] Provider Files 旧/新出口都保留到在途任务完成或过期；不要提前删除旧签名路由。

### Task H2：保留与最终下线

- [ ] 新环境运行态稳定至少 7-14 天后，再对旧服务器做只读归档；不立即删除旧 DB、旧 release、旧日志或旧 Nginx 备份。
- [ ] 目标服务器按项目 retention 脚本保留 Gray/Production 最近五个 release，先 dry-run 后 apply；不触碰 shared data、数据库和用户数据。
- [ ] 确认 Cloudflare DNS、证书自动续期、备份、监控、告警、SSH 白名单和 Provider 回调白名单都已改为新服务器。
- [ ] 将旧域名处理方式（保留、301、下线）写入最终运维记录；移除旧裸 IP Provider Files 入口前先确认无在途任务。
- [ ] 更新 `config/environments.json`、`ops/current/release-state.json`、`ops/current/gray.md`、`ops/current/production.md` 和服务器连接文档，确保 canonical state 不再指向旧主机/域名。

---

## 11. 验收记录模板

迁移执行时新增一份日期化记录，至少填入以下字段；不要在记录里写密钥、完整连接串或用户媒体 URL。

```text
迁移批次：YYYY-MM-DD-new-server-domain
源服务器：已确认（不在公开日志写凭据）
目标服务器：NEW_SERVER_IP（可写脱敏标识）
目标域名：NEW_PROD_DOMAIN / NEW_GRAY_DOMAIN / NEW_FILES_DOMAIN
代码制品：release id + SHA-256
源/目标 DB：生产与灰度数据库名、dump checksum、恢复时间
媒体策略：未迁移二进制；排除文件数/字节数；artifact/asset 清理结果
DNS/TLS：记录、TTL、证书到期、Cloudflare 模式
运行态：API/Worker/timer、版本、环境、数据库目标、permission readiness
功能：登录、Admin、Canvas、助手、托管、Provider Files、任务终态、渠道健康
观测：15m/1h/4h 错误率、队列、502、Provider 回抓、磁盘
回滚锚点：旧域名、旧 release、旧 DB backup、预计回滚耗时
最终结论：通过 / 阻断 / 回滚
```

## 12. 迁移完成判定

只有以下条件全部满足，才可以宣布迁移完成：

1. Gray 与 Production 均运行同一已验收代码制品，版本和环境状态正确。
2. 两个数据库完整恢复，核心表/权限/Agent/Provider/任务/审计数据通过比对，且没有跨环境串库。
3. 用户生成媒体二进制明确未迁移，相关元数据已清理或标记不可用，不产生假成功/悬空可见资源。
4. 新 Production、Gray、Files 域名、TLS、Nginx、Provider scope URL 和公网回抓全部通过。
5. API、Worker、Redis、Postgres、timer、日志、备份和监控均可运维。
6. 回滚路径经过演练，旧服务器仍在保留窗口内，最终迁移日志和 canonical state 已同步。

