# Canvas 加载与 Workspace 预加载验证（0.8.3-r4，进行中）

## 当前基线

- `App.tsx` 原先在模块评估阶段创建 Workspace `Promise.all`，认证前即请求 Sidebar、Canvas 和 RHToolsProvider。
- 本批次把预加载移到认证成功后的 idle 调度，并将失败视为可继续导航的非阻塞结果。

## 当前实现证据

- `workspace-preload.test.ts`：3 passed，覆盖未认证不加载、认证后单次 idle 调度、失败不重试。
- Web type-check：passed。
- `verify:web-lazy-import-recovery`：passed。
- `verify:file-hotspot-budgets`：passed。
- Deterministic fixture factory and tests now cover empty, 50, 100 and 200-node scenarios with stable IDs, positions, edges, groups and bounded runtime projections; fixture generation never calls a Provider.

## 尚未完成

- 空画布及 50/100/200 节点 fixture 的真实浏览器性能基线尚未采集。
- 未改变重型 MediaPipe/editor chunk 的交互式加载策略，尚未发布 r4 到服务器。
- 当前证据不代表 Canvas 首屏或节点渲染预算已达标。
