# Workflow 与 AI App 的区别

## 为什么必须拆开

RunningHub 的 Workflow 与 AI App 在标识、提交路径、查询方式和可用字段上都不是同一套协议，混用会直接导致错误运行。

## Workflow

- 用于 ComfyUI 工作流类目标
- 常见提交接口：`/openapi/v2/run/workflow/{id}`
- 关注 `nodeInfoList`
- 更依赖节点输入映射和输出节点

## AI App

- 用于 RH 的 AI 应用
- 当前提交接口：`/openapi/v2/run/ai-app/{id}`
- 查询接口：`/openapi/v2/query`
- 不再使用旧的 `taskType=ASYNC` 提交体

## 当前系统保护

- 后台条目按 `kind` 持有 `appId / workflowId / runTargetId`
- 前端节点遇到混合态条目时直接阻断运行
- worker 按 `kind` 选择协议分支，不再把 RH 任务误落普通 Provider 分支

## 排障第一跳

看到以下问题时优先检查：

- 提示 ID 类型不匹配
- 节点显示条目但无法运行
- worker 返回错误提交路径

第一跳文件：

- `apps/api/src/runninghub-catalog.ts`
- `apps/api/src/runninghub-execution-descriptor.ts`
- `apps/worker/src/worker.ts`
