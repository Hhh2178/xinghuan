# API 接口地图

## 后台类接口

- `/api/admin/system`
- `/api/admin/runninghub/*`
- `/api/admin/tasks`
- `/api/admin/providers`
- `/api/admin/models`

## 画布与任务类接口

- 节点提交任务相关接口
- 任务列表和任务详情接口
- 结果读取与素材访问接口

## RunningHub 关键接口

- 条目列表与编辑：`/api/admin/runninghub/*`
- 分析草案：`/api/admin/runninghub/analyze`
- 测试与 catalog 透出：由 `server.ts` 与 `runninghub-catalog.ts` 协同处理

## 观测类接口

- `/api/status`
- `/api/admin/system`

## 排障第一跳

- 参数保存了但前端没变：先看 `/api/admin/runninghub/*`
- 配置保存了但运行态没跟上：先看 `/api/admin/system` 返回的 `effectiveConcurrency`
