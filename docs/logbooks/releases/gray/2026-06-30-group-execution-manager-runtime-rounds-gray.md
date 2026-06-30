# Group Execution Manager Runtime Rounds Gray Release - 2026-06-30

## 状态

- 环境：`gray`
- 版本：`v0.5.19`
- release：`20260630-group-execution-manager-runtime-rounds-gray-r1-v0519`
- 当前状态：`2026-06-30 本地代码与发布材料已收口，待 gray deploy + runtime verify`
- 上一灰度 release：`20260630-aicopy-video-task-and-duration-range-gray-r1-v0518`

## 发布目标

- 给全局组执行管理器补齐 `开始执行`、`持续开关`、`执行次数`。
- 全局整套组顺序支持重复执行 `N` 轮。
- 每一轮开始前都重新基于当前画布连线计算拓扑顺序。
- 组内一个上游扇出多个下游时，若下游之间无显式依赖，则使用稳定顺序，不再随机乱序。

## 变更范围

- `apps/web/src/components/nodes/GroupExecutionManagerNode.tsx`
  - 新增持续开关、执行次数、开始执行按钮。
- `apps/web/src/components/canvas/groupExecutionManager.ts`
  - 管理器数据结构新增 `enabled / executionCount`。
  - 执行计划新增管理器启用态与轮次元信息。
- `apps/web/src/components/canvas/useCanvasRuntime.ts`
  - 运行器改为读取最新画布快照。
  - 管理器启用时按整套组序列重复跑 `N` 轮。
  - 每轮开始前重新计算当前拓扑。
- `apps/web/src/utils/topologicalSort.ts`
  - 多下游无显式依赖时按稳定视觉顺序排队。
- `scripts/verify-group-execution-manager-contract.ts`
  - 新增组执行管理器与稳定拓扑顺序契约。

## Agent 已验证

- `npx tsx scripts/verify-group-execution-manager-contract.ts`
- `npm run type-check -w @xinghuan/web`
- `node scripts/verify-canvas-runtime-split-contract.mjs`

## 待 Gray 验证

- 管理器面板点击 `开始执行` 后，是否按组顺序启动全局执行。
- `执行次数 = N` 时，是否整套组顺序连续跑 `N` 轮。
- 第 1 轮和第 2 轮之间修改画布连线后，后续轮次是否按新拓扑生效。
- 同一上游连多个下游、下游互无依赖时，执行顺序是否稳定一致。
- `aicopy / grok-imagine-video-1.5-preview` 链路在当前 gray 环境是否继续正常。

## 风险

- 真机交互层还需要重点观察停止批量运行时的轮次收口体验。
- 旧画布若存在环或断链，排序器会走尽力而为的稳定补位，仍需要用户人工复核业务语义。
