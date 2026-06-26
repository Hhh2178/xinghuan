# Group Permissions, Usage Analytics And Canvas Group Lock Gray Release - 2026-06-26

## 状态

- 环境：`gray`
- 版本：`v0.5.4`
- release：`20260626-group-permissions-group-lock-gray-r1-v054`
- 当前状态：`已完成 deploy + runtime verify`

## 发布目标

- 将组权限治理正式接入公共资源库、RunningHub AI 应用与工作流的可见性和可用性控制，并保持“无权限即隐藏”的前台口径。
- 为后台补齐账号分组权限配置页与按成功任务统计的使用量审计驾驶舱。
- 完成画布分组锁定交互：默认锁定、锁定后禁拖动/禁缩放、组内节点禁误拖离。
- 清理 API 设置里遗留的旧外部固定地址与旧获取 Key 链接。

## 变更范围

- `apps/api/db/019_group_permission_policies.sql`
  - 新增组权限策略表结构。
- `apps/api/src/group-permission-policy.ts`
- `apps/api/src/group-permission-policy-routes.ts`
  - 建立公共资源/RH 条目/组权限策略读写与过滤能力。
- `apps/api/src/admin-usage-analytics.ts`
- `apps/api/src/admin-audit-routes.ts`
- `apps/api/src/admin-task-list-routes.ts`
- `apps/api/src/server.ts`
  - 接入成功用量统计、审计页接口、任务列表 route 下沉，并继续缩减 `server.ts` 热点职责。
- `apps/admin/src/admin-users-panel.tsx`
- `apps/admin/src/admin-permissions-panel.tsx`
- `apps/admin/src/admin-usage-dashboard.tsx`
- `apps/admin/src/admin-readonly-panels.tsx`
  - 后台账号系统改为 `账号 / 用户组 / 权限 / 会话` 分区，并增加审计驾驶舱。
- `apps/web/src/components/Canvas.tsx`
- `apps/web/src/components/nodes/GroupBoxNode.tsx`
- `apps/web/src/components/canvas/groupBoxGuards.ts`
- `apps/web/src/components/canvas/useCanvasViewportHotkeys.ts`
  - 画布分组默认锁定、锁定保护、更低缩放上限与更大缩小范围。
- `apps/web/src/components/ResourceLibraryDrawer.tsx`
  - 去掉“保存到我的资源库”旧动作，保持无权限资源直接隐藏。
- `apps/web/src/components/ApiSettings.tsx`
- `apps/web/src/components/ApiSettingsKeyField.tsx`
- `apps/web/src/components/ApiSettingsKeySections.tsx`
- `apps/web/src/components/apiSettingsHelpers.ts`
- `apps/web/src/stores/apiKeys.ts`
  - 移除旧 `ai.t8star.org / runninghub.cn` 固定注入和旧外链文案。
- 新增 contract：
  - `scripts/verify-group-permission-governance-contract.mjs`
  - `scripts/verify-admin-usage-dashboard-contract.mjs`
  - `scripts/verify-canvas-group-lock-and-api-settings-contract.mjs`

## Agent 已验证

- `node scripts/verify-group-permission-governance-contract.mjs`
- `node scripts/verify-admin-usage-dashboard-contract.mjs`
- `node scripts/verify-canvas-group-lock-and-api-settings-contract.mjs`
- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/admin`
- `npm run type-check -w @xinghuan/web`
- `npm run build -w @xinghuan/web`
- `codegraph sync`
- `npm run release:gray:prepare -- --release=20260626-group-permissions-group-lock-gray-r1-v054`
- `node scripts/release/deploy-gray-release.mjs --release=20260626-group-permissions-group-lock-gray-r1-v054 --archive=dist-release/20260626-group-permissions-group-lock-gray-r1-v054.tar.gz --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem`
- `node scripts/release/verify-gray-runtime.mjs --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem --expected-version=0.5.4 --expected-environment=gray`

## 本次部署执行

- 发布包：
  - `dist-release/20260626-group-permissions-group-lock-gray-r1-v054.tar.gz`
- 服务器解包目录：
  - `/opt/apps/xinghuan-canvas-next/releases/20260626-group-permissions-group-lock-gray-r1-v054`
- release 内执行：
  - `npm ci`
  - `npm run db:migrate`
- 本次迁移结果：
  - `applied = [019_group_permission_policies.sql]`
  - `skipped = 18`

## 运行态复核

- current 指针：
  - `/opt/apps/xinghuan-canvas-next/releases/20260626-group-permissions-group-lock-gray-r1-v054`
- `/api/status`：
  - `version = 0.5.4`
  - `environment = gray`
- 关键服务状态：
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`

## 待用户验收

- 后台账号系统里是否能看到新的 `权限` 分区，以及各组对公共资源/RH 条目的授权是否符合预期。
- 未开放权限的公共资源、RH AI 应用、工作流在对应账号前台是否直接隐藏，而不是显示拒绝提示。
- 审计页是否能按组、账号、图像/视频/RH/LLM 与具体模型或 RH 条目查看成功使用次数。
- 画布分组是否默认锁定，锁定后组框不能拖动/缩放，组内节点不能被误拖出。
- API 设置页是否不再出现旧外部固定地址或旧获取 Key 链接。
