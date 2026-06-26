# Resource Preview And Shared Library Polish Gray Release - 2026-06-26

## 状态

- 环境：`gray`
- 版本：`v0.5.3`
- release：`20260626-resource-preview-gray-r1-v053`
- 当前状态：`已完成 deploy + runtime verify`

## 发布目标

- 收口公共资源库卡片操作位，避免“另存为我的资源”导致底部动作行挤压显示不全。
- 为公共资源库补上完整素材预览入口，并让卡片缩略图尽量保持完整比例展示。
- 修复生成库“查看”弹窗对高纵横比图片/视频的完整预览能力，优先展示完整原素材。

## 变更范围

- `apps/web/src/components/ResourceLibraryDrawer.tsx`
  - 公共资源卡片移除右上角收藏位，改为右上角“另存为我的资源”。
  - 为图片/视频资源新增完整预览按钮，接入统一预览弹窗。
  - 公共资源卡片图片/视频缩略图改为 `object-contain`，减少裁切。
- `apps/web/src/components/resource-library/ResourcePreviewOverlay.tsx`
  - 将预览弹窗改为受控最大尺寸的媒体舞台，保持完整素材优先，不强行铺满屏幕。
- `apps/web/src/components/GenerationLibraryPreviewOverlay.tsx`
  - 完整预览优先使用原始素材 `fileUrl`，避免继续放大已裁切的 `previewUrl`。
- `apps/web/src/styles/index.css`
  - 调整资源卡片悬停预览的最大像素边界，提升小图预览完整度。
- `scripts/verify-shared-resource-library-contract.mjs`
  - 补强公共资源完整预览与完整比例展示契约。
- `scripts/verify-generation-library-preview-contract.mjs`
  - 补强生成库完整预览必须优先使用原素材、预览容器需受控的契约。

## Agent 已验证

- `npm run type-check -w @xinghuan/web`
- `node scripts/verify-shared-resource-library-contract.mjs`
- `node scripts/verify-generation-library-resource-card-contract.mjs`
- `node scripts/verify-generation-library-preview-contract.mjs`

## 本次部署执行

- `codegraph sync`
- `npm run build:single-port`
- `npm run package:release -- 20260626-resource-preview-gray-r1-v053`
- `node scripts/release/deploy-gray-release.mjs --release=20260626-resource-preview-gray-r1-v053 --archive=dist-release/20260626-resource-preview-gray-r1-v053.tar.gz --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem`
- `node scripts/release/verify-gray-runtime.mjs --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem --expected-version=0.5.3 --expected-environment=gray`

## 运行态复核

- current 指针：
  - `/opt/apps/xinghuan-canvas-next/releases/20260626-resource-preview-gray-r1-v053`
- `/api/status`：
  - `version = 0.5.3`
  - `environment = gray`
- 关键服务状态：
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`

## 待用户验收

- 公共资源库卡片右上角是否已改为“另存为我的资源”，底部动作行是否完整显示。
- 公共资源库卡片的小图是否较之前更完整，点击“查看完整素材”后是否能完整看到图片/视频。
- 生成库点击“查看”后，`9:16` 等高比例素材是否能够完整显示在预览框中。
