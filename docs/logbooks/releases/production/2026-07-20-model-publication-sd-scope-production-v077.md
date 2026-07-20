# Model Publication and SD Scope Production v0.7.7 发布

## 发布信息

- release：`20260720-model-publication-sd-scope-prod-r1-v077`
- 来源 Gray：`20260720-model-publication-sd-scope-gray-r1-v077`
- source commit：`2d80c8f5a6d6dc6ac6ec3981822bd4682383c48b`
- 版本：`0.7.7`
- 回滚：`20260718-permission-image-node-repair-prod-r1-v076`
- 与 Gray 共用制品：`dist-release/release-20260720-model-publication-sd-scope-gray-r1-v077.tar.gz`
- 制品大小：`1,851,564` bytes
- SHA-256：`5c03b0a1e22e48f6af6769412bb3853f5538ca489fb0ed81fce10ce48f39033c`

## 变更与数据保护

- 复用已在 Gray 验收的完全相同制品，启用模型由目录统一决定全局发布状态。
- 对 10 个普通用户组及 ungrouped 主体配置 3 个 `sd2-*` 视频模型的 view/execute deny；账号 allow 可精确覆盖组 deny。
- 切换前数据库备份：`/opt/apps/xinghuan-canvas/shared/backups/20260720-before-model-publication-sd-scope-v077-r1.dump`。
- 备份大小 `32,892,722` bytes，SHA-256 `3ec707423a5f734571be1cf51f0a0fc87d7bb99dea312ee622b4f3e5cfd06ec0`，`pg_restore --list` 返回 126 条有效条目。
- 24 个迁移均已存在，无迁移重复执行。

## 结果

- Production 已切换到本 release；API/Worker active 且 `NRestarts=0`，Nginx 配置有效。
- 严格 runtime/readiness 返回 `0.7.7 / production / enforced / ready`。
- 普通用户目录有 43 个模型、11 个视频模型；仅 3 个 SD 视频模型被隐藏，此前误隐藏的 2 个 Grok 与 1 个 Seedance 视频模型已恢复。
- request-chain observability 通过，近 24 小时 requestId 覆盖率为 100%。既有任务失败和 canvas revision conflict 告警继续单独观察。
- Retention 保留 current v0.7.7、rollback v0.7.6 与 v0.7.5；删除旧 `20260718-generation-artifact-authority-prod-r1-v074` Release，释放 `308,019,200` bytes。shared 数据、备份与用户素材未触碰，代码可由 Git/历史制品恢复。
