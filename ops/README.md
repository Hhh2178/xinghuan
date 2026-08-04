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
  - 当前可用域名：`canvas-next.hhh2121.xyz`（旧服务器 Gray）
  - 目标域名：`canvas-next.zezhen.online`（注册商暂停解析期间暂不可用）
  - 端口：`127.0.0.1:18200`
  - 版本：`v0.8.20`
  - release：`20260804-runninghub-group-drawer-v0820-r1`
  - 状态：`旧服务器 Gray 已部署；API/Worker、权限 readiness、公网状态与认证 RunningHub 分组行为均通过；启动时发现的权限数据漂移已通过受控 reconciliation 修复；浏览器视觉复核因本机缺少 Chromium 待补`
  - 当前补修：`RunningHub 分组 CRUD、分组/条目双门禁、停用分组隐藏条目修复及 Admin 独立分组抽屉；Admin/Canvas 继续复用统一 groupId 选择器`
  - 当前限制：`柏拉图 5/5 因上游 no available platform 未创建上游任务；其显式 firstFrame 能力未在模型目录开启，当前只能按单图参考能力提交`
  - 本轮制品源提交：`412ca1cabbbdf14f0812c796939d2fedb08f8c17`
  - 本轮制品 SHA-256：`ca8e5c755d3c450f5188b2cc94f782828b2028f7b3d719d8594e3e8b48ba90e8`
  - 当前机器态：`ComfyUI 功能冻结前 gray 曾接入 1 台本机实例（通过 SSH 反向隧道暴露 server 127.0.0.1:28188）；本轮仅做既有页面视觉收敛`
  - 本地待补修：`Admin D 治理/内容工作台已激活；模型目录和 Analytics 助手上下文标签待统一；系统健康显示 13 条 DB queued / Redis empty 差异，待按受控 reconciliation 单独处理；Provider 历史探测和磁盘容量仍为 unknown；ComfyUI 功能继续冻结`
- Production：
  - 当前可用域名：`canvas.hhh2121.xyz`（旧服务器 Production）
  - 目标域名：`canvas.zezhen.online`（注册商暂停解析期间暂不可用）
  - 端口：`127.0.0.1:18100`
  - 版本：`v0.8.15`
  - release：`20260803-assistant-runtime-v0815-r1`
  - 状态：`用户授权后，Gray 同一验证归档已晋级；API/Worker、权限 readiness 与公网状态全部通过`
  - 当前补修：`Provider/RunningHub 共享配置栏唯一吸顶，内部列表独立滚动，新建页脚色块已移除；Agent 管理按当前服务环境隔离`
  - Agent：`沿用已验收状态；本次未在 Production 重复执行付费 canary，也未启用生产 AI 运行开关`
  - 当前限制：`柏拉图仍受上游无可用渠道限制；Production 未重复发起付费 Provider 任务`
  - 加固审计：`../docs/records/worker/2026-07-27-generation-delivery-and-agent-hardening-audit.md`

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
