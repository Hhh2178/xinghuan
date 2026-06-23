# 工程护栏

本文件用于把“不要继续制造超级文件”和“发布前必须收紧工作树”落成可执行护栏，而不是只停留在口头约束。

## 当前热点预算

以下文件被视为当前第一批热点入口，后续默认不允许继续增长：

- `apps/api/src/server.ts`
  - 当前预算：`<= 11910` 行
  - 原因：RunningHub、任务、系统页等逻辑需要继续拆出模块 handler
- `apps/worker/src/worker.ts`
  - 当前预算：`<= 1765` 行
  - 原因：协议执行、dispatch、diagnostics、cancel-sync 需要继续下沉
- `apps/web/src/components/nodes/RunningHubNode.tsx`
  - 当前预算：`<= 1526` 行
  - 原因：节点运行态、提交、轮询、取消、显示策略要继续抽 hook / helper
- `apps/admin/src/admin-runninghub-workspace.tsx`
  - 当前预算：`<= 916` 行
  - 原因：后台工作台需要继续拆 section / hook / service

说明：

- 预算基线采用当前已经发布到 `v0.4.15` 之后的仓库实态。
- 后续如果某个热点文件继续增长，默认动作是先拆分，而不是继续抬高预算。

对应脚本：

- `node scripts/verify-file-hotspot-budgets.mjs`

如果预算失败，默认处理方式不是“临时放宽阈值”，而是：

1. 先拆模块或抽 hook / helper
2. 再让热点文件降回预算内
3. 只有在确有新的结构设计并同步更新治理文件时，才允许调整预算

## 发布前工作树清洁

真实 gray / production 发布前，工作树必须是干净的。

对应脚本：

- `node scripts/verify-release-worktree-clean.mjs`

默认要求：

- 不允许未提交的 tracked 改动
- 不允许未记录的 untracked 文件
- 部署脚本会在真正开始远端动作前先执行这条检查

调试场景下如果只想检查“是否仍有 unstaged 污染”，可以手动使用：

- `node scripts/verify-release-worktree-clean.mjs --allow-staged=true`

但这不属于正式发布口径。

## 已接入的执行入口

- `npm run verify:file-hotspot-budgets`
- `npm run verify:release-worktree-clean`
- `npm run verify:engineering-governance-contract`
- `npm run release:gray:prepare`
  - 当前会执行热点预算与工程治理 contract
- `npm run release:gray:deploy`
  - 当前会先执行工作树清洁检查，再允许部署

## 维护规则

- 新增热点文件时，必须同时把预算、原因、拆分方向和脚本同步更新。
- 如果热点预算发生变化，必须同轮更新：
  - `AGENTS.md`
  - `docs/governance/documentation-governance-standard.md`
  - 本文件
- 如果部署脚本或发布流程变化，必须确认这些护栏仍然真实被调用，而不是只留在文档里。
