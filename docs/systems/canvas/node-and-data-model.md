# Canvas 节点与数据模型

## 当前稳定原则

- 节点体系以通用节点 + 模型目录 + schema 驱动
- 数据类型要显式隔离，不能用 `any` 绕过连接校验
- RunningHub 节点、图像/视频/音频节点都应消费结构化条目和参数定义

## 关键建模层

- `packages/canvas-core`
- `packages/model-core`
- `apps/web/src/components/nodes/`

## 当前重点

- 节点参数区优先消费后台定义
- 上游素材聚合要统一，不在单节点各自手搓
