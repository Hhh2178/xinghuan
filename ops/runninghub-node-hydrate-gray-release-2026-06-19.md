# RunningHub Node Hydrate Gray Release - 2026-06-19

## 发布目标

- 修复 RH 节点提交 workflow 条目时缺少 `workflowId / runTargetId` 导致的提交失败。
- 修复 RH 节点在选择空字段后台条目后，缺少自动补拉远端 `app-info` 的链路。
- 修复 RH `app-info` 代理在本地条目为空时，仍直接回空字段而不回退远端查询的问题。

## 灰度发布

- 环境：`gray`
- 版本：`v0.3.4`
- release：
  - `20260619-runninghub-node-hydrate-gray-r1-v034-d9b653c`
- 当前指针：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260619-runninghub-node-hydrate-gray-r1-v034-d9b653c`

## 本轮变更

- RH 节点：
  - `submitRh` 现在显式提交 `pageId / workflowId / runTargetId / targetType / taskCapability`
  - 选择本地空字段条目后，会自动尝试拉取远端 `app-info`
- RH API 代理：
  - `/api/proxy/runninghub/app-info`
    - 本地条目有 `fields / inputSlots` 时直接返回本地结构
    - 本地条目为空时回退调用 RH 远端 `apiCallDemo`
- 验证脚本：
  - `verify-runninghub-workflow-contract`
  - `verify-runninghub-workflow-api`
  - 已补齐 RH 节点补参链路的源码契约

## 验证

- 本机：
  - `node scripts/verify-runninghub-workflow-contract.mjs`
  - `node scripts/verify-runninghub-workflow-api.mjs`
  - `npm run build -w @xinghuan/web`
  - `npm run build -w @xinghuan/api`
  - `npm run build:single-port`
  - `codegraph sync`
- 灰度：
  - `verify:release-preflight`
  - `verify:request-chain-observability`
  - `verify:system-observability`

## 验证结果

- `/api/status`：
  - `version = 0.3.4`
  - `environment = gray`
- gray gate 全部通过。
- 当前 gray 条目实测补充结论：
  - 样例 workflow `runninghub-main:workflow:2004516402230509570`
    - 本地 `fields = 0`
    - 本地 `parameterSchema = {}`
    - 本地 `testPayload = {}`
    - 远端 `app-info.nodeInfoList = 0`
  - 结论：当前“选条目后不出现参数区”不再是前端渲染故障，而是该 workflow 条目没有任何可消费的参数定义来源。

## 备注

- 本轮未包含新 migration。
- 发布时发现 release 包默认不带 `node_modules`；灰度已通过复用上一 release 的 `node_modules` 完成启动。
- 后续需要单独修补 release 打包/部署链路，避免每次灰度切换再手动补 workspace 依赖目录。
