# 媒体输出保留与批次追加 Gray v0.7.13 发布

- release：`20260720-media-node-runtime-resume-gray-r2-v0713`
- source commits：`e00bd89`、`a5f9601`
- archive：`20260720-media-node-runtime-resume-gray-r2-v0713.tar.gz`
- 回滚：`20260720-media-node-runtime-resume-gray-r1-v0712`

## 变更

- 输出节点按媒体类型独立恢复已保存快照，避免图片参考先加载时覆盖视频结果。
- 图像和视频节点新增“输出累积（跨次生成追加）”开关，默认关闭。
- 同一批次的多个生成任务始终逐项完成、逐项追加到同一个输出素材节点。

本轮只部署 Gray，Production 保持 v0.7.11；不执行 retention/prune。
