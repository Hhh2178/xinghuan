# API 系统

## 这个系统负责什么

API 是前端、后台、Worker 与外部平台之间的统一协调层，负责鉴权、配置读取、任务提交、任务查询、catalog 透出和结果读取。

## 建议阅读顺序

1. `architecture.md`
2. `interface-map.md`
3. `request-response-flow.md`

## 关键代码入口

- 主服务：`apps/api/src/server.ts`
- RunningHub catalog：`apps/api/src/runninghub-catalog.ts`
- RunningHub 执行描述：`apps/api/src/runninghub-execution-descriptor.ts`

## 当前重点

- 保持前端、后台和 Worker 之间的数据契约一致
- 保持 `runTargetId`、并发设置、任务结果与运行态字段的正确传递

## 兼容正文来源

- `docs/project-atlas/interfaces-and-dataflow.md`
- `docs/project-atlas/api-navigation.md`

## 更新规则

- 新的 API 正文优先写当前系统目录
- atlas 文件只保留兼容层导航正文
