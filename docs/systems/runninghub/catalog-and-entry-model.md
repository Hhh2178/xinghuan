# RunningHub 条目与 Catalog 模型

## 条目最关键的字段

- `kind`
- `catalogId`
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

## 任务快照字段

为了让后台审计页能够把成功用量稳定下钻到 RH 后台条目，新 RH 队列任务现在会在 `xh_tasks.payload/result` 中补写以下快照：

- `rhCatalogId`
- `rhCatalogTitle`
- `rhCatalogKind`

这样即使后续后台条目标题被修改，审计页仍能先看到任务创建时的快照，并在必要时回退到当前 catalog 重新匹配。

## 组权限治理第一批落点

- public catalog 透出现在会按当前登录用户所属组过滤：
  - `GET /api/runninghub/catalog`
  - `GET /api/runninghub/catalog/:catalogId`
- 当前口径不是“显示锁定条目”，而是：
  - 没有开放权限的 RH AI 应用 / 工作流，前台直接不显示
- 后端仍保留 submit 兜底：
  - 旧画布如果还残留了已经被禁用的 RH 条目
  - 或有人绕过前端直接调用 submit
  - `POST /api/proxy/runninghub/submit` 仍会做最终权限校验
- 这保证了：
  - 正常新使用路径里看不到无权限条目
  - 历史残留引用不会偷偷继续执行

## 审计回溯规则

- 优先按任务里的 `rhCatalogId` 回放 RH 条目
- 缺失时按 `providerId + kind + runTargetId` 回退匹配
- 如果仍无法命中，则在审计页中显示为 `未知 RH 条目`
