# RunningHub Draft Creation And Output Reset Gray Release - 2026-06-23

## 发布目标

- 修复 RH 工作台新建空白 `AI 应用 / 工作流` 时因为默认启用而触发“缺少输入槽”报错的问题。
- 强化 RH 工作台条目摘要卡的备注视觉层级。
- 让画布 RH 节点参数名优先显示后台 `displayLabel`。
- 修复 RH / RH Tools 节点重复执行后历史输出残留、被输出素材节点继续带出的污染问题。

## 灰度发布

- 环境：`gray`
- 版本：`v0.4.9`
- release：
  - `20260623-runninghub-draft-output-reset-gray-r1-v049`
- 上一灰度 release：
  - `20260623-documentation-governance-standard-gray-r1-v048`
- 当前指针：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260623-runninghub-draft-output-reset-gray-r1-v049`

## 本轮变更

- API：
  - `apps/api/src/server.ts`
    - RH 空白草稿默认 `enabled=false`
    - `/api/status` 与后台系统聚合版本切到 `0.4.9`
- 画布：
  - `apps/web/src/components/nodes/RunningHubNode.tsx`
    - 提交前统一清空 `urls / imageUrl / imageUrls / videoUrl / videoUrls / audioUrl / audioUrls`
    - 成功后按本次返回结果重建输出状态
    - 参数显示优先级改为 `displayLabel > label > fieldName`
    - 工作台备注摘要块改成更显眼的强调卡
  - `apps/web/src/components/nodes/RHToolsNode.tsx`
    - 同步使用统一输出重置与覆盖逻辑
- 版本与契约：
  - 单仓版本推进到 `v0.4.9`
  - 新增：
    - `scripts/verify-runninghub-draft-and-summary-contract.mjs`
    - `scripts/verify-runninghub-output-reset-contract.mjs`

## 本地验证

- `npm install --package-lock-only`
- `npm run build:single-port`
- `node scripts/verify-release-version-alignment.mjs`
- `node scripts/verify-runninghub-draft-and-summary-contract.mjs`
- `node scripts/verify-runninghub-output-reset-contract.mjs`
- `node scripts/verify-runninghub-worker-and-label-contract.mjs`
- `node scripts/verify-runninghub-admin-empty-input-contract.mjs`
- `npm run verify:release-package-contract`
- `npm run package:release -- 20260623-runninghub-draft-output-reset-gray-r1-v049`
- `npm run verify:single-port`
  - RH 相关链路通过
  - 当前仍有一个旧断言未绿：`GET uploaded file`

## 灰度验收

- runtime：
  - `systemctl is-active xinghuan-canvas-next.service = active`
  - `systemctl is-active xinghuan-canvas-next-worker.service = active`
  - `GET http://127.0.0.1:18200/api/status`
    - `version = 0.4.9`
    - `environment = gray`
- 页面级复查：
  - `https://canvas-next.hhh2121.xyz/`
    - 标题为 `星幻 - 无限画布`
    - 首页正常起页
  - `https://canvas-next.hhh2121.xyz/admin`
    - 标题为 `星幻 - 统一后台`
    - 后台总览正常加载
  - RH 工作台灰度实机复查：
    - 已在灰度后台点击 `新建 AI 应用`
    - 已在灰度后台点击 `新建工作流`
    - 两者都未再出现“缺少输入槽 / 新建失败 / 保存失败”类错误
    - 验收后已把临时新建草稿删除，目录计数恢复为 `工作流=1 / AI 应用=1`

## 备注

- 本轮灰度视觉验收复用了浏览器里已有的后台有效会话。
- 当前还没有在灰度画布里逐节点复跑 RH 输出残留场景；这部分已有本地契约验证与构建产物校验，建议由业务侧继续做真人联调。

## 风险

- `verify:single-port` 里的 `GET uploaded file` 断言当前仍未通过，表现为老的上传后回读校验未绿。
- 该残留不阻断本轮 RH 工作台新建和 RH 节点输出重置修复，但需要后续单独排查。
