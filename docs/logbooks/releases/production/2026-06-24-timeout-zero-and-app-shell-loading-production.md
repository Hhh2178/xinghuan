# Timeout Zero Normalize And App Shell Loading Production Release - 2026-06-24

## 状态

- 环境：`production`
- 版本：`v0.5.1`
- release：`20260624-timeout-zero-and-app-shell-loading-prod-r2-v051`
- 当前状态：`已完成 production deploy + runtime verify`
- 晋级来源 gray release：
  - `/opt/apps/xinghuan-canvas-next/releases/20260624-timeout-zero-and-app-shell-loading-gray-r2-v051`
- 上一 production release：
  - `/opt/apps/xinghuan-canvas/releases/20260624-runninghub-timeout-empty-default-prod-r1-v051`
- 代码提交：
  - `7c5a4b7 fix: normalize timeout zero and remove extra loading shell`

## 发布目标

- 将 RH 超时 `0 => 未设置` 的治理从 gray 晋级到 production。
- 正式移除登录后额外出现的旧全屏 loading shell。
- 保持 `v0.5.1` 版本号不变，完成同版正式切换。

## 变更范围

- 后台 RH 编辑器：`0` 统一视为未设置。
- API RunningHub catalog：仅保留显式正数 timeout。
- Web App Shell：过渡页保持到 workspace shell ready，不再二次出现全屏 fallback。

## Agent 已验证

### 本地验证

- `codegraph sync`
- `node scripts/verify-poll-timeout-empty-by-default-contract.mjs`
- `node scripts/verify-app-shell-loading-announcement-contract.mjs`
- `npm run type-check -w @xinghuan/web`
- `npm run type-check -w @xinghuan/admin`
- `npm run type-check -w @xinghuan/api`

### Production 运行态

- `readlink -f /opt/apps/xinghuan-canvas/current`
  - `/opt/apps/xinghuan-canvas/releases/20260624-timeout-zero-and-app-shell-loading-prod-r2-v051`
- `systemctl is-active xinghuan-canvas.service`
  - `active`
- `systemctl is-active xinghuan-canvas-worker.service`
  - `active`
- `http://127.0.0.1:18100/api/status`
  - `version = 0.5.1`
  - `environment = production`
- `https://canvas.hhh2121.xyz/api/status`
  - `version = 0.5.1`
  - `environment = production`

## 本次部署执行

- 发布包：
  - `dist-release/20260624-timeout-zero-and-app-shell-loading-prod-r2-v051.tar.gz`
- 服务器解包目录：
  - `/opt/apps/xinghuan-canvas/releases/20260624-timeout-zero-and-app-shell-loading-prod-r2-v051`
- release 内执行：
  - `npm ci`
  - `npm run db:migrate`
- 本次迁移结果：
  - `applied = []`
  - `skipped = 18`

## 回滚锚点

- 代码回滚目标：
  - `/opt/apps/xinghuan-canvas/releases/20260624-runninghub-timeout-empty-default-prod-r1-v051`
- 回滚后需重启：
  - `xinghuan-canvas.service`
  - `xinghuan-canvas-worker.service`

## 影响

- 正式环境的 RH timeout 语义和后台 UI 一致，不再把 `0` 当成需要保留的配置值。
- 登录态到工作区的加载链路更单一，不再出现旧的二次工作区展开页。
- 正式版本号继续维持 `v0.5.1`，但 release 已晋级到新的 r2 批次。

## 待用户验收

- RH 编辑器里 `0` 的前端表现与保存行为。
- 正式版登录后过渡页与工作区加载体验。
- 视觉与交互层实际使用感受。
