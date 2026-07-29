# Canvas 新版视觉现代化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**目标：** 在不改变画布数据、节点执行、素材管理、React Flow 交互或服务端协议的前提下，为前台画布增加一个“新版画布（预览）”视觉表层。用户可在旧版（默认）与新版之间切换；新版采用悬浮展开的左侧工具栏、更清晰的点阵背景、不会遮挡小地图的悬浮层，以及更易读的图像／视频／LLM 节点编排。

**架构：** 将“画布呈现模式”作为按用户保存的浏览器本地 UI 偏好，而非画布字段或 API 状态。`App` 只负责选择模式并向现有 `Sidebar`／`Canvas` 传递；`Canvas` 保持现有 React Flow、任务和弹层树不变，仅提供稳定的 `data-*` 呈现钩子；新版节点通过共享无状态视觉容器和 scoped CSS 重排已有控件，不复制业务事件或素材状态。

**技术栈：** React 18、TypeScript、Zustand persist、React Flow、现有 Tailwind + CSS Modules 之外的 scoped stylesheet、Vitest。

## 固定边界与验收口径

- 当前版本维持 `v0.8.3`；本工作不调整后端、Worker、队列、Provider、任务 payload、画布 JSON 或素材 schema。
- 默认入口必须仍为旧版。不存在偏好、偏好损坏、用户未登录或未知模式时一律回落 `legacy`。
- 偏好只保存在浏览器本地，按当前登录用户 ID 隔离；切换时不得重新加载画布、重置视口／选中节点、取消任务、断开实时订阅或改变撤销栈。
- 现有 `MaterialPreviewSection` 的“本地／上游素材合并、排序、移除本地、排除／恢复上游”语义和所有回调必须原样保留。新版只改变其容器、尺寸、密度和溢出表现。
- 只以 PC 1920×1080 作为本轮视觉验收基准；所有新版选择器必须以 `data-canvas-presentation="modern"` 或专用组件 class 为根，不能污染旧版及管理端。
- 不能删除或替换 `Canvas` 中现有 React Flow 回调、工具栏、浮层、右键菜单、助手、运行面板、导入／导出、任务订阅、NodeActionBar 或 MiniMap；仅移动视觉容器／新增样式钩子。
- 不碰现有未提交的 `docs/logbooks/daily/2026/2026-07/*` 用户改动；不新增依赖；不在本阶段部署生产。

## 交付顺序

1. 先实现可逆的模式开关和旧版默认回退；没有开关不能开始替换默认体验。
2. 再实现壳层、左侧悬浮工具栏、背景／小地图的层级和碰撞保护。
3. 提取零业务逻辑的节点视觉原语，并先给素材区建立可验证的样式钩子。
4. 依次迁移图像、视频、LLM 三类高频节点，每次只改本类的视觉结构和 CSS。
5. 最后进行新旧切换回归、文字溢出、节点连线、素材和生成任务的手工验收。

---

### Task 1：建立按用户保存的画布呈现模式与入口开关

**Files:**
- Create: `apps/web/src/stores/canvasPresentation.ts`
- Create: `apps/web/src/stores/canvasPresentation.test.ts`
- Create: `apps/web/src/components/CanvasPresentationToggle.tsx`
- Create: `apps/web/src/components/CanvasPresentationToggle.test.tsx`
- Modify: `apps/web/src/App.tsx`

**Step 1: 先写失败测试，锁定回退与用户隔离。**

在 `canvasPresentation.test.ts` 中覆盖以下行为：

```ts
expect(resolveCanvasPresentation(undefined, {})).toBe("legacy");
expect(resolveCanvasPresentation("u-1", {})).toBe("legacy");
expect(resolveCanvasPresentation("u-1", { "u-1": "modern" })).toBe("modern");
expect(resolveCanvasPresentation("u-2", { "u-1": "modern" })).toBe("legacy");
expect(resolveCanvasPresentation("u-1", { "u-1": "unknown" as never })).toBe("legacy");
```

