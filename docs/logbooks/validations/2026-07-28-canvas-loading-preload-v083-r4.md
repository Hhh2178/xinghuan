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
- Real browser baseline (`npm run measure:canvas-performance`) completed against the local 0.8.3 single-port build. The raw JSON is gitignored under `output/playwright/`; the repeatable budget gate is `npm run verify:canvas-performance-budget`.

### 浏览器基线摘要（本地 0.8.3，未触发 Provider）

| 节点场景 | 实际渲染 | 导航耗时 | 资源数 | 长任务 |
| --- | ---: | ---: | ---: | ---: |
| 0 | 0 | 2132ms | 11 | 0 / 0ms |
| 50 | 50 | 112ms | 61 | 0 / 0ms |
| 100 | 100 | 182ms | 66 | 0 / 0ms |
| 200 | 200 | 321ms | 66 | 2 / 197ms |

200 节点仍在当前预算（导航 ≤1000ms、资源 ≤80、长任务 ≤3 且总时长 ≤250ms）内；无运行时错误。导航指标包含冷启动差异，后续优化只接受同一 harness 的回归比较。

## 尚未完成

- 空画布及 50/100/200 节点 fixture 的真实浏览器性能基线已采集并通过预算门禁。
- 重型 MediaPipe/editor chunk 仍保持交互式加载策略；本记录仅覆盖 r4 的本地验证，未发布 r4 到服务器。
- Provider 生成/回传/物化链路的在线验收仍沿用 r3 的 Gray 证据；本次浏览器 harness 不触发计费 Provider。
