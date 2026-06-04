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

## 仍保留的旧目录

旧项目文件目录仍保留：

- `/opt/apps/canvas-enterprise-next`

当前占用：

- 约 `23G`

目录摘要：

- `/opt/apps/canvas-enterprise-next/runtime`
- `/opt/apps/canvas-enterprise-next/releases`
- `/opt/apps/canvas-enterprise-next/current`

release 目录包括：

- `a123441`
- `4b4ed5c`
- `354c47c`
- `1eb6f78`
- `5125748`
- `cc91512`
- `bc49c66`
- `735ac78`
- `8234750`
- `43f0ac2`
- `fbcca4a`
- `5148170`
- `45643bd`
- `ef756b8`
- `ff1e3a0`
- `132f1a5`
- `e578e96`
- `c3b0757`
- `51e3c25`
- `475e47e`
- `e350602`

## 为什么未删除目录

项目根规则禁止批量删除文件或目录，并明确禁止递归删除命令，例如 `rm -rf`、`Remove-Item -Recurse` 等。

释放 `/opt/apps/canvas-enterprise-next` 的 `23G` 空间需要递归删除目录，因此本次未执行目录删除。

## 后续释放空间建议

如确实要释放空间，需要用户在服务器上手动删除：

```bash
sudo rm -rf /opt/apps/canvas-enterprise-next
```

执行前请再次确认：

- 旧项目不再需要回滚。
- `canvas-next.hhh2121.xyz` 暂时允许返回 `404`。
- 2.0 后续会重新规划灰度域名或重新接管该域名。

本次自动操作没有执行上述递归删除命令。
