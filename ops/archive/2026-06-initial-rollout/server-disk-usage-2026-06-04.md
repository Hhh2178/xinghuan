# Server Disk Usage Snapshot - 2026-06-04

## 总览

采集时间：`2026-06-04`

根分区：

| Filesystem | Type | Size | Used | Avail | Use% | Mount |
|---|---|---:|---:|---:|---:|---|
| `/dev/vda2` | `ext4` | `59G` | `24G` | `33G` | `42%` | `/` |

结论：

- 旧无限画布目录删除后，服务器磁盘已从高压状态恢复到健康区间。
- 当前可用空间约 `33G`，足够做 2.0 POC 和小规模灰度。
- 当前主要占用来自 `/home/ubuntu/.hermes`、`/tmp`、系统 `/usr` 和缓存。

## 一级目录占用

| 路径 | 占用 | 说明 |
|---|---:|---|
| `/home` | `14G` | 主要是 `ubuntu` 用户目录 |
| `/usr` | `4.1G` | 系统程序与库 |
| `/tmp` | `3.3G` | 临时 pip 解包、视频分析临时目录等 |
| `/var` | `832M` | 日志、apt 缓存、系统状态 |
| `/opt` | `305M` | 应用目录，旧 canvas 已清理 |
| `/boot` | `102M` | 内核启动文件 |

## `/opt/apps`

| 路径 | 占用 | 说明 |
|---|---:|---|
| `/opt/apps/infinite-canvas-archive` | `200M` | 旧草稿 Canvas 归档 |
| `/opt/apps/hermes-webui` | `72M` | Hermes Web UI |
| `/opt/apps/shared-media` | `7.1M` | 共享媒体 |
| `/opt/apps/hermes-media-relay` | `2.0M` | Hermes media relay |
| `/opt/apps/internal-proxy` | `72K` | 内部代理配置/服务 |
| `/opt/apps` 合计 | `281M` | 当前不是空间压力点 |

旧 `/opt/apps/canvas-enterprise-next` 已删除，不再占用约 `23G`。

## `/home/ubuntu`

| 路径 | 占用 | 说明 |
|---|---:|---|
| `/home/ubuntu/.hermes` | `10G` | 最大占用，包含 Hermes profile、依赖、缓存 |
| `/home/ubuntu/.cache` | `2.1G` | 用户缓存，含 Playwright Chromium 等 |
| `/home/ubuntu/.npm` | `850M` | npm 缓存 |
| `/home/ubuntu/.local` | `157M` | 用户本地库 |
| `/home/ubuntu` 合计 | `14G` | 当前最大一级来源 |

### Hermes 细分

| 路径 | 占用 | 说明 |
|---|---:|---|
| `/home/ubuntu/.hermes/profiles` | `8.0G` | 最大子目录 |
| `/home/ubuntu/.hermes/hermes-agent` | `1.9G` | Hermes agent 源码/依赖 |
| `/home/ubuntu/.hermes/profiles/company/home` | `7.8G` | company profile home |
| `/home/ubuntu/.hermes/profiles/company/home/.cache/pip` | `2.8G` | pip 缓存 |
| `/home/ubuntu/.hermes/profiles/company/home/.local/lib/python3.12/site-packages/nvidia` | `2.7G` | NVIDIA/CUDA Python 依赖 |
| `/home/ubuntu/.hermes/profiles/company/home/.local/lib/python3.12/site-packages/torch` | `806M` | PyTorch |
| `/home/ubuntu/.hermes/profiles/company/home/.local/lib/python3.12/site-packages/triton` | `700M` | Triton |

判断：

- Hermes 当前占用主要来自 Python AI/音视频相关依赖，不建议在未确认 Hermes 功能影响前删除。
- 可优先清理 pip 缓存，而不是删除 site-packages 依赖。

## `/tmp`

| 路径 | 占用 | 说明 |
|---|---:|---|
| `/tmp/pip-unpack-m6olik6g` | `2.7G` | pip 临时解包目录，包含 torch/nvidia wheel |
| `/tmp/video_analysis` | `110M` | 视频分析临时目录 |
| `/tmp` 合计 | `3.3G` | 可作为优先清理候选 |

判断：

- `/tmp/pip-unpack-m6olik6g` 看起来是残留临时解包目录，通常可清理，但清理前仍需确认没有正在运行的 pip 安装进程。

## `/var`

| 路径 | 占用 | 说明 |
|---|---:|---|
| `/var/cache` | `431M` | 主要 apt 缓存 |
| `/var/lib` | `321M` | 系统状态 |
| `/var/log` | `79M` | 日志 |
| systemd journal | `64M` | journal 日志 |
| `/var/cache/apt` | `395M` | apt 包缓存 |

判断：

- `/var` 占用健康。
- apt 缓存可以通过常规清理释放约数百 MB，但收益不大。

## 可清理建议

优先级从高到低：

1. `/tmp/pip-unpack-m6olik6g`：约 `2.7G`，疑似临时残留。
2. `/home/ubuntu/.hermes/profiles/company/home/.cache/pip`：约 `2.8G`，pip 缓存。
3. `/home/ubuntu/.npm`：约 `850M`，npm 缓存。
4. `/var/cache/apt`：约 `395M`，apt 缓存。
5. `/home/ubuntu/.cache/ms-playwright`：包含 Chromium，若 Hermes 或浏览器自动化仍需要，不建议贸然删。

## 不建议直接清理

- `/home/ubuntu/.hermes/profiles/company/home/.local/lib/python3.12/site-packages/nvidia`
- `/home/ubuntu/.hermes/profiles/company/home/.local/lib/python3.12/site-packages/torch`
- `/home/ubuntu/.hermes/profiles/company/home/.local/lib/python3.12/site-packages/triton`
- `/home/ubuntu/.hermes/hermes-agent`

这些属于 Hermes/AI 依赖或 agent 代码，直接删除可能影响 Hermes 功能。

## 当前建议

- 暂时不需要继续清理，`33G` 可用空间足够 2.0 POC。
- 如果要为 2.0 灰度腾出更多空间，先清理 `/tmp` 残留和 pip/npm 缓存，而不是动 Hermes 依赖。
- 清理前应继续遵守项目安全规则，避免批量误删非目标目录。