为开关组件写交互测试：初始文案为“旧版画布”，点击／键盘选择“新版画布（预览）”时只调用 `onChange("modern")`；组件包含可读标签和 `aria-pressed`／等价的单选语义。

**Step 2: 运行测试，确认它先失败。**

Run: `npm --workspace @xinghuan/web test -- canvasPresentation CanvasPresentationToggle`

Expected: 缺少 store／组件导致失败。

**Step 3: 实现最小、可测试的本地偏好 store。**

在新 store 中导出：

```ts
export type CanvasPresentation = "legacy" | "modern";
export const resolveCanvasPresentation = (
  userId: string | undefined,
  byUser: Record<string, CanvasPresentation | string>,
): CanvasPresentation =>
  userId && byUser[userId] === "modern" ? "modern" : "legacy";
```

用现有 `theme.ts`／`performanceMode.ts` 的 Zustand `persist` 模式创建 `useCanvasPresentationStore`，存储键命名为 `xinghuan-canvas-presentation-v1`，只保存 `byUser` 和 `setPresentation(userId, presentation)`。禁止读取／写入 API 或 Canvas 持久化对象。

实现顶栏小型 `CanvasPresentationToggle`：旧版、新版画布（预览）为清楚的二选一；视觉上沿用顶栏按钮，但不占用画布空间。它应是受控组件，不能直接访问 store，便于测试。

**Step 4: 接入 App，但不改变现有业务树。**

在 `App.tsx` 用当前 `currentUser?.id` 读取模式：无用户时为 `legacy`。把模式传给 `Sidebar` 与 `Canvas`，在顶栏现有 canvas 操作区域放置开关。不得在模式变更时更改 `key`、条件卸载 `Canvas` 或触发数据重新获取。

新增约定属性：

```tsx
<div className="t8-app-shell" data-canvas-presentation={canvasPresentation}>
```

**Step 5: 运行目标测试与类型检查。**

Run:

```bash
npm --workspace @xinghuan/web test -- canvasPresentation CanvasPresentationToggle
npm --workspace @xinghuan/web run typecheck
```

Expected: 所有测试通过；未选择模式时旧版仍被渲染。

**Step 6: Commit。**

```bash
git add apps/web/src/stores/canvasPresentation.ts apps/web/src/stores/canvasPresentation.test.ts apps/web/src/components/CanvasPresentationToggle.tsx apps/web/src/components/CanvasPresentationToggle.test.tsx apps/web/src/App.tsx
git commit -m "feat(canvas): add opt-in modern presentation switch"
```

---

### Task 2：实现新版画布壳层和悬浮左侧工具栏，且旧版像素行为不变

**Files:**
- Create: `apps/web/src/styles/canvas-modern.css`
- Create: `apps/web/src/styles/canvas-modern.test.ts`
- Modify: `apps/web/src/styles/index.css`
- Modify: `apps/web/src/components/Sidebar.tsx`
- Modify: `apps/web/src/components/Sidebar.test.tsx`（或当前对应 Sidebar 测试文件）
- Modify: `apps/web/src/App.tsx`

**Step 1: 为新版结构写失败的 DOM／CSS 契约测试。**

测试必须证明：

- `Sidebar` 接收 `presentation`，新版根有 `data-sidebar-presentation="modern"`，旧版没有覆盖层 class；
- 新版 rail 的默认宽度为 56px，展开层以 `position: absolute`／`fixed` 叠在画布上，不能以 flex 宽度挤压 Canvas；
- `canvas-modern.css` 所有选择器均以 `[data-canvas-presentation="modern"]` 开头，不含 `body`、`html` 或裸 `.react-flow` 全局覆盖；
- 新版展开状态同时支持 hover 和键盘 focus-within，且存在显式的“收起／展开”可访问入口。

**Step 2: 运行测试，确认失败。**

Run: `npm --workspace @xinghuan/web test -- Sidebar canvas-modern`

**Step 3: 以最少 JSX 包装保存 Sidebar 行为。**

