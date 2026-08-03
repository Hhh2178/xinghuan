# 灰度部署 Runbook

目标：将星幻无限画布单端口生产服务部署到 `canvas-next.hhh2121.xyz`，服务端口为 `127.0.0.1:18200`。

## 边界

- 不修改内部代理项目。
- 不切换生产域名 `canvas.hhh2121.xyz`。
- 不批量删除服务器文件或目录。
- 不把真实密钥写入 Git、文档、日志或聊天。

## 目标目录

```text
/opt/apps/xinghuan-canvas-next/
  current -> 当前 release
  releases/<release-id>/
  shared/
    canvas-next.env
    data/
    logs/
```

## 本机准备

推荐优先走新的半自动化脚本链：

```powershell
npm run release:gray:prepare -- --release=<release-id>
npm run release:gray:deploy -- --release=<release-id> --archive=dist-release/<release-id>.tar.gz --ssh-key=<path-to-key>
npm run release:gray:verify -- --ssh-key=<path-to-key> --expected-version=<version> --expected-environment=gray
npm run release:retention:prune -- --env=gray --ssh-key=<path-to-key>
npm run release:retention:prune -- --env=gray --ssh-key=<path-to-key> --apply=true --confirm-retention=5
```

Retention 会从 `ops/current/release-state.json` 读取 Gray `rollbackReleaseId`；dry-run 必须同时将 `current` 与该回滚 Release 标记为 `KEEP`，否则不得执行 apply。

如果是 RunningHub 相关专题发布，推荐直接使用带 preset 的准备命令：

```powershell
npm run release:gray:prepare -- --release=<release-id> --preset=runninghub
```

说明：

- 这三步只覆盖代码层、架构层和运行态层验证。
- gray 页面视觉验收和真实业务体验验收默认由用户负责。
- Release 清理必须在运行态验证成功之后执行；先 dry-run，确认 current 位于最近五个，再 apply。
- 清理范围只允许 `/opt/apps/xinghuan-canvas-next/releases/`，不得触碰 `shared/`、备份和用户数据。
- 若需要手工发布，仍可继续使用下方原始步骤。

1. 在 worktree 执行构建：

```powershell
npm run build:single-port
```

2. 本机单端口验收：

```powershell
npm run start:single-port
npm run verify:single-port
```

3. 确认只使用单 upstream：

```powershell
Get-NetTCPConnection -LocalPort 18200,18300,18310,18766 -State Listen -ErrorAction SilentlyContinue
```

## 服务器准备

1. 登录服务器：

```powershell
ssh -p 728 ubuntu@101.33.75.38
```

2. 创建灰度目录。只创建目录，不删除旧项目：

```bash
mkdir -p /opt/apps/xinghuan-canvas-next/releases
mkdir -p /opt/apps/xinghuan-canvas-next/shared/data
mkdir -p /opt/apps/xinghuan-canvas-next/shared/logs
```

3. 写入环境文件：

```bash
cp config/canvas-next.env.example /opt/apps/xinghuan-canvas-next/shared/canvas-next.env
```

然后只在服务器上编辑真实路径和环境变量，不写入真实密钥到仓库。

如果灰度使用 PostgreSQL，必须同时设置：

```bash
XINGHUAN_EXPECTED_DATABASE_NAME=<灰度数据库名>
```

要求：

- 必须填灰度实际数据库名。
- 不得复用正式数据库名。

## 发布步骤

1. 上传或拉取 release 到：

```text
/opt/apps/xinghuan-canvas-next/releases/<release-id>
```

2. 在 release 目录校验归档并安装生产依赖：

```bash
sha256sum -c /tmp/<release-id>.tar.gz.sha256
npm ci --omit=dev
```

sealed archive 已在本地完成 bundle 和静态资源构建；服务器不得重新构建或安装开发依赖。

3. 切换 `current` 指向新 release：

```bash
ln -sfn /opt/apps/xinghuan-canvas-next/releases/<release-id> /opt/apps/xinghuan-canvas-next/current
```

4. 安装 systemd 示例：

```bash
sudo cp ops/systemd/xinghuan-canvas-next.service.example /etc/systemd/system/xinghuan-canvas-next.service
sudo systemctl daemon-reload
sudo systemctl enable xinghuan-canvas-next
sudo systemctl restart xinghuan-canvas-next
```

5. 安装 Nginx 示例：

```bash
sudo cp ops/nginx/canvas-next.hhh2121.xyz.conf.example /etc/nginx/sites-available/canvas-next.hhh2121.xyz
sudo ln -sfn /etc/nginx/sites-available/canvas-next.hhh2121.xyz /etc/nginx/sites-enabled/canvas-next.hhh2121.xyz
sudo nginx -t
sudo systemctl reload nginx
```

6. HTTPS 证书在确认 HTTP 灰度可用后再处理，避免把证书问题和应用问题混在一起。

7. 若灰度使用 PostgreSQL，发布后补做数据库目标校验：

```bash
set -a
. /opt/apps/xinghuan-canvas-next/shared/canvas-next.env
set +a
psql "$XINGHUAN_DATABASE_URL" -Atc "select current_database();"
```

返回值必须与 `XINGHUAN_EXPECTED_DATABASE_NAME` 一致。

## 验收

按照 `ops/gray-release-standard-checklist.md` 和 `ops/gray-acceptance-checklist.md` 执行，并在 release 目录运行：

```bash
set -a; . /opt/apps/xinghuan-canvas-next/shared/canvas-next.env; set +a
node apps/api/dist/cli/permission-readiness.js --expect-ready=true
```

其中：

- Agent 默认执行服务层、域名层、运行态与安全边界检查。
- 用户默认执行视觉层和真实业务体验验收。

### Live Verifier 注意事项

- 不要默认把本机 `http://127.0.0.1:18200` 当成服务器灰度。Windows/WSL 可能存在 `wslrelay.exe` 或本机残留服务占用该端口，导致 verifier 命中旧目标。
- 灰度放行推荐在服务器 release 目录执行：

```bash
cd /opt/apps/xinghuan-canvas-next/current
set -a
. /opt/apps/xinghuan-canvas-next/shared/canvas-next.env
set +a
XINGHUAN_VERIFY_BASE_URL=http://127.0.0.1:18200 node scripts/verify-admin-task-pagination.mjs
XINGHUAN_VERIFY_BASE_URL=http://127.0.0.1:18200 node scripts/verify-environment-sync-smoke.mjs
```

- 如果必须在本机执行 live verifier，必须显式设置 `XINGHUAN_VERIFY_BASE_URL` 指向确认过的公网灰度域名或 SSH 隧道目标，并先用 `/api/status` 确认 `version` 与 `environment`。

## 回滚

1. 将 `current` 指回上一个 release：

```bash
ln -sfn /opt/apps/xinghuan-canvas-next/releases/<previous-release-id> /opt/apps/xinghuan-canvas-next/current
sudo systemctl restart xinghuan-canvas-next
```

2. 验证：

```bash
curl -fsS http://127.0.0.1:18200/api/status
curl -fsS http://127.0.0.1:18200/
```

3. 不删除失败 release；先保留用于排查。
