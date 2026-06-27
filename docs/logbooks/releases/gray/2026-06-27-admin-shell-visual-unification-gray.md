# Admin Shell Visual Unification Gray Release - 2026-06-27

## 状态

- 环境：`gray`
- 版本：`v0.5.8`
- release：`20260627-admin-shell-visual-unification-gray-r1-v058`
- 当前状态：`待 deploy`

## 发布目标

- 统一后台一级工作域顶部壳层为单层 `workspace band`。
- 从后台 IA 中移除不再需要的 `资源与内容 -> 生成库`。
- 清理 `API 设置` 中残留的 RH 迁移说明和跳转入口。
- 收口 `公共资源 / 组织与治理 / 环境同步` 的视觉层级、按钮样式和窄宽度兼容。

## 变更范围

- `apps/admin/src/admin-common-components.tsx`
  - 新增复用 `AdminWorkspaceBand`
  - 新增 `AdminBandTabButton`
- `apps/admin/src/main.tsx`
  - 顶部壳层切换到 `workspace band`
  - 删除后台 `generation-library` 渲染分支
  - 清理 API 设置到 RH 工作台的跳转残留
  - 登录页补齐 `autocomplete`
- `apps/admin/src/admin-view-model.ts`
  - 移除 `generation-library`
  - 收紧后台工作域映射
- `apps/admin/src/admin-api-settings-panel.tsx`
  - 删除 RH 迁移摘要卡、入口按钮与相关 props
- `apps/admin/src/admin-public-resources-panel.tsx`
  - 顶部改为统一 band
- `apps/admin/src/admin-users-panel.tsx`
  - 顶部改为统一 band
- `apps/admin/src/admin-environment-sync-panel.tsx`
  - 删除旧 `environment-sync-hero`
  - 顶部改为统一 band
- `apps/admin/src/styles.css`
  - 新增 `admin-workspace-band*`
  - 收口 `environment-sync-*` 窄宽度和按钮样式
  - 提前触发二级 tab 在窄宽度下的降列
- 契约同步：
  - `scripts/verify-admin-view-model-contract.ts`
  - `scripts/verify-admin-starlight-shell-contract.mjs`
  - `scripts/verify-admin-resource-content-phase2-contract.mjs`
  - `scripts/verify-admin-environment-sync-contract.mjs`
  - `scripts/verify-admin-api-layout-contract.mjs`
  - `scripts/verify-runninghub-workflow-contract.mjs`
- 文档同步：
  - `docs/superpowers/specs/2026-06-27-admin-shell-visual-unification-design.md`
  - `docs/systems/admin/ui-and-information-architecture.md`
  - `docs/logbooks/daily/2026/2026-06/2026-06-27.md`

## Agent 已验证

### 代码与构建

- `npm run verify:admin-view-model-contract`
- `npm run verify:admin-starlight-shell`
- `npm run verify:admin-resource-content-phase2`
- `npm run verify:admin-public-resources-starlight`
- `npm run verify:admin-users-panel-contract`
- `node scripts/verify-admin-environment-sync-contract.mjs`
- `npm run verify:runninghub-workflow-contract`
- `npm run verify:admin-api-layout-contract`
- `npm run build -w @xinghuan/admin`

### 本地浏览器 QA

- 本地单端口：`http://127.0.0.1:18224/admin`
- 已检查页面：
  - `总览`
  - `公共资源`
  - `组织与治理`
  - `环境同步`
- 已检查断点：
  - `1920x1080`
  - `1366x768`
- 已检查状态：
  - `AI 助手开启`
  - `AI 助手关闭`

## 待用户验收

### 视觉验收

- 后台一级工作域顶部是否已经统一为同一套工作带语言。
- `环境同步` 在 gray 环境的 `1080 / 2K` 显示器上是否还存在任何叠层、压边或文字发灰问题。
- `资源与内容` 工作域在删除后台 `生成库` 后，剩余 `公共资源 / 公告` 的信息层级是否符合预期。

### 真实交互验收

- `公共资源` 上传、分类、搜索与预览操作是否保持正常。
- `组织与治理` 的 `账号 / 用户组 / 权限 / 会话` 工作台切换和编辑是否正常。
- `环境同步` 的预览、左右互换和确认同步链路是否正常。

## 风险与残留问题

- Playwright CLI 在当前桌面环境下存在偶发 session 中断，因此本轮浏览器 QA 采用多次重开会话 + 截图复核。
- `1366` 临界宽度下的 `系统与发布` 工作域属于后续 gray 人工验收重点断点。

## 回滚信息

- deploy 前回滚锚点：
  - `/opt/apps/xinghuan-canvas-next/releases/20260627-admin-resource-content-governance-gray-r1-v057`
- 当前目标 release 目录：
  - `/opt/apps/xinghuan-canvas-next/releases/20260627-admin-shell-visual-unification-gray-r1-v058`
- 回滚后需重启：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