为 `Sidebar` 增加 `presentation: CanvasPresentation` prop。保留当前画布列表、节点搜索、分组、节点添加、权限判断与点击 handler；只在外层增加：

```tsx
<aside
  className="t8-sidebar"
  data-sidebar-presentation={presentation}
  data-expanded={isModernExpanded}
>
  <div className="t8-sidebar-rail" aria-hidden={presentation !== "modern"}>…</div>
  <div className="t8-sidebar-panel">{existingSidebarContent}</div>
</aside>
```

不要复制节点菜单或把同一个按钮渲染两次。rail 图标应复用当前分类／操作图标，并用 `aria-label` 提供名称；完整内容仍是现有内容的一份 DOM。

在新版中以 `onMouseEnter`／`onMouseLeave` + `onFocusCapture`／`onBlurCapture` 驱动临时展开，另提供键盘／触控可用的显式 toggle。旧版分支继续使用现在的 `w-64` 流式侧栏。

**Step 4: 写 scoped shell 样式。**

导入 `canvas-modern.css`，只在 modern 根下定义：顶栏 56px、rail 56px、展开面板 288px、毛玻璃深色面板、焦点环、图标命中区最少 40px、分组间距和字体等级。展开面板使用 `z-index` 高于 React Flow nodes、低于 modal；关闭时 Canvas 获得完整宽度。

为所有可能溢出的文案应用：

```css
min-width: 0;
overflow-wrap: anywhere;
text-overflow: ellipsis;
```

但不要对 prompt 正文施加单行省略。

**Step 5: 运行测试与桌面手工检查。**

Run:

```bash
npm --workspace @xinghuan/web test -- Sidebar canvas-modern
npm --workspace @xinghuan/web run typecheck
```

Manual (1920×1080): 新版默认只显示图标列；悬停／Tab 展开内容且不移动画布或现有节点；鼠标离开／失焦收起；切回旧版恢复当前宽侧栏。

**Step 6: Commit。**

```bash
git add apps/web/src/styles/canvas-modern.css apps/web/src/styles/canvas-modern.test.ts apps/web/src/styles/index.css apps/web/src/components/Sidebar.tsx apps/web/src/App.tsx
git commit -m "feat(canvas): add modern overlay sidebar shell"
```

---

### Task 3：让新版点阵、小地图和画布浮层稳定共存

**Files:**
- Create: `apps/web/src/components/CanvasPresentation.test.tsx`
- Modify: `apps/web/src/components/Canvas.tsx`
- Modify: `apps/web/src/styles/canvas-shell.css`
- Modify: `apps/web/src/styles/canvas-shell.test.ts`
- Modify: `apps/web/src/styles/canvas-modern.css`

**Step 1: 先写失败测试，锁定不丢失关键画布能力。**

静态／组件测试必须断言：

- `Canvas` 接收 `presentation` 并在 `.t8-canvas-shell` 写出 `data-canvas-presentation`；
- `Background`、`ReactFlow`、`CanvasToolbar`、`CanvasFlowOverlays`、`NodeActionBar`、`MaterialDragOverlay`、各 picker／menu／assistant 均仍在源文件渲染树中；
- `MiniMap` 始终渲染（不受 presentation 的条件卸载）；
- 新版使用独立的 CSS 变量将 `gridDot` 的有效可见度提高约 40%，而不是改动全局主题 token；
- MiniMap 与右下角助手／反馈／浮动操作位于同一个避让策略内，任一项显示时不会被另一项覆盖。

**Step 2: 运行测试，确认失败。**

Run: `npm --workspace @xinghuan/web test -- CanvasPresentation canvas-shell`

**Step 3: 仅新增呈现钩子和定位容器。**

将 presentation prop 传入 `CanvasInner` 并放在：

```tsx
<div className="t8-canvas-shell" data-canvas-presentation={presentation}>
```

