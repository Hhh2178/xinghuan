# RunningHub Empty-Shell Guard Gray Release - 2026-06-19

## 发布目标

- 阻止没有输入槽定义的 RH 条目继续被启用。
- 在 RH 工作台中明确标出“待补输入槽”的条目。
- 在画布 RH 节点中明确提示“当前条目没有可用输入槽定义”，避免误判为节点渲染故障。

## 灰度发布

- 环境：`gray`
- 版本：`v0.3.4`
- release：
  - `20260619-runninghub-empty-shell-guard-gray-r1-v034-d9b653c`
- 当前指针：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260619-runninghub-empty-shell-guard-gray-r1-v034-d9b653c`

## 本轮变更

- 后台 API：
  - RH 条目启用前增加输入槽治理校验。
  - 没有有效 `nodeId + fieldName` 的条目，只允许作为停用草稿保存。
- RH 工作台：
  - 条目列表新增“待补输入槽”提示。
  - 编辑器保存前直接拦截空壳启用，并在摘要区显示启用条件状态。
- 画布 RH 节点：
  - 选中空壳 RH 条目后，直接显示“缺少输入槽定义”的说明。

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
  - `/opt/apps/xinghuan-canvas-next/releases/20260619-runninghub-empty-shell-guard-gray-r1-v034-d9b653c`
- gray gate 全部通过。
- 本轮灰度 release 已在 release 目录内直接执行 `npm ci`，未再复用旧 release 的 `node_modules`。

## 备注

- 这轮没有改主版本号，属于 `v0.3.4` 下的灰度治理收口。
- 当前治理默认把“无输入槽定义”视为不可启用；如果后续确认存在真实零输入 RH 条目，需要再补显式开关，不应重新放开空壳条目。
