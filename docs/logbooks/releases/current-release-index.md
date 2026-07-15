# 当前 Release 索引

## 当前 active release

### Gray

- 版本：`v0.6.12`
- release：`20260715-aifork-grok-fast-preprocess-v0612`
- 当前状态：`v0.6.12 已部署灰度；AIFork Grok FAST 使用插件一致的通用请求契约和参考图预处理，生产保持 v0.5.22`
- 部署内容：`FAST 独立启用 duration/video_length/aspect_ratio/video_config/reference_images；参考图按 JPEG/1024/85 处理；SD 补充契约保持隔离`
- 已验证：`公网 URL 和 Data URL 预处理回归、全工作区类型检查、构建和 71 项测试通过；灰度真实 FAST 三图任务成功，竖屏 6 秒视频与 AAC 音轨已物料化`
- 待验收：`用户可继续检查成片内容质量；协议、第三张素材、任务终态、画布轮询停止与本地回收均已通过`
- 部署时间：`2026-07-15`
- 当前批次记录：
  - `gray/2026-07-15-provider-poll-retry-grok-data-url-v0610.md`
  - `../validations/2026-07-15-provider-poll-retry-grok-data-url-v0610.md`
  - `gray/2026-07-15-aifork-grok-fast-contract-v0611.md`
  - `../validations/2026-07-15-aifork-grok-fast-contract-v0611.md`
  - `gray/2026-07-15-aifork-grok-fast-preprocess-v0612.md`
  - `../validations/2026-07-15-aifork-grok-fast-preprocess-v0612.md`
  - `gray/2026-07-15-aicopy-sd-toggle-contract-defaults-v069.md`
  - `../validations/2026-07-15-aicopy-sd-toggle-contract-defaults.md`
  - `gray/2026-07-15-aicopy-task-store-normalization-v068.md`
  - `../validations/2026-07-15-aicopy-sd-mini-six-second.md`
  - `gray/2026-07-15-aicopy-protocol-normalization-v067.md`
  - `gray/2026-07-15-aicopy-sd-final-content-v066.md`
  - `gray/2026-07-15-aicopy-sd-video-input-modes-v064.md`
  - `gray/2026-07-15-admin-runninghub-overflow-key-pool-v065.md`
  - `gray/2026-07-14-ops-task-window-gray.md`
  - `gray/2026-07-14-user-group-postgres-atomic-v063.md`
  - `gray/2026-07-14-aifork-contract-access-gray.md`
  - `gray/2026-07-05-auth-login-repository-gray.md`
  - `gray/2026-07-06-task-list-lightweight-gray.md`
  - `gray/2026-07-05-postgres-pool-tuning-gray.md`
  - `gray/2026-07-05-admin-task-list-heavy-fields-gray.md`
  - `gray/2026-07-04-comfyui-machine-first-gray.md`
  - `gray/2026-07-03-comfyui-rh-node-machine-gray.md`
  - `gray/2026-07-03-comfyui-workflow-governance-gray.md`
  - `gray/2026-07-03-comfyui-icon-fix-and-connector-harness-activation-gray.md`
  - `gray/2026-07-03-comfyui-dashboard-redesign-gray.md`
  - `gray/2026-07-03-comfyui-dashboard-redesign-gray-deployment-completed.md`
  - `gray/2026-07-02-comfyui-shared-app-and-workflow-upload-gray.md`
  - `gray/2026-06-30-performance-toggle-and-import-fixes-gray.md`
  - `gray/2026-06-30-group-execution-manager-and-tech-theme-lockdown-gray.md`
  - `gray/2026-06-30-group-execution-manager-runtime-rounds-gray.md`
  - `gray/2026-06-29-group-default-permission-refresh-gray.md`
  - `gray/2026-06-28-web-version-sync-gray.md`
  - `gray/2026-06-28-admin-audit-account-drilldown-gray.md`
  - `gray/2026-06-28-admin-assistant-environment-sync-overlap-gray.md`
  - `gray/2026-06-27-admin-capability-flow-create-form-gray.md`
