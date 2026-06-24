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
- `RHToolsNode.tsx` 已开始按 `field/output helpers -> runtime display -> param sections` 的顺序收口
