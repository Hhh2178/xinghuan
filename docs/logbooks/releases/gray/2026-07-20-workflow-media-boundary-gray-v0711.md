# 工作流媒体边界与批量视频 Gray v0.7.11 发布

- release：`20260720-workflow-media-boundary-gray-r1-v0711`
- source commit：`4e3e3be`
- 回滚：`20260720-permission-media-contract-gray-r1-v0710`

## 变更

- 工作流导出只清理克隆副本中的生成结果、参考媒体、本地拖入媒体和 direct media 字段；本地画布保存/刷新不变。
- Text、Upload、Output 节点持久化并恢复拉伸尺寸。
- OutputNode 收集和透传 `videoUrls[]`，保留批量视频结果和下游引用。

本轮只部署 Gray，Production 保持 v0.7.10；不执行 retention/prune。
