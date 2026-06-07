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
ssh -i D:\codex\服务器\Tencent_Cloud_Server.pem -p 728 ubuntu@101.33.75.38
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

## 发布步骤

1. 上传或拉取 release 到：

```text
/opt/apps/xinghuan-canvas/releases/<release-id>
```

2. 在 release 目录安装依赖并构建：

```bash
npm ci
npm run build:single-port
```

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

6. 安装 Nginx 示例并切域名：

```bash
sudo cp ops/nginx/canvas.hhh2121.xyz.conf.example /etc/nginx/sites-available/canvas.hhh2121.xyz
sudo ln -sfn /etc/nginx/sites-available/canvas.hhh2121.xyz /etc/nginx/sites-enabled/canvas.hhh2121.xyz
sudo nginx -t
sudo systemctl reload nginx
```

7. 域名切换后，按生产验收清单补 smoke：

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
