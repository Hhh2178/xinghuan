# Server State Snapshot - 2026-06-04

## 采集时间

- 时间：`2026-06-04T14:24:13+08:00`
- 主机：`VM-0-12-ubuntu`
- 内核：`6.8.0-101-generic`
- 服务器：腾讯云 VPS `101.33.75.38`
- SSH：`ubuntu@101.33.75.38 -p 728`

## 磁盘状态

根分区：

| Filesystem | Size | Used | Avail | Use% | Mount |
|---|---:|---:|---:|---:|---|
| `/dev/vda2` | `59G` | `46G` | `11G` | `81%` | `/` |

判断：

- 磁盘已经偏紧，2.0 POC 和新 release 需要先规划空间。
- 旧灰度项目 `/opt/apps/canvas-enterprise-next` 当前占用约 `23G`，是主要关注点。
- 在未确认回滚需求前，不要批量删除旧 release。需要清理时必须先列清单并逐项确认。

## 应用目录占用

| 路径 | 占用 | 说明 |
|---|---:|---|
| `/opt/apps/canvas-enterprise-next` | `23G` | 旧无限画布灰度项目，当前仍在运行 |
| `/opt/apps/infinite-canvas-archive` | `8.0K` | 旧草稿 Canvas 归档入口目录 |
| `/opt/apps/canvas-enterprise` | 未发现有效占用 | 正式目录未启用或未采集到 |

## 旧项目当前运行状态

旧项目灰度：

- 当前 release：`/opt/apps/canvas-enterprise-next/releases/5148170`
- 服务：`canvas-enterprise-next.service`
- Worker：`canvas-enterprise-worker.service`
- 监听：`127.0.0.1:18200`
- 域名：`https://canvas-next.hhh2121.xyz`

服务状态：

| 服务 | 状态 |
|---|---|
| `nginx` | `active` |
| `canvas-enterprise-next.service` | `active` |
| `canvas-enterprise-worker.service` | `active` |
| `redis-server.service` | `active` |
| `internal-proxy-ss.service` | `active` |
| `internal-proxy-subscription.service` | `active` |

## 端口状态

| 地址 | 说明 |
|---|---|
| `0.0.0.0:80` | Nginx HTTP |
| `0.0.0.0:443` | Nginx HTTPS |
| `0.0.0.0:728` | SSH |
| `0.0.0.0:8443` | 内部 Shadowsocks |
| `127.0.0.1:18080` | 内部代理订阅服务 |
| `127.0.0.1:18200` | 旧无限画布灰度 Web |

## 对 2.0 的影响

- 2.0 不应直接覆盖旧 `canvas-enterprise-next`，除非用户明确要求停用旧项目。
- 2.0 POC 推荐先使用新的本地端口，例如 `127.0.0.1:18300`。
- 2.0 灰度域名是否复用 `canvas-next.hhh2121.xyz` 需要单独决策。
- 当前磁盘可用空间约 `11G`，如果继续保留旧项目全部 release，2.0 部署空间会偏紧。

## 清理建议

- 不自动清理。
- 后续如需释放空间，应先生成旧 release 清单、标注当前 release、保留最近可回滚版本，再逐个明确删除。
- 禁止批量删除目录。
