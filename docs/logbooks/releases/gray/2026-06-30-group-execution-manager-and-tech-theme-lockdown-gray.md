# Group Execution Manager And Tech Theme Lockdown Gray Release - 2026-06-30

## 状态

- 环境：`gray`
- 版本：`v0.5.17`
- release：`20260630-group-execution-manager-and-tech-theme-lockdown-gray-r1-v0517`
- 当前状态：`待部署`
- 上一灰度 release：`20260629-group-default-permission-refresh-gray-r1-v0516`

## 发布目标

- 组内执行改为按画布连线自动推导的拓扑顺序串行执行。
- 新增全局组管理节点，只负责组级执行顺序和跳过控制。
- 前台主题锁定为科技风，保留 dark / light 切换，移除多风格入口。
- 旧视觉预设移出前台运行入口，统一归档。

## 变更范围

- `apps/web/src/components/canvas/groupExecutionManager.ts`
  - 新增组级执行计划解析与全局组顺序管理。
- `apps/web/src/components/canvas/useCanvasRuntime.ts`
  - 画布运行路径改为按组计划和拓扑顺序执行。
- `apps/web/src/components/nodes/GroupExecutionManagerNode.tsx`
  - 新增组管理节点面板。
- `apps/web/src/stores/theme.ts`
  - 锁定科技风运行面，保留 dark / light。
- `apps/web/src/theme/defaultTemplates.ts`
  - 前台模板收口为科技风。
- `apps/web/src/theme/applyTheme.ts`
  - 统一科技风变量映射。
- `apps/web/src/styles/index.css`
  - 移除旧多风格入口。
- `docs/archive/canvas-theme-presets/`
  - 旧主题预设归档。

## Agent 已验证

- `npm run type-check -w @xinghuan/web`
- `npm run type-check -w @xinghuan/admin`
- `npm run verify:current-release-entry-consistency`
- `node scripts/run-codegraph.mjs status`

## 待执行

- `npm run release:gray:prepare -- --release=20260630-group-execution-manager-and-tech-theme-lockdown-gray-r1-v0517`
- `npm run release:gray:deploy -- --release=20260630-group-execution-manager-and-tech-theme-lockdown-gray-r1-v0517 --archive=dist-release/20260630-group-execution-manager-and-tech-theme-lockdown-gray-r1-v0517.tar.gz --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem`
- `npm run release:gray:verify -- --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem --expected-version=0.5.17 --expected-environment=gray`

## 风险

- 组内拓扑执行依赖连线正确性，旧画布若存在断链或环，需要用户后续人工复核。
- 主题已锁到科技风，但仍保留少量兼容字段，后续若继续瘦身可再拆兼容层。
