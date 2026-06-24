# Canvas 系统

## 这个系统负责什么

Canvas 系统负责用户前台画布、节点编排、项目读写、素材连接和生成节点消费。

## 关键代码入口

- `apps/web`
- `packages/canvas-core`
- `packages/model-core`

## 建议阅读顺序

1. `node-and-data-model.md`
2. `project-and-material-flow.md`

## 相关系统

- `../api/`
- `../worker/`
- `../storage-and-data/`

## 当前重点

- 继续把前台热点超级文件拆成 `sections / helpers / runtime hooks`
- `ApiSettings.tsx` 已完成 `Key sections / local paths / footer actions / cloud target detail panel / advanced provider detail panel` 五层收口，并已退出 `1200+` watchlist
- `RunningHubNode.tsx` 已完成 `helpers -> config section -> param section` 三层收口，并已退出 `1200+` watchlist
- `RHToolsNode.tsx` 已完成 `helpers -> param/runtime sections -> runner/launcher view shells` 三层收口，并已退出 `1200+` watchlist
- 下一批前台热点建议继续优先处理：
  - `Canvas.tsx` 的 runtime hooks / overlay panels
  - `VideoNode.tsx` 的 runtime panel / param sections
