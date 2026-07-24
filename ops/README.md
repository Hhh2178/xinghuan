# ops - 无限画布 2.0 运维记录

本目录用于记录服务器、域名、部署、服务、日志、回滚和验收。

## 兼容入口说明

> 本文件是运维兼容入口。当前运行态、发布证据和回滚判断请优先跟随 `current/` 与 `../docs/logbooks/releases/`。

当前运行态的机器可读权威文件是 `current/release-state.json`，环境拓扑是 `../config/environments.json`。

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
  - 版本：`v0.7.35`
  - release：`20260724-canvas-resize-materialized-gray-r1-v0735`
  - 状态：`Canvas 连线、AI 托管就绪提示、全局小地图和鼠标定位粘贴已部署；运行态、PC 视觉基础验证以及无付费隔离 Canvas Run 生命周期均已通过`
  - 当前补修：`Workflow Region 生成步骤保留完整候选集，显式 selector 独占候选裁剪；选中 Run 投影隔离，质量失败受事务边界保护`
  - 本轮制品源提交：`b07ebcc`
  - 当前机器态：`ComfyUI 功能冻结前 gray 曾接入 1 台本机实例（通过 SSH 反向隧道暴露 server 127.0.0.1:28188）；本轮未推进 ComfyUI`
  - 本地待补修：`系统健康显示 13 条 DB queued / Redis empty 差异，待按受控 reconciliation 单独处理；Provider 历史探测和磁盘容量仍为 unknown；ComfyUI 功能继续冻结`
- Production：
  - 域名：`canvas.hhh2121.xyz`
  - 端口：`127.0.0.1:18100`
  - 版本：`v0.7.18`
  - release：`20260722-canvas-revision-observability-prod-r1-v0718`
  - 状态：`画布 revision 协调与基线化观测已由 Gray 验收制品晋级，Production runtime/readiness、数据库、路由、Nginx 和日志验证通过`
  - 当前补修：`启动前 retired subject rule 漂移已通过受控 reconciliation 修复；继续观察任务失败率与 revision conflict；依赖审计项单独治理`

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
