# 生产部署 Runbook

目标：将星幻无限画布正式部署到 `canvas.hhh2121.xyz`，服务端口为 `127.0.0.1:18100`。

## 边界

- 不修改内部代理项目。
- 不覆盖灰度目录 `/opt/apps/xinghuan-canvas-next/`。
- 不批量删除服务器文件或目录。
- 不把真实密钥写入 Git、文档、日志或聊天。

## 目标目录

```text
/opt/apps/xinghuan-canvas/
  current -> 当前 release
  releases/<release-id>/
  shared/
    canvas.env
    data/
    logs/
```

## 生产位与灰度位隔离要求

- 生产目录固定为 `/opt/apps/xinghuan-canvas/`，不要复用灰度根目录 `/opt/apps/xinghuan-canvas-next/`。
- 生产环境文件固定为 `/opt/apps/xinghuan-canvas/shared/canvas.env`，不要直接指向灰度 `canvas-next.env`。
- 生产数据目录固定为 `/opt/apps/xinghuan-canvas/shared/data`，不要复用灰度 `shared/data`。
- 生产日志目录固定为 `/opt/apps/xinghuan-canvas/shared/logs`，不要复用灰度 `shared/logs`。
- 生产 Redis 队列建议使用 `xinghuan:tasks:prod`，不要与灰度 `xinghuan:tasks` 混用。

## 本机准备

1. 在 worktree 执行构建：

```powershell
npm run build:single-port
```

2. 确认本机自动验收仍通过：

```powershell
npm run verify:single-port
```

3. 确认当前灰度基线文档为最新 release：

```text
ops/production-preflight-2026-06-06.md
```

## 服务器准备

1. 登录服务器：

```powershell
$sshKey = (Resolve-Path '..\Server\Tencent_Cloud_Server.pem').Path
ssh -i $sshKey -p 728 ubuntu@101.33.75.38
```

2. 创建生产目录。只创建目录，不删除灰度或旧目录：

```bash
mkdir -p /opt/apps/xinghuan-canvas/releases
mkdir -p /opt/apps/xinghuan-canvas/shared/data
mkdir -p /opt/apps/xinghuan-canvas/shared/logs
```

3. 写入生产环境文件：

```bash
cp config/canvas-production.env.example /opt/apps/xinghuan-canvas/shared/canvas.env
```

然后只在服务器上填入真实连接串、密钥和 bootstrap 密码，不把真实值写回仓库。

同时必须设置：

```bash
XINGHUAN_EXPECTED_DATABASE_NAME=<正式数据库名>
```

要求：

- 必须是正式实际使用的 PostgreSQL 数据库名。
- 不得留空。
- 不得复用灰度数据库名。

## 发布步骤

1. 上传或拉取 release 到：

```text
/opt/apps/xinghuan-canvas/releases/<release-id>
```

2. 在 release 目录校验 Gray 晋级的归档并安装生产依赖：

```bash
sha256sum -c /tmp/<release-id>.tar.gz.sha256
npm ci --omit=dev
```

Production 必须使用 Gray 已验收的同一个 archive/SHA；服务器不得重新构建、运行 `tsx` 或安装开发依赖。

3. 切换 `current` 指向新 release：

```bash
ln -sfn /opt/apps/xinghuan-canvas/releases/<release-id> /opt/apps/xinghuan-canvas/current
```

4. 安装 systemd 示例：

```bash
sudo cp ops/systemd/xinghuan-canvas.service.example /etc/systemd/system/xinghuan-canvas.service
sudo cp ops/systemd/xinghuan-canvas-worker.service.example /etc/systemd/system/xinghuan-canvas-worker.service
sudo cp ops/systemd/xinghuan-canvas-output-prune.service.example /etc/systemd/system/xinghuan-canvas-output-prune.service
sudo cp ops/systemd/xinghuan-canvas-output-prune.timer.example /etc/systemd/system/xinghuan-canvas-output-prune.timer
sudo systemctl daemon-reload
sudo systemctl enable xinghuan-canvas xinghuan-canvas-worker xinghuan-canvas-output-prune.timer
sudo systemctl restart xinghuan-canvas
sudo systemctl restart xinghuan-canvas-worker
sudo systemctl restart xinghuan-canvas-output-prune.timer
```

5. 先验证生产位本机监听：

```bash
curl -fsS http://127.0.0.1:18100/api/status
curl -fsS http://127.0.0.1:18100/
```

6. 验证生产进程没有连错库：

```bash
set -a
. /opt/apps/xinghuan-canvas/shared/canvas.env
set +a
psql "$XINGHUAN_DATABASE_URL" -Atc "select current_database();"
```

返回值必须与 `XINGHUAN_EXPECTED_DATABASE_NAME` 一致。

7. 安装 Nginx 示例并切域名：

```bash
sudo cp ops/nginx/canvas.hhh2121.xyz.conf.example /etc/nginx/sites-available/canvas.hhh2121.xyz
sudo ln -sfn /etc/nginx/sites-available/canvas.hhh2121.xyz /etc/nginx/sites-enabled/canvas.hhh2121.xyz
sudo nginx -t
sudo systemctl reload nginx
```

8. 域名切换后，按生产验收清单补 smoke：

```text
ops/production-acceptance-checklist.md
```

## 回滚

1. 将 `current` 指回上一个 release：

```bash
ln -sfn /opt/apps/xinghuan-canvas/releases/<previous-release-id> /opt/apps/xinghuan-canvas/current
sudo systemctl restart xinghuan-canvas
sudo systemctl restart xinghuan-canvas-worker
```

2. 验证生产位本机和域名恢复：

```bash
curl -fsS http://127.0.0.1:18100/api/status
curl -fsS https://canvas.hhh2121.xyz/api/status
```

3. 不删除失败 release；先保留用于排查。

## 发布成功后的 Release 保留

Production 全部运行态、数据库目标、权限 readiness 和域名验收通过后，执行：

```powershell
npm run release:retention:prune -- --env=production --ssh-key=<path-to-key>
npm run release:retention:prune -- --env=production --ssh-key=<path-to-key> --apply=true --confirm-retention=5
```

- 必须先检查 dry-run 清单，再执行 apply。
- 保留五个 Release：`current` 与 `ops/current/release-state.json` 中 Production `rollbackReleaseId` 必须位于其中，剩余名额按服务器修改时间选择。
- 不得触碰 `/opt/apps/xinghuan-canvas/shared/`、数据库备份、环境文件和用户数据。
- 失败 Release 在调查完成前保留证据；调查结束后恢复为五个。
