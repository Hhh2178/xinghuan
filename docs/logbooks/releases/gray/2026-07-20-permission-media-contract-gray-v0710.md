# 权限目录与媒体参考契约 Gray v0.7.10 发布

- release：`20260720-permission-media-contract-gray-r1-v0710`
- source commit：`96b196e`
- 回滚：`20260720-aicopy-sd-media-contract-gray-r1-v079`

## 变更

- 公共资源根、分类、素材条目、RunningHub 条目和画布节点均进入已发布目录，账号/用户组规则可编辑；停用的服务商模型仍保持全局受限。
- 参考视频、参考音频最大数量统一为 10，默认值为 2，并同步 SD 契约 profile 配置。
- 保留按次、按秒、渠道 431/900 的 AICOPY `input.media[]` 契约兼容与旧请求字段兼容。

## 发布边界

- 本轮只发布 Gray；Production 保持 v0.7.8。
- 不执行 Release retention/prune，不删除旧 Release。

## Gray 验证结果

- 当前 release：`20260720-permission-media-contract-gray-r1-v0710`；API/Worker `active`。
- 公网与内网 `/api/status`：`0.7.10 / gray / enforced`。
- 权限 readiness：`ready=true`，subjects `128`，published `122`，restricted `3`，retired `3`，failures `0`。
- Gray 已迁移四个 SD 模型：按次模型使用 `sd2-per-request`；三个按秒模型使用 `sd2-per-second`；混合媒体上限 `referenceVideos/referenceAudio=10`，默认 `2`。
