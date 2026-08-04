# 当前 Production 运行态

- 当前可用入口：`canvas.hhh2121.xyz`（旧服务器 Production）
- 目标入口：`canvas.zezhen.online`（注册商暂停解析期间暂不可用）
- 服务端口：`127.0.0.1:18100`
- 当前版本：`v0.8.24`
- 当前 release：`20260804-runninghub-group-collapse-v0824-r1`
- 当前状态：`已由 Gray 同一验证归档晋级；API/Worker、内部/公网状态和权限 readiness 均已通过，当前环境为 production，权限模式 enforced`
- 新服务器并行状态：`43.131.246.222 / canvas.zezhen.online 已运行同一 v0.8.24 sealed release；API/Worker、权限 readiness 和 HTTPS 状态均通过，尚未切换公网流量`
- 当前补修：`RunningHub 分组选择器默认展开且可单独折叠；此前的归档下载、共享配置栏和 Agent 环境隔离能力继续保留`
- Agent 运行态：`运行环境静态 readiness 门禁已保留；本批次未重复执行付费 Agent canary，亦未启用生产 AI 运行开关`
- 当前限制：`Production 未重复发起付费 Provider 任务；Gray 已完成 Aifork Grok 首帧 5/5 上游成功和本地回传验证，柏拉图本轮仍受上游渠道容量限制`
- 加固审计：`../../docs/records/worker/2026-07-27-generation-delivery-and-agent-hardening-audit.md`
- 当前发布索引：`../../docs/logbooks/releases/current-release-index.md`
- 当前发布记录：`../../docs/logbooks/releases/production/2026-08-04-runninghub-group-collapse-v0824-r1.md`
- 当前验证记录：`../../docs/logbooks/validations/2026-08-04-runninghub-group-collapse-production-v0824-r1.md`
- 新服务器发布记录：`../../docs/logbooks/releases/production/2026-08-04-runninghub-group-collapse-new-server-production-v0824-r1.md`
- 新服务器验证记录：`../../docs/logbooks/validations/2026-08-04-runninghub-group-collapse-new-server-production-v0824-r1.md`
- 回退锚点：`20260803-assistant-runtime-v0815-r1`
- 当前运行材料：
  - `../../docs/logbooks/releases/production/2026-07-30-admin-rail-single-owner-footer-production-v0814-r1.md`
  - `../../docs/logbooks/validations/2026-07-30-admin-rail-single-owner-footer-production-v0814-r1.md`
  - `../../docs/logbooks/releases/production/2026-07-25-ai-governance-runtime-current-production-v0744.md`
  - `../../docs/logbooks/validations/2026-07-25-ai-governance-runtime-current-production-v0744.md`
  - `../../docs/logbooks/releases/production/2026-07-22-canvas-revision-observability-production-v0718.md`
  - `../../docs/logbooks/validations/2026-07-22-canvas-revision-observability-production-v0718.md`
  - `../../docs/logbooks/releases/production/2026-07-21-admin-health-visual-resource-domain-production-v0717.md`
  - `../../docs/logbooks/validations/2026-07-21-admin-health-visual-resource-domain-production-v0717.md`
  - `../../docs/logbooks/releases/production/2026-07-20-workflow-media-boundary-prod-v0711.md`
  - `../../docs/logbooks/validations/2026-07-20-workflow-media-boundary-prod-v0711.md`
  - `../../docs/logbooks/releases/production/2026-07-20-aicopy-video-contract-scope-production-v078.md`
  - `../../docs/logbooks/validations/2026-07-20-aicopy-video-contract-scope-production-v078.md`
  - `../../docs/logbooks/releases/production/2026-07-20-model-publication-sd-scope-production-v077.md`
  - `../../docs/logbooks/validations/2026-07-20-model-publication-sd-scope-production-v077.md`
  - `../../docs/logbooks/releases/production/2026-07-18-permission-image-node-repair-production-v076.md`
  - `../../docs/logbooks/validations/2026-07-18-permission-image-node-repair-production-v076.md`
  - `../../docs/logbooks/releases/production/2026-07-18-generation-artifact-stream-abort-production-v075.md`
  - `../../docs/logbooks/validations/2026-07-18-generation-artifact-stream-abort-production-v075.md`
  - `../../docs/logbooks/incidents/2026-07-18-generation-artifact-production-stream-abort-rollback.md`
  - `../../docs/logbooks/releases/production/2026-07-18-generation-artifact-authority-production-v074.md`
  - `../../docs/logbooks/validations/2026-07-18-generation-artifact-authority-production-v074.md`
  - `../../docs/logbooks/releases/production/2026-07-17-admin-ten-domain-version-correction-production-v073.md`
  - `../../docs/logbooks/validations/2026-07-17-admin-ten-domain-version-correction-production-v073.md`
  - `../../docs/logbooks/releases/production/2026-07-17-audit-rankings-production-v072.md`
  - `../../docs/logbooks/validations/2026-07-17-audit-rankings-production-v072.md`
  - `../../docs/logbooks/releases/production/2026-07-16-permission-platform-hardening-production.md`
  - `../../docs/logbooks/releases/production/2026-07-17-group-retry-catalog-order-production.md`
  - `../../docs/logbooks/validations/2026-07-17-group-retry-catalog-order-production-v070.md`
  - `../../docs/logbooks/validations/2026-07-16-permission-platform-hardening-production.md`
  - `../../docs/logbooks/incidents/2026-07-14-production-rollback-auth-and-rh-catalog.md`
  - `../../docs/logbooks/releases/production/2026-07-14-task-list-lightweight-production.md`
  - `../../docs/logbooks/releases/production/2026-07-02-envsync-admin-sections-production.md`
  - `../../docs/logbooks/releases/production/2026-07-01-performance-toggle-button-sizing-production.md`
  - `../../docs/logbooks/releases/production/2026-06-30-group-execution-manager-runtime-rounds-production.md`
  - `../../docs/logbooks/releases/production/2026-06-28-web-version-sync-production.md`
  - `../../docs/logbooks/releases/production/2026-06-28-admin-assistant-environment-sync-overlap-production.md`
  - `../../docs/logbooks/releases/production/2026-06-27-admin-capability-flow-create-form-production.md`
  - `../production-deploy-runbook.md`
  - `../production-acceptance-checklist.md`
  - `../../docs/logbooks/releases/production/2026-06-24-timeout-zero-and-app-shell-loading-production.md`
  - `../../docs/logbooks/releases/production/2026-06-24-runninghub-timeout-empty-default-production.md`
  - `../../docs/logbooks/releases/production/2026-06-24-task-runtime-kernel-governance-production.md`

