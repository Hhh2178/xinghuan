# Admin Assistant And Environment Sync Overlap Production Release - 2026-06-28

## 状态

- 环境：`production`
- 版本：`v0.5.13`
- release：`20260628-admin-assistant-environment-sync-overlap-prod-r1-v0513`
- 当前状态：`2026-06-28 已完成 production deploy + runtime verify`
- 晋级来源 gray release：
  - `/opt/apps/xinghuan-canvas-next/releases/20260628-admin-assistant-environment-sync-overlap-gray-r2-v0513`
- 上一 production release：
  - `/opt/apps/xinghuan-canvas/releases/20260627-admin-capability-flow-create-form-prod-r1-v0512`

## 发布目标

- 将灰度已验证的 `AI 助手` 和 `环境同步` 页面重叠修复晋级到正式环境。
- 保持 gray 与 production 对外版本号同步为 `v0.5.13`。

## 变更范围

- `apps/admin/src/main.tsx`
  - `assistant`、`environment-sync` 不再使用 `admin-main--fixed-panel`。
- `apps/admin/src/styles.css`
  - `assistant-settings-page` 和 `environment-sync-page` 回到正常文档流。
  - `environment-sync-toolbar` 取消 sticky 覆盖行为。
- `scripts/verify-admin-layout-overlap-fixes-contract.mjs`
  - 更新契约，反映新的页面壳层策略。

## Agent 已验证

### 本地验证

- `npm run verify:admin-layout-overlap-fixes`
- `npm run build -w @xinghuan/admin`
- `npm run release:gray:prepare -- --release=20260628-admin-assistant-environment-sync-overlap-gray-r2-v0513`

### Production 部署与运行态

- 发布包：
  - `dist-release/20260628-admin-assistant-environment-sync-overlap-prod-r1-v0513.tar.gz`
- 服务器解包目录：
  - `/opt/apps/xinghuan-canvas/releases/20260628-admin-assistant-environment-sync-overlap-prod-r1-v0513`
- current 指针：
  - `/opt/apps/xinghuan-canvas/releases/20260628-admin-assistant-environment-sync-overlap-prod-r1-v0513`
- systemd 状态：
  - `xinghuan-canvas.service`: `active`
  - `xinghuan-canvas-worker.service`: `active`
- 内网状态：
  - `http://127.0.0.1:18100/api/status`
  - `version = 0.5.13`
  - `environment = production`
- 公网状态：
  - `https://canvas.hhh2121.xyz/api/status`
  - `version = 0.5.13`
  - `environment = production`
- 生产 env 下迁移：
  - `npm run db:migrate`
  - `applied = []`
  - `skipped = 19`

## 部署备注

- 生产发布复用 `deploy-gray-release.mjs`，但显式传入：
  - `--remote-root=/opt/apps/xinghuan-canvas`
  - `--shared-env-file=/opt/apps/xinghuan-canvas/shared/canvas.env`
  - `--service=xinghuan-canvas.service`
  - `--worker-service=xinghuan-canvas-worker.service`

## 回滚锚点

- 代码回滚目标：
  - `/opt/apps/xinghuan-canvas/releases/20260627-admin-capability-flow-create-form-prod-r1-v0512`
- 回滚后需重启：
  - `xinghuan-canvas.service`
  - `xinghuan-canvas-worker.service`

## 待用户验收

- 正式环境 `AI 助手`：顶部、hero、配置区和右侧抽屉是否不再互相压住。
- 正式环境 `环境同步`：顶部 band、工具栏、分区和表格是否恢复正常分层。