保留现有 `dotColor` 和主题 token。新版通过局部 `--canvas-modern-grid-dot`（例如用支持 alpha 的 `color-mix` 或对应主题安全值）提供更高对比度，并只让 `Background` 读取该呈现模式变量。不要更改 `gap`、节点坐标或 React Flow 的 callback。

给现有 MiniMap／助手／feedback／AI 快捷入口外层补充 `data-canvas-overlay-slot` 或同等 class，集中在 `canvas-modern.css` 定义右下区域避让：MiniMap 固定底部和右边安全距离，其他浮层按其已显示高度偏移。不可用 `display: none` 隐藏小地图。

**Step 4: 审查层级与溢出。**

确认现代侧栏展开层、工具栏、React Flow 节点、连线、MiniMap、模态框遵循已有 z-index 阶梯；任何新 `overflow: hidden` 不得裁切 handles、边、菜单或小地图。

**Step 5: 运行验证。**

Run:

```bash
npm --workspace @xinghuan/web test -- CanvasPresentation canvas-shell
npm --workspace @xinghuan/web run typecheck
```

Manual: 在含 95+ 节点的画布中切换两种模式，确认背景点阵、节点、边、缩放控制、小地图和右下角浮层都出现；连续缩放、拖动画布、选中节点、小地图点击均仍有效。

**Step 6: Commit。**

```bash
git add apps/web/src/components/Canvas.tsx apps/web/src/components/CanvasPresentation.test.tsx apps/web/src/styles/canvas-shell.css apps/web/src/styles/canvas-shell.test.ts apps/web/src/styles/canvas-modern.css
git commit -m "feat(canvas): stabilize modern canvas overlays and minimap"
```

---

### Task 4：提供共享节点视觉原语，并为既有素材区建立现代样式钩子

**Files:**
- Create: `apps/web/src/components/nodes/common/NodePresentation.tsx`
- Create: `apps/web/src/components/nodes/common/NodePresentation.test.tsx`
- Create: `apps/web/src/styles/node-modern.css`
- Create: `apps/web/src/styles/node-modern.test.ts`
- Modify: `apps/web/src/components/nodes/common/MaterialPreviewSection.tsx`
- Modify: `apps/web/src/styles/index.css`

**Step 1: 写失败测试，明确“只呈现、不接管业务”。**

测试 `NodePresentation`：渲染指定的 `children`、标题、状态和 `data-node-presentation`，不持有 task／model／material state。测试 `MaterialPreviewSection` 新增的属性：其现有 upstream 和 local 条目仍可由既有 props 渲染，modern 模式只增加 `data-materials-presentation="modern"`、`data-material-origin` 等样式钩子。

CSS 契约需覆盖：新版节点标题 `16px/22px`、说明和值 `14px/20px`、标签 `13px/18px`、辅助文字 `12px/18px`；所有选择器受 modern presentation 限制，不出现全局 tag selector。

**Step 2: 运行失败测试。**

Run: `npm --workspace @xinghuan/web test -- NodePresentation node-modern MaterialPreviewSection`

**Step 3: 实现无状态视觉组件。**

实现下列纯展示组件，全部接受 `children`，不得把现有业务字段变成新 state：

```tsx
export function NodePresentation({ kind, title, status, children }: NodePresentationProps) { … }
export function NodePresentationSection({ title, tone, children }: NodePresentationSectionProps) { … }
export function NodePresentationKeyGrid({ children }: { children: ReactNode }) { … }
```

它们只提供语义 class／data attribute、标题布局、两列 key-value grid 和断词规则。模型选择、输入、运行按钮、错误卡仍由各节点原有组件创建和处理。

**Step 4: 为已有素材区补充 opt-in 外观，不动合并逻辑。**

给 `MaterialPreviewSection` 增加可选 `presentation?: CanvasPresentation` 或从已传入的 node visual prop 派生，仅把该值写至容器。不得改动 `useUpstreamMaterials`、`useOrderedMaterials`、素材数组拼接、排序、删除／排除／恢复回调、上传或 DnD 语义。

