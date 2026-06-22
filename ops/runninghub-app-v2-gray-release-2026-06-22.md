# RunningHub App V2 Gray Release - 2026-06-22

## 发布目标

- 收口 RunningHub App / Workflow 在前台节点运行态中的 ID 归属混乱问题，避免条目混合态继续伪装成可执行配置。
- 将 RunningHub AI App worker submit/query 切换到官方 v2 协议。
- 补齐灰度页面级复查，确认后台 RH 工作台、系统页和画布 RH 节点都已落到 `v0.4.4`。

## 灰度发布

- 环境：`gray`
- 版本：`v0.4.4`
- release：
  - `20260622-runninghub-app-v2-gray-r1-v044-36415e9`
- 上一灰度 release：
  - `20260622-runninghub-worker-routing-gray-r1-v043-d253c57`
- 当前指针：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260622-runninghub-app-v2-gray-r1-v044-36415e9`

## 本轮变更

- 前台运行态：
  - `apps/web/src/services/runninghubCatalog.ts`
    - RH catalog 运行态字段按 `kind` 归一化，分别持有正确归属的 `appId / workflowId / runTargetId`。
    - `buildRunningHubAppInfoFromCatalog()` 输出统一对齐 `targetType / runTargetId / webappId / workflowId`。
  - `apps/web/src/components/nodes/RunningHubNode.tsx`
    - 新增 RH 混合态条目保护：`app + workflowId`、`workflow + appId` 会在提交前直接阻断并给出显式提示。
    - 节点提交参数统一使用归一化后的 `resolvedWebappId / resolvedWorkflowId / resolvedRunTargetId / resolvedTargetType`。
  - `apps/web/src/services/generation.ts`
    - RH submit 的 `nodeInfoList[].fieldValue` 改为 `unknown`，不再继续用 `any` 放松协议边界。
- 后端与 worker：
  - `apps/api/src/runninghub-catalog.ts`
    - `parseRunningHubRef()` 显式收窄为 `"app" | "workflow"`。
    - public RH catalog 保持 `kind` 专属 ID 归属一致。
  - `apps/worker/src/worker.ts`
    - AI App submit 切到 `/openapi/v2/run/ai-app/{id}`。
    - AI App query 切到 `/openapi/v2/query`。
    - 旧 AI App `taskType = "ASYNC"` 提交体已移除。
    - 继续保留 `rhFailureStage / rhSubmitUrl / rhSubmitTargetType / rhRunTargetId / rhWorkflowId / rhSubmitRequest / rhSubmitResponseStatus / rhSubmitResponseText` 结构化诊断字段。
- 验证链：
  - `scripts/verify-runninghub-workflow-contract.mjs`
  - `scripts/verify-runninghub-worker-submit-contract.mjs`
  - `scripts/verify-local-acceptance-chain.mjs`

## 本地验证

- `npm run verify:runninghub-analyze-contract`
- `npm run verify:runninghub-workflow-contract`
- `npm run verify:runninghub-queue-governance-contract`
- `node scripts/verify-runninghub-worker-submit-contract.mjs`
- `node scripts/verify-runninghub-single-node-contract.mjs`
- `npm run build -w @xinghuan/worker`
- `npm run build:single-port`
- `node scripts/verify-local-acceptance-chain.mjs`

## 灰度验收

- 运行态：
  - `readlink -f /opt/apps/xinghuan-canvas-next/current`
    - `/opt/apps/xinghuan-canvas-next/releases/20260622-runninghub-app-v2-gray-r1-v044-36415e9`
  - `systemctl is-active xinghuan-canvas-next.service`
    - `active`
  - `systemctl is-active xinghuan-canvas-next-worker.service`
    - `active`
  - `/api/status => version = 0.4.4, environment = gray`
- gate：
  - `verify:release-preflight`
  - `verify:request-chain-observability`
  - `verify:system-observability`
- 页面级复查：
  - 后台 RH 工作台：
    - 已真实显示 `请求示例 / 响应示例`
    - 已真实显示 `标注/显示名`
    - 输出类型与结果路径仍保持“预设 + 自定义覆盖”
    - 当前页面统计为 `1` 个工作流、`0` 个 AI 应用
  - 后台系统页：
    - 已真实显示 `版本 0.4.4`
    - 已真实显示 `数据库目标校验 matched`
    - 已真实显示 `按类别并发 / 实际生效并发 / Worker 数 / Worker 槽位数 / RH 平台窗口`
  - 画布页：
    - 顶栏与左下角版本都已显示 `v0.4.4`
    - RH 分类当前显示 `1`
    - 现有 RunningHub 节点已直接展示后台条目 `工作流 cd3add`
    - 节点参数区已展开 `3` 个参数
    - 旧的“输出映射”摘要文案未再出现

## 当前限制与备注

- 当前 gray 数据里 RH 目录只有 `1` 个 workflow、`0` 个 AI app，因此这轮页面级复查还不能在真实目录数据上直接跑一遍 AI App v2 任务。
- 当前 gray 目录里也没有故意保留的混合态条目，所以“混合态告警”本轮主要由前台契约与源码保护验证，没有在现网数据上制造脏条目做演示。
- `scripts/package-release.mjs` 仍是 runtime-only 打包；release 目录里缺少 `scripts/verify-runninghub-workflow-api.mjs`，因此该脚本不能作为服务器 release 目录内 gate 的一部分直接执行。
- 本机用默认管理员账号跑远端 `verify-runninghub-workflow-api.mjs` 会返回 `401 INVALID_CREDENTIALS`，说明当前 gray 已不是默认后台口令；涉及真实登录的远程验收应继续以服务器环境变量内的账号为准。
