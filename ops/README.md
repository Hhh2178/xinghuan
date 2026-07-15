# ops - 无限画布 2.0 运维记录

本目录用于记录服务器、域名、部署、服务、日志、回滚和验收。

## 兼容入口说明

> 本文件是运维兼容入口。当前运行态、发布证据和回滚判断请优先跟随 `current/` 与 `../docs/logbooks/releases/`。

`ops/README.md` 继续保留为运维兼容入口，但“当前运行态”和“历史材料”已经拆成更清晰的两层：

- 当前值守入口：`current/`
- 历史归档入口：`archive/`
- 当前发布索引：`../docs/logbooks/releases/current-release-index.md`

## 当前第一跳

1. `../docs/logbooks/releases/current-release-index.md`
2. `current/README.md`
3. `current/gray.md`
4. `current/production.md`
5. `current/release-entrypoints.md`

## 当前运行态摘要

- Gray：
  - 域名：`canvas-next.hhh2121.xyz`
  - 端口：`127.0.0.1:18200`
  - 版本：`v0.6.13`
  - release：`20260715-permission-platform-hardening-v0613`
  - 状态：`统一权限平台已在 gray enforced，readiness 与真实成员/账号覆盖验收通过`
  - 当前补修：`目录与执行一致性、统一后台、迁移门禁和 PostgreSQL revision 并发保护`
  - 当前机器态：`ComfyUI 功能冻结前 gray 曾接入 1 台本机实例（通过 SSH 反向隧道暴露 server 127.0.0.1:28188）；本轮未推进 ComfyUI`
  - 本地待补修：`environment-sync-local 抽取延期到专门批次；F1 realtime implementation 已延期；ComfyUI 功能继续冻结`
- Production：
  - 域名：`canvas.hhh2121.xyz`
  - 端口：`127.0.0.1:18100`
  - 版本：`v0.5.22`
  - release：`20260702-envsync-admin-sections-prod-r1-v0522`
  - 状态：`2026-07-14 15:44 已从 v0.5.27 回退；API/Worker active，内网与公网状态接口已验证为 v0.5.22`
  - 当前补修：`AIFork SD 视频适配、RH catalog 可见性和管理员会话失效处理正在 v0.6.1 灰度验证，未通过前不恢复生产晋级`

## current / archive 分工

- `current/` 只保留仍直接用于当前部署、放行、回滚判断和 release 追溯的入口。
- `archive/` 存放已经脱离当前值守职责、但仍需保留为审计证据的批次化历史材料。
- 更细的发布证据与验收记录优先写入 `../docs/logbooks/releases/` 与 `../docs/logbooks/validations/`。

## 常用入口

- 服务器连接：`server-connection.md`
- Phase E 放行 gate：`phase-e-observability-release-gate-2026-06-15.md`
- Gray 部署：`gray-deploy-runbook.md`
- Gray 标准清单：`gray-release-standard-checklist.md`
- Gray 记录模板：`templates/gray-release-record-template.md`
- Production 部署：`production-deploy-runbook.md`
- Production 验收：`production-acceptance-checklist.md`
- 历史归档总索引：`archive/README.md`

## 清理规则

- 不批量删除文件或目录。
- 不使用递归删除命令。
- 不清理运行期数据、密钥、服务器环境文件或用户素材。
- 如需删除历史文档，必须先列出单个明确路径，再逐个删除。
- 历史材料优先移动到 `archive/`，不要直接删除。
