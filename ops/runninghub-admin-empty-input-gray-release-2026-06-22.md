# RH 显式无入参工作流管理端热修 gray 发布 - 2026-06-22

目标:
- 修复管理端 RH 工作台对显式无入参 workflow 的误判。
- 将 gray 版本推进到 `v0.4.7`。

release:
- gray release: `20260622-runninghub-admin-empty-input-gray-r1-v047-dec3f87`
- gray path: `/opt/apps/xinghuan-canvas-next/releases/20260622-runninghub-admin-empty-input-gray-r1-v047-dec3f87`
- version: `v0.4.7`

变更:
- RH 工作台列表卡片对 `allowsEmptyInputs=true` 的 workflow 改为显示：
  - `显式无入参工作流，可直接启用并运行`
- RH 条目编辑器不再把这类 workflow 判定为“缺少输入槽”并阻止保存/启用。
- 新增管理端契约脚本：
  - `scripts/verify-runninghub-admin-empty-input-contract.mjs`
- 单仓版本统一推进到 `0.4.7`。

验证:
- 本地：
  - `node scripts/verify-runninghub-admin-empty-input-contract.mjs`
  - `node scripts/verify-runninghub-empty-input-workflow-contract.mjs`
  - `node scripts/verify-runninghub-empty-input-ui-contract.mjs`
  - `npm run build:single-port`
  - `node scripts/verify-release-version-alignment.mjs`
  - `npm run verify:single-port`
- gray：
  - `readlink -f /opt/apps/xinghuan-canvas-next/current`
    - `/opt/apps/xinghuan-canvas-next/releases/20260622-runninghub-admin-empty-input-gray-r1-v047-dec3f87`
  - `systemctl is-active xinghuan-canvas-next.service = active`
  - `systemctl is-active xinghuan-canvas-next-worker.service = active`
  - `curl http://127.0.0.1:18200/api/status`
    - `version = 0.4.7`
    - `environment = gray`
  - `XINGHUAN_VERIFY_BASE_URL=https://canvas-next.hhh2121.xyz npm run verify:request-chain-observability = ok`
  - `XINGHUAN_VERIFY_BASE_URL=https://canvas-next.hhh2121.xyz npm run verify:system-observability = ok`

灰度目标条目复核:
- `catalogId = runninghub-main:workflow:2064255815862800385`
- `pageId = 2064255815862800385`
- `workflowId = 2064255815862800385`
- `runTargetId = 2064255815862800385`
- `allowsEmptyInputs = true`
- `fields = 0`
- `outputSchema[0].path = results`
- `testPayload.nodeInfoList = []`

页面级结论:
- RH 工作台卡片与编辑器已不再把该条目标成“缺少输入槽”。
- 灰度画布里如果仍看到旧参数区或 `默认 plus`，需要先确认节点当前选中的是否还是历史条目 `cd3add`。
