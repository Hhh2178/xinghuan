# Canvas 系统

## 这个系统负责什么

Canvas 系统负责用户前台画布、节点编排、项目读写、素材连接和生成节点消费。

## 关键代码入口

- `apps/web`
- `packages/canvas-core`
- `packages/model-core`

## 建议阅读顺序

1. `node-and-data-model.md`
2. `project-and-material-flow.md`
3. `frontend-design/`

## 视觉与交互规范

- 前台画布视觉规范：`docs/systems/canvas/frontend-design/`

## 相关系统

- `../api/`
- `../worker/`
- `../storage-and-data/`

## 当前重点

- 节点目录将原“工具节点”拆为颜色一致的三个可见分类：工作流类（teal，工作流输入/输出/变量与组执行管理器）、逻辑处理类（sky，循环、候选选择、分割、代码）和工具（orange，画板、图像处理与宫格工具）。历史 `canvas-agent` 仍可渲染，但不会在目录中创建；Sidebar 的 `AI 托管` 是打开工作流范围托管面板的入口，不会新增节点。
- 工作流输入将外部或调用方的强类型数据带进 Region；工作流输出将 Region 内确认的文本、图像、视频或音频交给区域外。直接在同一画布串联时可不使用，跨边界、可复用工作流或需要明确 Run 输入/输出时使用。
- 代码节点归入工具节点橙色体系，标签节点归入辅助节点灰蓝体系；节点面板归属以 `nodeRegistry.ts` 为唯一权威。
- 公共工作流模板弹层与资源库共用 `kind=workflow` 数据、缩略图和插入链路，不维护静态模板副本。
- 组框支持独立循环次数；组执行管理器可配置节点失败后的额外重试次数（`0-10`，旧画布默认 `3`），文本分割手动运行和组运行共用同一 runner。
- 继续把前台热点超级文件拆成 `sections / helpers / runtime hooks`
- `Canvas.tsx` 已完成第一批真实下沉：
  - `useCanvasPersistence.ts`
  - `useCanvasConnectionPanMode.ts`
  - `CanvasFlowOverlays.tsx`
- `Canvas.tsx` 已完成第二批真实下沉：
  - `useCanvasRuntime.ts`
  - `useCanvasViewportHotkeys.ts`
  - `CanvasOverlayLayer.tsx`
- `Canvas.tsx` 已完成第三批真实下沉：
  - `useCanvasSelectionMenus.ts`
  - `useCanvasBulkReconnect.ts`
- `Canvas.tsx` 已完成第四批真实下沉：
  - `useCanvasSendFlow.ts`
- `ApiSettings.tsx` 已完成 `Key sections / local paths / footer actions / cloud target detail panel / advanced provider detail panel` 五层收口，并已退出 `1200+` watchlist
- `RunningHubNode.tsx` 已完成 `helpers -> config section -> param section` 三层收口，并已退出 `1200+` watchlist
- `RHToolsNode.tsx` 已完成 `helpers -> param/runtime sections -> runner/launcher view shells` 三层收口，并已退出 `1200+` watchlist
- 下一批前台热点建议继续优先处理：
  - `Canvas.tsx` 的 `connect picker / context-menu view shell / remaining edit interactions`
  - `PoseMasterNode.tsx` 的 `field schema / preview sections / runtime actions`
  - `VideoNode.tsx` 的 runtime panel / param sections
# Canvas Connectivity Follow-up (2026-07-24)

- Workflow Region uses a translucent background layer below SVG edges and Canvas nodes. Grouping a node must never make a connected edge opaque or non-interactive.
- When exactly one node is selected, direct upstream edges are cyan and direct downstream edges are orange; the reachable upstream/downstream chain uses subdued blue/amber, while unrelated edges remain visible but muted. No or multiple selections retain the standard edge treatment.
