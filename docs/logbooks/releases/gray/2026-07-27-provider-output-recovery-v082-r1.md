# Provider Output Recovery v0.8.2 Gray

- release: `20260727-provider-output-recovery-v082-r1`
- version: `0.8.2`
- source commit: `55aa3d9`
- rollback: `20260726-video-prompt-provider-limit-v081-r1`

## Scope

- Provider 已成功但视频内容下载或本地物料化失败时，增加可重试、可分类、可恢复的完整链路。
- 支持 `429/502/503/504` 重试、响应流中断分类与 Range 续传，并保留 `remoteVideoUrls`、`upstreamTaskId` 和恢复状态。
- 新增后台 `POST /api/admin/tasks/:id/recover-output`，恢复产物不重新调用 Provider、不重复计费。
- Redis 入队增加连接和命令超时；仅部署新服务器 Gray，Production 保持当前版本不变。

## Deployment

- Gray：`canvas-next.zezhen.online`，current 切换至本 release。
- API：`xinghuan-canvas-next.service`；Worker：`xinghuan-canvas-next-worker.service`。
- 数据库迁移按 release 脚本执行；未执行 retention prune，未触碰 Production、用户媒体或密钥。

## Result

- 运行态版本、环境和权限模式由 Gray runtime verify 复核。
- Grok 五次真实生成任务的提交、轮询、下载、物料化和最终状态记录在对应 validation 台账。
