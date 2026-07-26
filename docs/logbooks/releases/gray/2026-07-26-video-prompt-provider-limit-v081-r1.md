# Video Prompt Provider Limit v0.8.1 Gray

- release: `20260726-video-prompt-provider-limit-v081-r1`
- version: `0.8.1`（版本号保持不变）
- source commit: `04a9e87`
- archive SHA-256: `9AA0205D3F38BE4C452CC27247ABEBF3B9E8331C3436D4122057B29FC6AD3709`
- rollback: `20260725-media-retention-v081-r2`

## Scope

- 修复视频提示词字节限制在平台 API 入队前误拦截的问题。
- 历史 `advancedConfig.maxPromptBytes` 和 AICOPY/AIFork 4096 提示不再作为平台 admission limit；由服务商返回实际限制。
- 保留通用输入安全上限，不改动数据库、Provider Key、用户媒体或资源库数据。

## Deployment

- 旧 Gray：`canvas-next.hhh2121.xyz`，current 已切换。
- 新 Gray：`canvas-next.zezhen.online`，current 已切换。
- API/Worker 已重启，数据库迁移无新增项；未执行 release retention prune。

## Result

- 两端内部与公网 `/api/status` 均返回 `0.8.1 / gray / enforced`。
- 两端 API/Worker active，权限 readiness 无失败。
- 旧服务器保持在线，既有生产构建包、备份和用户媒体未删除。
