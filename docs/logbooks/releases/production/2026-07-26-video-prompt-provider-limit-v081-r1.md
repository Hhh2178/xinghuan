# Video Prompt Provider Limit v0.8.1 Production

- release: `20260726-video-prompt-provider-limit-v081-r1`
- version: `0.8.1`（版本号保持不变）
- source commit: `04a9e87`
- archive SHA-256: `9AA0205D3F38BE4C452CC27247ABEBF3B9E8331C3436D4122057B29FC6AD3709`
- rollback: `20260725-media-retention-v081-r2`

## Deployment

- 旧 Production：`canvas.hhh2121.xyz`，current 已切换。
- 新 Production：`canvas.zezhen.online`，current 已切换。
- API/Worker 已重启，数据库迁移无新增项；权限 readiness 与公网状态通过。

## Boundary

- 版本号保持 `0.8.1`。
- 未执行 release retention prune；既有 Production 构建包、数据库备份和用户媒体均保留。
- 旧服务器继续在线作为回滚来源。
