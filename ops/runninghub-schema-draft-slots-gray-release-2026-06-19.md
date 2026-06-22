# RunningHub Schema Draft Slots Gray Release - 2026-06-19

## 发布目标

- 让 RH 工作台支持从 `parameterSchema` 一键生成输入槽草稿。
- 把 RH 条目从“只有 Schema 草案”推进到“可继续补齐执行绑定”的状态。

## 灰度发布

- 环境：`gray`
- 版本：`v0.3.4`
- release：
  - `20260619-runninghub-schema-draft-slots-gray-r1-v034-d9b653c`
- 当前指针：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260619-runninghub-schema-draft-slots-gray-r1-v034-d9b653c`

## 本轮变更

- RH 工作台编辑器：
  - 新增“从 Schema 生成输入槽草稿”按钮
  - 根据 `properties / required / title / description / default / enum` 自动生成字段草稿
  - 生成后明确提示：仍需补齐 `nodeId`
- 契约验证：
  - `verify-runninghub-workflow-contract` 新增 Schema 生成输入槽草稿的校验

## 验证

- 本机：
  - `node scripts/verify-runninghub-workflow-contract.mjs`
  - `npm run build -w @xinghuan/admin`
  - `npm run build -w @xinghuan/web`
  - `npm run build -w @xinghuan/api`
  - `npm run build:single-port`
  - `codegraph sync`
- 灰度：
  - `npm ci`
  - `verify:release-preflight`
  - `verify:request-chain-observability`
  - `verify:system-observability`

## 验证结果

- `/api/status`：
  - `version = 0.3.4`
  - `environment = gray`
- 当前灰度指针：
  - `/opt/apps/xinghuan-canvas-next/releases/20260619-runninghub-schema-draft-slots-gray-r1-v034-d9b653c`
- gray gate 全部通过。

## 备注

- 自动生成的是输入槽草稿，不是最终 RH 执行绑定。
- `fieldName / label / valueType / required / default / options` 可以由 Schema 带出。
- `nodeId` 仍然必须由管理员按真实 RH 节点结构补齐后，条目才能成为可执行态。
