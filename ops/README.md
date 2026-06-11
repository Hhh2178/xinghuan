# ops - 无限画布 2.0 运维记录

本目录用于记录服务器、域名、部署、服务、日志、回滚和验收。

## 当前状态

- 灰度入口：`canvas-next.hhh2121.xyz`，服务端口 `127.0.0.1:18200`。
- 生产入口：`canvas.hhh2121.xyz`，服务端口 `127.0.0.1:18100`。
- 灰度与生产是两套 Nginx 入口、端口和 release 目录；当前共用同一 PostgreSQL 数据底座。
- 旧无限画布服务器运行态已清理，最终证据见 `old-canvas-cleanup-2026-06-04.md`。
- 当前本机修复与文档清理进度见 `current-fix-cleanup-progress-2026-06-08.md`。
- 后台 AI 助手 Hermes 灰度联调与上线记录见 `assistant-hermes-gray-2026-06-08.md`。
- 画布助手 UI 与可见文案清理灰度记录见 `canvas-assistant-ui-gray-2026-06-09.md`。
- 生成节点 `生成数量` 灰度与生产发布记录见 `generation-count-release-2026-06-10.md`。
- 异步视频 Provider 模板规范主文档见 `../docs/prd/v0.1.0/provider-async-video-template-spec.md`。

## 当前运行态入口

- `server-connection.md`
- `current-fix-cleanup-progress-2026-06-08.md`
- `entry-ui-gray-2026-06-07.md`
- `full-node-acceptance-audit-2026-06-07.md`
- `assistant-hermes-gray-2026-06-08.md`
- `canvas-assistant-ui-gray-2026-06-09.md`
- `generation-count-release-2026-06-10.md`
- `phase3-node-acceptance-gray-2026-06-07.md`
- `phase3-node-acceptance-production-2026-06-07.md`
- `production-cutover-2026-06-06.md`
- `production-user-accounts-2026-06-06.md`

## 当前灰度材料

- `gray-deploy-runbook.md`
- `phase3-output-prune-gray-2026-06-06.md`
- `phase3-lifecycle-gray-2026-06-06.md`
- `phase3-canvas-resource-pg-hotfix-gray-2026-06-07.md`
- `phase3-runninghub-workflow-gray-2026-06-07.md`
- `phase3-node-acceptance-gray-2026-06-07.md`
- `entry-ui-gray-2026-06-07.md`
- `nginx/canvas-next.hhh2121.xyz.conf.example`
- `systemd/xinghuan-canvas-next.service.example`
- `systemd/xinghuan-canvas-next-worker.service.example`
- `systemd/xinghuan-canvas-next-output-prune.service.example`
- `systemd/xinghuan-canvas-next-output-prune.timer.example`

## 当前生产材料

- `production-deploy-runbook.md`
- `production-acceptance-checklist.md`
- `production-cutover-2026-06-06.md`
- `production-prep-2026-06-07.md`
- `phase3-node-acceptance-production-2026-06-07.md`
- `nginx/canvas.hhh2121.xyz.conf.example`
- `systemd/xinghuan-canvas.service.example`
- `systemd/xinghuan-canvas-worker.service.example`
- `systemd/xinghuan-canvas-output-prune.service.example`
- `systemd/xinghuan-canvas-output-prune.timer.example`

## 历史发布记录

以下文件保留为历史审计证据，不再作为当前运行态入口：

- `domain-map-2026-06-04.md`
- `server-state-2026-06-04.md`
- `server-disk-usage-2026-06-04.md`
- `old-canvas-cleanup-2026-06-04.md`
- `gray-deploy-2026-06-05.md`
- `gray-auth-deploy-2026-06-05.md`
- `gray-admin-deploy-2026-06-05.md`
- `gray-admin-security-2026-06-05.md`
- `gray-db-readiness-2026-06-05.md`
- `postgresql-gray-migration-2026-06-05.md`
- `postgresql-repository-cutover-2026-06-05.md`
- `worker-queue-gray-deploy-2026-06-05.md`
- `phase2-complete-gray-2026-06-06.md`
- `grsai-worker-gray-2026-06-06.md`
- `production-preflight-2026-06-06.md`

## 清理规则

- 不批量删除文件或目录。
- 不使用递归删除命令。
- 不清理运行期数据、密钥、服务器环境文件或用户素材。
- 如需删除历史文档，必须先列出单个明确路径，再逐个删除。
