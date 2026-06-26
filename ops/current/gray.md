# 当前 Gray 运行态

- 入口域名：`canvas-next.hhh2121.xyz`
- 服务端口：`127.0.0.1:18200`
- 当前版本：`v0.5.1`
- 当前 release：`20260626-workflow-resource-visibility-gray-r1-v051`
- 当前状态：`2026-06-26 已完成 deploy + runtime verify`
- 当前发布索引：`../../docs/logbooks/releases/current-release-index.md`
- 当前运行材料：
  - `../gray-deploy-runbook.md`
  - `../gray-acceptance-checklist.md`
  - `../../docs/logbooks/releases/gray/2026-06-26-workflow-resource-visibility-gray.md`
  - `../../docs/logbooks/releases/gray/2026-06-26-canvas-compatibility-persistence-gray.md`
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
  - `/opt/apps/xinghuan-canvas-next/releases/20260624-runninghub-timeout-empty-default-gray-r2-v051`
- 回滚后需重启：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`

## 当前 systemd / nginx 模板

- `../systemd/xinghuan-canvas-next.service.example`
- `../systemd/xinghuan-canvas-next-worker.service.example`
- `../systemd/xinghuan-canvas-next-output-prune.service.example`
- `../systemd/xinghuan-canvas-next-output-prune.timer.example`
- `../nginx/canvas-next.hhh2121.xyz.conf.example`
