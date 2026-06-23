# RunningHub 长期记忆

## 当前长期有效判断

- RunningHub 是独立于普通 Provider 的外部运行目标体系
- Workflow 与 AI App 不共享同一套运行标识和提交协议
- 后台 RH 工作台是 RH 条目录入、分析、同步输入槽和测试的主入口

## 当前稳定规则

- `runTargetId` 必须与 `kind` 对应
- `allowsEmptyInputs=true` 的 workflow 可以合法 `fields=0`
- 前端 RH 节点优先消费后台条目定义、`displayLabel` 和 `outputSchema`
- Worker 对 AI App 已切到官方 v2 submit/query 协议

## 当前长期风险

- 若继续把历史混合态条目留在 catalog 中，前端仍可能命中不可执行配置
- 若 RH 上游不返回 `nodeInfoList`，条目仍需要后台人工补录

## 相关入口

- `../systems/runninghub/README.md`
- `../systems/runninghub/workflow-app-differences.md`
- `../../ops/runninghub-app-v2-gray-release-2026-06-22.md`
