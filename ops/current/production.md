# 当前 Production 运行态

- 入口域名：`canvas.hhh2121.xyz`
- 服务端口：`127.0.0.1:18100`
- 当前版本：`v0.7.7`
- 当前 release：`20260720-model-publication-sd-scope-prod-r1-v077`
- 当前状态：`启用模型跟随目录全局发布，SD 系列由全部普通用户组 deny，单账号 allow 可覆盖组拒绝`
- 当前补修：`普通用户可见 11 个视频模型且只缺少 3 个 SD；此前误隐藏的 Grok/Seedance 已恢复；继续观察既有任务失败趋势与 revision conflict`
- 当前发布索引：`../../docs/logbooks/releases/current-release-index.md`
- 当前运行材料：
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
- 统一权限数据：134 Subjects、112 published、14 restricted、8 retired、452 rules、11 principals、0 readiness failures
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
  - `/opt/apps/xinghuan-canvas/releases/20260718-permission-image-node-repair-prod-r1-v076`
- 回滚后需重启：
  - `xinghuan-canvas.service`
  - `xinghuan-canvas-worker.service`

## 当前 systemd / nginx 模板

- `../systemd/xinghuan-canvas.service.example`
- `../systemd/xinghuan-canvas-worker.service.example`
- `../systemd/xinghuan-canvas-output-prune.service.example`
- `../systemd/xinghuan-canvas-output-prune.timer.example`
- `../nginx/canvas.hhh2121.xyz.conf.example`
