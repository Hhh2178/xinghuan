# Canvas Flow Height Fix 验证（0.8.3-r19）

## 稳定性行为

- 错误边界现在是纵向 flex 容器且占满工作区高度，避免 ReactFlow 根节点、底纹、节点、Controls 与 MiniMap 被压缩到零高或负坐标。

## 证据

- 浏览器复现修复前 `.react-flow` 高度为 `0px`，`.react-flow__minimap` 存在但 y 坐标为 `-110`；根因确认是错误边界 wrapper 未建立 flex/height 传递。
- 修复后 focused CSS test、Web type-check、release prepare/build/package/governance 全部通过。
- 旧服务器 Gray r19 严格运行态验证通过：API/Worker active、内部/公网状态为 `0.8.3 / gray`、permission readiness ready。
- Production 按用户要求保持 `0.7.17`，未晋级 r19。