新版 CSS 以可滚动横向素材带／紧凑网格呈现原有缩略图，明确显示“上游输入”来源 badge；文本材料保持可展开／多行截断，不能把内容删除或挪到新 store。

**Step 5: 运行测试与类型检查。**

Run:

```bash
npm --workspace @xinghuan/web test -- NodePresentation node-modern MaterialPreviewSection
npm --workspace @xinghuan/web run typecheck
```

**Step 6: Commit。**

```bash
git add apps/web/src/components/nodes/common/NodePresentation.tsx apps/web/src/components/nodes/common/NodePresentation.test.tsx apps/web/src/components/nodes/common/MaterialPreviewSection.tsx apps/web/src/styles/node-modern.css apps/web/src/styles/node-modern.test.ts apps/web/src/styles/index.css
git commit -m "feat(canvas): add modern node presentation primitives"
```

---

### Task 5：迁移图像节点的视觉编排，保持所有模型和生成路径

**Files:**
- Create: `apps/web/src/components/nodes/ImageNode.presentation.test.tsx`
- Modify: `apps/web/src/components/nodes/ImageNode.tsx`
- Modify: `apps/web/src/styles/node-modern.css`

**Step 1: 建立图像节点的失败契约测试。**

测试 modern presentation 下存在：图像节点标题／状态区、`生成描述` 主区、模型选择与核心尺寸／比例控件组成的 key grid、已有 `MaterialPreviewSection`，以及原生成按钮。静态保护测试还应匹配仍调用 `useUpstreamMaterials`、`useOrderedMaterials`、`useSyncNodeInternalsOnResize` 和原有提交函数。

**Step 2: 运行测试，确认失败。**

Run: `npm --workspace @xinghuan/web test -- ImageNode.presentation`

**Step 3: 只以共享视觉原语包裹现有控件。**

在 `ImageNode` 中接收／读取同一 presentation 值。现代分支用 `NodePresentation` 将现有 JSX 分为：

1. 标题、连接状态和运行状态；
2. `生成描述`（保留 `MentionPromptInput` 与原 prompt state）；
3. “模型与画面”键值网格（复用原 model selector、尺寸、比例、数量等控件）；
4. “素材”区（传入原先相同的 `MaterialPreviewSection` props）；
5. 运行／结果区（复用原 action、task card、error card）。

避免把 payload 组装、模型兼容判断、错误处理或 hooks 移入新组件；必要时仅将已有 JSX 块移动进视觉容器。旧版继续渲染原有排列（或仅被不命中的 scoped CSS 影响）。

**Step 4: 补足文本防越界 CSS。**

模型名／渠道名／错误信息使用 `min-width: 0` + 多行 clamp 或 `overflow-wrap:anywhere`；prompt 区可增长但节点 max-height 内滚动，禁止影响 handle 与 action button；160px 以下的附件预览用 `object-fit: cover`。

**Step 5: 验证。**

Run:

```bash
npm --workspace @xinghuan/web test -- ImageNode.presentation
npm --workspace @xinghuan/web run typecheck
```

Manual: 测试仅文本、仅上游图片、混合本地／上游图片、长模型名称、失败任务、成功结果和拖拽排序；提交参数和结果卡与旧版一致。

**Step 6: Commit。**

```bash
git add apps/web/src/components/nodes/ImageNode.tsx apps/web/src/components/nodes/ImageNode.presentation.test.tsx apps/web/src/styles/node-modern.css
git commit -m "feat(canvas): modernize image node layout"
```

---

### Task 6：迁移视频节点的视觉编排，特别保护首帧和上游素材输入

**Files:**
- Create: `apps/web/src/components/nodes/VideoNode.presentation.test.tsx`
- Modify: `apps/web/src/components/nodes/VideoNode.tsx`
- Modify: `apps/web/src/styles/node-modern.css`

**Step 1: 写失败契约测试。**

