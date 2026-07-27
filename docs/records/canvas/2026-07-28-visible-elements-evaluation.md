# Canvas 可见性渲染评估（0.8.3）

## 结论

本轮不启用 React Flow `onlyRenderVisibleElements`。当前 Canvas 保持全量节点渲染，原因是内建可见性裁剪会把画布外分组子节点从 DOM 渲染集中移除；这与当前的选中反馈、跨视口连线、fit-view 全图边界和运行态投影同时存在耦合，尚无 renderer-level 回归证据证明可以安全打开。

## 评估场景

- viewport：`800×600`，transform `[0, 0, 1]`
- 分组节点：`group` 覆盖全图，子节点 `far` / `far-child` 在视口外
- 连线：视口内 `near -> far` 横跨视口；视口外 `far -> far-child`
- 状态：视口外 `far` 保持 selected，并注入 `runtimeStage=polling` / `progress=45%`
- fit-view：使用全部节点边界，而不是裁剪后的节点集合

## 证据

`apps/web/src/components/canvas/visible-elements-evaluation.test.tsx` 通过：

- `getNodesInside` 只把 `group`、`near` 判为当前可见；画布外节点仍保留在状态图中。
- 跨视口连线仍可见；完全画布外连线不可见。
- 选中状态和运行态投影仍存在于画布外节点数据。
- fit-view 边界包含完整分组和画布外子节点。
- Canvas 源码未启用 `onlyRenderVisibleElements`。

## 决策

拒绝本轮启用可见性裁剪，保留当前渲染策略；后续若要重试，必须补充真实 renderer-level selection、group edge、fit-view、runtime projection 回归和同一性能 harness 的 100/200 节点收益证据。
