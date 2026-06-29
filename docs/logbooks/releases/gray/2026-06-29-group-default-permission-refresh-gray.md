# Group Default, Permission Visibility, and Canvas Refresh Gray Release - 2026-06-29

## 状态

- 环境：`gray`
- 版本：`v0.5.16`
- release：`20260629-group-default-permission-refresh-gray-r1-v0516`
- 当前状态：`待部署`
- 上一灰度 release：`20260628-web-version-sync-gray-r1-v0515`

## 发布目标

- 新建用户组默认名称统一为 `未命名组`。
- 未开放权限的共享资源、RH 条目和节点能力直接隐藏，不再以拒绝态展示。
- 画布刷新后保留 image/video 素材的可见状态。
- 同步对外版本到 `v0.5.16`。

## 变更范围

- `apps/web/src/stores/groupBus.ts`
  - 新建组默认名改为 `未命名组`。
- `apps/api/src/group-permission-policy.ts`
  - 成员缺省策略改为默认关闭。
- `apps/api/src/server.ts`
  - 新建用户组时自动落一条默认关闭策略。
  - API 状态版本同步到 `0.5.16`。
- `apps/web/src/components/nodes/UploadNode.tsx`
  - 刷新后按素材数据反推 uploadType 并恢复显示。
- `packages/shared/src/index.ts`
  - `appVersion` 推进到 `0.5.16`。
- `package.json` 与各 workspace package.json
  - 版本统一推进到 `0.5.16`。

## Agent 已验证

- `node scripts/verify-group-default-name-contract.mjs`
- `node scripts/verify-shared-resource-visibility-contract.mjs`
- `node scripts/verify-upload-node-material-persistence-contract.mjs`
- `npm run type-check -w @xinghuan/web`
- `npm run type-check -w @xinghuan/api`
- `npm run build:single-port`
- `node scripts/verify-web-app-version-define.mjs`
- `node scripts/verify-release-version-alignment.mjs`

## 待执行

- `npm run release:gray:prepare -- --release=20260629-group-default-permission-refresh-gray-r1-v0516`
- `npm run release:gray:deploy -- --release=20260629-group-default-permission-refresh-gray-r1-v0516 --archive=dist-release/20260629-group-default-permission-refresh-gray-r1-v0516.tar.gz --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem`
- `npm run release:gray:verify -- --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem --expected-version=0.5.16 --expected-environment=gray`

## 风险

- 旧成员组若已有显式空策略行，仍需后续补一次迁移或后台重写，才能完全切到默认关闭语义。
- 灰度和正式都需要完成版本索引同步，避免 UI 与运行态版本再次分叉。
