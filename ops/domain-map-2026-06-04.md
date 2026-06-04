# Domain Map Snapshot - 2026-06-04

## 采集时间

- 日期：`2026-06-04`
- 采集方式：本机 DNS 查询 + 腾讯云 VPS Nginx 配置读取
- 服务器：`101.33.75.38`
- SSH：`ubuntu@101.33.75.38 -p 728`

## DNS 托管

`hhh2121.xyz` 当前权威 DNS 为 Cloudflare：

- `hasslo.ns.cloudflare.com`
- `rosemary.ns.cloudflare.com`

腾讯云/DNSPod 控制台如果提示“未使用云解析 DNS 服务”，属于预期情况；当前解析应在 Cloudflare 控制台维护。

## 当前 A 记录

| 域名 | 类型 | TTL | 解析结果 | 当前用途 |
|---|---|---:|---|---|
| `hhh2121.xyz` | A | `300` | `101.33.75.38` | 主域名，当前由 Hermes/internal proxy 相关 Nginx 入口占用 |
| `canvas.hhh2121.xyz` | A | `300` | `101.33.75.38` | 无限画布正式域名预留，当前未发现启用的 Nginx server block |
| `canvas-next.hhh2121.xyz` | A | `300` | `101.33.75.38` | 旧无限画布灰度域名，当前映射到旧项目 |

## 当前 Nginx 映射

| Nginx 配置 | Server Name | Upstream | 说明 |
|---|---|---|---|
| `/etc/nginx/sites-enabled/canvas-enterprise-next.conf` | `canvas-next.hhh2121.xyz` | `http://127.0.0.1:18200` | 旧无限画布灰度项目 |
| `/etc/nginx/sites-enabled/hermes-media-relay` | `101.33.75.38 hhh2121.xyz www.hhh2121.xyz _` | `http://127.0.0.1:18080` | 主域名和默认入口，内部代理订阅/媒体相关服务 |
| `/etc/nginx/sites-enabled/hermes-webui.conf` | `hermes.hhh2121.xyz` | `http://127.0.0.1:8787` | Hermes Web UI |
| `/etc/nginx/sites-enabled/files.hhh2121.xyz.conf` | `files.hhh2121.xyz` | 未在本次摘要中展开 | 文件服务入口 |

## 当前旧无限画布服务

- 域名：`canvas-next.hhh2121.xyz`
- Nginx upstream：`127.0.0.1:18200`
- systemd：`canvas-enterprise-next.service`
- worker：`canvas-enterprise-worker.service`
- 当前 release：`/opt/apps/canvas-enterprise-next/releases/5148170`
- 当前状态：Web、worker、Redis、Nginx 均为 `active`

## 2.0 域名建议

2.0 清理旧项目时建议采用以下顺序：

1. 先保留当前 `canvas-next.hhh2121.xyz`，不要直接覆盖，直到旧项目归档和回滚需求确认。
2. 2.0 POC 阶段可以先使用新本地端口，例如 `127.0.0.1:18300`，不接公网域名。
3. 2.0 灰度可新建子域名，例如 `canvas2-next.hhh2121.xyz` 或 `canvas-v2-next.hhh2121.xyz`。
4. 2.0 验收通过后，再决定是否将 `canvas-next.hhh2121.xyz` 指向 2.0 灰度。
5. 正式发布时再启用或切换 `canvas.hhh2121.xyz`。

## 清理旧项目注意事项

- 当前旧项目仍占用 `canvas-next.hhh2121.xyz` 和 `127.0.0.1:18200`。
- 清理前必须先决定：
  - 是否保留旧 release 回滚点。
  - 是否停用 `canvas-enterprise-next.service`。
  - 是否停用 `canvas-enterprise-worker.service`。
  - 是否释放 `127.0.0.1:18200`。
  - 是否将 `canvas-next.hhh2121.xyz` 转给 2.0。
- 不要改动 `hhh2121.xyz` 主域名、`hermes.hhh2121.xyz`、`files.hhh2121.xyz` 或内部代理服务，除非任务明确要求。

## 后续待补

- Cloudflare 控制台截图或导出记录。
- 证书到期时间。
- 2.0 灰度域名最终选择。
- 2.0 正式域名切换计划。
