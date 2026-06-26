# ops - 无限画布 2.0 运维记录

本目录用于记录服务器、域名、部署、服务、日志、回滚和验收。

## 兼容入口说明

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
  - 版本：`v0.5.2`
  - release：`20260626-shared-resource-admin-generation-gray-r1-v052`
  - 状态：`2026-06-26 已完成 deploy + runtime verify`
- Production：
  - 域名：`canvas.hhh2121.xyz`
  - 端口：`127.0.0.1:18100`
  - 版本：`v0.5.1`
  - release：`20260624-timeout-zero-and-app-shell-loading-prod-r2-v051`

## current / archive 分工

- `current/` 只保留仍直接用于当前部署、放行、回滚判断和 release 追溯的入口。
- `archive/` 存放已经脱离当前值守职责、但仍需保留为审计证据的批次化历史材料。
- 更细的发布证据与验收记录优先写入 `../docs/logbooks/releases/` 与 `../docs/logbooks/validations/`。

## 常用入口

- 服务器连接：`server-connection.md`
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
