# RunningHub 系统

## 这个系统负责什么

RunningHub 系统负责把 RH Workflow 与 AI App 作为外部运行目标接入到无限画布 2.0，覆盖后台条目建模、前端节点选择与运行、后端 catalog 透出，以及 worker 的提交与查询执行。

## 建议阅读顺序

1. `integration-architecture.md`
2. `catalog-and-entry-model.md`
3. `workflow-app-differences.md`
4. `node-runtime-flow.md`

## 关键代码入口

- 后台工作台：`apps/admin/src/admin-runninghub-workspace.tsx`
- 后台条目编辑器：`apps/admin/src/admin-runninghub-item-editor.tsx`
- 后台列表面板：`apps/admin/src/admin-runninghub-panel.tsx`
- API catalog：`apps/api/src/runninghub-catalog.ts`
- API 执行描述：`apps/api/src/runninghub-execution-descriptor.ts`
- 画布节点：`apps/web/src/components/nodes/RunningHubNode.tsx`
- 共享类型：`packages/shared/src/runninghub.ts`
- worker 执行：`apps/worker/src/worker.ts`

## 当前重点边界

- RH 条目必须区分 `workflow` 与 `app`
- `runTargetId` 必须与 `kind` 对应
- `allowsEmptyInputs=true` 的 workflow 允许 `fields=0`
- 节点参数区优先消费后台条目定义，而不是继续在前端猜
- RH Key 池是 RunningHub 的真实并发来源：
  - 后台 Provider 可维护多 Key
  - RH 总并发自动汇总所有启用 Key 的 `maxConcurrency`
  - 任务入队时会绑定具体 RH Key，Worker 优先使用该 Key 执行
- RH 节点阶段进度统一口径：
  - 提交中或排队中：`5%`
  - 已开始生成：`45%`
  - 成功完成：`100%`
  - 排队文案：`任务队列排队中`

## 兼容正文来源

- `docs/project-atlas/runninghub-integration-and-node-design.md`

## 更新规则

- 新的 RunningHub 正文优先写当前系统目录
- atlas 文件只保留兼容层方案正文
