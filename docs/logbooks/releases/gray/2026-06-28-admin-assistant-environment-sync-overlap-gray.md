# Admin Assistant And Environment Sync Overlap Gray Fix - 2026-06-28

## 状态

- 环境：`gray`
- 版本：`v0.5.13`
- release：`20260628-admin-assistant-environment-sync-overlap-gray-r1-v0513`
- 当前状态：`2026-06-28 待 deploy + runtime verify`

## 发布目标

- 修复 `AI 助手` 页面和 `环境同步` 页面与页面壳层重叠的问题。

## 根因

- `assistant` 和 `environment-sync` 被固定面板壳层包裹。
- 两个页面本身已经是长页面工作台，内部还有 sticky / scroll 结构，外层 shell 造成双层重叠。

## 变更范围

- `apps/admin/src/main.tsx`
  - `assistant`、`environment-sync` 不再使用 `admin-main--fixed-panel`。
- `scripts/verify-admin-layout-overlap-fixes-contract.mjs`
  - 更新契约，反映新的页面壳层策略。
- 版本推进：
  - monorepo 工作区版本从 `v0.5.12` 推进到 `v0.5.13`。

## 验证

- `npm run verify:admin-layout-overlap-fixes`
- `npm run build -w @xinghuan/admin`

## 待用户验收

- `AI 助手`：顶部、hero、配置区和右侧抽屉是否不再互相压住。
- `环境同步`：顶部 band、工具栏、分区和表格是否恢复正常分层。
