# Shared Resource Admin And Generation Library Gray Release - 2026-06-26

## 状态

- 环境：`gray`
- 版本：`v0.5.2`
- release：`20260626-shared-resource-admin-generation-gray-r1-v052`
- 当前状态：`准备 deploy，待 runtime verify`

## 发布目标

- 补齐后台“公共资源”管理入口。
- 将公共资源库上传从 URL 填写改为本地文件上传。
- 修复资源库抽屉额外横向/纵向滚动条风险，并暴露缺失分类状态。
- 将生成库卡片交互和媒体展示继续对齐资源库，避免图片/视频被裁切。

## 变更范围

- `apps/admin/src/admin-public-resources-panel.tsx`
  - 新增后台公共资源管理页，支持分类、搜索、列表、内联编辑、删除和本地上传媒体资源。
- `apps/admin/src/admin-view-model.ts` / `apps/admin/src/main.tsx`
  - 新增“公共资源”后台导航并接入页面。
- `apps/web/src/components/ResourceLibraryDrawer.tsx`
  - 公共资源上传改为隐藏 file input + `/api/files/upload` + shared resource 入库。
  - 抽屉宽度和横向溢出约束收紧。
  - 分类下拉补齐未分类/缺失分类显示，改分类后刷新列表。
- `apps/web/src/components/GenerationLibraryDrawer.tsx`
  - 生成库图片/视频卡片从 `object-cover` 改为 `object-contain`。
  - 生成库动作按钮改为资源库风格圆形图标按钮。
- `apps/web/src/services/sharedResourceApi.ts`
  - 新增公共资源本地文件上传 helper。
- `scripts/verify-*.mjs` / `scripts/verify-admin-view-model-contract.ts`
  - 补强公共资源后台、上传方式、生成库非裁切展示和导航契约。

## Agent 已验证

- `npm run type-check -w @xinghuan/web`
- `npm run type-check -w @xinghuan/admin`
- `node scripts/verify-shared-resource-library-contract.mjs`
- `node scripts/verify-generation-library-resource-card-contract.mjs`
- `node scripts/verify-generation-library-preview-contract.mjs`
- `npm run verify:admin-view-model-contract`
- `npm run verify:generation-library-admin-assistant-layout`

## 待执行

- `codegraph sync`
- `npm run build:single-port`
- `npm run package:release -- 20260626-shared-resource-admin-generation-gray-r1-v052`
- `node scripts/release/deploy-gray-release.mjs --release=20260626-shared-resource-admin-generation-gray-r1-v052 --archive=dist-release/20260626-shared-resource-admin-generation-gray-r1-v052.tar.gz --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem`
- `node scripts/release/verify-gray-runtime.mjs --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem --expected-version=0.5.2 --expected-environment=gray`

## 待用户验收

- 后台是否能看到并管理“公共资源”。
- “公共资源库”上传按钮是否能直接选择本地文件并入库。
- “我的资源库”抽屉是否不再出现页面级多余滚动条。
- 用户已有分组 `1` / `2` 中，资源是否按分类显示；若出现“缺失分类”标记，需要继续核对对应资源的历史 categoryId。
- 生成库图片/视频是否完整显示，卡片操作是否接近资源库体验。
