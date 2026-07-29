# 新版画布呈现修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正新版画布的重复侧栏入口、既有生成节点未切换视觉和顶栏样式开关失配，同时保持旧版默认及所有节点业务行为不变。

**Architecture:** 以根级 `data-canvas-presentation` 作为唯一视觉开关；Sidebar 移除重复的状态控制，生成节点通过稳定 data 属性接入 scoped CSS，顶部切换器复用一个独立的紧凑控件样式。所有改动为运行时展示层，不创建节点迁移或额外持久化数据。

**Tech Stack:** React、TypeScript、Tailwind utility classes、scoped CSS、Vitest。

## Global Constraints

- `legacy` 始终为默认画布样式，数据及任务链路不变。
- 不修改 `docs/logbooks/daily/2026/2026-07/README.md` 或 `docs/logbooks/daily/2026/2026-07/2026-07-28.md` 的用户改动。
- 所有新版 CSS 必须以 `.t8-app-shell[data-canvas-presentation='modern']` 为根。
- PC 1920×1080 为本轮视觉验收基准；不新增依赖。

---

### Task 1: 移除重复侧栏开合控制

**Files:**
- Modify: `apps/web/src/components/Sidebar.tsx`
- Modify: `apps/web/src/components/Sidebar.test.tsx`（若当前测试文件不存在则创建 `Sidebar.modern.test.tsx`）
- Modify: `apps/web/src/styles/canvas-modern.css`

- [x] **Step 1: Write the failing test**

断言 modern rail 只有画布列表、创建画布、节点搜索、AI 托管四个动作；源代码不包含 `PanelLeftClose`、`PanelLeftOpen` 或 `setModernExpanded((expanded) => !expanded)` 的 rail toggle。

- [x] **Step 2: Run test to verify it fails**

Run: `npm --workspace @xinghuan/web test -- Sidebar`

Expected: FAIL，因为目前 rail 仍含展开/收起按钮。

- [x] **Step 3: Write minimal implementation**

删除仅切换 `modernExpanded` 的第一个 rail button 和不再使用的 icon import；保留 mouse/focus 自动展开以及另外四个真实动作。

- [x] **Step 4: Run test to verify it passes**

Run: `npm --workspace @xinghuan/web test -- Sidebar`

Expected: PASS。

- [x] **Step 5: Commit**

`git commit -m "fix(canvas): remove redundant modern sidebar toggle"`

### Task 2: 让既有生成节点接入新版视觉边界

**Files:**
- Modify: `apps/web/src/components/nodes/ImageNode.tsx`
- Modify: `apps/web/src/components/nodes/VideoNode.tsx`
- Modify: `apps/web/src/components/nodes/LLMNode.tsx`
- Modify: `apps/web/src/components/nodes/GenerationNodes.presentation.test.ts`
- Modify: `apps/web/src/styles/node-modern.css`
- Modify: `apps/web/src/styles/node-modern.test.ts`

- [x] **Step 1: Write the failing test**

断言三个节点根元素包含 `data-node-presentation="generation"` 和对应 `data-node-kind`；现代 CSS 具有这三个 data 属性的标题、模型区、参数控件和文本溢出规则，且仍由 modern 根选择器限定。

- [x] **Step 2: Run test to verify it fails**

Run: `npm --workspace @xinghuan/web test -- GenerationNodes.presentation node-modern`

Expected: FAIL，因为根元素尚未提供这些标识，且 CSS 未以真实 DOM 为目标。

- [x] **Step 3: Write minimal implementation**

给图像、视频、LLM 节点的现有根元素添加 data 属性；用 scoped CSS 针对原有 header、发布模型区、label、输入、textarea、素材区和状态卡调整密度、字号、宽度与断词。不得改变 hooks、payload、素材 props、按钮回调或节点 JSX 的业务分支。

- [x] **Step 4: Run test to verify it passes**

Run: `npm --workspace @xinghuan/web test -- GenerationNodes.presentation node-modern`

Expected: PASS。

- [x] **Step 5: Commit**

`git commit -m "fix(canvas): apply modern presentation to existing generation nodes"`

### Task 3: 统一顶栏样式切换器

**Files:**
- Modify: `apps/web/src/components/CanvasPresentationToggle.tsx`
- Modify: `apps/web/src/components/CanvasPresentationToggle.test.tsx`
- Modify: `apps/web/src/styles/canvas-modern.css`

- [x] **Step 1: Write the failing test**

断言组件有 `画布样式` 可访问名称、旧版/新版选择和 `预览` 辅助状态；测试 stylesheet 存在 `.t8-canvas-presentation-toggle`、32px 高度和 active 样式。

- [x] **Step 2: Run test to verify it fails**

Run: `npm --workspace @xinghuan/web test -- CanvasPresentationToggle canvas-modern`

Expected: FAIL，因为当前切换器没有专属样式和辅助状态。

- [x] **Step 3: Write minimal implementation**

更新切换器语义和文案，新增仅在 modern 根生效的紧凑分段控件 CSS；同时提供基础 class 以确保旧版顶部也不出现裸按钮。保持受控 `presentation` / `onChange` API 不变。

- [x] **Step 4: Run test to verify it passes**

Run: `npm --workspace @xinghuan/web test -- CanvasPresentationToggle canvas-modern`

Expected: PASS。

- [x] **Step 5: Commit**

`git commit -m "fix(canvas): align presentation switch with topbar controls"`

### Task 4: 集成验证与灰度发布准备

**Files:**
- Modify: `docs/logbooks/validations/2026-07-29-modern-canvas-presentation-correction.md`

- [x] **Step 1: Run focused and workspace verification**

Run:

```powershell
npm --workspace @xinghuan/web test -- Sidebar GenerationNodes.presentation node-modern CanvasPresentationToggle canvas-modern
npm --workspace @xinghuan/web run typecheck
npm --workspace @xinghuan/web run build
```

- [ ] **Step 2: Perform desktop visual acceptance**

在 1920×1080 检查新旧切换、已有图像/视频/LLM 节点、长模型名、上游素材和右下小地图；记录实际结果，不记录凭据。

- [x] **Step 3: Commit validation evidence**

`git commit -m "docs(canvas): record modern presentation correction validation"`

- [x] **Step 4: Prepare gray release**

仅在测试、构建和视觉验收通过后，遵循项目 release runbook 递增当前 Gray patch 版本并推送旧服务器 Gray；执行 release preflight 和目标环境 health check。
