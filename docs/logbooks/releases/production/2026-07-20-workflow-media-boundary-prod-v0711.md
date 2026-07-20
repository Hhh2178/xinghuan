# 工作流媒体边界与批量视频 Production v0.7.11 发布

- release：`20260720-workflow-media-boundary-prod-r1-v0711`
- 制品：Gray 已验收的 `20260720-workflow-media-boundary-gray-r1-v0711`
- source commit：`4e3e3be`
- 回滚：`20260720-permission-media-contract-prod-r1-v0710`

## 变更

- 工作流导出清除生成/参考媒体残留，但不影响本地画布保存和刷新。
- Text、Upload、Output 节点保留拉伸尺寸。
- OutputNode 保留批量视频数组和下游引用。

本次复用 Gray 已验收版本，不执行 retention/prune。

## Production 验证

- API/Worker active；公网与内网状态均为 `0.7.11 / production / enforced`。
- 权限 readiness ready，subjects `142`，published `125`，restricted `11`，retired `6`，rules `2772`，failures `0`。
