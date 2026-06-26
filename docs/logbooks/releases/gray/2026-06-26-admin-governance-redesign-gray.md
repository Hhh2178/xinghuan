# Admin Governance Redesign Gray Release - 2026-06-26

## 状态

- 环境：`gray`
- 版本：`v0.5.5`
- release：`20260626-admin-governance-redesign-gray-r1-v055`
- 当前状态：`待 deploy`

## 发布目标

- 修复中文分组名创建用户组时的 ID 冲突问题，并把错误提示收回到分组表单局部。
- 将后台用户治理页正式拆成 `账号 / 用户组 / 权限 / 会话` 四个稳定工作区。
- 将权限后台拆成左侧分组轨道、右侧摘要条带、分区编辑器和底部保存条，并收口按钮换行和高亮层级。
- 将公共资源后台改造成左侧分类侧栏 + 右侧自适应卡片网格 + 完整预览弹层的素材治理工作台。
- 补齐共享资源 web API 的 `copySharedResourceToPersonal` 出口，恢复共享资源契约完整性。

## 变更范围

- `apps/api/src/server.ts`
  - 用户组创建改为系统生成稳定唯一 ID。
- `apps/admin/src/main.tsx`
  - `mutate()` 支持局部错误不上浮为全局错误。
- `apps/admin/src/admin-users-panel.tsx`
- `apps/admin/src/admin-user-accounts-section.tsx`
- `apps/admin/src/admin-user-groups-section.tsx`
- `apps/admin/src/admin-user-sessions-section.tsx`
  - 用户后台拆分成稳定工作区。
- `apps/admin/src/admin-permissions-panel.tsx`
- `apps/admin/src/admin-permissions-group-rail.tsx`
- `apps/admin/src/admin-permissions-summary-strip.tsx`
- `apps/admin/src/admin-permissions-savebar.tsx`
  - 权限后台拆成壳层 + 分组轨道 + 摘要条带 + 保存条。
- `apps/admin/src/admin-public-resources-panel.tsx`
- `apps/admin/src/admin-public-resource-card.tsx`
- `apps/admin/src/admin-public-resource-category-sidebar.tsx`
- `apps/admin/src/admin-media-preview-modal.tsx`
  - 公共资源后台改为卡片化预览治理页。
- `apps/admin/src/styles.css`
  - 新增后台治理重构的工作区布局、卡片预览、完整弹层和防溢出规则。
- `apps/web/src/services/sharedResourceApi.ts`
  - 补齐 `copySharedResourceToPersonal`。
- `scripts/verify-admin-governance-redesign-contract.mjs`
- `scripts/verify-admin-users-panel-contract.mjs`
  - 增补后台治理重构 contract。

## Agent 已验证

### 本地代码与产物

- `npm run verify:admin-users-panel-contract`
- `npm run verify:admin-governance-redesign-contract`
- `npm run verify:shared-resource-library`
- `npm run verify:engineering-governance-contract`
- `npm run type-check -w @xinghuan/admin`
- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/web`
- `npm run build -w @xinghuan/admin`
- `codegraph sync`

### 远端部署与运行态

- 待本轮 gray deploy 后补记

## 待用户验收

### 视觉验收

- 用户后台四个工作区在常见桌面宽度下是否无标题裁切、按钮溢出和局部滚动陷阱。
- 权限页左侧分组轨道是否不再喧宾夺主，右侧编辑区是否更清晰。
- 公共资源后台卡片是否能完整看清竖图、横图、视频和音频素材。

### 真实业务链路

- 中文分组名创建是否稳定成功，失败时是否只在分组表单内提示。
- 公共资源后台上传、分类、保存、删除、完整预览是否都可正常使用。
- 共享资源“复制到我的资源库”链路是否正常。

## 风险与残留问题

- 这批主要完成后台治理重构第一批，账号系统更深一层的批量治理和节点能力显式锁定 UI 还在后续切片。
- 本轮未覆盖页面级人工视觉验收，仍需要用户在 gray 环境实际检查。

## 回滚信息

- `current` 回滚目标：
  - `/opt/apps/xinghuan-canvas-next/releases/20260626-group-permissions-group-lock-gray-r1-v054`
- 需要重启的服务：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
- 回滚后需复查的接口：
  - `http://127.0.0.1:18200/api/status`
  - `https://canvas-next.hhh2121.xyz/api/status`
