# Permission and Image Node Repair Gray v0.7.6 发布

## 发布信息

- release：`20260718-permission-image-node-repair-gray-r1-v076`
- source branch：`xinghuan-integration-clean`
- source commit：`c9eaf5a4be2127463721e2343264db624917ce00`
- 版本：`0.7.6`
- 回滚：`20260718-generation-artifact-stream-abort-gray-r2-v075`

## 变更

- 权限管理矩阵只写账号或组 scoped rules，不再从当前主体选择器改写全局 Subject 发布状态；支持“组 deny、单账号 allow”，且不会放开其他账号。
- ReactFlow 节点序号徽标改为稳定 DOM 宿主，修复节点运行/条件渲染时的 `insertBefore` 错误边界。
- 恢复 `/api/image/resize`、`upscale`、`crop`、`combine`，输入限制在当前用户 input/output 或图片 data URL，输出登记到 Generation Library。
- 图片操作节点对视频、音频、文本等不兼容上游给出可操作提示，尺寸调整节点明确为图片节点。

## 状态

- 制品：`dist-release/20260718-permission-image-node-repair-gray-r1-v076.tar.gz`；1,850,600 bytes；SHA-256 `f98dc5fb45f3c68038c2653f2d026d9675fc081fd2bbc3ecc83a1047e3d4cd36`。
- Gray 已切换到本 release；API 与 Worker active，内外网均返回 `0.7.6 / gray / enforced`，permission readiness 为 ready。
- Production 保持 `0.7.5`，未切换、未迁移、未重启。
- Gray retention 已按受保护脚本收口为 3 个 Release：保留 current v0.7.6、rollback v0.7.5 r2 与 v0.7.5 r1；移除 3 个更旧目录并释放 923,869,184 bytes，未触碰 shared 数据、备份或用户素材。