测试 modern 视频节点保留：`生成描述`、模型 selector、模式／时长／比例等已有控件、首帧相关已有控件、原 `MaterialPreviewSection`、原运行与状态卡。保护断言仍包含 `useUpstreamMaterials`／`useOrderedMaterials` 和原有提交函数。

**Step 2: 运行测试，确认失败。**

Run: `npm --workspace @xinghuan/web test -- VideoNode.presentation`

**Step 3: 重排已有 JSX，不改视频业务逻辑。**

沿用 Task 5 的五段结构。将模型、视频模式、时长、分辨率／比例放进 `NodePresentationKeyGrid`；首帧／上游图片仍以当前素材管理组件和当前选择语义展示，不创建“新素材池”或复制素材数据。

任务运行中与回传结果需要有明确的状态 stripe：状态文字至少 13px，完整错误信息可展开且可以复制，但不得覆盖素材、按钮或 handles。

**Step 4: 增加视频专用溢出与缩略图样式。**

对长 provider／model 名、上游返回文本、视频链接和错误详情分别使用可断词／clamp 规则；视频缩略图保留当前点击预览和来源标识。禁止改动轮询、重试、取消、回传或任务状态处理。

**Step 5: 验证。**

Run:

```bash
npm --workspace @xinghuan/web test -- VideoNode.presentation
npm --workspace @xinghuan/web run typecheck
```

Manual: 用上游图作为首帧、混合本地素材、选择不同视频模型、成功／失败／运行中任务分别验收；确认切换新版不导致正在运行任务显示失踪或重新提交。

**Step 6: Commit。**

```bash
git add apps/web/src/components/nodes/VideoNode.tsx apps/web/src/components/nodes/VideoNode.presentation.test.tsx apps/web/src/styles/node-modern.css
git commit -m "feat(canvas): modernize video node layout"
```

---

### Task 7：迁移 LLM 节点视觉编排，保留上下文／模型／结果能力

**Files:**
- Create: `apps/web/src/components/nodes/LLMNode.presentation.test.tsx`
- Modify: `apps/web/src/components/nodes/LLMNode.tsx`
- Modify: `apps/web/src/styles/node-modern.css`

**Step 1: 写失败契约测试。**

测试 modern LLM 节点存在：标题／状态、`任务说明`、模型／推理／输出等原有关键控件、当前上下文／素材预览、原运行按钮和结果区。保护原有 prompt、模型选择、上下文、任务提交／结果逻辑的函数／hook 标识。

**Step 2: 运行测试，确认失败。**

Run: `npm --workspace @xinghuan/web test -- LLMNode.presentation`

**Step 3: 使用共享原语包装，而非复制 LLM 状态。**

把现有控件视觉拆分为“任务说明”“模型与输出”“上下文／素材”“运行结果”，在 modern 模式下使用两列 key grid；长上下文保持展开入口和现有管理方式。上游文本、图片等材料继续直接并入当前素材／上下文区域，数据来源不变。

**Step 4: 验证文案和键盘可达性。**

确保标签不小于 13px、说明和值不小于 14px；选择器、提示词、上下文、运行按钮均可以 Tab 聚焦；折叠区的可访问名称准确。

**Step 5: 运行验证。**

Run:

```bash
npm --workspace @xinghuan/web test -- LLMNode.presentation
npm --workspace @xinghuan/web run typecheck
```

Manual: 验证长任务说明、长模型名、上游文本和多素材、运行中、失败和成功结果；与旧版比较提交结果／输出一致。

**Step 6: Commit。**

```bash
git add apps/web/src/components/nodes/LLMNode.tsx apps/web/src/components/nodes/LLMNode.presentation.test.tsx apps/web/src/styles/node-modern.css
git commit -m "feat(canvas): modernize llm node layout"
```

---

### Task 8：进行双模式回归、桌面视觉验收与发布前质量门禁

**Files:**
- Create: `docs/qa/2026-07-29-canvas-modern-presentation-qa.md`
- Modify: `docs/superpowers/specs/2026-07-29-canvas-visual-modernization-design.md`（仅补实施状态和 QA 链接）

