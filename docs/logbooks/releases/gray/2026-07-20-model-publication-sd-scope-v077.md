# Model Publication and SD Scope Gray v0.7.7 发布

## 发布信息

- release：`20260720-model-publication-sd-scope-gray-r1-v077`
- source branch：`xinghuan-integration-clean`
- source commit：`2d80c8f5a6d6dc6ac6ec3981822bd4682383c48b`
- 版本：`0.7.7`
- 回滚：`20260718-permission-image-node-repair-gray-r1-v076`
- 制品：`dist-release/release-20260720-model-publication-sd-scope-gray-r1-v077.tar.gz`
- 制品大小：`1,851,564` bytes
- SHA-256：`5c03b0a1e22e48f6af6769412bb3853f5538ca489fb0ed81fce10ce48f39033c`

## 变更

- Provider 模型的全局发布状态改为跟随模型目录的 enabled 状态，修复启用模型因创建时默认 restricted 而被全部普通用户隐藏的问题。
- 管理后台不再允许手动修改 Provider 模型 Subject 的全局 exposure，避免全局状态和模型目录漂移。
- 对 4 个普通用户组及 ungrouped 主体配置 3 个 `sd2-*` 视频模型的 view/execute deny；账号 allow 仍高于组 deny。

## 数据保护与结果

- 切换前数据库备份：`/opt/apps/xinghuan-canvas-next/shared/backups/20260720-before-model-publication-sd-scope-v077-r1.dump`。
- 备份大小 `9,088,745` bytes，SHA-256 `e61b6aace1c9d056f4682cc43aaca1b8d8da695f1ec021e0225d66f8d7ca8c8e`，`pg_restore --list` 返回 126 条有效条目。
- 24 个迁移均已存在，无迁移重复执行。
- Gray 已切换到本 release；API/Worker active 且 `NRestarts=0`，严格 runtime/readiness 返回 `0.7.7 / gray / enforced / ready`。
- 普通用户目录有 48 个模型、10 个视频模型；仅 3 个 SD 视频模型被隐藏，所有非 SD 视频模型正常可见。
- Retention 保留 current v0.7.7、rollback v0.7.6 与 v0.7.5 r2；删除旧 `20260718-generation-artifact-stream-abort-gray-r1-v075` Release，释放 `308,023,296` bytes。shared 数据、备份与用户素材未触碰，代码可由 Git/历史制品恢复。
