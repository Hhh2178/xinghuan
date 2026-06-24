# Timeout Zero Normalize And App Shell Loading Gray Release - 2026-06-24

## 状态

- 环境：`gray`
- 版本：`v0.5.1`
- release：`20260624-timeout-zero-and-app-shell-loading-gray-r2-v051`
- 当前状态：`已完成 gray deploy + runtime verify`
- 上一 gray release：
  - `/opt/apps/xinghuan-canvas-next/releases/20260624-runninghub-timeout-empty-default-gray-r1-v051`
- 代码提交：
  - `7c5a4b7 fix: normalize timeout zero and remove extra loading shell`

## 发布目标

- 把 RH 轮询超时字段的 `0` 统一收口为“未设置”。
- 去掉过渡页结束后再次出现的全屏工作区加载页。
- 保持 `v0.5.1` 版本号不变，只推进 gray release 批次。

## 变更范围

- 后台 RH 编辑器：
  - `pollTimeoutMs = 0` 不再落库存值，统一转为空。
- API RunningHub catalog：
  - 读取旧值时只保留 `> 0` 的轮询超时，其余归一成未设置。
- Web App Shell：
  - 登录后在 workspace shell 预加载完成前继续停留在设计过渡页。
  - 顶层 `Suspense` 不再二次渲染额外全屏 loading shell。

## Agent 已验证

### 本地验证

- `codegraph sync`
- `node scripts/verify-poll-timeout-empty-by-default-contract.mjs`
- `node scripts/verify-app-shell-loading-announcement-contract.mjs`
- `npm run type-check -w @xinghuan/web`
- `npm run type-check -w @xinghuan/admin`
- `npm run type-check -w @xinghuan/api`
- `npm run release:gray:prepare -- --release=20260624-timeout-zero-and-app-shell-loading-gray-r2-v051 --verify="node scripts/verify-poll-timeout-empty-by-default-contract.mjs" --verify="node scripts/verify-app-shell-loading-announcement-contract.mjs"`

### Gray 运行态

- `readlink -f /opt/apps/xinghuan-canvas-next/current`
  - `/opt/apps/xinghuan-canvas-next/releases/20260624-timeout-zero-and-app-shell-loading-gray-r2-v051`
- `systemctl is-active xinghuan-canvas-next.service`
  - `active`
- `systemctl is-active xinghuan-canvas-next-worker.service`
  - `active`
- `http://127.0.0.1:18200/api/status`
  - `version = 0.5.1`
  - `environment = gray`
- `https://canvas-next.hhh2121.xyz/api/status`
  - `version = 0.5.1`
  - `environment = gray`

## 本次部署执行

- 发布包：
  - `dist-release/20260624-timeout-zero-and-app-shell-loading-gray-r2-v051.tar.gz`
- 服务器解包目录：
  - `/opt/apps/xinghuan-canvas-next/releases/20260624-timeout-zero-and-app-shell-loading-gray-r2-v051`
- release 内执行：
  - `npm ci`
  - `npm run db:migrate`
- 本次迁移结果：
  - `applied = []`
  - `skipped = 18`

## 回滚锚点

- 代码回滚目标：
  - `/opt/apps/xinghuan-canvas-next/releases/20260624-runninghub-timeout-empty-default-gray-r1-v051`
- 回滚后需重启：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`

## 影响

- RH 轮询超时配置和“留空表示不设置”的 UI 语义一致。
- 登录后不再额外闪出一层“正在展开星图/工作区”的旧 loading 页。
- 这批改动不改变对外版本号，只替换 gray 当前 release。

## 待用户验收

- RH 编辑器里输入 `0` 后是否自动表现为留空口径。
- 过渡页结束后是否不再出现二次全屏加载页。
- 页面观感、视觉节奏和真实业务体验。
