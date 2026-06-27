# Admin Resource Content Governance Gray Release - 2026-06-27

## 状态

- 环境：`gray`
- 版本：`v0.5.7`
- release：`20260627-admin-resource-content-governance-gray-r1-v057`
- 当前状态：`2026-06-27 已完成 deploy + runtime verify`

## 发布目标

- 把 `资源与内容` 工作域补齐到新版后台体系。
- 在后台新增 `生成库` 治理工作台，统一图像 / 视频 / 音频生成结果的完整预览和治理动作。
- 继续收口 `组织与治理` 第二阶段的工作台化结构，并保留本轮已完成的治理中心改造。

## 变更范围

- `apps/admin/src/admin-generation-library-panel.tsx`
- `apps/admin/src/admin-generation-library-card.tsx`
  - 新增生成库后台治理工作台与卡片治理壳层。
- `apps/admin/src/admin-api-client.ts`
- `apps/admin/src/admin-types.ts`
  - 新增生成库后台接口与类型。
- `apps/admin/src/admin-view-model.ts`
- `apps/admin/src/main.tsx`
  - 将 `生成库` 接入 `资源与内容` 工作域导航和页面路由。
- `apps/admin/src/styles.css`
  - 新增生成库摘要卡、详情块和卡片治理样式，并复用四列资源卡片基线。
- `scripts/verify-admin-resource-content-phase2-contract.mjs`
- `package.json`
  - 新增 `verify:admin-resource-content-phase2`。
- 文档同步：
  - `docs/systems/admin/frontend-design/page-map-and-functions.md`
  - `docs/systems/admin/frontend-design/visual-style-and-stitch-baseline.md`
  - `docs/systems/admin/ui-and-information-architecture.md`
  - `docs/superpowers/plans/2026-06-27-admin-backend-overall-redesign-master-plan.md`

## Agent 已验证

### 本地代码与产物

- `npm run verify:admin-view-model-contract`
- `npm run verify:admin-starlight-shell`
- `npm run verify:admin-public-resources-starlight`
- `npm run verify:admin-resource-content-phase2`
- `npm run verify:admin-users-panel-contract`
- `npm run verify:admin-governance-center-phase2`
- `npm run verify:admin-governance-redesign-contract`
- `npm run verify:admin-usage-dashboard-contract`
- `npm run verify:admin-readonly-panels-contract`
- `npm run build -w @xinghuan/admin`
- `codegraph sync`

### Gray 发布与运行态

- `npm run build`
- `npm run release:gray:prepare -- --release=20260627-admin-resource-content-governance-gray-r1-v057`
- `npm run release:gray:deploy -- --release=20260627-admin-resource-content-governance-gray-r1-v057 --archive=dist-release/20260627-admin-resource-content-governance-gray-r1-v057.tar.gz --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem`
- `npm run release:gray:verify -- --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem --expected-version=0.5.7 --expected-environment=gray`
- Gray 运行态结果：
  - `current`：`/opt/apps/xinghuan-canvas-next/releases/20260627-admin-resource-content-governance-gray-r1-v057`
  - `xinghuan-canvas-next.service`：`active`
  - `xinghuan-canvas-next-worker.service`：`active`
  - `https://canvas-next.hhh2121.xyz/api/status`：`version=0.5.7`，`environment=gray`
  - `http://127.0.0.1:18200/api/status`：`version=0.5.7`，`environment=gray`

## 待用户验收

### 视觉验收

- `生成库` 工作台在桌面端是否保持四列资源卡片、完整预览和无文字溢出。
- 生成结果卡片的来源信息区和操作区是否清晰、无拥挤和错误高亮。
- `资源与内容` 工作域三个入口 `公共资源 / 生成库 / 公告` 的信息层级是否统一。

### 真实业务链路

- 生成库中的图像、视频、音频是否都能完整预览。
- `转公共资源` 是否可以把生成结果稳定转入公共资源后台。
- 生成库删除动作是否正常，且不影响其他条目。

## 风险与残留问题

- 当前 `生成库` 后台先接入现有生成库链路，治理范围是当前账号结果；如果后续需要“跨账号全局治理”，要补专门的 admin 聚合接口。
- 本轮主要完成后台前端治理台收口，未在这批内新增独立的 `资源与内容首页` 聚合摘要接口。

## 回滚信息

- deploy 前回滚锚点：
  - `/opt/apps/xinghuan-canvas-next/releases/20260626-lazy-import-recovery-admin-grid-gray-r1-v056`
- 当前 release 目录：
  - `/opt/apps/xinghuan-canvas-next/releases/20260627-admin-resource-content-governance-gray-r1-v057`
- 回滚后需重启：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
