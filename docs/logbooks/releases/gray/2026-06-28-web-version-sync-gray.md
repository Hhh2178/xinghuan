# Web Version Sync Gray Release - 2026-06-28

## 状态

- 环境：`gray`
- 版本：`v0.5.15`
- release：`20260628-web-version-sync-gray-r1-v0515`
- 当前状态：`待 deploy`
- 上一灰度 release：`20260628-admin-audit-account-drilldown-gray-r1-v0514`

## 发布目标

- 修复前端显示版本号仍停留在旧值 `0.5.6` 的问题。
- 保证 Web 端展示版本号直接跟随根 `package.json`，避免后续发版时再次出现显示值滞后。
- 统一 gray 与 production 下一批对外版本号到 `v0.5.15`。

## 根因

- `apps/web/vite.config.ts` 之前将 `__APP_VERSION__` 写成了硬编码常量，导致 UI 中显示的版本号不会随着 monorepo 版本推进自动更新。
- 后端 `/api/status` 与共享版本常量虽然已经推进到新版本，但前端角标仍可能显示旧值，形成“运行态版本正确、UI 版本错误”的割裂。

## 变更范围

- `apps/web/vite.config.ts`
  - 改为读取根 `package.json` 版本并注入 `__APP_VERSION__`。
- `scripts/verify-web-app-version-define.mjs`
  - 新增前端版本注入回归校验，阻止再次写回硬编码版本。
- `package.json`
  - 新增 `verify:web-app-version-define` 脚本。
- `packages/shared/src/index.ts`
  - 共享 `appVersion` 推进到 `v0.5.15`。
- `apps/api/src/server.ts`
  - API 状态返回版本推进到 `v0.5.15`。
- monorepo workspace 版本：
  - 根包与 `apps/*`、`packages/*` 统一推进到 `v0.5.15`。

## Agent 已验证

### 本地代码与产物

- `npm install --package-lock-only --ignore-scripts`
- `npm run verify:web-app-version-define`
- `npm run build -w @xinghuan/web`
- `codegraph sync`

### Gray 发布与运行态

- `npm run release:gray:prepare -- --release=20260628-web-version-sync-gray-r1-v0515 --verify="npm run verify:web-app-version-define" --verify="npm run build -w @xinghuan/web"`
- `npm run release:gray:deploy -- --release=20260628-web-version-sync-gray-r1-v0515 --archive=dist-release/20260628-web-version-sync-gray-r1-v0515.tar.gz --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem`
- `npm run release:gray:verify -- --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem --expected-version=0.5.15 --expected-environment=gray`

## 待用户验收

- Gray Web 侧边栏、空画布入口和应用壳层中的版本号是否都显示为 `v0.5.15`。
- `canvas-next.hhh2121.xyz` 前端刷新后是否不再出现 `0.5.6`。

## 回滚信息

- deploy 前回滚锚点：
  - `/opt/apps/xinghuan-canvas-next/releases/20260628-admin-audit-account-drilldown-gray-r1-v0514`
- 当前目标 release 目录：
  - `/opt/apps/xinghuan-canvas-next/releases/20260628-web-version-sync-gray-r1-v0515`
- 回滚后需重启：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