## 当前数据库实态

- 当前 production `canvas.env` 仍指向数据库：`xinghuan_canvas_next`
- `XINGHUAN_EXPECTED_DATABASE_NAME` 当前也为：`xinghuan_canvas_next`
- gray 实际使用 `xinghuan_canvas_gray`，production 与 gray 当前为独立数据库；production 保留历史库名 `xinghuan_canvas_next`
- 统一权限数据：156 Subjects、120 published、26 restricted、10 retired、2810 rules、11 principals、0 readiness failures
- `v0.7.6` 晋级前数据库备份：
  - `/opt/apps/xinghuan-canvas/shared/backups/20260718-before-permission-image-node-repair-v076-r1.dump`
- `v0.7.2` 晋级前数据库备份：
  - `/opt/apps/xinghuan-canvas/shared/backups/20260717-audit-rankings-prod-pre-v072.dump`
- `v0.7.3` 晋级前数据库备份：
  - `/opt/apps/xinghuan-canvas/shared/backups/20260717-admin-ten-domain-version-correction-prod-pre-v073.dump`
- `v0.7.4` 晋级前数据库备份：
  - `/opt/apps/xinghuan-canvas/shared/backups/20260718-pre-v074-generation-artifact-authority.dump`
- `v0.7.5` 晋级前数据库备份：
  - `/opt/apps/xinghuan-canvas/shared/backups/20260718-before-generation-artifact-stream-abort-v075-r1.dump`
- `v0.5.1` 晋级前数据库备份：
  - `/opt/apps/xinghuan-canvas/shared/backups/xinghuan_canvas_next_before_v051_20260624_213115.dump`

## 当前回滚锚点

- 代码回滚目标：
  - `/opt/apps/xinghuan-canvas/releases/20260728-plato-output-recovery-v083-r22`
- 回滚后需重启：
  - `xinghuan-canvas.service`
  - `xinghuan-canvas-worker.service`

## 当前 systemd / nginx 模板

- `../systemd/xinghuan-canvas.service.example`
- `../systemd/xinghuan-canvas-worker.service.example`
- `../systemd/xinghuan-canvas-output-prune.service.example`
- `../systemd/xinghuan-canvas-output-prune.timer.example`
- `../nginx/canvas.hhh2121.xyz.conf.example`
