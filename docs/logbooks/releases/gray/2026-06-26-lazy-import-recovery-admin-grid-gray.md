# Lazy Import Recovery And Admin Grid Gray Release - 2026-06-26

## 状态

- 环境：`gray`
- 版本：`v0.5.6`
- release：`20260626-lazy-import-recovery-admin-grid-gray-r1-v056`
- 当前状态：`已完成 deploy + runtime verify`

## 发布目标

- 修复 gray 发布切换窗口内，旧标签页懒加载旧 chunk 时直接落入错误边界的问题。
- 为画布壳层、资源抽屉和主要懒加载节点补上一层“一次性硬刷新恢复”。
- 收口公共资源后台分类区文字对比度不足的问题。
- 将公共资源后台卡片收紧为桌面端一行四卡，更贴近后台浏览和治理场景。

## 变更范围

- `apps/web/src/utils/lazyImportRecovery.ts`
  - 新增动态导入失败识别与一次性 reload 恢复 helper。
- `apps/web/src/App.tsx`
  - 画布壳层、资源库抽屉、生成库抽屉、主题管理器、RHToolsProvider 统一接入懒加载恢复链路。
- `apps/web/src/components/Canvas.tsx`
  - 主要懒加载节点统一接入 stale chunk 自恢复。
- `scripts/verify-web-lazy-import-recovery.ts`
- `package.json`
  - 新增 `verify:web-lazy-import-recovery`
- `apps/admin/src/styles.css`
  - 公共资源分类区统一深色背景与白色文字
  - 公共资源卡片改为四列网格
  - 卡片预览与管理区高度、间距、输入框尺寸同步收紧

## Agent 已验证

### 本地代码与产物

- `npm run verify:web-lazy-import-recovery`
- `npm run type-check -w @xinghuan/web`
- `npm run build -w @xinghuan/web`
- `npm run verify:app-shell-loading-announcement-contract`
- `npm run verify:admin-governance-redesign-contract`
- `npm run build -w @xinghuan/admin`
- `node scripts/verify-release-version-alignment.mjs`
- `npm run verify:engineering-governance-contract`
- `codegraph sync`

### 远端部署与运行态

- `npm run release:gray:prepare -- --release=20260626-lazy-import-recovery-admin-grid-gray-r1-v056`
- `npm run release:gray:deploy -- --release=20260626-lazy-import-recovery-admin-grid-gray-r1-v056 --archive=dist-release/20260626-lazy-import-recovery-admin-grid-gray-r1-v056.tar.gz --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem`
- `npm run release:gray:verify -- --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem --expected-version=0.5.6 --expected-environment=gray`
- 发布包：
  - `dist-release/20260626-lazy-import-recovery-admin-grid-gray-r1-v056.tar.gz`
- 服务器解包目录：
  - `/opt/apps/xinghuan-canvas-next/releases/20260626-lazy-import-recovery-admin-grid-gray-r1-v056`
- release 内执行：
  - `npm ci`
  - `npm run db:migrate`
- 运行态复核：
  - `current = /opt/apps/xinghuan-canvas-next/releases/20260626-lazy-import-recovery-admin-grid-gray-r1-v056`
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
  - `http://127.0.0.1:18200/api/status => version = 0.5.6, environment = gray`
  - `https://canvas-next.hhh2121.xyz/api/status => version = 0.5.6, environment = gray`

## 待用户验收

### 视觉验收

- 公共资源后台分类区文字在深色背景上是否清晰可读。
- 公共资源后台桌面端是否稳定保持一行四卡，且无文字溢出和操作区挤压。
- 公共资源卡片缩小后，竖图、横图、视频的完整预览是否仍可快速辨认。

### 真实业务链路

- gray 页面停留在旧标签页后，再打开 LLM/资源库/生成库时，是否不再偶发出现动态导入错误页。
- 若跨发布窗口命中旧 chunk，页面是否会只自动刷新一次并恢复到新版本。

## 风险与残留问题

- 这轮恢复逻辑针对的是 stale chunk 失配，不覆盖真正的网络断连或发布目录损坏。
- 线上仍需继续观察是否存在极少数浏览器使用不同的动态导入失败文案。

## 回滚信息

- `current` 回滚目标：
  - `/opt/apps/xinghuan-canvas-next/releases/20260626-admin-governance-redesign-gray-r1-v055`
- 需要重启的服务：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
- 回滚后需复查的接口：
  - `http://127.0.0.1:18200/api/status`
  - `https://canvas-next.hhh2121.xyz/api/status`
