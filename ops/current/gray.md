# 当前 Gray 运行态

- 入口域名：`canvas-next.hhh2121.xyz`
- 服务端口：`127.0.0.1:18200`
- 当前版本：`v0.5.22`
- 当前 release：`20260702-comfyui-shared-app-and-workflow-upload-gray-r1-v0522`
- 当前状态：`2026-07-02 已完成 gray deploy + runtime verify`
- 当前补修：`2026-07-02-comfyui-shared-app-and-workflow-upload-gray.md`
- 当前本地待补修：`待用户在 gray 上验收公共工作流上传、共享 ComfyUI 节点目录显示、共享工作流运行输出与权限边界`
- 当前发布索引：`../../docs/logbooks/releases/current-release-index.md`
- 当前运行材料：
  - `../../docs/logbooks/releases/gray/2026-07-02-comfyui-shared-app-and-workflow-upload-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-30-performance-toggle-and-import-fixes-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-30-group-execution-manager-runtime-rounds-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-30-group-execution-manager-and-tech-theme-lockdown-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-29-group-default-permission-refresh-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-28-web-version-sync-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-28-admin-audit-account-drilldown-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-27-admin-capability-flow-create-form-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-28-admin-assistant-environment-sync-overlap-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-27-admin-structural-layout-fixes-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-27-admin-account-api-resource-preview-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-27-admin-layout-overlap-resource-grid-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-27-admin-shell-visual-unification-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-27-admin-resource-content-governance-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-26-lazy-import-recovery-admin-grid-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-26-admin-governance-redesign-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-26-group-permissions-group-lock-gray.md`
  - `../gray-deploy-runbook.md`
  - `../gray-acceptance-checklist.md`
  - `../../docs/logbooks/releases/gray/2026-06-26-resource-preview-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-26-canvas-compatibility-persistence-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-26-workflow-resource-visibility-gray.md`
  - `../../docs/records/canvas/2026-06-26-canvas-compatibility-and-persistence-risk-analysis.md`
  - `../../docs/logbooks/releases/gray/2026-06-24-timeout-zero-and-app-shell-loading-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-24-runninghub-timeout-empty-default-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-24-announcement-center-and-runninghub-queue-repair-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-24-cyber-pcb-entry-brand-refresh-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-24-api-worker-canvas-hotspot-decomposition-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-24-api-settings-decomposition-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-24-engineering-governance-guardrails-gray.md`
  - `../runninghub-grsai-worker-key-pool-gray-release-2026-06-23.md`
  - `../runninghub-poll-resume-gray-release-2026-06-23.md`
  - `../runninghub-default-key-migrate-gray-release-2026-06-23.md`
  - `../runninghub-key-pool-progress-gray-release-2026-06-23.md`
  - `../runninghub-draft-output-reset-gray-release-2026-06-23.md`

## 当前回滚锚点

- 代码回滚目标：
  - `/opt/apps/xinghuan-canvas-next/releases/20260630-performance-toggle-and-import-fixes-gray-r1-v0520`
- deploy 前上一版锚点：
  - `/opt/apps/xinghuan-canvas-next/releases/20260630-performance-toggle-and-import-fixes-gray-r1-v0520`
- 回滚后需重启：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`

## 当前 systemd / nginx 模板

- `../systemd/xinghuan-canvas-next.service.example`
- `../systemd/xinghuan-canvas-next-worker.service.example`
- `../systemd/xinghuan-canvas-next-output-prune.service.example`
- `../systemd/xinghuan-canvas-next-output-prune.timer.example`
- `../nginx/canvas-next.hhh2121.xyz.conf.example`