**Step 1: 写可执行 QA 清单。**

清单逐项记录在旧版和新版中的结果、截图／录屏链接（不提交含账号凭据的内容）及缺陷：

- 新用户／无偏好默认旧版；切换后刷新保持新版；不同用户偏好相互隔离；无效值回落旧版；
- 切换时视口、选中节点、撤销栈、正在运行任务、实时状态不重置；
- 工具栏悬停／焦点展开，不挤压 1920×1080 的画布；所有现有节点分类、搜索、加节点、画布选择可用；
- 背景点阵比旧版更明显约 40%，但不降低节点／边对比度；
- 小地图在空画布及 95+ 节点画布出现，和右下浮层不重叠；
- 图像、视频、LLM：模型选择、所有关键参数、提示词、上游素材并入、素材排序／移除／排除／恢复、生成、运行中、成功、失败、结果展示均无回归；
- 文字在中文、英文、长 model/provider 名、长错误详情下无跨界、遮挡、覆盖、不可读按钮。

**Step 2: 跑自动质量门禁。**

Run:

```bash
npm --workspace @xinghuan/web test -- CanvasPresentation CanvasPresentationToggle Sidebar canvas-modern canvas-shell NodePresentation node-modern ImageNode.presentation VideoNode.presentation LLMNode.presentation
npm --workspace @xinghuan/web run typecheck
npm run verify:visual-design-docs-contract
npm run verify:design-token-docs-contract
npm run verify:component-registry-docs-contract
```

Expected: 全部通过；若任一项失败，先修复对应任务，再重跑，不以截图替代测试。

**Step 3: 使用真实浏览器完成桌面手工回归。**

使用非生产／灰度环境和可撤销测试画布。创建／打开包含图像、视频、LLM、文本、素材、任务结果的样本画布；切换双模式并记录 QA 结果。视频测试不得因为本前端视觉任务而修改 Provider 或重试策略；只验证 UI 未造成提交、状态、回传显示回归。

**Step 4: 评审发布边界。**

新版仍标注“预览”，旧版保持默认。完成 QA 后只提交代码与 QA 文档，默认不合并、不推送灰度、更不部署生产；由用户明确授权后再按现有发布 runbook 执行。

**Step 5: Commit。**

```bash
git add docs/qa/2026-07-29-canvas-modern-presentation-qa.md docs/superpowers/specs/2026-07-29-canvas-visual-modernization-design.md
git commit -m "test(canvas): document modern presentation regression qa"
```

## 实施完成定义

只有以下条件全部满足，才可宣称新版画布实现完成：

1. 每个用户首次看到旧版；新版只能经显式切换启用，且可即时切回。
2. 新版的左栏、点阵、小地图／浮层、图像／视频／LLM 三类节点均达到设计规格，且在 1920×1080 下无文字越界或覆盖。
3. 上游输入素材和文本仍在同一既有素材／上下文管理区内呈现；没有新的素材 schema、重复来源或逻辑分支。
4. React Flow 操作、节点连线、任务提交／回传、素材操作、导入导出、工具栏与助手均通过双模式回归。
5. Task 8 的自动门禁与手工 QA 已留下可复查结果；未得到额外授权时未发布到任何环境。

## Implementation log

| Date | Scope | Evidence |
| --- | --- | --- |
| 2026-07-29 | Tasks 1–3 complete | `e779e0c` adds the local per-user legacy-default toggle; `1696916` adds the non-resizing modern sidebar rail; the current change adds the `Canvas` presentation boundary, modern grid contrast variable, and MiniMap/assistant safe slots. Targeted Vitest and web type-check pass before each commit. |
| 2026-07-29 | Tasks 4–7 presentation hooks complete | Shared visual primitives and material-origin hooks preserve all existing callbacks. Image, Video and LLM roots now opt into scoped Modern Canvas typography, width, overflow and material presentation rules without changing payload or upstream-material hooks. |
