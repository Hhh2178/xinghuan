# Admin Governance Rail And Resource Layout Design

## Goal

修复 D 批治理/内容工作台在桌面端的 rail 固定、滚动和公共资源列轨问题；保留既有路由、数据、权限、revision 与 mutation ownership。

## Decision

采用共享 `AdminGovernanceLayout` rail 契约。桌面端 layout 以 `--admin-sticky-offset` 固定 rail，并让 rail 内容在可视工作区内独立纵向滚动；正文继续由 `.admin-main` 滚动。窄于既有桌面断点时，rail 恢复正常文档流和无限制高度，避免多滚动容器挤压内容。

公共资源把资源类型切换与分类目录共同放入 rail；正文 toolbar 只保留搜索。资源网格使用可扩展的正文列，不再将类型按钮和搜索限定在右侧窄列。上传、刷新、筛选状态、预览、分类 revision、上传、编辑和删除确认仍由 `AdminPublicResourcesPanel` 拥有。

## Scope And Boundaries

- 覆盖已接入 `AdminGovernanceLayout` 的组织、安全、资源、公告和自动化 activity rail；不改其业务组件接口。
- 不迁移 API 请求、URL、权限判断、dirty/冲突、确认或保存回调。
- 不改变 mobile/tablet 的产品需求；仅保持现有响应式文档流兼容。
- 使用现有 Foundation token，不新增裸色值或新的页面专用基础组件。

## Verification

- 组件测试锁定 shared rail marker、资源类型/分类都在 rail、搜索仅在 editor，以及现有预览/API/确认 ownership。
- Admin TypeScript/Vite build、资源内容与视觉/Token/registry 文档契约通过。
- 后续 Gray 前，在登录态 1920×1080 检查 rail 固定、独立滚动、无双横向溢出、公共资源网格和公告/自动化 rail。
