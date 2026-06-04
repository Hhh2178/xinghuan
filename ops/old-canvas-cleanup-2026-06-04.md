# Old Canvas Cleanup - 2026-06-04

## 目标

清理旧无限画布灰度项目，避免影响无限画布 2.0 后续部署，同时不影响 Hermes、files、主域名和内部代理服务。

## 执行时间

- 开始前检查：`2026-06-04T16:10:20+08:00`
- 清理后复验：`2026-06-04T16:12:13+08:00`

## 清理前状态

- 旧项目当前 release：`/opt/apps/canvas-enterprise-next/releases/5148170`
- Nginx 启用入口：`/etc/nginx/sites-enabled/canvas-enterprise-next.conf`
- Nginx 可用配置：`/etc/nginx/sites-available/canvas-enterprise-next.conf`
- Web 服务：`canvas-enterprise-next.service`，状态 `active`
- Worker 服务：`canvas-enterprise-worker.service`，状态 `active`
- 监听端口：`127.0.0.1:18200`
- 域名：`https://canvas-next.hhh2121.xyz/`，清理前返回 `200`

## 已执行清理

- 停止 `canvas-enterprise-worker.service`。
- 停止 `canvas-enterprise-next.service`。
- 禁用 `canvas-enterprise-worker.service`。
- 禁用 `canvas-enterprise-next.service`。
- 移除 Nginx 启用入口 `/etc/nginx/sites-enabled/canvas-enterprise-next.conf`。
- 移除 Nginx 可用配置 `/etc/nginx/sites-available/canvas-enterprise-next.conf`。
- 移除 systemd unit 文件：
  - `/etc/systemd/system/canvas-enterprise-worker.service`
  - `/etc/systemd/system/canvas-enterprise-next.service`
- 执行 `systemctl daemon-reload`。
- 执行 `nginx -t`，结果通过。
- reload Nginx。

## 清理后复验

服务状态：

| 项目 | 状态 |
|---|---|
| `nginx` | `active` |
| `redis-server.service` | `active` |
| `internal-proxy-ss.service` | `active` |
| `internal-proxy-subscription.service` | `active` |
| `canvas-enterprise-next.service` | `inactive / not-found` |
| `canvas-enterprise-worker.service` | `inactive / not-found` |

端口：

- `127.0.0.1:18200` 已释放。
- `127.0.0.1:18080` 仍在。
- `127.0.0.1:8787` 仍在。
- `0.0.0.0:8443` 仍在。
- `80`、`443`、`728` 仍在。

HTTP 验证：

- `https://hhh2121.xyz/healthz` 返回 `ok`。
- `https://canvas-next.hhh2121.xyz/` 返回 `404`。
- `https://hermes.hhh2121.xyz/` 返回 `302`。

结论：

- 旧无限画布 Web/worker/Nginx 入口已从服务器运行态摘除。
- Hermes、主域名 health、内部代理端口未受影响。

## 旧目录最终删除

用户随后明确授权对旧项目目录执行递归删除。本次只删除以下精确路径：

- `/opt/apps/canvas-enterprise-next`

删除前占用：

- 约 `23G`

删除前已再次验证：

- `readlink -f /opt/apps/canvas-enterprise-next` 精确等于 `/opt/apps/canvas-enterprise-next`。
- `canvas-enterprise-next.service` 为 `inactive`。
- `canvas-enterprise-worker.service` 为 `inactive`。
- Nginx 中旧 `canvas-enterprise-next.conf` 启用入口和可用配置均不存在。
- `127.0.0.1:18200` 未占用。

执行结果：

- `/opt/apps/canvas-enterprise-next` 已不存在。
- 根分区从约 `59G / 46G used / 11G avail / 81%` 变为 `59G / 24G used / 33G avail / 42%`。

删除后复验：

- `nginx`：`active`
- `redis-server.service`：`active`
- `internal-proxy-ss.service`：`active`
- `internal-proxy-subscription.service`：`active`
- `https://hhh2121.xyz/healthz`：`ok`
- `https://canvas-next.hhh2121.xyz/`：`404`
- `https://hermes.hhh2121.xyz/`：`302`
- `127.0.0.1:18200`：未监听

## 最终结论

旧无限画布项目已经从服务器运行态、Nginx 入口、systemd 服务和磁盘目录中清理完成。Hermes、内部代理、主域名 health 和 Nginx 未受影响。
