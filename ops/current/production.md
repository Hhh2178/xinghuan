# 当前 Production 运行态

- 当前可用入口：`canvas.hhh2121.xyz`（旧服务器 Production）
- 目标入口：`canvas.zezhen.online`（注册商暂停解析期间暂不可用）
- 服务端口：`127.0.0.1:18100`
- 当前版本：`v0.8.2`
- 当前 release：`20260727-provider-output-recovery-v082-r1`
- 当前状态：`旧服务器 Production 已晋级并完成正式运行态验证；由旧域名继续提供服务`
- 当前补修：`Provider 视频内容下载支持重试、流中断分类和 Range 续传；失败时保留远端产物`
- Agent 运行态：`bootstrap、Production Agent/route 发布和 observe 控制已补齐；前后台真实请求均返回 mode=agent`
- 当前限制：`recover-output 存在 API/Worker 字段契约缺陷，Gray 补丁验收前禁止在 Production 使用`
- 加固审计：`../../docs/records/worker/2026-07-27-generation-delivery-and-agent-hardening-audit.md`
- 当前发布索引：`../../docs/logbooks/releases/current-release-index.md`
- 本轮发布记录：`../../docs/logbooks/releases/production/2026-07-27-provider-output-recovery-v082-r1.md`
- 本轮验证记录：`../../docs/logbooks/validations/2026-07-27-provider-output-recovery-production-v082-r1.md`
- 当前运行材料：
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
- 统一权限数据：154 Subjects、126 published、20 restricted、8 retired、2832 rules、11 principals、0 readiness failures
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
  - `/opt/apps/xinghuan-canvas/releases/20260726-video-prompt-provider-limit-v081-r1`
- 回滚后需重启：
  - `xinghuan-canvas.service`
  - `xinghuan-canvas-worker.service`

## 当前 systemd / nginx 模板

- `../systemd/xinghuan-canvas.service.example`
- `../systemd/xinghuan-canvas-worker.service.example`
- `../systemd/xinghuan-canvas-output-prune.service.example`
- `../systemd/xinghuan-canvas-output-prune.timer.example`
- `../nginx/canvas.hhh2121.xyz.conf.example`
