# Provider Output Recovery v0.8.2 Gray

- release: `20260727-provider-output-recovery-v082-r1`
- version: `0.8.2`
- source commit: `55aa3d9`
- archive SHA-256: `F1607BADC97988CD79E3C9FBA344F67839257BFB3C466AAF5409E3418BF8B6A1`
- rollback: `20260726-video-prompt-provider-limit-v081-r1`

## Scope

- Provider 已成功但视频内容下载或本地物料化失败时，增加可重试、可分类、可恢复的完整链路。
- 支持 `429/502/503/504` 重试、响应流中断分类与 Range 续传，并保留 `remoteVideoUrls`、`upstreamTaskId` 和恢复状态。
- 新增后台 `POST /api/admin/tasks/:id/recover-output`；发布后审计发现恢复模式字段的 API/Worker 契约不一致，当前入口尚不能证明不重新调用 Provider 或不重复计费。
- Redis 入队增加连接和命令超时；新旧服务器 Gray 均部署本 release，Production 保持当前版本不变。

## Deployment

- 新服务器 Gray：current 已切换至本 release；`zezhen.online` 因注册商暂停解析暂不可作为公网入口。
- 旧服务器 Gray：`canvas-next.hhh2121.xyz`，current 已切换至本 release，作为当前可用灰度入口。
- API：`xinghuan-canvas-next.service`；Worker：`xinghuan-canvas-next-worker.service`。
- 数据库迁移按 release 脚本执行；未执行 retention prune，未触碰 Production、用户媒体或密钥。

## Result

- 旧服务器 Gray 的内部与公网状态、API/Worker 和权限 readiness 已由 Gray runtime verify 全部复核通过。
- Grok 五次真实生成任务的提交、轮询、下载、物料化和最终状态记录在对应 validation 台账。
