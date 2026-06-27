# Admin Shell Visual Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把后台统一到单层工作区信息带与稳定深色视觉体系，同时移除后台 IA 中已废弃的生成库入口和 API 设置中的 RH 迁移残留，并完成 1080 / 2K 与 AI 助手开关兼容收口。

**Architecture:** 以 `admin-view-model.ts` 和 `main.tsx` 作为后台壳层真源，先收紧导航、工作区和路由，再通过公共头部结构与样式 token 把页面顶部统一成单层 `workspace band`。页面级整改优先覆盖用户正在验收的高风险工作区：API 设置、公共资源、环境同步、组织与治理，并用契约脚本锁住结构与 IA 约束。

**Tech Stack:** React 18、TypeScript、Vite、Lucide、Node.js 契约脚本、CSS 自定义属性

---

### Task 1: 收紧后台 IA 与壳层契约

**Files:**
- Modify: `apps/admin/src/admin-view-model.ts`
- Modify: `apps/admin/src/main.tsx`
- Modify: `scripts/verify-admin-view-model-contract.ts`
- Modify: `scripts/verify-admin-starlight-shell-contract.mjs`
- Modify: `scripts/verify-admin-resource-content-phase2-contract.mjs`
- Modify: `scripts/verify-runninghub-workflow-contract.mjs`

- [ ] **Step 1: 先把契约改成新要求**

  目标：
  - `admin-view-model` 不再暴露 `generation-library`
  - `main.tsx` 不再渲染 `AdminGenerationLibraryPanel`
  - `API 设置` 不再要求 `进入 RH 工作台`
  - 后台壳层要求 `workspace band`，不再要求旧 `starlight-workspace-home`

- [ ] **Step 2: 运行契约并确认先失败**

Run:

```bash
npm run verify:admin-view-model-contract
npm run verify:admin-starlight-shell
npm run verify:admin-resource-content-phase2
npm run verify-runninghub-workflow-contract
```

Expected:
- 至少出现与旧实现相关的失败项，例如仍然包含 `generation-library`、仍然引用旧壳层 class、仍然要求 RH 迁移入口。

- [ ] **Step 3: 修改后台 IA 与主路由**

  目标：
  - 从 `AdminTabId`、导航项、工作区 tabs、描述、刷新策略中移除 `generation-library`
  - 移除 `AdminGenerationLibraryPanel` import、渲染分支和相关 live refresh 条件
  - 保留 RH 独立工作台，但从 API 设置父子 props 中移除跳转入口依赖

- [ ] **Step 4: 重跑契约**

Run:

```bash
npm run verify:admin-view-model-contract
npm run verify:admin-starlight-shell
npm run verify:admin-resource-content-phase2
npm run verify-runninghub-workflow-contract
```

Expected:
- 以上契约全部通过

### Task 2: 建立统一 workspace band 壳层

**Files:**
- Modify: `apps/admin/src/main.tsx`
- Modify: `apps/admin/src/admin-common-components.tsx`
- Modify: `apps/admin/src/styles.css`

- [ ] **Step 1: 为后台页面增加复用的 band 结构**

  目标：
  - 在 `admin-common-components.tsx` 中新增可复用 `AdminWorkspaceBand`
  - 支持左侧主说明、右侧当前页卡片、底部 tab/section 切换区
  - 保持文本截断和换行边界，不造成按钮堆叠

- [ ] **Step 2: 用新 band 替换主壳层旧结构**

  目标：
  - `main.tsx` 用新 band 替换 `starlight-workspace-home`
  - 右侧活动页卡不再和 tab 卡片同层重叠
  - AI 助手开启时允许 band 自适应换行

- [ ] **Step 3: 在样式中增加统一 band 与响应式规则**

  目标：
  - 新增 `admin-workspace-band*` 系列样式
  - 删除或停用旧 `starlight-workspace-home*` 依赖
  - 明确 1080 / 2K / 助手开关下的列数和换行规则

- [ ] **Step 4: 构建一次确保没有类型或 JSX 错误**

Run:

```bash
npm run build -w @xinghuan/admin
```

Expected:
- 构建通过

### Task 3: 重做 API 设置与环境同步顶部结构

**Files:**
- Modify: `apps/admin/src/admin-api-settings-panel.tsx`
- Modify: `apps/admin/src/admin-environment-sync-panel.tsx`
- Modify: `apps/admin/src/styles.css`
- Modify: `scripts/verify-admin-environment-sync-contract.mjs`
- Modify: `scripts/verify-admin-api-layout-contract.mjs`

