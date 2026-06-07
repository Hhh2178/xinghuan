# 服务器连接与基础设施信息

> 本文件从 `D:\codex\服务器` 同步，记录无限画布 2.0 灰度服务器的连接方式和基础设施状态。
> 最后更新：2026-06-05

## SSH 连接

```bash
ssh -i Tencent_Cloud_Server.pem -p 728 ubuntu@101.33.75.38
```

- 服务器：腾讯云 VPS `101.33.75.38`
- 用户：`ubuntu`（非 root，禁止直接 root 登录）
- 端口：`728`（非标准 22，已禁用密码认证）
- 认证：仅公钥认证（`PubkeyAuthentication yes`）
- 密钥位置：`D:\codex\服务器\Tencent_Cloud_Server.pem`

### SSH 安全配置

```
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
PermitRootLogin no
AllowUsers ubuntu
```

### 本地路由修复

本机通过代理软件时，需要添加静态路由绕过代理隧道：

```powershell
route -p add 101.33.75.38 mask 255.255.255.255 192.168.20.1 metric 1 if 7
```

- 物理网卡：`以太网`
- 本地 IP：`192.168.20.67`
- 网关：`192.168.20.1`
- 本机公网 IP：`58.20.23.64`（用于腾讯云安全组白名单）

## 域名与端口映射

| 域名 | 用途 | 后端端口 | 状态 |
|------|------|---------|------|
| `canvas-next.hhh2121.xyz` | 无限画布 2.0 灰度 | `127.0.0.1:18200` | ✅ 已启用 |
| `canvas.hhh2121.xyz` | 无限画布 2.0 生产（预留） | `127.0.0.1:18100` | ⏳ 未启用 |
| `hhh2121.xyz` | 主域名 | - | Cloudflare DNS |

### DNS 配置

- 权威 DNS：Cloudflare
- Nameserver：`hasslo.ns.cloudflare.com`、`rosemary.ns.cloudflare.com`
- 所有子域名均解析到 `101.33.75.38`

### HTTPS 证书

- 证书：Let's Encrypt
- 自动续期：已启用
- 当前到期：`2026-08-31`

## 无限画布 2.0 灰度基础设施

### 服务清单

| 服务 | 单元文件 | 监听地址 | 状态 |
|------|---------|---------|------|
| API 服务 | `xinghuan-canvas-next.service` | `127.0.0.1:18200` | active |
| Worker 服务 | `xinghuan-canvas-next-worker.service` | - | active |
| PostgreSQL | `postgresql.service` | `127.0.0.1:5432` | active |
| Redis | `redis-server.service` | `127.0.0.1:6379` | active |
| Nginx | `nginx.service` | `80/443` | active |

### 部署目录

```
/opt/apps/xinghuan-canvas-next/
├── current -> releases/20260606-1217-output-preview-layout-gray/
├── releases/
│   ├── 20260605-0903-xinghuan-gray/
│   ├── 20260605-1135-xinghuan-auth-gray/
│   ├── 20260605-1215-xinghuan-admin-gray/
│   ├── 20260605-1245-xinghuan-admin-sec-gray/
│   ├── 20260605-1315-xinghuan-db-ready-gray/
│   ├── 20260605-1410-xinghuan-pg-repo-gray/
│   ├── 20260605-1505-xinghuan-worker-queue-gray/
│   ├── 20260606-2140-grsai-draw-gray/
│   ├── 20260606-2335-grsai-worker-gray/
│   ├── 20260606-1150-admin-schema-gray/
│   └── 20260606-1217-output-preview-layout-gray/
└── shared/
    └── canvas-next.env          # 环境变量（密钥，不入 Git）
```

### 数据库

- PostgreSQL 16.14
- 数据库名：`xinghuan_canvas_next`
- 应用账号：`xinghuan_canvas_next`
- 连接串环境变量：`XINGHUAN_DATABASE_URL`
- Schema 迁移：`npm run db:migrate`
- 已应用迁移：`001_admin_core.sql`

### Redis

- 队列名：`xinghuan:tasks`
- 连接串环境变量：`XINGHUAN_REDIS_URL`
- 用途：Worker 任务队列

### 存储驱动

- 当前：`postgres`（`XINGHUAN_STORAGE_DRIVER=postgres`）
- 备选：`file`（本地文件型，用于开发和回滚）

## 密钥管理

> ⚠️ 真实密钥不得写入文档、Git 或聊天输出

| 密钥 | 环境变量 | 用途 | 存放位置 |
|------|---------|------|---------|
| 数据库连接串 | `XINGHUAN_DATABASE_URL` | PostgreSQL 连接 | 服务器环境文件 |
| Redis 连接串 | `XINGHUAN_REDIS_URL` | Redis 连接 | 服务器环境文件 |
| 加密主密钥 | `XINGHUAN_SECRET_KEY` | Provider Key AES-256-GCM 加密 | 服务器环境文件 |
| 管理员密码 | `XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD` | 初始管理员密码 | 服务器环境文件 |
| GRSAI API Key | `GRSAI_API_KEY` | 图像生成测试 | 本机 .env.local |
| ToAPIs API Key | `TOAPIS_API_KEY` | 视频生成测试 | 本机 .env.local |

### 环境变量文件位置

- 服务器：`/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`
- 本机：`D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b\.env.local`（已 Git 忽略）

## 其他服务（不影响无限画布）

| 服务 | 用途 | 状态 |
|------|------|------|
| `internal-proxy-ss.service` | 机场 Shadowsocks 代理 | active |
| `internal-proxy-subscription.service` | 订阅服务 | active |
| 端口 `8443` | 代理端口 | 监听中 |

## 常用运维命令

```bash
# 查看服务状态
sudo systemctl status xinghuan-canvas-next
sudo systemctl status xinghuan-canvas-next-worker
sudo systemctl status postgresql
sudo systemctl status redis-server

# 查看日志
sudo journalctl -u xinghuan-canvas-next -f
sudo journalctl -u xinghuan-canvas-next-worker -f

# 数据库迁移
cd /opt/apps/xinghuan-canvas-next/current
npm run db:migrate

# 自动验收
npm run verify:single-port
npm run verify:worker

# 查看 Redis 队列
redis-cli -h 127.0.0.1 llen xinghuan:tasks

# 查看 PostgreSQL
psql -h 127.0.0.1 -U xinghuan_canvas_next -d xinghuan_canvas_next
```
