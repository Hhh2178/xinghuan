# Performance Toggle Button Sizing Production Release - 2026-07-01

## 状态

- 环境：`production`
- 版本：`v0.5.20`
- release：`20260630-performance-toggle-and-import-fixes-gray-r1-v0520`
- 当前状态：`待 production deploy + runtime verify`
- 晋级来源 gray release：
  - `/opt/apps/xinghuan-canvas-next/releases/20260630-performance-toggle-and-import-fixes-gray-r1-v0520`
- 上一 production release：
  - `/opt/apps/xinghuan-canvas/releases/20260630-group-execution-manager-runtime-rounds-prod-r1-v0519`

## 发布目标

- 将灰度已验证的性能优化按钮尺寸对齐收口晋级到正式环境。
- 保持 production 与 gray 暴露同一应用版本 `v0.5.20`。

## 变更范围

- `apps/web/src/App.tsx`
  - 顶栏“性能优化”胶囊按钮与公告 / 资源库统一高度和图标字号。
- `apps/web/src/styles/index.css`
  - 收窄性能优化按钮内边距和切换轨道，避免上下堆叠。

## Agent 已验证

- `npx tsx scripts/verify-performance-mode-toggle-contract.ts`
- `npm run build -w @xinghuan/web`

## 待用户验收

- Production 顶栏“性能优化”按钮是否与公告 / 资源库对齐。
- 按钮高度和图标字号是否满足视觉统一要求。

## 回滚锚点

- 代码回滚目标：
  - `/opt/apps/xinghuan-canvas/releases/20260630-group-execution-manager-runtime-rounds-prod-r1-v0519`
- 回滚后需重启：
  - `xinghuan-canvas.service`
  - `xinghuan-canvas-worker.service`
