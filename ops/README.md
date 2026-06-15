# ops - 无限画布 2.0 运维记录

本目录用于记录服务器、域名、部署、服务、日志、回滚和验收。

## 当前状态

- 灰度入口：`canvas-next.hhh2121.xyz`，服务端口 `127.0.0.1:18200`。
- 生产入口：`canvas.hhh2121.xyz`，服务端口 `127.0.0.1:18100`。
- 灰度与生产是两套 Nginx 入口、端口和 release 目录；当前已经拆分为独立 PostgreSQL 数据库与独立 release 指针。
- 旧无限画布服务器运行态已清理，最终证据见 `old-canvas-cleanup-2026-06-04.md`。
- 当前本机修复与文档清理进度见 `current-fix-cleanup-progress-2026-06-08.md`。
- 后台 AI 助手 Hermes 灰度联调与上线记录见 `assistant-hermes-gray-2026-06-08.md`。
- 画布助手 UI 与可见文案清理灰度记录见 `canvas-assistant-ui-gray-2026-06-09.md`。
- 生成节点 `生成数量` 灰度与生产发布记录见 `generation-count-release-2026-06-10.md`。
- 异步视频 Provider 模板规范主文档见 `../docs/prd/v0.1.0/provider-async-video-template-spec.md`。
- 仓库结构和当前 worktree 说明见 `../docs/repo-structure.md`。
- Cloudflare 源站封口与橙云切换验收见 `cloudflare-origin-lock-2026-06-12.md`。
- `files.hhh2121.xyz` 的完整封口方案见 `files-origin-seal-plan-2026-06-12.md`。
- `files.hhh2121.xyz` 的可执行切换清单见 `files-origin-seal-execution-checklist-2026-06-12.md`。
- `Provider Files` 从裸 IP 切到 `files.hhh2121.xyz` 的正式切换记录见 `provider-files-files-domain-cutover-2026-06-12.md`。
- 视频生成 `Unexpected token '<'` 前端误报修复灰度发布记录见 `video-json-guard-gray-2026-06-12.md`。
- Provider 生成任务标准化灰度/生产切换清单见 `provider-generation-task-rollout-checklist-2026-06-12.md`。
- Provider 生成任务标准化灰度发布记录见 `provider-generation-task-gray-release-2026-06-12.md`。
- Provider 分类队列并发灰度发布记录见 `provider-task-queue-concurrency-gray-2026-06-12.md`。
- Provider 分类队列并发正式发布记录见 `provider-task-queue-concurrency-production-2026-06-12.md`。
- ModelScope 图像协议修复与灰度/正式真实验收记录见 `modelscope-image-protocol-release-2026-06-12.md`。
- 数据库目标防呆与防空画布误清理发布记录见 `database-target-guard-release-2026-06-13.md`。
- 多用户正式化加固验收方案见 `production-multi-user-acceptance-plan-2026-06-13.md`。
- 多用户正式化实施主方案见 `../docs/production-multi-user-hardening-plan-2026-06-13.md`。
- Phase A 灰度多用户隔离真实验收记录见 `phase-a-gray-multi-user-acceptance-2026-06-13.md`。
- 发布前快照与回滚基线 Runbook 见 `release-preflight-snapshot-runbook-2026-06-13.md`。
- Phase B 画布 Revision 冲突防护灰度发布记录见 `phase-b-canvas-revision-gray-2026-06-13.md`。
- Phase B 后台关键设置 Revision 冲突防护灰度发布记录见 `phase-b-admin-settings-revision-gray-2026-06-13.md`。
- Phase C 第一批会话治理灰度/生产发布记录见 `phase-c-session-governance-release-2026-06-15.md`。
- Phase C 第二批 CSRF 同源防护灰度/生产发布记录见 `phase-c-csrf-origin-release-2026-06-15.md`。
- Phase C 第三批登录限流本地验收记录见 `phase-c-login-rate-limit-local-validation-2026-06-15.md`。
- Phase C 第三批登录限流灰度发布记录见 `phase-c-login-rate-limit-gray-2026-06-15.md`。
- Phase C 第三批登录限流灰度/生产发布记录见 `phase-c-login-rate-limit-release-2026-06-15.md`。

## 当前运行态入口

- `server-connection.md`
- `current-fix-cleanup-progress-2026-06-08.md`
- `entry-ui-gray-2026-06-07.md`
- `full-node-acceptance-audit-2026-06-07.md`
- `assistant-hermes-gray-2026-06-08.md`
- `canvas-assistant-ui-gray-2026-06-09.md`
- `generation-count-release-2026-06-10.md`
- `video-json-guard-gray-2026-06-12.md`
- `provider-generation-task-rollout-checklist-2026-06-12.md`
- `provider-generation-task-gray-release-2026-06-12.md`
- `provider-task-queue-concurrency-gray-2026-06-12.md`
- `provider-task-queue-concurrency-production-2026-06-12.md`
- `modelscope-image-protocol-release-2026-06-12.md`
- `database-target-guard-release-2026-06-13.md`
- `production-multi-user-acceptance-plan-2026-06-13.md`
- `phase-a-gray-multi-user-acceptance-2026-06-13.md`
- `release-preflight-snapshot-runbook-2026-06-13.md`
- `phase-b-canvas-revision-gray-2026-06-13.md`
- `phase-b-admin-settings-revision-gray-2026-06-13.md`
- `phase-c-session-governance-release-2026-06-15.md`
- `phase-c-csrf-origin-release-2026-06-15.md`
- `phase-c-login-rate-limit-local-validation-2026-06-15.md`
- `phase-c-login-rate-limit-gray-2026-06-15.md`
- `phase-c-login-rate-limit-release-2026-06-15.md`
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

以下材料已归档到 `archive/`，保留为历史审计证据，不再作为当前运行态入口：

- `archive/2026-06-initial-rollout/`
  - 初始灰度、认证、后台、安全、数据库切换、旧画布清理和第一轮运行态落地材料

## 清理规则

- 不批量删除文件或目录。
- 不使用递归删除命令。
- 不清理运行期数据、密钥、服务器环境文件或用户素材。
- 如需删除历史文档，必须先列出单个明确路径，再逐个删除。
- 历史材料优先移动到 `archive/`，不要直接删除。