- 历史运行态材料：
  - `gray/2026-06-28-web-version-sync-gray.md`
  - `gray/2026-06-28-admin-audit-account-drilldown-gray.md`
  - `gray/2026-06-28-admin-assistant-environment-sync-overlap-gray.md`
  - `gray/2026-06-27-admin-capability-flow-create-form-gray.md`
  - `gray/2026-06-27-admin-structural-layout-fixes-gray.md`
  - `gray/2026-06-27-admin-account-api-resource-preview-gray.md`
  - `gray/2026-06-27-admin-layout-overlap-resource-grid-gray.md`
  - `gray/2026-06-27-admin-shell-visual-unification-gray.md`
  - `gray/2026-06-27-admin-resource-content-governance-gray.md`
  - `gray/2026-06-26-lazy-import-recovery-admin-grid-gray.md`
  - `gray/2026-06-26-admin-governance-redesign-gray.md`
  - `gray/2026-06-26-group-permissions-group-lock-gray.md`
  - `gray/2026-06-26-resource-preview-gray.md`
  - `gray/2026-06-26-shared-resource-admin-generation-gray.md`
  - `gray/2026-06-26-workflow-resource-visibility-gray.md`
  - `gray/2026-06-26-canvas-compatibility-persistence-gray.md`
  - `gray/2026-06-24-timeout-zero-and-app-shell-loading-gray.md`
  - `gray/2026-06-24-runninghub-timeout-empty-default-gray.md`
  - `gray/2026-06-24-announcement-center-and-runninghub-queue-repair-gray.md`
  - `gray/2026-06-24-cyber-pcb-entry-brand-refresh-gray.md`
  - `gray/2026-06-24-api-worker-canvas-hotspot-decomposition-gray.md`
  - `gray/2026-06-24-api-settings-decomposition-gray.md`
  - `gray/2026-06-24-hotspot-decomposition-gray.md`
  - `gray/2026-06-24-engineering-governance-guardrails-gray.md`
  - `gray/2026-06-23-runninghub-worker-second-stage-gray.md`
  - `gray/2026-06-23-runninghub-runtime-guardrails-gray.md`
  - `gray/2026-06-22-runninghub-release-index.md`
  - `../../../ops/runninghub-grsai-worker-key-pool-gray-release-2026-06-23.md`
  - `../../../ops/runninghub-poll-resume-gray-release-2026-06-23.md`
  - `../../../ops/runninghub-default-key-migrate-gray-release-2026-06-23.md`
  - `../../../ops/runninghub-key-pool-progress-gray-release-2026-06-23.md`

### Production

- 版本：`v0.5.22`
- release：`20260702-envsync-admin-sections-prod-r1-v0522`
- 当前状态：`2026-07-14 15:44 因 admin 会话失效后的创建分组误导状态、成员 RH catalog 全空，以及 AIFork SD 视频适配问题回退；API/Worker 与内网/公网状态接口已验证为 v0.5.22`
- 当前补修：`保留 v0.5.27 release 供排查；完成 RH 可见性、管理员会话失效处理和 AIFork SD 适配验证后再重新发布`
- 当前批次记录：
  - `../incidents/2026-07-14-production-rollback-auth-and-rh-catalog.md`
  - `production/2026-07-14-task-list-lightweight-production.md`
  - `production/2026-07-02-envsync-admin-sections-production.md`
  - `production/2026-07-01-performance-toggle-button-sizing-production.md`
  - `production/2026-06-30-group-execution-manager-runtime-rounds-production.md`
  - `production/2026-06-28-web-version-sync-production.md`
  - `production/2026-06-28-admin-assistant-environment-sync-overlap-production.md`
- 历史运行态材料：
  - `production/2026-06-28-web-version-sync-production.md`
  - `production/2026-06-28-admin-assistant-environment-sync-overlap-production.md`
  - `production/2026-06-27-admin-capability-flow-create-form-production.md`
  - `production/2026-06-24-timeout-zero-and-app-shell-loading-production.md`
  - `production/2026-06-24-runninghub-timeout-empty-default-production.md`
  - `production/2026-06-24-task-runtime-kernel-governance-production.md`
  - `production/2026-06-23-runninghub-grsai-worker-key-pool-production.md`
  - `production/2026-06-23-runninghub-poll-resume-production.md`
- `production/2026-06-19-runninghub-release-index.md`

## 当前值守建议

先看本文件，再进入：

- `gray/`
- `production/`
- `../../../ops/README.md`
