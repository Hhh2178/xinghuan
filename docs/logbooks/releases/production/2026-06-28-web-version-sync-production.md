# Web Version Sync Production Release - 2026-06-28

## 状态

- 环境：`production`
- 版本：`v0.5.15`
- release：`20260628-web-version-sync-prod-r1-v0515`
- 当前状态：`待 deploy`
- 晋级来源 gray release：
  - `/opt/apps/xinghuan-canvas-next/releases/20260628-web-version-sync-gray-r1-v0515`
- 上一 production release：
  - `/opt/apps/xinghuan-canvas/releases/20260628-admin-assistant-environment-sync-overlap-prod-r1-v0513`

## 发布目标

- 将 gray 已验证的 Web 版本展示修复晋级到正式环境。
- 保证 production 前端显示版本号与 API 状态、共享版本常量一致，统一为 `v0.5.15`。

## 变更范围

- `apps/web/vite.config.ts`
  - Web 版本注入改为读取根 `package.json`。
- `scripts/verify-web-app-version-define.mjs`
  - 新增版本注入回归校验。
- `package.json`
  - 新增 `verify:web-app-version-define`。
- `packages/shared/src/index.ts`
  - 共享版本推进到 `v0.5.15`。
- `apps/api/src/server.ts`
  - API 状态返回版本推进到 `v0.5.15`。

## Agent 已验证

### 本地验证

- `npm run verify:web-app-version-define`
- `npm run build -w @xinghuan/web`

### Production 部署与运行态

- 发布包：
  - `dist-release/20260628-web-version-sync-prod-r1-v0515.tar.gz`
- 部署脚本复用：
  - `scripts/release/deploy-gray-release.mjs`
  - `scripts/release/verify-gray-runtime.mjs`
- 生产环境覆盖参数：
  - `--remote-root=/opt/apps/xinghuan-canvas`
  - `--shared-env-file=/opt/apps/xinghuan-canvas/shared/canvas.env`
  - `--service=xinghuan-canvas.service`
  - `--worker-service=xinghuan-canvas-worker.service`
  - `--internal-status-url=http://127.0.0.1:18100/api/status`
  - `--public-status-url=https://canvas.hhh2121.xyz/api/status`
  - `--expected-environment=production`

## 待用户验收

- Production Web 侧边栏和空画布版本号是否显示为 `v0.5.15`。
- `canvas.hhh2121.xyz` 强刷后前端是否不再展示 `0.5.6`。

## 回滚锚点

- 代码回滚目标：
  - `/opt/apps/xinghuan-canvas/releases/20260628-admin-assistant-environment-sync-overlap-prod-r1-v0513`
- 回滚后需重启：
  - `xinghuan-canvas.service`
  - `xinghuan-canvas-worker.service`
