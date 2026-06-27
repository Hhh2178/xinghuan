# Admin Structural Layout Fixes Gray Release - 2026-06-27

## 状态

- 环境：`gray`
- 版本：`v0.5.11`
- release：`20260627-admin-structural-layout-fixes-gray-r1-v0511`
- 当前状态：`2026-06-27 待 deploy`
- 上一灰度 release：`20260627-admin-account-api-resource-preview-gray-r1-v0510`

## 发布目标

- 修复 `组织与治理` 中新增成员与新建用户组表单仍被通用 5 列 `.form-grid` 挤压的问题。
- 修复 `能力配置 / API 设置` 中平台列表和 API 配置内容形成半透明覆盖层，压住父级能力配置与 API/RH 切换区域的问题。
- 修复 `公共资源` 中单个资源卡被 `1fr` 拉满整行，以及图片预览被固定高度容器限制的问题。

## 根因

- `FormPanel` 组件固定把 children 包进 5 列 `.form-grid`，导致账号和用户组虽然内部已改成竖向表单，但外层格子仍只有五分之一宽度。
- `ApiSettingsPanel` 自身继续渲染一套半透明、固定高度、内滚动的子页面工作台，和父级 `能力配置` 工作区叠出两层视觉结构。
- 公共资源卡使用 `repeat(auto-fill, minmax(220px, 1fr))`，当资源数量少时单卡会被 `1fr` 拉伸到整行；图片预览区使用固定/clamp 高度，不符合“固定卡宽、图片按原比例自然高度”的要求。

## 变更范围

- `apps/admin/src/admin-common-components.tsx`
  - `FormPanel` 新增 `bodyClassName`，允许调用方选择单列表单体。
- `apps/admin/src/admin-user-accounts-section.tsx`
  - 新增成员表单使用 `form-grid form-grid--stack`，脱离 5 列压缩。
- `apps/admin/src/admin-user-groups-section.tsx`
  - 新建用户组表单使用 `form-grid form-grid--stack`，脱离 5 列压缩。
- `apps/admin/src/admin-api-settings-panel.tsx`
  - 删除 API 设置内层重复页面头，改为轻量当前 Provider 状态条。
- `apps/admin/src/styles.css`
  - 新增 `.form-grid--stack` 单列布局。
  - API 设置页改为普通文档流容器，provider rail 不再使用 overlay-prone 定位/高度预算。
  - 公共资源网格改为固定 `250px` 卡片列，卡片不再被 `1fr` 拉满。
  - 图片预览改为固定卡宽下 `width: 100%; height: auto; object-fit: contain` 自然等比展示。
- 契约同步：
  - `scripts/verify-admin-layout-overlap-fixes-contract.mjs`
  - `scripts/verify-admin-api-layout-contract.mjs`
  - `scripts/verify-admin-resource-content-phase2-contract.mjs`
- 计划与日志：
  - `docs/superpowers/plans/2026-06-27-admin-structural-layout-fixes.md`
  - `docs/logbooks/daily/2026/2026-06/2026-06-27.md`

## Agent 已验证

### 本地代码与产物

- `npm run verify:admin-layout-overlap-fixes`
- `npm run verify:admin-api-layout-contract`
- `npm run verify:admin-resource-content-phase2`
- `npm run build -w @xinghuan/admin`

### Gray 发布与运行态

- 待执行：
  - `npm run release:gray:prepare -- --release=20260627-admin-structural-layout-fixes-gray-r1-v0511 --verify="npm run verify:admin-layout-overlap-fixes" --verify="npm run verify:admin-api-layout-contract" --verify="npm run verify:admin-resource-content-phase2" --verify="npm run build -w @xinghuan/admin"`
  - `npm run release:gray:deploy -- --release=20260627-admin-structural-layout-fixes-gray-r1-v0511 --archive=dist-release/20260627-admin-structural-layout-fixes-gray-r1-v0511.tar.gz --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem`
  - `npm run release:gray:verify -- --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem --expected-version=0.5.11 --expected-environment=gray`

## 待用户验收

- `组织与治理 / 账号`：新增成员输入框是否占满左侧卡片宽度，按钮是否横向可读。
- `组织与治理 / 用户组`：新建用户组输入框是否一行一个、宽度完整。
- `能力配置 / API 设置`：平台列表是否只作为左侧列存在，不再盖住能力配置标题、API/RH 切换区和右侧表单。
- `资源与内容 / 公共资源`：单个资源卡是否保持固定宽度；图片是否按原比例自然缩放，不再被固定高度裁切。

## 回滚信息

- deploy 前回滚锚点：
  - `/opt/apps/xinghuan-canvas-next/releases/20260627-admin-account-api-resource-preview-gray-r1-v0510`
- 当前目标 release 目录：
  - `/opt/apps/xinghuan-canvas-next/releases/20260627-admin-structural-layout-fixes-gray-r1-v0511`
- 回滚后需重启：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
