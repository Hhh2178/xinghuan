# Admin Account API Resource Preview Gray Release - 2026-06-27

## 状态

- 环境：`gray`
- 版本：`v0.5.10`
- release：`20260627-admin-account-api-resource-preview-gray-r1-v0510`
- 当前状态：`2026-06-27 已完成 deploy + runtime verify`
- 上一灰度 release：`20260627-admin-layout-overlap-resource-grid-gray-r1-v059`

## 发布目标

- 修复 `组织与治理` 中账号与用户组创建表单输入框过窄、占位内容不必要、账号详情默认铺开的问题。
- 修复 `API 设置` 中 provider 列表与右侧配置区互相堆叠，导致配置与切换信息无法交互的问题。
- 修复 `公共资源` 中单个素材占满四列、资源卡预览和查看原图被裁切的问题。

## 变更范围

- `apps/admin/src/admin-user-accounts-section.tsx`
  - 新增随机强密码生成。
  - 新增成员表单字段满宽展示并移除无意义占位。
  - 账号列表默认显示账号、密码、备注、归属组摘要，详情点击后展开。
- `apps/admin/src/admin-user-groups-section.tsx`
  - 新建用户组表单改为一行一个字段、输入框满宽。
  - 清理新建与编辑分组中的冗余占位。
- `apps/admin/src/admin-media-preview-modal.tsx`
  - 图片和视频预览统一使用完整 contain 媒体类。
- `apps/admin/src/styles.css`
  - API provider rail 改为非 sticky，高度预算内滚动，避免覆盖配置表单。
  - 账号与用户组创建卡补齐满宽布局。
  - 账号记录新增摘要行与折叠详情样式。
  - 公共资源网格改为 `auto-fill + minmax(220px, 1fr)`，展开态不再跨满整行。
  - 公共资源卡片与弹窗媒体预览统一黑底 contain。
- 契约同步：
  - `scripts/verify-admin-layout-overlap-fixes-contract.mjs`
  - `scripts/verify-admin-users-panel-contract.mjs`
  - `scripts/verify-admin-api-layout-contract.mjs`
- 文档同步：
  - `docs/logbooks/daily/2026/2026-06/2026-06-27.md`

## Agent 已验证

### 本地代码与产物

- `npm run verify:admin-layout-overlap-fixes`
- `npm run verify:admin-users-panel-contract`
- `node scripts/verify-admin-governance-redesign-contract.mjs`
- `npm run verify:admin-public-resources-starlight`
- `npm run verify:admin-resource-content-phase2`
- `npm run verify:admin-api-layout-contract`
- `npm run verify:admin-view-model-contract`
- `npm run verify:admin-starlight-shell`
- `npm run build -w @xinghuan/admin`

### Gray 发布与运行态

- `npm run release:gray:prepare -- --release=20260627-admin-account-api-resource-preview-gray-r1-v0510 --verify="npm run verify:admin-layout-overlap-fixes" --verify="npm run verify:admin-users-panel-contract" --verify="node scripts/verify-admin-governance-redesign-contract.mjs" --verify="npm run verify:admin-public-resources-starlight" --verify="npm run verify:admin-resource-content-phase2" --verify="npm run verify:admin-api-layout-contract" --verify="npm run verify:admin-view-model-contract" --verify="npm run verify:admin-starlight-shell"`
- `npm run release:gray:deploy -- --release=20260627-admin-account-api-resource-preview-gray-r1-v0510 --archive=dist-release/20260627-admin-account-api-resource-preview-gray-r1-v0510.tar.gz --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem`
- `npm run release:gray:verify -- --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem --expected-version=0.5.10 --expected-environment=gray`

### 部署结果

- 当前 release 指针：
  - `/opt/apps/xinghuan-canvas-next/releases/20260627-admin-account-api-resource-preview-gray-r1-v0510`
- systemd 状态：
  - `xinghuan-canvas-next.service`: `active`
  - `xinghuan-canvas-next-worker.service`: `active`
- 内网状态：
  - `http://127.0.0.1:18200/api/status`
  - `status=ok`
  - `version=0.5.10`
  - `environment=gray`
- 公网状态：
  - `https://canvas-next.hhh2121.xyz/api/status`
  - `status=ok`
  - `version=0.5.10`
  - `environment=gray`

## 待用户验收

### 视觉验收

- `新增成员` 与 `新建用户组` 输入框是否按卡片宽度完整展开。
- 账号列表默认是否为单行摘要，展开后详情是否向下推开且不重叠。
- `API 设置` 的 provider 列表是否不再遮挡右侧配置。
- 公共资源是否按多列排列，素材预览和查看原图是否完整显示。

### 真实交互验收

- 随机强密码生成、创建账号、重置密码、保存备注、启停账号是否正常。
- 新建分组、保存分组、删除分组限制提示是否正常。
- 公共资源展开详情、查看原图、分类切换和上传是否正常。

## 风险与残留问题

- 这轮主要修复当前截图暴露的后台布局回归，仍建议在 `1080p / 2K` 与 AI 助手开关两种状态下继续人工验收。

## 回滚信息

- deploy 前回滚锚点：
  - `/opt/apps/xinghuan-canvas-next/releases/20260627-admin-layout-overlap-resource-grid-gray-r1-v059`
- 当前目标 release 目录：
  - `/opt/apps/xinghuan-canvas-next/releases/20260627-admin-account-api-resource-preview-gray-r1-v0510`
- 回滚后需重启：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
