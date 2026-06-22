# RunningHub Worker Routing And Display Label Gray Release - 2026-06-22

## 发布目标

- 修复 RunningHub 任务误走普通 Provider 执行分支的问题，避免 RH 任务在 worker 侧因为模型分支不匹配而报错。
- 修复 RH defer/requeue 时 `chat` 型任务无法正确回到实际消费队列的问题。
- 为 RH 字段定义补齐 `displayLabel`，让后台可录入标注，画布节点优先显示标注而不是裸字段名。
- 允许 RH 输出定义 `kind` 保留自定义值，后台输出类型编辑支持预设与手动覆盖并存。

## 灰度发布

- 环境：`gray`
- 版本：`v0.4.3`
- 待发布 release：
  - `20260622-runninghub-worker-routing-gray-r1-v043-<commit>`
- 上一灰度 release：
  - `20260622-runtime-queue-concurrency-gray-r3-v042-fee46da`
- 当前发布前指针：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260622-runtime-queue-concurrency-gray-r3-v042-fee46da`

## 本轮变更

- worker：
  - `apps/worker/src/worker.ts`
    - `executeTask()` 顶部按 `normalizeProtocol(task.providerProtocol)` 判断；`runninghub` 直接进入 `executeRunningHubTask(task)`。
    - `executeImageTask()`、`executeAudioTask()`、`executeChatTask()` 增加 RH 早返回保护，避免 RH 任务掉入普通 Provider 适配链。
    - `requeueDeferredTask()` 改为走 `capabilityToQueueCapability()`，补齐 `chat -> video` 队列映射。
- catalog / shared / descriptor：
  - `apps/api/src/runninghub-catalog.ts`
  - `apps/api/src/runninghub-execution-descriptor.ts`
  - `packages/shared/src/runninghub.ts`
    - 字段定义新增 `displayLabel`
    - 输出定义 `kind` 改为保留字符串自定义值
    - 输入槽标题优先使用 `displayLabel`
- 后台：
  - `apps/admin/src/admin-runninghub-item-editor.tsx`
  - `apps/admin/src/admin-types.ts`
    - 输入槽编辑新增“标注/显示名”
    - 字段类型、输出类型、结果路径支持“预设 + 自定义覆盖”
- 画布：
  - `apps/web/src/services/runninghubCatalog.ts`
  - `apps/web/src/components/nodes/RunningHubNode.tsx`
  - `apps/web/src/components/nodes/RHToolsNode.tsx`
    - 参数名显示优先级改为 `displayLabel > label > fieldName`
    - 去掉多余“输出映射”摘要文案
- 契约：
  - `scripts/verify-runninghub-worker-and-label-contract.mjs`
  - `scripts/verify-runninghub-workflow-api.mjs`

## 本地验证

- `node scripts/verify-runninghub-worker-and-label-contract.mjs`
- `npm run type-check -w @xinghuan/admin`
- `npm run type-check -w @xinghuan/web`
- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/worker`
- `npm run verify:runninghub-workflow-contract`
- `npm run verify:runninghub-analyze-contract`
- `node scripts/verify-runninghub-workflow-api.mjs`
- `node scripts/verify-release-version-alignment.mjs`
- `npm run verify:release-package-contract`
- `npm run build:single-port`
- `npm run verify:single-port`
- `npm run verify:local-acceptance-chain`

## 预期灰度验收

- gate：
  - `verify:release-preflight`
  - `verify:request-chain-observability`
  - `verify:system-observability`
- runtime：
  - `/api/status => version = 0.4.3, environment = gray`
- 页面级复查：
  - 后台 RH 条目编辑器可见“标注/显示名”
  - 后台输出类型可用预设下拉并支持手填覆盖
  - 画布 RH 节点参数名称优先显示后台标注
  - RH 节点不再显示旧的“输出映射”摘要文案

## 备注

- 本轮仍属于 runtime-only release；服务器 release 目录不应假定可以独立重建完整前端依赖链。
- 若灰度实链需要真实 RH catalog 数据，本地 `workflowCount=0/appCount=0` 的空目录状态不能替代灰度验收。
