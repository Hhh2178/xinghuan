# 媒体节点尺寸与运行任务续接 Gray v0.7.12 发布

- release：`20260720-media-node-runtime-resume-gray-r1-v0712`
- source commit：`54332d3`
- archive：`20260720-media-node-runtime-resume-gray-r1-v0712.tar.gz`
- 回滚：`20260720-workflow-media-boundary-gray-r1-v0711`

## 变更

- 媒体节点按固有比例初始化和手动拉伸，多素材使用完整展示布局。
- 普通画布刷新保留 Output 已生成视频、节点尺寸和运行任务；仅保存为工作流的深拷贝清理媒体与运行时字段。
- 按批次持久化远端任务 ID，刷新或前端版本更新后只查询原任务，不重复提交。

本轮只部署 Gray，Production 保持 v0.7.11；不执行 retention/prune。

## 部署

- Gray current：`/opt/apps/xinghuan-canvas-next/releases/20260720-media-node-runtime-resume-gray-r1-v0712`
- API/Worker 已重启并 active。
