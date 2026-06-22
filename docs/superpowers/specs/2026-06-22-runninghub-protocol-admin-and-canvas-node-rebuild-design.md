# RunningHub Protocol Admin And Canvas Node Rebuild Design

## Background

2026-06-19 的 RunningHub 工作台已经打通了目录条目、运行目标同步和画布节点自动展开参数区，但在真实维护链路里还有 3 个断点：

1. RH 分析工作台缺少 `requestExample` / `responseExample` 输入，管理员只能靠备注猜字段。
2. 后端草案生成没有消费 `requestExample.nodeInfoList`，导致输入槽仍常常停留在空白草稿态。
3. RH 任务链路仍把 `instanceType` 默认写成 `plus`，会把“未指定实例规格”和“明确要求 plus”混在一起。

## This Round Goal

把 RH 条目分析、目录治理和画布提交流程重新对齐为“示例驱动”的协议链路：

- 分析面板允许直接提交请求示例和响应示例。
- 后端优先从 `requestExample` 自动提取 `runTargetId` 与 `nodeInfoList` 草案。
- `runTargetId` 出现表单值与示例值不一致时，给出明确预警。
- RH 任务提交不再默认落成 `instanceType=plus`。

## Scope

### 1. Admin Workspace

- 文件：`apps/admin/src/admin-runninghub-workspace.tsx`
- 新增分析输入：
  - `requestExample`
  - `responseExample`
- 调用 `/api/admin/runninghub/analyze` 时把两段示例一起提交。
- 面板文案明确“请求示例/响应示例/备注线索”共同参与结构化草案生成。

### 2. Backend Analyze Draft

- 文件：`apps/api/src/server.ts`
- 新增示例解析辅助逻辑：
  - 解析 JSON 对象
  - 从 `requestExample` 提取 `runTargetId / webappId / workflowId / pageId`
  - 从 `requestExample.nodeInfoList` 生成 `fields`
  - 根据字段草案补一份基础 `parameterSchema`
- 当表单输入的 `runTargetId` 与 `requestExample` 内提取到的目标不一致时，向 `warnings` 写入人工确认提示。
- 若示例 JSON 非法或没有 `nodeInfoList`，也要明确告警，而不是静默回退。

### 3. Task Payload Semantics

- 文件：
  - `apps/api/src/server.ts`
  - `apps/worker/src/worker.ts`
- 去掉 `instanceType` 的默认 `plus`。
- 只有在用户或目录条目明确提供 `instanceType` 时，才把该字段写入 RH 提交 payload。

## Expected Outcome

- 管理员可直接把 RunningHub 官方请求样例粘进工作台，得到初始 `fields` 草案。
- RH 条目里的 `runTargetId` 不再因为表单和示例混填而悄悄漂移。
- 画布和队列链路对 `instanceType` 的语义回归为“显式才发送”。

## Verification

- `npm run verify:runninghub-analyze-contract`
- `npm run verify:runninghub-workflow-contract`
- `npm run verify:runninghub-queue-governance-contract`
