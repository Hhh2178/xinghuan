# Admin Layout Overlap And Resource Grid Gray Release - 2026-06-27

## 状态

- 环境：`gray`
- 版本：`v0.5.9`
- release：`20260627-admin-layout-overlap-resource-grid-gray-r1-v059`
- 当前状态：`2026-06-27 待 deploy`
- 上一灰度 release：`20260627-admin-shell-visual-unification-gray-r1-v058`

## 发布目标

- 去掉 `API 设置` 中重复且会遮挡分区切换的顶部大板块。
- 重排 `组织与治理` 中账号治理工作台，解决新增成员区与右侧账号管理区互相挤压的问题。
- 将 `公共资源` 收口为自适应等宽卡片与单卡展开模式，避免资源详情叠层覆盖和卡片混乱。

## 变更范围

- `apps/admin/src/admin-api-settings-panel.tsx`
  - 删除重复 `统一管理接入能力` 顶部工作带
  - 改为内容区内轻量 section head
- `apps/admin/src/admin-user-accounts-section.tsx`
  - 左侧 `新增成员` 改为竖向堆叠创建卡
  - 右侧 `账号列表` 改为单列 `账号工作台`
- `apps/admin/src/admin-permissions-group-rail.tsx`
  - 选中分组成员数状态芯片改为更柔和的 warning 态
- `apps/admin/src/admin-public-resources-panel.tsx`
  - 引入单一 `expandedItemId`
- `apps/admin/src/admin-public-resource-card.tsx`
  - 默认只展示预览、标题、摘要与展开入口
  - 详情区改为卡片内折叠展开
- `apps/admin/src/styles.css`
  - 收口普通按钮为统一深色体系
  - 新增 `users-create-stack-card*`、`users-account-record*`
  - 公共资源网格改为自适应 `minmax` 列
- 契约与脚本：
  - `scripts/verify-admin-layout-overlap-fixes-contract.mjs`
  - `scripts/verify-admin-users-panel-contract.mjs`
  - `package.json`
- 文档：
  - `docs/superpowers/specs/2026-06-27-admin-layout-overlap-and-resource-grid-fixes-design.md`
  - `docs/superpowers/plans/2026-06-27-admin-layout-overlap-and-resource-grid-fixes-plan.md`
  - `docs/logbooks/daily/2026/2026-06/2026-06-27.md`

## Agent 已验证

### 本地代码与产物

- `npm run verify:admin-users-panel-contract`
- `npm run verify:admin-layout-overlap-fixes`
- `npm run verify:admin-api-layout-contract`
- `node scripts/verify-admin-governance-redesign-contract.mjs`
- `npm run verify:admin-resource-content-phase2`
- `npm run verify:admin-public-resources-starlight`
- `npm run verify:admin-view-model-contract`
- `npm run verify:admin-starlight-shell`
- `npm run build -w @xinghuan/admin`
- `codegraph sync`

### Gray 发布与运行态

- `npm run release:gray:prepare -- --release=20260627-admin-layout-overlap-resource-grid-gray-r1-v059 --verify="npm run verify:admin-users-panel-contract" --verify="npm run verify:admin-layout-overlap-fixes" --verify="npm run verify:admin-api-layout-contract" --verify="node scripts/verify-admin-governance-redesign-contract.mjs" --verify="npm run verify:admin-resource-content-phase2" --verify="npm run verify:admin-public-resources-starlight" --verify="npm run verify:admin-view-model-contract" --verify="npm run verify:admin-starlight-shell"`
- `npm run release:gray:deploy -- --release=20260627-admin-layout-overlap-resource-grid-gray-r1-v059 --archive=dist-release/20260627-admin-layout-overlap-resource-grid-gray-r1-v059.tar.gz --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem`
- `npm run release:gray:verify -- --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem --expected-version=0.5.9 --expected-environment=gray`

## 待用户验收

### 视觉验收

- `API 设置` 顶部是否已不再遮挡分区切换。
- `组织与治理` 中新增成员竖卡、账号工作台和按钮颜色是否已统一、不再拥挤。
- `公共资源` 自适应卡片在常用分辨率下是否保持稳定列布局，展开详情时没有叠层。

### 真实交互验收

- 账号创建、分组切换、备注保存、密码重置、启停账号是否正常。
- 公共资源预览、展开详情、折叠收起与分类切换是否正常。

## 风险与残留问题

- 这轮主要完成后台局部布局与交互收口，仍建议在 `1080p / 2K` 和 AI 助手开关两种壳层宽度下继续人工视觉验收。
- 本轮没有新增 migration，但灰度发布仍依赖远端已有迁移链路正常可执行。

## 回滚信息

- deploy 前回滚锚点：
  - `/opt/apps/xinghuan-canvas-next/releases/20260627-admin-shell-visual-unification-gray-r1-v058`
- 当前目标 release 目录：
  - `/opt/apps/xinghuan-canvas-next/releases/20260627-admin-layout-overlap-resource-grid-gray-r1-v059`
- 回滚后需重启：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