- [ ] **Step 1: 先更新契约以匹配新结构**

  目标：
  - 环境同步契约要求统一 band/summary 布局，而不是旧 `environment-sync-hero`
  - API 设置契约不再允许 RH 迁移摘要卡

- [ ] **Step 2: 运行相关契约确认失败**

Run:

```bash
npm run verify:admin-environment-sync-contract
npm run verify:admin-api-layout-contract
```

Expected:
- 旧结构导致契约失败

- [ ] **Step 3: 改造 API 设置页**

  目标：
  - 移除 `ArrowRight`、`onOpenRunningHubWorkspace`、`runninghub-summary-card`
  - 顶部改为单层 band + 状态条
  - Provider rail、表单区、AI 协助区在窄宽度下保持稳定

- [ ] **Step 4: 改造环境同步页**

  目标：
  - 移除 `environment-sync-hero`
  - 改为 band + 工具条 + 左侧摘要/右侧结果工作区
  - 避免顶部面板叠层与局部滚动陷阱

- [ ] **Step 5: 重跑契约与构建**

Run:

```bash
npm run verify:admin-environment-sync-contract
npm run verify:admin-api-layout-contract
npm run build -w @xinghuan/admin
```

Expected:
- 契约与构建通过

### Task 4: 统一公共资源与组织治理视觉

**Files:**
- Modify: `apps/admin/src/admin-public-resources-panel.tsx`
- Modify: `apps/admin/src/admin-public-resource-category-sidebar.tsx`
- Modify: `apps/admin/src/admin-public-resource-card.tsx`
- Modify: `apps/admin/src/admin-users-panel.tsx`
- Modify: `apps/admin/src/styles.css`
- Modify: `scripts/verify-admin-public-resources-starlight-contract.mjs`
- Modify: `scripts/verify-admin-users-panel-contract.mjs`

- [ ] **Step 1: 更新契约要求**

  目标：
  - 公共资源分类卡默认深底白字，激活态深底青边
  - 桌面下一行四卡
  - 用户治理页顶部与快捷区遵循统一工作带节奏

- [ ] **Step 2: 运行契约确认旧样式不满足**

Run:

```bash
npm run verify:admin-public-resources-starlight
npm run verify:admin-users-panel-contract
```

Expected:
- 旧实现至少在头部结构或状态样式上失败

- [ ] **Step 3: 改造公共资源页**

  目标：
  - 顶部改为统一 band
  - 分类卡背景统一深色，文字统一白色
  - 资源网格在桌面保持四列，1080 + 助手开启时自动降列

- [ ] **Step 4: 改造组织治理页**

  目标：
  - 顶部 hero 和 overview hero 与统一风格对齐
  - 快捷卡、摘要卡、tab 状态统一边框与文字层级
  - 修正文案溢出和卡片挤压风险

- [ ] **Step 5: 重跑契约**

Run:

```bash
npm run verify:admin-public-resources-starlight
npm run verify:admin-users-panel-contract
```

Expected:
- 契约通过

### Task 5: 收尾验证与文档更新

**Files:**
- Modify: `docs/superpowers/specs/2026-06-27-admin-shell-visual-unification-design.md`
- Modify: `DEVLOG.md`
- Modify: `docs/logbooks/daily/2026/2026-06/2026-06-27.md` or current daily record if present

- [ ] **Step 1: 全量执行本轮相关验证**

Run:

```bash
npm run verify:admin-view-model-contract
npm run verify:admin-starlight-shell
npm run verify:admin-resource-content-phase2
npm run verify:admin-public-resources-starlight
npm run verify:admin-users-panel-contract
npm run verify:admin-environment-sync-contract
npm run verify:admin-api-layout-contract
npm run build -w @xinghuan/admin
```

Expected:
- 全部通过

- [ ] **Step 2: 同步文档与台账**

  目标：
  - 在设计 spec 中补充“已实施范围”说明
  - 在 `DEVLOG.md` 和当日台账中记录：
    - 移除后台生成库入口
    - API 设置移除 RH 迁移残留
    - workspace band 壳层统一
    - 1080 / 2K + AI 助手兼容收口

- [ ] **Step 3: 检查工作树归属**

Run:

```bash
git status --short
git diff --stat
```

Expected:
- 仅包含本轮后台前端、契约、文档和必要样式改动
