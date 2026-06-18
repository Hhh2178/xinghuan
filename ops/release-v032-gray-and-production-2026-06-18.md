# v0.3.2 gray / production 发布记录 - 2026-06-18

## 目标

- 将尺寸调整节点输入修复、生成节点多任务运行态 UI 收口，以及工具栏导入 / 导出逻辑纠正发布到 gray 与 production。
- 将对外版本号从 `v0.3.1` 推进到 `v0.3.2`，并保持 gray / production 暴露相同版本号。

## 版本范围

- 对外版本号：
  - `v0.3.2`
- gray release：
  - `20260618-v032-ui-fixes-gray-r1`
- production release：
  - `20260618-v032-ui-fixes-prod-r1`

## 本轮功能点

- 尺寸调整节点：
  - 修复上游图片接入后仍报 `NOT_FOUND`
  - 宽高输入框允许先删空再重新填写，不再强制覆盖输入
- 生成节点运行态卡片：
  - 改为小字汇总展示 `成功 / 失败 / 运行中 / 排队`
  - 去掉逐子任务的大号杂乱明细
- 右上角工具栏：
  - `上传` 图标改为执行导出工作流
  - `下载` 图标改为执行导入工作流

## 本地发布前验证

- `npm install --package-lock-only`
- `node scripts/verify-image-op-upstream-material-contract.mjs`
- `node scripts/verify-node-runtime-card-task-runs-contract.mjs`
- `node scripts/verify-canvas-toolbar-import-export-contract.mjs`
- `node scripts/verify-resize-node-input-behavior-contract.mjs`
- `npm run build -w @xinghuan/web`
- `npm run build:single-port`
- `node scripts/verify-release-package-contract.mjs`
- `node scripts/verify-release-preflight-contract.mjs`

## 发布后验收

- gray：
  - `verify:release-preflight`
  - `verify:request-chain-observability`
  - `verify:system-observability`
- production：
  - `verify:release-preflight`
  - `verify:request-chain-observability`
  - `verify:system-observability`

## 实际发布结果

- gray current：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260618-v032-ui-fixes-gray-r1`
- production current：
  - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260618-v032-ui-fixes-prod-r1`
- gray `/api/status`：
  - `environment = gray`
  - `version = 0.3.2`
- production `/api/status`：
  - `environment = production`
  - `version = 0.3.2`

## Gate 结果

- gray：
  - `verify:release-preflight = ok`
  - `verify:request-chain-observability = ok`
  - `verify:system-observability = ok`
- production：
  - `verify:release-preflight = ok`
  - `verify:request-chain-observability = ok`
  - `verify:system-observability = ok`

## 数据库目标复核

- gray：
  - `current = xinghuan_canvas_gray`
  - `expected = xinghuan_canvas_gray`
  - `targetMatched = true`
- production：
  - `current = xinghuan_canvas_next`
  - `expected = xinghuan_canvas_next`
  - `targetMatched = true`

## 备注

- 本记录用于承接 `v0.3.2` 的 gray / production 同批发布。
- 本轮已完成主入口同步更新。
