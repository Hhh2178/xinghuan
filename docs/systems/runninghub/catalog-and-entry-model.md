# RunningHub 条目与 Catalog 模型

## 条目最关键的字段

- `kind`
- `pageId`
- `workflowId`
- `appId`
- `runTargetId`
- `allowsEmptyInputs`
- `fields`
- `inputSlots`
- `outputSchema`
- `executionRules`

## 建模规则

### Workflow 条目

- `kind = workflow`
- `workflowId` 与 `runTargetId` 对应 Workflow 运行目标
- 如果 RH 明确无入参，可出现 `allowsEmptyInputs = true` 且 `fields = 0`

### AI App 条目

- `kind = app`
- `appId` 与 `runTargetId` 对应 AI App 运行目标
- 提交与查询走 AI App v2 协议

## 为什么不能混填

如果把 Workflow 的 ID 填进 App 区，或把 App 的 ID 填进 Workflow 区：

- 后台分析与保存会产出错位配置
- 前端节点运行时会进入错误协议分支
- worker 会拿错提交目标

因此当前系统要主动阻断：

- `app + workflowId`
- `workflow + appId`

## 字段来源

优先级：

1. 后台条目人工维护或同步得到的真实字段
2. `requestExample.nodeInfoList` 推断出的草案
3. 远端运行目标补水

前端不应再伪造不可执行的参数表单。
