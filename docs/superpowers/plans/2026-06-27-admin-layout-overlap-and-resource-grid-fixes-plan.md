# Admin Layout Overlap And Resource Grid Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复后台 `API 设置`、`组织与治理`、`公共资源` 三个页面中仍存在的布局堆叠、亮青按钮滥用和资源卡片展示混乱问题，并完成代码与灰度联通性验证。

**Architecture:** 以现有 admin 拆分后的组件边界为基础，局部重排 `ApiSettingsPanel`、`AdminUserAccountsSection`、`AdminPermissionsGroupRail` / `AdminPermissionsPanel`、`AdminPublicResourcesPanel` / `AdminPublicResourceCard` 的结构与样式。资源卡片改为“自适应等宽网格 + 单卡展开”模式，展开态保持在正常文档流中，不使用叠层浮盖。

**Tech Stack:** React 19 + TypeScript + Vite + 现有 admin contract scripts + CSS

---

### Task 1: 补充本轮布局契约

**Files:**
- Create: `scripts/verify-admin-layout-overlap-fixes-contract.mjs`
- Modify: `package.json`
- Test: `scripts/verify-admin-layout-overlap-fixes-contract.mjs`

- [ ] **Step 1: 写失败中的契约脚本**

要求覆盖：
- `API 设置` 不再包含 `title="统一管理接入能力"`
- `AdminUserAccountsSection` 含有竖向创建卡标记类
- `AdminPublicResourceCard` 含有展开/收起和单卡详情标记
- `styles.css` 含有资源网格自适应列和展开态样式

- [ ] **Step 2: 运行契约确保当前失败**

Run: `node scripts/verify-admin-layout-overlap-fixes-contract.mjs`  
Expected: FAIL，指出至少一个尚未满足的新约束

- [ ] **Step 3: 在 `package.json` 增加脚本入口**

Run target:
- `verify:admin-layout-overlap-fixes`

- [ ] **Step 4: 重新运行并确认仍因实现未完成而失败**

Run: `npm run verify:admin-layout-overlap-fixes`  
Expected: FAIL

---

### Task 2: 修复 API 设置顶部堆叠

**Files:**
- Modify: `apps/admin/src/admin-api-settings-panel.tsx`
- Modify: `apps/admin/src/styles.css`
- Test: `scripts/verify-admin-api-layout-contract.mjs`
- Test: `scripts/verify-admin-layout-overlap-fixes-contract.mjs`

- [ ] **Step 1: 删除重复 workspace band**

实现：
- 去掉 `统一管理接入能力` 这块 `AdminWorkspaceBand`
- 保留内容区和可点击分区

- [ ] **Step 2: 给 API 设置内容区补简洁页头**

实现：
- 在内容区内保留轻量的 section title / status
- 避免出现遮挡切换按钮的上层大面板

- [ ] **Step 3: 调整相关样式**

实现：
- 去掉 API 设置额外的大带状高度占用
- 收紧上边距、层级和 overflow

- [ ] **Step 4: 运行验证**

Run:
- `npm run verify:admin-api-layout-contract`
- `npm run verify:admin-layout-overlap-fixes`

Expected: PASS

---

### Task 3: 重排账号治理页面

**Files:**
- Modify: `apps/admin/src/admin-user-accounts-section.tsx`
- Modify: `apps/admin/src/styles.css`
- Test: `scripts/verify-admin-users-panel-contract.mjs`
- Test: `scripts/verify-admin-governance-redesign-contract.mjs`
- Test: `scripts/verify-admin-layout-overlap-fixes-contract.mjs`

- [ ] **Step 1: 将新增成员卡改为竖向窄卡**

实现：
- 每个字段一行
- 固定较窄宽度
- `创建用户` 按钮不再使用亮青大块填充

- [ ] **Step 2: 重排账号列表行内部布局**

实现：
- 账号行改为块级分区结构，而不是单条超长横排
- 至少把基础信息、分组/角色、密码治理、操作区分开

- [ ] **Step 3: 统一账号页按钮样式**

实现：
- 普通按钮走深色边框态
- danger 保留红色

- [ ] **Step 4: 运行验证**

Run:
- `npm run verify:admin-users-panel-contract`
- `node scripts/verify-admin-governance-redesign-contract.mjs`
- `npm run verify:admin-layout-overlap-fixes`

Expected: PASS

---

### Task 4: 收口用户组和权限页颜色/rail

**Files:**
- Modify: `apps/admin/src/admin-permissions-group-rail.tsx`
- Modify: `apps/admin/src/admin-permissions-panel.tsx`
- Modify: `apps/admin/src/styles.css`
- Test: `scripts/verify-admin-governance-redesign-contract.mjs`

- [ ] **Step 1: 调整权限分组卡的选中态表达**

实现：
- 禁止大面积亮青底
- 改为深底 + 描边 + 白字

- [ ] **Step 2: 调整权限页按钮和工具条配色**

实现：
- 刷新、目录已就绪、批量操作按钮回到统一深色体系

- [ ] **Step 3: 运行验证**

Run: `node scripts/verify-admin-governance-redesign-contract.mjs`  
Expected: PASS

---

### Task 5: 把公共资源改成自适应单卡展开网格

**Files:**
- Modify: `apps/admin/src/admin-public-resources-panel.tsx`
- Modify: `apps/admin/src/admin-public-resource-card.tsx`
- Modify: `apps/admin/src/styles.css`
- Test: `scripts/verify-admin-resource-content-phase2-contract.mjs`
- Test: `scripts/verify-admin-public-resources-starlight-contract.mjs`
- Test: `scripts/verify-admin-layout-overlap-fixes-contract.mjs`

- [ ] **Step 1: 在 panel 中加入单卡展开状态**

实现：
- 保存 `expandedItemId`
- 点击新卡片展开时自动收起旧卡片

- [ ] **Step 2: 改造资源卡片结构**

实现：
- 默认仅显示预览 + 名称 + 展开按钮
- 详情区默认折叠
- 展开后在卡片内部渲染详情表单和操作

- [ ] **Step 3: 调整资源网格和分类 rail**

实现：
- 左 rail 收窄
- 网格使用自适应列
- 宽屏 4 列，中屏 3 列，窄屏 2 列
- 卡片展开时走正常文档流下撑

- [ ] **Step 4: 运行验证**

Run:
- `npm run verify:admin-resource-content-phase2`
- `npm run verify:admin-public-resources-starlight`
- `npm run verify:admin-layout-overlap-fixes`

Expected: PASS

---

### Task 6: 构建与本地收尾验证

**Files:**
- Modify: `docs/logbooks/daily/2026/2026-06/2026-06-27.md`

- [ ] **Step 1: 运行后台核心验证**

Run:
- `npm run verify:admin-view-model-contract`
- `npm run verify:admin-starlight-shell`
- `npm run verify:admin-api-layout-contract`
- `node scripts/verify-admin-governance-redesign-contract.mjs`
- `npm run verify:admin-resource-content-phase2`
- `npm run verify:admin-public-resources-starlight`
- `npm run verify:admin-layout-overlap-fixes`

Expected: 全部 PASS

- [ ] **Step 2: 运行构建**

Run: `npm run build -w @xinghuan/admin`  
Expected: PASS

- [ ] **Step 3: 更新当天台账**

记录：
- API 设置去除重复大板块
- 账号治理竖卡重排
- 公共资源自适应单卡展开网格
- 本轮验证命令

