# Admin Audit Account Drilldown Gray Release - 2026-06-28

## 状态

- 环境：`gray`
- 版本：`v0.5.14`
- release：`20260628-admin-audit-account-drilldown-gray-r1-v0514`
- 当前状态：`待 deploy`
- 上一灰度 release：`20260628-admin-assistant-environment-sync-overlap-gray-r2-v0513`

## 发布目标

- 在后台审计页新增“先选账号，再查看模型与 RH 条目使用明细”的下钻能力。
- 保留当前成功用量驾驶舱的全局统计，不因选中账号而丢失模型与 RH 条目的总使用次数视图。

## 根因

- 当前审计页虽然已经能看全局成功任务统计，但缺少账号级明细下钻，管理员无法直接查看某个账号使用了哪些模型、哪些 RH 条目以及各自的使用次数。
- 现有前端只消费全局 summary，没有账号选择器、账号摘要和双明细表结构。

## 变更范围

- `apps/api/src/admin-usage-analytics.ts`
  - `AdminUsageSummary` 新增 `selectedUser`
  - 新增账号模型明细与 RH 条目明细聚合
  - 选择账号后继续保留全局成功统计
- `apps/admin/src/admin-types.ts`
  - 同步新增账号下钻类型
- `apps/admin/src/admin-api-client.ts`
  - `readUsageSummary()` 支持 query filters
- `apps/admin/src/main.tsx`
  - 新增审计筛选状态、选中账号状态和独立刷新链路
- `apps/admin/src/admin-readonly-panels.tsx`
  - 审计面板透传筛选、账号选择、加载中和错误状态
- `apps/admin/src/admin-usage-dashboard.tsx`
  - 审计页升级为“筛选区 + 账号下钻区 + 全局汇总区 + 审计日志区”
  - 账号下钻拆成“账号模型使用明细”和“账号 RH 条目使用明细”两张表
  - 保留“模型总使用次数”和“RH 条目总使用次数”两张全局表
- `apps/admin/src/styles.css`
  - 新增审计筛选条、账号摘要卡、空态和长字段表格样式
- `scripts/verify-admin-usage-summary-selected-user.ts`
  - 新增账号下钻聚合回归验证
- `scripts/verify-admin-usage-dashboard-contract.mjs`
  - 升级为覆盖账号选择、账号下钻和全局总量表保留
- 版本推进：
  - monorepo 工作区版本从 `v0.5.13` 推进到 `v0.5.14`

## Agent 已验证

### 本地代码与产物

- `npx tsx scripts/verify-admin-usage-summary-selected-user.ts`
- `node scripts/verify-admin-usage-dashboard-contract.mjs`
- `npm run build -w @xinghuan/api`
- `npm run build -w @xinghuan/admin`
- `codegraph sync`

### Gray 发布前计划执行

- `npm run release:gray:prepare -- --release=20260628-admin-audit-account-drilldown-gray-r1-v0514 --verify="npx tsx scripts/verify-admin-usage-summary-selected-user.ts" --verify="node scripts/verify-admin-usage-dashboard-contract.mjs" --verify="npm run build -w @xinghuan/api" --verify="npm run build -w @xinghuan/admin"`
- `npm run release:gray:deploy -- --release=20260628-admin-audit-account-drilldown-gray-r1-v0514 --archive=dist-release/20260628-admin-audit-account-drilldown-gray-r1-v0514.tar.gz --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem`
- `npm run release:gray:verify -- --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem --expected-version=0.5.14 --expected-environment=gray`

## 待用户验收

- 审计页选择账号后，是否能看到该账号的模型使用明细和 RH 条目使用明细。
- 选择账号后，全局模型总使用次数和 RH 条目总使用次数是否仍保留。
- 长邮箱、模型 ID、Catalog ID 在 1080 和 2K 下是否都没有压坏布局。

## 回滚信息

- deploy 前回滚锚点：
  - `/opt/apps/xinghuan-canvas-next/releases/20260628-admin-assistant-environment-sync-overlap-gray-r2-v0513`
- 当前目标 release 目录：
  - `/opt/apps/xinghuan-canvas-next/releases/20260628-admin-audit-account-drilldown-gray-r1-v0514`
- 回滚后需重启：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
