# Group Execution Manager Runtime Rounds Gray Release - 2026-06-30

## 状态

- 环境：`gray`
- 版本：`v0.5.19`
- release：`20260630-group-execution-manager-runtime-rounds-gray-r2-v0519`
- 当前状态：`2026-06-30 已完成 gray deploy + runtime verify；release package smoke 脚本已补齐并完成服务器侧 smoke`
- 上一灰度 release：`20260630-aicopy-video-task-and-duration-range-gray-r1-v0518`

## 发布目标

- 给全局组执行管理器补齐 `开始执行`、`持续开关`、`执行次数`。
- 全局整套组顺序支持重复执行 `N` 轮。
- 每一轮开始前都重新基于当前画布连线计算拓扑顺序。
- 组内一个上游扇出多个下游时，若下游之间无显式依赖，则使用稳定顺序，不再随机乱序。

## 变更范围

- `apps/web/src/components/nodes/GroupExecutionManagerNode.tsx`
  - 新增持续开关、执行次数、开始执行按钮。
- `apps/web/src/components/canvas/groupExecutionManager.ts`
  - 管理器数据结构新增 `enabled / executionCount`。
  - 执行计划新增管理器启用态与轮次元信息。
- `apps/web/src/components/canvas/useCanvasRuntime.ts`
  - 运行器改为读取最新画布快照。
  - 管理器启用时按整套组序列重复跑 `N` 轮。
  - 每轮开始前重新计算当前拓扑。
- `apps/web/src/utils/topologicalSort.ts`
  - 多下游无显式依赖时按稳定视觉顺序排队。
- `scripts/verify-group-execution-manager-contract.ts`
  - 新增组执行管理器与稳定拓扑顺序契约。

## Agent 已验证

- `npx tsx scripts/verify-group-execution-manager-contract.ts`
- `npm run type-check -w @xinghuan/web`
- `node scripts/verify-canvas-runtime-split-contract.mjs`
- `node scripts/verify-release-package-contract.mjs`
- `npm run package:release -- 20260630-group-execution-manager-runtime-rounds-gray-r2-v0519`
- `npm run release:gray:deploy -- --release=20260630-group-execution-manager-runtime-rounds-gray-r2-v0519 --archive=dist-release/20260630-group-execution-manager-runtime-rounds-gray-r2-v0519.tar.gz --ssh-key=...`
- `npm run release:gray:verify -- --ssh-key=... --expected-version=0.5.19 --expected-environment=gray`
- gray current release 内联 `npm run verify:single-port`
  - 基础站点、登录、后台、画布保存、用户隔离、上传、图片生成库、SPA fallback = `PASS`
  - 视频生成库相关 5 项 = `FAIL`，根因是服务器当前没有可复用的本地样例视频文件，`Local sample video seeded` 前置条件未满足，不是本次组执行管理器发布回归

## 本轮补修

- 修复 gray release package 漏带 `scripts/verify-single-port.mjs`，导致服务器 current release 无法直接执行标准 smoke 的问题。
- 新灰度批次 `r2` 已确认：
  - `current` 指向正确 release
  - `/api/status` 内外网均返回 `0.5.19 / gray`
  - `verify-single-port.mjs` 已随包分发并可在服务器 current release 目录直接执行

## 待用户验收

- 管理器面板点击 `开始执行` 后，是否按组顺序启动全局执行。
- `执行次数 = N` 时，是否整套组顺序连续跑 `N` 轮。
- 第 1 轮和第 2 轮之间修改画布连线后，后续轮次是否按新拓扑生效。
- 同一上游连多个下游、下游互无依赖时，执行顺序是否稳定一致。
- `aicopy / grok-imagine-video-1.5-preview` 链路在当前 gray 环境是否继续正常。
- 公网真实浏览器视觉验收。
  - 本机自动化直接访问公网灰度时遇到 Cloudflare `403 / error code 1010`，因此本轮未完成公网交互自动化验收。

## 风险

- 真机交互层还需要重点观察停止批量运行时的轮次收口体验。
- 旧画布若存在环或断链，排序器会走尽力而为的稳定补位，仍需要用户人工复核业务语义。
