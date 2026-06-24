# API 系统

## 这个系统负责什么

API 是前端、后台、Worker 与外部平台之间的统一协调层，负责鉴权、配置读取、任务提交、任务查询、catalog 透出和结果读取。

## 建议阅读顺序

1. `architecture.md`
2. `interface-map.md`
3. `request-response-flow.md`

## 关键代码入口

- 主服务：`apps/api/src/server.ts`
- 后台系统状态与并发设置路由：`apps/api/src/admin-system-routes.ts`
- 后台 system GET 路由：`apps/api/src/admin-system-settings-routes.ts`
- 后台 queue settings 路由：`apps/api/src/admin-queue-settings-routes.ts`
- 后台系统状态响应适配：`apps/api/src/admin-system-response-adapter.ts`
- 通用 system/queue 响应适配：`apps/api/src/api-response-adapters.ts`
- RunningHub catalog：`apps/api/src/runninghub-catalog.ts`
- RunningHub 执行描述：`apps/api/src/runninghub-execution-descriptor.ts`

## 当前重点

- 保持前端、后台和 Worker 之间的数据契约一致
- 保持 `runTargetId`、并发设置、任务结果与运行态字段的正确传递
- `server.ts` 当前继续朝入口装配层收口：
  - RunningHub 后台路由已下沉到 `admin-runninghub-routes.ts`
  - system status / task queue settings 已下沉到 `admin-system-routes.ts`
  - 稳定响应拼装已下沉到 `admin-system-response-adapter.ts`
  - `GET /api/admin/system` 已继续下沉到 `admin-system-settings-routes.ts`
  - queue settings 读写边界已继续下沉到 `admin-queue-settings-routes.ts`
  - system/queue response glue 已统一到 `api-response-adapters.ts`

## 兼容正文来源

- `docs/project-atlas/interfaces-and-dataflow.md`
- `docs/project-atlas/api-navigation.md`

## 更新规则

- 新的 API 正文优先写当前系统目录
- atlas 文件只保留兼容层导航正文
