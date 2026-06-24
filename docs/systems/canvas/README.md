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
- `ApiSettings.tsx` 已开始按 `Key sections / local paths / footer actions` 继续 section 化收口
- `RHToolsNode.tsx` 已完成 `helpers -> param/runtime sections -> runner/launcher view shells` 三层收口，并已退出 `1200+` watchlist
- 下一批前台热点建议继续优先处理：
  - `ApiSettings.tsx` 的 detail form
  - `RunningHubNode.tsx` 的参数区 / 输出区
  - `Canvas.tsx` 的 runtime hooks / overlay panels
