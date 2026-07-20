# 权限目录与媒体参考契约 Production v0.7.10 发布

- release：`20260720-permission-media-contract-prod-r1-v0710`
- 制品：Gray 已验收的 `20260720-permission-media-contract-gray-r1-v0710`
- source commit：`96b196e`
- 回滚：`20260720-aicopy-video-contract-scope-prod-r1-v078`

## 变更

- 公共资源及可治理目录对象发布，账号/用户组权限规则可编辑。
- 参考视频、参考音频上限为 10，默认值为 2。
- SD 按次/按秒契约与 `input.media[]` 兼容已从 Gray 验收制品晋级。

本次仅晋级已通过 Gray 验收的版本，不递增产品版本，不执行 retention/prune。

## Production 验证

- API/Worker：`active`；公网与内网状态均为 `0.7.10 / production / enforced`。
- 权限 readiness：`ready=true`，subjects `140`，published `121`，restricted `13`，retired `6`，rules `2772`，failures `0`。
- 生产库启动前清理了旧 retired subject rule，reconcile apply 后幂等验证通过。
