# RunningHub Schema State Gray Release - 2026-06-19

## 发布目标

- 把 RH 条目的 `parameterSchema` 正式透传到目录层和前端状态层。
- 明确区分“Schema 草案”与“可执行 RH 绑定字段”，避免节点误导。

## 灰度发布

- 环境：`gray`
- 版本：`v0.3.4`
- release：
  - `20260619-runninghub-schema-state-gray-r1-v034-d9b653c`
- 当前指针：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260619-runninghub-schema-state-gray-r1-v034-d9b653c`

## 本轮变更

- RH public catalog：
  - 透传 `parameterSchema`
- RH 工作台：
  - 列表与编辑器同时展示“绑定数 / Schema 参数数”
  - 对“有 Schema、无 RH 绑定”的条目增加明确说明
- 画布 RH 节点：
  - 节点摘要显示“绑定 / Schema / 输出”
  - 选中此类条目时提示“已有结构化参数，但还没有可执行 RH 绑定字段”

## 验证

- 本机：
  - `node scripts/verify-runninghub-workflow-contract.mjs`
  - `npm run build -w @xinghuan/shared`
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
  - `/opt/apps/xinghuan-canvas-next/releases/20260619-runninghub-schema-state-gray-r1-v034-d9b653c`
- gray gate 全部通过。

## 备注

- 这轮不是执行链升级，而是状态治理升级。
- 当前系统已经能明确告诉用户：
  - 哪些条目可执行
  - 哪些条目只有 Schema 草案
  - 哪些条目完全还是空壳
