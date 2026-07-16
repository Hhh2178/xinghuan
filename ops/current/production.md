# 当前 Production 运行态

- 入口域名：`canvas.hhh2121.xyz`
- 服务端口：`127.0.0.1:18100`
- 当前版本：`v0.6.13`
- 当前 release：`20260716-permission-platform-hardening-prod-r1-v0613`
- 当前状态：`统一权限平台已在 production enforced；API/Worker active，内网与公网状态、readiness 和真实未分组成员目录已验证`
- 当前补修：`继续观察历史任务失败趋势与 revision conflict；浏览器自动化截图验收仍未完成`
- 当前发布索引：`../../docs/logbooks/releases/current-release-index.md`
- 当前运行材料：
  - `../../docs/logbooks/releases/production/2026-07-16-permission-platform-hardening-production.md`
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
- 统一权限数据：127 Subjects、120 published、7 restricted、478 rules、2 principals、0 readiness failures
- `v0.5.1` 晋级前数据库备份：
  - `/opt/apps/xinghuan-canvas/shared/backups/xinghuan_canvas_next_before_v051_20260624_213115.dump`

## 当前回滚锚点

- 代码回滚目标：
  - `/opt/apps/xinghuan-canvas/releases/20260702-envsync-admin-sections-prod-r1-v0522`
- 回滚后需重启：
  - `xinghuan-canvas.service`
  - `xinghuan-canvas-worker.service`

## 当前 systemd / nginx 模板

- `../systemd/xinghuan-canvas.service.example`
- `../systemd/xinghuan-canvas-worker.service.example`
- `../systemd/xinghuan-canvas-output-prune.service.example`
- `../systemd/xinghuan-canvas-output-prune.timer.example`
- `../nginx/canvas.hhh2121.xyz.conf.example`
