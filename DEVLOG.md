# DEVLOG.md - 无限画布 2.0 开发日志台账

## 日志规则

- 最新记录放在最上方。
- 每次真实推进都必须记录：目标、变更范围、验证证据、影响、风险、下一步。
- 任何选型、部署、回滚、数据结构、节点规范和后台规范变化都要记录。
- 禁止记录真实 API Key、Token、Cookie、SSH Key 和数据库密码。
- `DEVLOG.md` 只负责逐日推进台账，不承担长期结构、长期环境和长期规范入口职责。
- 三层台账维护规则见 `docs/project-atlas/logbook-maintenance.md`。

## 标准记录模板

```md
## YYYY-MM-DD

### 事项标题

目标:
- 

变更:
- 

验证:
- 

影响:
- 

风险:
- 

下一步:
- 
```

## 使用建议

- 如果只是要快速恢复当前项目状态，先看 `MEMORY.md` 和 `docs/prd/README.md`，再回来看本文件顶部最近几天记录。

## 2026-06-22

### RunningHub 容错分析与节点输出适配 v0.4.2 本地发布候选收口

目标:
- 在继续推进 gray 之前，把 RunningHub 容错分析与画布节点输出适配整理成新的可发布小版本，并重新完成本地严格验证。

变更:
- 版本治理：
  - 统一将版本从 `v0.4.1` 提升到 `v0.4.2`
  - 更新根 `package.json`、各 workspace `package.json`、`packages/shared/src/index.ts`、`apps/web/vite.config.ts`、`apps/api/src/server.ts`
- 后端：
  - `apps/api/src/server.ts`
    - 增加 mixed text / fenced JSON / balanced object 的容错解析
    - `docUrl` 参与 RH analyze 推断
    - `responseExample` 推断 `outputDraft / executionDraft`
  - `apps/api/src/runninghub-catalog.ts`
    - public RH catalog 透传 `outputSchema`
- 前端：
  - `apps/web/src/services/runninghubCatalog.ts`
  - `apps/web/src/utils/runninghubNodeSchema.ts`
  - `apps/web/src/components/nodes/RunningHubNode.tsx`
  - `apps/web/src/config/portTypes.ts`
    - RH 节点优先消费后台 `outputSchema`
    - 节点摘要补充输出映射信息
    - RH 输出端口补上 `audio`
- shared 与验证：
  - `packages/shared/src/runninghub.ts`
  - `scripts/verify-runninghub-analyze-contract.mjs`
  - `scripts/verify-runninghub-workflow-contract.mjs`
- 文档与运维入口：
  - `README.md`
  - `docs/prd/README.md`
  - `docs/prd/v0.1.0/progress.md`
  - `docs/prd/v0.1.0/changelog.md`
  - `ops/README.md`
  - 新增 `ops/runninghub-tolerant-analyze-and-node-adaptation-gray-release-2026-06-22.md`

验证:
- `npm run verify:runninghub-analyze-contract = ok`
- `npm run verify:runninghub-workflow-contract = ok`
- `npm run type-check = ok`
- `npm run build:single-port = ok`
- `npm run verify:single-port = ok`
- `npm run package:release -- 20260622-runninghub-tolerant-analyze-gray-r1-v042-local = ok`
  - `dist-release/20260622-runninghub-tolerant-analyze-gray-r1-v042-local.tar.gz`
  - `sizeMB = 5.47`

影响:
- 本轮 RH analyze 已从“只够处理纯 JSON 文本”推进到“能吃混合示例并推断输出草案”。
- RH 节点开始真正消费后台 `outputSchema`，减少继续靠 `workflowJson` 关键词猜输出的误差。
- 版本治理重新对齐到“每次 gray 真实发布推进一个非 major 版本”的仓库规则。

风险:
- 当前还未完成 gray 切换与服务器 gate，主入口里暂时保留“待本轮发布后更新”的过渡描述。
- `scripts/package-release.mjs` 仍是 runtime-only，服务器若要在 release 目录重建仍受依赖链缺口约束。

下一步:
- 先把本轮改动提交入库。
- 基于 `20260622-runninghub-tolerant-analyze-gray-r1-v042-local` 包推进 gray 发布。
- 发布后补跑 gray gate、RH analyze 视觉实查和画布 RH 节点复验。

### RunningHub 协议后台与画布节点重建 v0.4.1 gray 发布与视觉验收

目标:
- 把本轮 RunningHub 重建改动正式推到 gray，并把功能、接口、视觉和发布指针都收成可复核证据。

变更:
- 灰度发布：
  - 首次发布：
    - `20260622-runninghub-rebuild-gray-r1-v041-9e1f2fe`
  - 热修后当前灰度：
    - `20260622-runninghub-rebuild-gray-r2-v041-8faaadf`
- 热修内容：
  - `apps/api/src/server.ts`
    - `parseRunningHubExampleObject` 从 `safeText(..., 240)` 改为 `safeLongText(..., 16000)`
  - `scripts/verify-runninghub-analyze-contract.mjs`
    - 增加长 `requestExample` 保留能力的回归校验
- 运维归档：
  - 新增 `ops/runninghub-protocol-admin-and-canvas-node-rebuild-gray-release-2026-06-22.md`
  - 更新 `ops/README.md`
  - 更新 `MEMORY.md`

验证:
- gray gate：
  - `npm run verify:release-preflight = ok`
  - `npm run verify:request-chain-observability = ok`
  - `npm run verify:system-observability = ok`
- gray 运行态：
  - `/api/status => version=0.4.1 environment=gray`
  - current symlink =>
    - `/opt/apps/xinghuan-canvas-next/releases/20260622-runninghub-rebuild-gray-r2-v041-8faaadf`
  - 数据库目标 =>
    - `current = xinghuan_canvas_gray`
    - `expected = xinghuan_canvas_gray`
    - `targetMatched = true`
- gray 接口实查：
  - 直接调用 `POST /api/admin/runninghub/analyze` 已返回 `inputs.payload.fields`
  - 字段包含：
    - `12.prompt`
    - `15.negative_prompt`
    - `18.seed`
- gray UI 实查：
  - 真实登录后台页面后，RH 工作台分析面板已显示：
    - `请求示例`
    - `响应示例`
  - 点击“AI 分析并填写”后，已真实渲染：
    - `基础信息草案`
    - `输入槽草案`
    - `参数 Schema 草案`
    - `输出定义草案`
    - `执行规则草案`
  - 输入槽卡片与 Schema 草案中已出现：
    - `prompt`
    - `negative prompt`
    - `seed`
  - 本轮 UI 验证使用 Playwright + Edge 自动化点击与前后截图对比完成，不再只看接口返回

影响:
- RH 分析工作台现在已经不是“接口能返回但页面不落地”的半成品，gray 页面可以直接看到结构化草案卡片。
- `requestExample.nodeInfoList` 已真正进入后台条目治理链，字段草案与参数 Schema 草案都能从真实样例推导出来。

风险:
- 当前 release 包仍是 runtime-only；如果后续发布要求在服务器 release 目录重新执行 `build:single-port`，现有 runbook 还不够，需要先补依赖链。
- 当前只完成 gray 放行，production 仍停在 `v0.4.0`。

下一步:
- 如需继续推进 production，先沿用本轮 gray 的接口样例和 UI 自动化脚本思路补做正式环境验收。
- 如果后续有 migration 或服务器重建诉求，先修补 release 打包与构建 runbook。

### RunningHub 协议后台与画布节点重建 v0.4.1 本地收口

目标:
- 把 RunningHub 协议后台与画布节点这轮重建改动整理成可发布版本，先完成工作树清理、版本提升、契约补强和本地重验证，再进入 gray 发布。

变更:
- 设计与归档：
  - 新增 `docs/superpowers/specs/2026-06-22-runninghub-protocol-admin-and-canvas-node-rebuild-design.md`
  - 补齐本轮 RunningHub 方案、计划与灰度记录草稿归档
- 后台 RH 分析工作台：
  - `apps/admin/src/admin-runninghub-workspace.tsx`
  - `apps/admin/src/admin-runninghub-item-editor.tsx`
  - `apps/admin/src/admin-types.ts`
  - `apps/admin/src/admin-api-client.ts`
  - `apps/admin/src/admin-readonly-panels.tsx`
  - 分析面板补齐 `requestExample / responseExample`
  - 后台条目编辑与分析区继续收口为工作台结构
- 后端 RH 目录与协议重建：
  - `apps/api/src/server.ts`
  - `apps/api/src/runninghub-catalog.ts`
  - `apps/api/src/runninghub-execution-descriptor.ts`
  - 从 `requestExample.nodeInfoList` 解析字段草稿并生成 `fields`
  - 修复 `runTargetId` 校验，避免错误条目继续伪装成可执行配置
  - 去掉 `instanceType = plus` 默认兜底，避免协议被静默污染
- 画布 RH 节点：
  - `apps/web/src/components/nodes/RunningHubNode.tsx`
  - `apps/web/src/services/runninghubCatalog.ts`
  - `apps/web/src/services/generation.ts`
  - 节点继续按后台 catalog 与真实字段定义消费，不再默认依赖旧兜底实例类型
- 验证与版本治理：
  - 新增 `scripts/verify-runninghub-analyze-contract.mjs`
  - 调整 `scripts/verify-runninghub-workflow-api.mjs`
    - 当本地未配置 RunningHub Provider API Key 时，跳过远端 hydration 实查并显式返回 `hydrationSkippedReason`
  - 统一版本提升到：
    - `v0.4.1`

验证:
- 静态与契约：
  - `npm run type-check = ok`
  - `npm run verify:runninghub-analyze-contract = ok`
  - `npm run verify:runninghub-workflow-contract = ok`
  - `npm run verify:runninghub-queue-governance-contract = ok`
  - `npm run verify:runninghub-workflow-api = ok`
- 构建与本地运行：
  - `npm run build:single-port = ok`
  - `npm run verify:single-port = ok`
  - `http://127.0.0.1:18200/api/status => version=0.4.1 environment=local`
- 重型本地验收链：
  - `npm run verify:local-acceptance-chain = ok`
  - 覆盖：
    - `verify:single-port`
    - `verify:node-acceptance-matrix`
    - `verify:canvas-node-render-smoke`
    - `verify:generic-node-catalog`
    - `verify:model-catalog`
    - `verify:external-image-proxy`
    - `verify:external-video-proxy`
    - `verify:external-chat-proxy`
    - `verify:task-payload-api`
    - `verify:task-lifecycle`
    - `verify:runninghub-workflow-contract`
    - `verify:runninghub-workflow-api`
    - `verify:worker-adapter-contract`
    - `verify:worker-output-materializer`
    - `verify:output-material-prune`

影响:
- RH 后台条目现在可以把分析输入样例、协议样例与字段草稿放到同一条治理链里，避免“分析结果有了，但字段定义仍停在手工补录”的断层。
- RH 节点对 `runTargetId / instanceType` 的消费边界更清楚，减少静默兜底导致的假成功配置。
- 版本、验证脚本和归档材料已经整理到可发布形态，后续 gray 发布可以直接基于当前 worktree 继续。

风险:
- 当前本地 `verify-runninghub-workflow-api` 返回 `workflowCount = 0 / appCount = 0`，说明本地数据集仍没有真实 RH 条目样本；这不影响契约通过，但 gray 仍需要做真实后台条目与视觉实查。
- 本地缺少 RunningHub Provider API Key 时，远端 hydration 仅能走“跳过并显式记录原因”的分支；真实远端补槽仍需到 gray 或配置完整的环境里验证。

下一步:
- 先完成本轮代码与文档提交，随后推送 gray。
- gray 上补做版本、功能、视觉和细节对比验收，并把实际 release 指针、截图证据和结论补入 `ops/` 台账。

## 2026-06-19

### RH 条目真实输入槽同步与 v0.4.0 gray / production 发布

目标:
- 让 RH 后台条目不再停留在 Schema 草稿或空字段状态，而是能直接从运行目标同步真实 `nodeInfoList`，随后让画布 RH 节点自动展开可执行参数区。

变更:
- `apps/admin/src/admin-api-client.ts`
  - 新增 `fetchRemoteAppInfo(runTargetId)`，复用后端 RH `app-info` 代理。
- `apps/admin/src/admin-runninghub-item-editor.tsx`
  - 新增 `buildFieldsFromRemoteNodeInfoList`
  - 新增“从运行目标同步输入槽”按钮
  - 支持把运行目标返回的真实 `nodeId / fieldName / fieldType / options` 合并回条目字段定义
- 统一版本升级到：
  - `v0.4.0`
- 发布结果：
  - gray：`20260619-runninghub-slot-sync-gray-r1-v040-local`
  - production：`20260619-runninghub-slot-sync-prod-r1-v040-local`

验证:
- 本地：
  - `node scripts/verify-runninghub-workflow-contract.mjs = ok`
  - `npm run build -w @xinghuan/admin = ok`
  - `npm run build -w @xinghuan/web = ok`
  - `npm run build -w @xinghuan/api = ok`
  - `npm run build:single-port = ok`
- gray：
  - `/api/status => version=0.4.0 environment=gray`
  - `verify:release-preflight = ok`
  - `verify:request-chain-observability = ok`
  - `verify:system-observability = ok`
- production：
  - `/api/status => version=0.4.0 environment=production`
  - `verify:release-preflight = ok`
  - `verify:request-chain-observability = ok`
  - `verify:system-observability = ok`

影响:
- RH 后台条目现在可以直接吸收运行目标返回的真实字段定义，避免字段长期停在“只有 Schema、没有可执行绑定”的半成品状态。
- 条目保存后，画布 RH 节点会按后台条目自动展开参数区，不再要求用户理解或手工维护 `workflowId / runTargetId / nodeId` 这些后台治理字段。

风险:
- 如果某个 RH 运行目标本身不返回 `nodeInfoList`，当前同步能力仍无源可用，这类条目依然需要后台人工补录字段。
- 本轮发布仍不包含 migration，`db:migrate` 的 release 依赖链缺口仍需后续单独修补。

下一步:
- 用真实 RH workflow / app 继续补几组“同步输入槽 -> 保存条目 -> 节点展开参数区 -> 提交任务”的联调样本。
- 继续收 RH 工作台对空返回 `nodeInfoList` 的提示和人工补录辅助能力。

### RH 从 Schema 生成输入槽草稿

目标:
- 让 RH 工作台里的 Schema 草案可以继续推进成可编辑输入槽草稿，而不是停留在说明层。

变更:
- `apps/admin/src/admin-runninghub-item-editor.tsx`
  - 新增 `buildFieldsFromParameterSchema`
  - 新增“从 Schema 生成输入槽草稿”按钮
  - 根据 `properties / required / title / description / default / enum` 自动生成字段草稿
  - 生成后明确提示：仍需补齐 `nodeId`
- `scripts/verify-runninghub-workflow-contract.mjs`
  - 增加 RH admin 可从 Schema 生成输入槽草稿的契约校验

验证:
- `node scripts/verify-runninghub-workflow-contract.mjs = ok`
- `npm run build -w @xinghuan/admin = ok`
- `npm run build -w @xinghuan/web = ok`
- `npm run build -w @xinghuan/api = ok`

影响:
- RH 条目现在从“有 Schema 草案”推进到“有可编辑字段草稿”只差一步。
- 后台管理员无需手动从零逐条录入 `fieldName / label / valueType`。

风险:
- 自动生成的是字段草稿，不是最终可执行绑定；`nodeId` 仍必须人工确认。

下一步:
- 推灰度后实际验证一轮 RH 工作台补槽流程。
- 如果效果稳定，再继续补“逐条绑定完成度”状态和批量检查提示。

### RH Schema 状态透出与灰度发布

目标:
- 让 RH 条目明确区分“结构化参数草案”与“可执行 RH 绑定字段”。
- 避免用户在画布节点中把 Schema 草案误认为可直接提交的执行表单。

变更:
- `packages/shared/src/runninghub.ts`
  - RH 公共目录项补充 `parameterSchema` 字段。
- `apps/api/src/runninghub-catalog.ts`
  - RH public catalog 输出透传 `parameterSchema`。
- `apps/web/src/services/runninghubCatalog.ts`
  - 前端 RH 目录服务保留 `parameterSchema`。
- `apps/admin/src/admin-runninghub-workspace.tsx`
  - 条目列表改为同时显示“绑定数 / Schema 数”。
  - 对“只有 Schema 草案、没有 RH 绑定”的条目给出明确提示。
- `apps/admin/src/admin-runninghub-item-editor.tsx`
  - 参数 Schema 区和摘要区增加 Schema 参数数说明。
- `apps/web/src/components/nodes/RunningHubNode.tsx`
  - 节点卡片显示“绑定 / Schema / 输出”状态。
  - 对“有 Schema、无 RH 绑定”的条目给出更精确提示，不再暗示它可以直接提交。
- `scripts/verify-runninghub-workflow-contract.mjs`
  - 增加 `parameterSchema` 穿透到目录层的契约检查。
- 灰度发布：
  - `20260619-runninghub-schema-state-gray-r1-v034-d9b653c`

验证:
- `node scripts/verify-runninghub-workflow-contract.mjs = ok`
- `npm run build -w @xinghuan/shared = ok`
- `npm run build -w @xinghuan/admin = ok`
- `npm run build -w @xinghuan/web = ok`
- `npm run build -w @xinghuan/api = ok`
- `npm run build:single-port = ok`
- `codegraph sync = ok`
- gray:
  - `verify:release-preflight = ok`
  - `verify:request-chain-observability = ok`
  - `verify:system-observability = ok`

影响:
- RH workflow / app 条目现在能更清楚地表达三种状态：
  - 既有 RH 绑定，也可执行
  - 只有 Schema 草案，仍不可执行
  - 连 Schema 草案都没有，属于空壳条目

风险:
- 这一步仍然没有替代真实 RH 字段绑定；它解决的是状态透明度，不是自动生成可执行字段映射。

下一步:
- 如果要真正做到“选中条目后自动出现可执行输入区”，需要补充真实 RH 绑定信息来源：
  - 远端可拉取 `nodeInfoList`
  - 或后台手工补齐 `nodeId + fieldName`
  - 或后续为特定协议定义安全的参数映射规则

### RH 空壳条目治理与节点提示补强

目标:
- 避免没有输入槽定义的 RH 条目继续被启用并流入画布节点。
- 让后台管理员和画布用户都能明确识别“当前条目为什么不会展开参数区”。

变更:
- `apps/api/src/server.ts`
  - 新增 RH 条目启用前校验：如果没有任何有效输入槽定义，则禁止启用，只允许作为停用草稿保存。
- `apps/admin/src/admin-runninghub-item-editor.tsx`
  - 保存前增加输入槽治理校验。
  - 右侧摘要增加“启用条件”状态。
- `apps/admin/src/admin-runninghub-workspace.tsx`
  - RH 条目列表增加“待补输入槽”提示，明确说明这类条目启用后节点不会展开参数区。
- `apps/web/src/components/nodes/RunningHubNode.tsx`
  - 节点选择到空壳 RH 条目时，直接显示缺少输入槽定义的说明，不再让用户误判为前端渲染异常。
- `scripts/verify-runninghub-workflow-contract.mjs`
  - 补充空壳条目治理与节点提示契约检查。

验证:
- `node scripts/verify-runninghub-workflow-contract.mjs = ok`
- `npm run build -w @xinghuan/admin = ok`
- `npm run build -w @xinghuan/web = ok`
- `npm run build -w @xinghuan/api = ok`

影响:
- RH 条目现在必须先补齐输入槽，才能作为启用条目进入画布。
- 现有空壳样例条目会被明确识别为“后台配置未完成”，而不是“节点功能异常”。

风险:
- 当前治理默认将“无输入槽定义”视为不可启用，这会把极少数真正零输入的 RH 条目也归为草稿态。
- 如果后续确认存在真实零输入工作流，需要补一个显式标记，而不是重新放开空壳启用。

下一步:
- 推灰度验证后台提示与节点提示是否符合实际使用感受。
- 如果要支持真实零输入 RH 条目，需单独补“允许零输入”的显式配置，不与空壳条目混用。

### RunningHub 节点补链与空字段条目核查

目标:
- 修复 RH 节点选择 workflow 条目后提交失败的问题。
- 修复 RH 节点在后台条目本地无字段时，自动尝试补拉远端字段定义。
- 查清当前样例 workflow 为什么仍然没有参数输入区。

变更:
- `apps/web/src/components/nodes/RunningHubNode.tsx`
  - RH 节点提交时显式携带 `pageId / workflowId / runTargetId / targetType / taskCapability`
  - 新增空字段条目自动补拉远端 `app-info` 的 hydration 链路
- `apps/web/src/services/generation.ts`
  - 扩展 `RhSubmitRequest`，补齐 RH 运行目标元数据
- `apps/api/src/server.ts`
  - `app-info` 代理改为：本地条目为空字段时回退拉取远端 `apiCallDemo`
- `scripts/verify-runninghub-workflow-contract.mjs`
- `scripts/verify-runninghub-workflow-api.mjs`
  - 补齐 RH 节点提交流程与自动补参链路的源码契约
- 灰度发布：
  - `20260619-runninghub-node-hydrate-gray-r1-v034-d9b653c`

验证:
- `node scripts/verify-runninghub-workflow-contract.mjs = ok`
- `node scripts/verify-runninghub-workflow-api.mjs = ok`
- `npm run build -w @xinghuan/web = ok`
- `npm run build -w @xinghuan/api = ok`
- `npm run build:single-port = ok`
- `codegraph sync = ok`
- gray:
  - `verify:release-preflight = ok`
  - `verify:request-chain-observability = ok`
  - `verify:system-observability = ok`
- gray 实查：
  - `runninghub-main:workflow:2004516402230509570`
    - `localFieldCount = 0`
    - `parameterSchema = {}`
    - `testPayload = {}`
    - `remoteNodeInfoCount = 0`

影响:
- RH 节点 workflow 提交流程不再因为缺少 `workflowId / runTargetId` 直接失败。
- RH 条目为空字段时，系统已经具备自动补拉远端字段的机制。
- 当前样例 workflow 仍然不会自动出现参数区，但根因已明确收束为“条目没有任何字段定义来源”，不是前端渲染缺陷。

风险:
- 当前 release 包默认仍不携带 `node_modules`，本次灰度通过复用上一 release 的 `node_modules` 完成启动。
- 如果后续 gray / production 再走 release 切换而不修补打包/部署链路，仍可能再次遇到 workspace 依赖缺失。

下一步:
- 为 RH workflow / app 条目建立“输入槽定义必填”或“可分析后生成输入槽草案”的治理约束。
- 单独修补 release 打包/部署链路，消除对旧 release `node_modules` 的手工复用。
- 如果需要先理解整体结构、环境、接口和排障入口，先看 `docs/project-atlas/README.md`。
- 本文件保留逐日推进细节，不承担“唯一入口摘要”职责。
- 已经沉淀为长期规则的内容，应同步收口到 `MEMORY.md`、`docs/` 或 `ops/`，避免只存在于日志中。

## 2026-06-17

## 2026-06-19

### RH 工作台 sticky 重叠修复与 gray 发布完成

目标:

- 修复 RH 工作台滚动时后台顶栏、筛选条和编辑器头部之间的重叠问题。
- 继续收口 RH 编辑器长表单结构和 AI 分析区的工作台化布局。
- 将修复推送到 gray，并补齐 release 台账。

变更:

- `apps/admin/src/admin-runninghub-workspace.tsx`
  - 搜索 / 分类 / 状态筛选改为 `admin-runninghub-workspace__sticky-shell` 吸顶控制层。
  - `AI 分析并填写` 区块改为 `workbench` 结构，增加输入来源 / 输出结果 / 应用方式说明卡。
- `apps/admin/src/admin-runninghub-item-editor.tsx`
  - 编辑器头部改为 `admin-runninghub-editor__shell-head` 独立吸顶。
  - 增加区块 chips，强化“基础信息 / 输入槽 / Schema / 输出 / 执行规则”的阅读分段。
  - 右侧摘要 / 测试面板保留结构，但去掉双重 sticky 叠层。
- `apps/admin/src/styles.css`
  - 调整 RH 工作台吸顶层、编辑器头部、侧栏和 AI 分析区布局样式。
- `scripts/verify-runninghub-workflow-api.mjs`
  - 补充 RH 工作台新结构源代码契约：`sticky-shell`、`shell-head`、`analyze workbench`。
- 新增发布记录：
  - `ops/runninghub-sticky-gray-release-2026-06-19.md`

验证:

- `node scripts/verify-runninghub-workflow-api.mjs = ok`
- `npm run build -w @xinghuan/admin = ok`
- `codegraph sync = ok`
- `npm run build:single-port = ok`
- gray release `20260619-runninghub-sticky-gray-r6-v034-d9b653c` 已部署
- gray gate:
  - `verify:release-preflight = ok`
  - `verify:request-chain-observability = ok`
  - `verify:system-observability = ok`

结果:

- RH 工作台现在采用“后台总顶栏 + RH 筛选吸顶层 + 编辑器头部吸顶层”的单向层级，不再出现多层 sticky 相互压住正文。
- RH 分析区已具备更清晰的工作台结构，后续继续扩展结构化草案不会再把说明和输入挤成一块。
- gray 当前已切到 `20260619-runninghub-sticky-gray-r6-v034-d9b653c`，对外版本仍为 `v0.3.4`。

## 2026-06-18

### RunningHub 工作台与节点第二轮结构收口

完成:

- 后台 RH 工作台补齐管理动作第一版：
  - `POST /api/admin/runninghub/items`
  - `DELETE /api/admin/runninghub/items/:catalogId`
  - `POST /api/admin/runninghub/analyze`
- RH 工作台页面已改成更接近 API 设置页的结构：
  - 顶部操作条：`刷新目录 / 新建工作流 / 新建 AI 应用 / AI 分析并填写`
  - 左侧目录：搜索、工作流/AI 应用切换、`全部 / 启用 / 停用` 状态筛选
  - 右侧编辑：显式 `保存 / 另存为 / 删除 / 启停 / 测试与调试`
- RH AI 分析已切到结构化卡片输出第一版：
  - `基础信息草案`
  - `输入槽草案`
  - `参数 Schema 草案`
  - `输出定义草案`
  - `执行规则草案`
- RH 节点 UI 第一轮收口：
  - 增加“输入摘要”
  - 增加小字状态摘要：`进行中 / 成功 / 失败`
  - 移除节点界面里的 `Webapp ID` 文案，收口为“运行目标”
- 系统页并发文案第一轮收口：
  - `任务并发设置` 标题拆成 `普通任务并发`
  - RunningHub 区域补齐 `RunningHub 平台并发治理` 与 `RH 平台总并发`

验证:

- `node scripts/verify-runninghub-workflow-api.mjs`
  - 源码契约检查已通过
  - 当前本地未起 `127.0.0.1:18200`，所以 live API 段会报 `ECONNREFUSED`
- `npm run build -w @xinghuan/api = ok`
- `npm run build -w @xinghuan/admin = ok`
- `npm run build -w @xinghuan/web = ok`
- `npm run build:single-port = ok`

说明:

- 这一轮先把 RH 工作台和节点从“能用但很乱”推进到“结构清晰、接口完整、可继续联调”的状态。
- AI 分析卡片和条目应用目前是第一版，后续仍需要继续把“应用全部 / 局部应用”的实际交互做得更稳。

### RunningHub 运行时结果保留、队列治理与 v0.3.4 gray / production 发布

目标:

- 完成 RunningHub 运行时读结果修复、RH queued task 外键修复，以及普通 Provider / RH 队列治理的真实验证与发布收口。
- 把 gray / production 的实际 release、版本号和验证证据同步落入文档和运维记录。

变更:

- 修复 RH query 结果读取：
  - `apps/api/src/provider-generation-task-service.ts`
  - 读取任务状态时统一保留：
    - `imageUrls`
    - `remoteImageUrls`
    - `videoUrls`
    - `remoteVideoUrls`
    - `audioUrls`
    - `remoteAudioUrls`
- 修复 RH queued task 入库外键误用：
  - `apps/api/src/server.ts`
  - 创建 RH 队列任务时 `modelId` 改为空字符串，不再复用 workflow/page id
- 统一版本号推进到：
  - `v0.3.4`
- gray 发布：
  - `20260618-runninghub-runtime-queue-gray-r6-v034-d9b653c`
- production 发布：
  - `20260618-runninghub-runtime-queue-prod-r1-v034-d9b653c`
- 新增运维发布记录：
  - `ops/runninghub-runtime-queue-governance-release-2026-06-18.md`

验证:

- 本地：
  - `npm run build -w @xinghuan/api = ok`
  - `node scripts/verify-runninghub-queue-governance-contract.mjs = ok`
  - `node scripts/verify-user-queue-governance-contract.mjs = ok`
  - `npm install --package-lock-only = ok`
  - `npm run build:single-port = ok`
- gray gate：
  - `verify:release-preflight = ok`
  - `verify:request-chain-observability = ok`
  - `verify:system-observability = ok`
- production gate：
  - `verify:release-preflight = ok`
  - `verify:request-chain-observability = ok`
  - `verify:system-observability = ok`
- gray 实链验证：
  - 普通 Provider 用户窗口：
    - `task-1781787483910-nxtenx`
    - `task-1781787484073-900frn`
    - `task-1781787484217-1vdo6q`
    - 已观察到 `waitReason = waiting_user_window`
  - RH 单任务成功：
    - `task-1781788410710-ndki99`
  - RH 三任务批量成功：
    - `task-1781789036588-mqrk4c`
    - `task-1781789036735-jvltj3`
    - `task-1781789036892-eglgtt`
    - 已观察到 `waitReason = waiting_runninghub_window`

影响:

- RH 即使在视频能力链路中返回图像输出，也不会再因为结果暴露分支错误而被前台读成空结果。
- RH workflow/page id 不再污染普通模型外键。
- 普通 Provider 与 RunningHub 的等待语义、自动递进和并发窗口现在都有真实验证证据，不再只停留在脚本或设计口径。
- gray / production 当前对外版本已经统一到 `v0.3.4`。

风险:

- 本轮 release 不含 migration，因此 `PG_DRIVER_NOT_INSTALLED` 不影响本次发布成立。
- 但 release 目录的迁移依赖链仍未修补，后续带 migration 的 release 必须先解决，否则发布链仍有隐患。

下一步:

- 修补 release 包 `db:migrate` 的驱动依赖链。
- 继续推进 RH 后续能力扩展时，保持普通 Provider 队列与 RH 平台窗口的隔离治理。

### RunningHub 工作台与单一 RH 节点第一阶段灰度发布

目标:

- 将 RunningHub 第一阶段实现真正发布到 gray，并补齐服务器侧 release / gate 记录。
- 把当前状态同步收口到主入口文档，避免继续停留在旧 gray release 口径。

变更:

- 发布 gray release：
  - `20260618-runninghub-workspace-gray-r1-6b65dbc`
- gray current 已切换到：
  - `/opt/apps/xinghuan-canvas-next/releases/20260618-runninghub-workspace-gray-r1-6b65dbc`
- 补充运维记录：
  - `ops/runninghub-workspace-gray-release-2026-06-18.md`
- 同步更新当前入口文档：
  - `README.md`
  - `MEMORY.md`
  - `ops/README.md`
  - `docs/prd/README.md`
  - `AGENTS.md`

验证:

- `GET http://127.0.0.1:18200/api/status = ok`
  - `environment = gray`
  - `version = 0.3.2`
- gray release 目录执行：
  - `verify:release-preflight = ok`
  - `verify:request-chain-observability = ok`
  - `verify:system-observability = ok`

影响:

- 当前 gray 已不再停留在 `v0.3.2` 的 UI fixes release，而是进入 RunningHub 第一阶段工作台与单一 RH 节点改造版本。
- 项目主入口文档现在能直接反映当前 gray / production 分别处于哪一批 release，后续查状态不需要再倒推日志。

风险:

- 本轮 gray 不包含新的数据库 migration，因此发布可成立；但 release 目录执行 `db:migrate` 时仍暴露 `PG_DRIVER_NOT_INSTALLED`，说明后续若带 migration 发布，需要先修补 release 迁移依赖链。
- 当前仍只完成 RH 第一阶段灰度收口，真实工作流录入、字段展开和运行验收还需要继续补。

下一步:

- 继续推进 RH 第二阶段实施与真实工作流验收。
- 在后续带 migration 的发布前，先补 release 包数据库驱动依赖链验证。

### RunningHub 工作台与单一 RH 节点第一阶段实现推进

目标:

- 将 RunningHub 从旧的 `workflows/apps + 节点内隐式映射` 逐步推进到“后台 RH 工作台 + 公开 catalog + 单一 RH 节点 schema 消费”。
- 先完成第一阶段可发货切片：后端规范化、后台工作台、前台单节点契约切换。

变更:

- 后端与共享契约：
  - 新增 `packages/shared/src/runninghub.ts`
  - 新增 `apps/api/src/runninghub-catalog.ts`
  - 新增 `apps/api/src/runninghub-execution-descriptor.ts`
  - `server.ts` 新增：
    - `GET /api/admin/runninghub/items`
    - `PATCH /api/admin/runninghub/items/:id`
    - `POST /api/admin/runninghub/items/:id/test`
    - `GET /api/runninghub/catalog`
    - `GET /api/runninghub/catalog/:id`
- 后台：
  - 新增 `apps/admin/src/admin-runninghub-workspace.tsx`
  - 新增 `apps/admin/src/admin-runninghub-item-editor.tsx`
  - Provider 页内 RH 配置入口改为“进入 RH 工作台”
  - RH 工作台补齐：
    - 输入槽定义
    - 参数 Schema
    - 输出定义
    - 执行描述
    - 测试运行
- 前台：
  - 重写 `apps/web/src/services/runninghubCatalog.ts`
    - 公开以 `items` 为主，兼容旧 `workflows/apps`
  - 新增 `apps/web/src/utils/runninghubNodeSchema.ts`
  - 更新 `apps/web/src/components/nodes/RunningHubNode.tsx`
    - 接入新 catalog item
    - 增加固定 typed handles：
      - `text-in`
      - `image-in`
      - `video-in`
      - `audio-in`
      - `json-in`
    - 增加 RH schema 摘要区
    - 保留旧 `rhWorkflowPresetId / appInfo / webappId` 兼容链路
- 契约与验证：
  - 新增 `scripts/verify-runninghub-single-node-contract.mjs`
  - 沿用：
    - `scripts/verify-runninghub-catalog-normalization.mjs`
    - `scripts/verify-admin-runninghub-workspace-contract.mjs`

验证:

- `node scripts/verify-runninghub-catalog-normalization.mjs = ok`
- `node scripts/verify-admin-runninghub-workspace-contract.mjs = ok`
- `node scripts/verify-runninghub-single-node-contract.mjs = ok`
- `npm run build -w @xinghuan/api = ok`
- `npm run build -w @xinghuan/admin = ok`
- `npm run build -w @xinghuan/web = ok`

影响:

- RunningHub 第一阶段现在不再只是“后台能录卡片、前台能读旧字段”，而是已经具备：
  - RH 工作台
  - 结构化 catalog
  - 单一 RH 节点固定输入口契约
- 前台 RH 节点已具备继续往“动态输入槽 + 更稳定输入输出编排”推进的基座。

风险:

- 前台节点目前仍保留旧 `appInfo.nodeInfoList` 运行主链，只是在 catalog 和句柄层切到新契约；这属于有意的兼容式过渡。
- 公开 `RhCatalogItem` 目前仍未直接暴露更完整的 `outputSchema / parameterSchema`，前台 schema helper 现阶段采用兼容推断，不是最终态。

下一步:

- 继续推进 RH 节点内部从旧 `nodeInfoList` 形态向更直接的 `inputSlots` 消费过渡。
- 完成 CodeGraph sync、最终提交与后续 gray 验收准备。

### RunningHub 后台工作台与单一 RH 节点方案定稿

目标:

- 将 RunningHub 这条能力线从“Provider 表单中的 RH 附属配置”升级为完整可执行的设计方案。
- 同时明确后台工作台、RH catalog 建模、execution descriptor 与前端单一 RH 节点的边界。

变更:

- 新增项目总纲分域设计文档：
  - `docs/project-atlas/runninghub-integration-and-node-design.md`
- 更新总纲入口：
  - `docs/project-atlas/README.md`
- 方案收口内容包括：
  - Provider 基础连接层与 RH 工作台的职责拆分
  - `RhCatalogItem / RhInputSlotDefinition / RhParamFieldDefinition / RhOutputDefinition / RhExecutionDescriptor` 数据模型草案
  - RH 管理接口与公开 catalog / proxy 接口边界
  - 后台 RH 工作台信息架构与结构化接入草案助手定位
  - 前端单一 RH 节点的输入口 / 参数区 / 输出口 / 状态展示方案
  - 旧 RH 节点到新模型的兼容迁移阶段

验证:

- 设计稿已与当前代码现状对齐：
  - Provider 侧 `runninghub` 协议
  - `rhApps / rhWorkflows` 现有雏形
  - `/api/runninghub/catalog` 现有公开入口
  - `RunningHubNode` 当前消费方式
- 文档路由已挂入 `docs/project-atlas/README.md`

影响:

- RunningHub 后续实施不再依赖对话上下文，已有明确的项目内主方案文档。
- 后续如果正式开始实施，可直接围绕这份方案拆 implementation plan，而不需要再重新对齐后端 / 后台 / 节点边界。

风险:

- 当前仍是设计定稿阶段，尚未开始代码实施。
- `rhApps / rhWorkflows` 到新 catalog 模型的具体落库方式，仍需在实施计划里细化迁移步骤。

下一步:

- 由用户审阅 `docs/project-atlas/runninghub-integration-and-node-design.md`。
- 审阅通过后，继续拆正式 implementation plan，再进入代码实施。

### 多生成任务状态与超时统一灰度发布

目标:

- 将多图 / 多视频拆单异步任务的状态展示、输出追加、超时统一与上游素材透传修复正式推到 gray。

变更:

- 基于 commit `b8534f2` 生成 gray release：
  - `20260618-multi-generation-timeout-gray-r1-b8534f2`
- 发布到：
  - `/opt/apps/xinghuan-canvas-next/releases/20260618-multi-generation-timeout-gray-r1-b8534f2`
- 切换：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260618-multi-generation-timeout-gray-r1-b8534f2`
- 同步更新：
  - `ops/README.md`
  - `README.md`
  - `MEMORY.md`
  - `docs/prd/README.md`
  - `ops/multi-generation-timeout-gray-release-2026-06-18.md`

验证:

- `npm run build:single-port = ok`
- `node scripts/verify-release-package-contract.mjs = ok`
- `node scripts/verify-release-preflight-contract.mjs = ok`
- `npm run package:release -- 20260618-multi-generation-timeout-gray-r1-b8534f2 = ok`
- gray `npm run db:migrate = ok`
- gray `verify:release-preflight = ok`
- gray `verify:request-chain-observability = ok`
- gray `verify:system-observability = ok`
- gray `/api/status`：
  - `environment = gray`
  - `version = 0.3.1`

影响:

- gray 已进入新的多生成任务修复 release，后续可直接做真实链路验收。
- 文档主入口已经指向最新 gray release，不会再停留在 6 月 17 日的旧指针上。

风险:

- 本轮只完成 gray 发布与 gate 复验，尚未同步 production。
- `verify:system-observability` 虽通过，但当前环境历史失败统计仍为 `critical`，它反映的是近 7 天累计失败偏高，不代表本次发布失败。

下一步:

- 直接在 gray 做用户关心的真实链路验收：
  - 多图输出追加到输出节点
  - 多视频多任务状态展示
  - `GRSAI` 超时跟随配置
  - 上传素材 -> 图像处理链路不再丢输入

### v0.3.2 版本推进与 gray / production 发布准备

目标:

- 将这轮 UI / 节点交互修复发布到 gray 和 production。
- 将对外版本号统一推进到 `v0.3.2`。

变更:

- 统一更新 monorepo 对外版本源到 `0.3.2`：
  - 根 `package.json`
  - `apps/*/package.json`
  - `packages/*/package.json`
  - `packages/shared/src/index.ts`
  - `apps/web/vite.config.ts`
  - `apps/api/src/server.ts`
- 修复：
  - 尺寸调整节点上游取图和宽高输入行为
  - 运行态卡片子任务摘要样式
  - 工具栏导入 / 导出图标逻辑
- 新增验证脚本：
  - `verify-canvas-toolbar-import-export-contract.mjs`
  - `verify-resize-node-input-behavior-contract.mjs`
- 新增发布记录：
  - `ops/release-v032-gray-and-production-2026-06-18.md`

验证:

- `npm install --package-lock-only = ok`
- `node scripts/verify-image-op-upstream-material-contract.mjs = ok`
- `node scripts/verify-node-runtime-card-task-runs-contract.mjs = ok`
- `node scripts/verify-canvas-toolbar-import-export-contract.mjs = ok`
- `node scripts/verify-resize-node-input-behavior-contract.mjs = ok`
- `npm run build -w @xinghuan/web = ok`

影响:

- 版本号源已经统一，后续 gray / production 发布后 `/api/status` 和前端注入版本会同步显示 `0.3.2`。

风险:

- 当前还处于发布前状态，gray / production release 目录和 gate 结果尚未写回。

下一步:

- 跑 `build:single-port` 和 release 契约。
- 先发 gray，再发 production，并把实际 release id 与 gate 结果写回主入口。

### 环境同步页布局重构与版本治理收口

目标:

- 修复后台“环境同步”页面在灰度和正式环境中的布局混乱、重叠与工作区不可控滚动问题。
- 将项目对外版本从 `v0.1.0` 统一推进到 `v0.3.1`，并建立后续 gray / production 版本治理规则。

变更:

- 重构 `apps/admin/src/admin-environment-sync-panel.tsx`：
  - 由旧的 `sidebar + content` 结构改为：
    - 顶部固定 `environment-sync-toolbar`
    - 左侧摘要 `environment-sync-rail`
    - 右侧工作区 `environment-sync-table-area`
  - 新增 `账号 / 服务商（含模型）` 分区切换，避免两张大表同时堆叠首屏。
  - 保留右侧后台 AI 助手默认打开能力，并让环境同步页改造与助手面板共存。
- 重构 `apps/admin/src/styles.css`：
  - 新增 `environment-sync-toolbar / workspace / rail / table-area / table-scroll / section-tabs` 样式结构。
  - 收紧本地滚动边界，避免对话区下方再出现不必要的横向滚动条。
  - 让固定工具栏和剩余高度工作区与 `admin-main--fixed-panel` 配合生效。
- 更新 `apps/admin/src/main.tsx`，让 `environment-sync` 页纳入固定面板布局。
- 更新 `scripts/verify-admin-environment-sync-contract.mjs`，将新 DOM/CSS 结构和助手共存关系固化为静态契约。
- 统一版本到 `v0.3.1`：
  - 根 `package.json`
  - `apps/*/package.json`
  - `packages/*/package.json`
  - `packages/shared/src/index.ts`
  - `apps/web/vite.config.ts`
  - `apps/api/src/server.ts`
  - `package-lock.json`
- 更新主入口与治理文档：
  - `README.md`
  - `AGENTS.md`
  - `MEMORY.md`
  - `docs/prd/README.md`
  - `ops/README.md`
- 新增版本治理规则：
  - 每次真实发布都必须推进 non-major 版本
  - major 版本只能由用户明确指令推进
  - 同一批 gray / production 必须保持相同对外版本号

验证:

- `node scripts/verify-admin-environment-sync-contract.mjs = ok`
- `npm run build -w @xinghuan/admin = ok`
- `npm install --package-lock-only = ok`

影响:

- 后台“环境同步”页现在具备更稳定的操作路径：顶部参数固定、左侧摘要集中、右侧独立滚动。
- 版本号来源已从包清单、共享常量、Web 编译注入到 API 状态接口统一为 `v0.3.1`。
- 后续 gray / production 放量时，版本展示不会再出现“代码已发布但环境显示旧版本”的分裂状态。

风险:

- 目前只完成了本地契约与 admin 构建验证，完整 monorepo 构建、gray/prod 打包与远端 gate 仍需继续执行。
- `docs/prd/v0.1.0/` 仍是当前版本文档目录名，本轮未迁目录，只更新了对外活跃版本口径。

下一步:

- 跑完整验证链：助手契约、shared/api/admin/build:single-port、CodeGraph sync。
- 生成新的 gray / production `v0.3.1` release 包并执行远端发布与 gate。
- 将本轮 release 指针和版本号写入专门的发布记录。

### 环境同步灰度 clean rebuild 补发完成，并补齐干净发布缺失提交

目标:

- 将环境同步这批改动从“本地通过、脏工作树可构建”收口到“干净 release worktree 可构建、可打包、可灰度发布”。
- 避免继续从带未提交依赖的工作树发灰度包，补齐发布与提交 SHA 的一致性。

变更:

- 新增提交：
  - `795c1e5`
  - `fix: restore prompt sanitizer helpers for release builds`
- 收口文件：
  - `apps/api/src/api-sanitizers.ts`
  - `apps/api/src/external-proxy.ts`
  - `apps/api/src/provider-generation-task-service.ts`
  - `scripts/verify-api-sanitizers-contract.ts`
  - `scripts/verify-provider-generation-task-service.mjs`
- 本次补齐的核心不是新功能，而是把此前已经被 `server.ts` 引用的：
  - `safeLongText`
  - `safePromptText`
  - 以及对应依赖接口声明
  从“仅存在于本地未提交状态”收口为真实提交内容。
- 基于干净 detached worktree 重新打包并发布 gray：
  - release：`20260617-environment-sync-gray-r2-795c1e5`
  - gray current：
    - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260617-environment-sync-gray-r2-795c1e5`

验证:

- 本地主 worktree：
  - `node --import tsx scripts/verify-api-sanitizers-contract.ts = ok`
  - `node scripts/verify-provider-generation-task-service.mjs = ok`
  - `npm run build -w @xinghuan/api = ok`
- 干净 release worktree：
  - `npm ci = ok`
  - `npm run build:single-port = ok`
  - `node scripts/verify-admin-environment-sync-contract.mjs = ok`
  - `node scripts/verify-environment-sync-service.mjs = ok`
  - `node scripts/verify-release-package-contract.mjs = ok`
  - `npm run package:release -- 20260617-environment-sync-gray-r2-795c1e5 = ok`
- gray 服务器：
  - `npm run db:migrate = ok`
  - `systemctl is-active xinghuan-canvas-next.service = active`
  - `systemctl is-active xinghuan-canvas-next-worker.service = active`
  - `npm run verify:release-preflight = ok`
  - `npm run verify:request-chain-observability = ok`
  - `npm run verify:system-observability = ok`
  - `http://127.0.0.1:18200/api/status = ok`

影响:

- 当前 gray 已不再依赖旧的 `dirty` 环境同步发布包，release 与提交 SHA 已重新对齐到可复现构建。
- 提示词/长文本在 API 输入链路中的清洗 helper 已进入正式提交，后续再做 clean release build 不会因缺失导出而失败。

风险:

- `verify:system-observability` 仍提示历史任务失败趋势偏高，这是运行态存量告警，不是本次发版失败。
- production 仍停留在：
  - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260617-environment-sync-prod-r1-f881c28-dirty`
  - 本轮未同步生产。

下一步:

- 若用户确认，可将同一 clean commit 再推 production，结束这批 environment sync 的发布债务。
- 继续收口其余未提交的后台助手相关修改，避免再次出现“脏工作树可跑、干净发布不可复现”的状态。

### 环境同步 clean release 已完成正式发布

目标:

- 将已经在 gray 验证通过的 clean commit `795c1e5` 推送到正式环境。
- 结束 environment sync 这批改动“gray 是 clean release、production 仍是 dirty release”的分裂状态。

变更:

- production release：
  - `20260617-environment-sync-prod-r2-795c1e5`
- production current：
  - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260617-environment-sync-prod-r2-795c1e5`
- 发布包来源：
  - `D:\codex\无限画布2.0-worktrees\release-gray-795c1e5`
  - `npm run package:release -- 20260617-environment-sync-prod-r2-795c1e5`

验证:

- production 服务器：
  - `npm run db:migrate = ok`
  - `systemctl is-active xinghuan-canvas.service = active`
  - `systemctl is-active xinghuan-canvas-worker.service = active`
  - `http://127.0.0.1:18100/api/status = ok`
  - `npm run verify:release-preflight = ok`
  - `npm run verify:request-chain-observability = ok`
  - `npm run verify:system-observability = ok`
  - `readlink -f /opt/apps/xinghuan-canvas/current`
    - `/opt/apps/xinghuan-canvas/releases/20260617-environment-sync-prod-r2-795c1e5`

影响:

- gray / production 现在都已切到 clean release：
  - gray：`20260617-environment-sync-gray-r2-795c1e5`
  - production：`20260617-environment-sync-prod-r2-795c1e5`
- 这批 environment sync 的线上版本与提交 SHA 已重新对齐，不再依赖旧的 dirty 发布包。

风险:

- `verify:system-observability` 仍报告生产近 24h 内存在失败任务和少量 revision conflict，这属于运行态存量告警，不是本次部署失败。
- 主 worktree 仍残留未提交的后台助手相关修改，后续仍需分批收口。

下一步:

- 继续清理主 worktree 中尚未收口的后台助手 / 文档变更，恢复主线可发布状态。
- 后续新的 gray / production 发布应继续坚持从干净 release worktree 打包，避免再次出现 dirty 包。

### 环境同步页文案收口，并将服务商同步升级为包含关联模型

目标:

- 解决环境同步页操作文案过于工程化、后台使用者不易理解的问题。
- 解决“同步服务商只同步主配置、不同步关联模型”的功能缺口。
- 保持当前 Provider/模型独立数据结构不被打乱，同时让环境同步在操作层表现为整包同步。

变更:

- 更新共享环境同步契约：
  - `packages/shared/src/environment-sync.ts`
  - 新增 `EnvironmentSyncProviderModelSummary`
  - `EnvironmentSyncPreviewRow` 新增 `providerModelSummary`
- 更新后端环境同步服务：
  - `apps/api/src/environment-sync-service.ts`
  - 环境快照从 `users + providers` 扩展为 `users + providers + models`
  - 服务商预览差异现在同时比较服务商主配置和关联模型配置
  - 模型自然键明确为 `provider.name + capability + modelId`
- 更新 API 环境同步写入链路：
  - `apps/api/src/server.ts`
  - 内部同步接口新增 `models` 受控传输
  - 勾选服务商同步时，目标环境会同步写入该服务商下的全部模型配置
- 更新后台环境同步页：
  - `apps/admin/src/admin-environment-sync-panel.tsx`
  - 将“源环境 / 目标环境 / 生成预览 / 执行同步”等说法改为更直白的运营语义
  - 服务商列表标题改为“服务商（含模型）”
  - 行内显示左右模型总数、仅左侧、配置不同、完全一致、仅右侧摘要
- 同步更新文档：
  - `docs/superpowers/specs/2026-06-17-gray-production-sync-design.md`
  - `docs/superpowers/plans/2026-06-17-gray-production-sync-plan.md`
  - `docs/project-atlas/interfaces-and-dataflow.md`
  - `docs/prd/v0.1.0/progress.md`
  - `README.md`
  - `AGENTS.md`

验证:

- `node scripts/verify-admin-environment-sync-contract.mjs`
- `node scripts/verify-environment-sync-service.mjs`
- `npm run build -w @xinghuan/shared`
- `npm run build -w @xinghuan/api`
- `npm run build -w @xinghuan/admin`

影响:

- 管理员在后台勾选服务商同步时，实际会同步服务商主配置与其全部关联模型配置。
- 当前环境同步页的术语更接近后台运营场景，减少误判和误操作成本。

风险:

- 当前版本仍不执行目标环境多余服务商或模型的自动删除，只做新增和覆盖。
- 这次只完成本地实现与验证，尚未做新的 gray / production 发布。

下一步:

- 将本地提交后的版本推送到灰度并做真实双环境联调，重点复验服务商+模型联动同步。
- 如后续出现更细粒度操作诉求，再评估是否补“模型独立同步模式”作为高级入口。

### gray / production 环境同步能力已完成发布、双向联调与台账收口

目标:

- 将后台“环境同步”能力真正发布到 gray / production，而不是只停留在本地实现。
- 为两端补齐环境变量，打通内部受控同步接口。
- 完成真实双向预览与写回 smoke，并把当前 release / 变量 / 验收状态同步回主入口文档。

变更:

- 服务器环境文件已补齐：
  - gray：`/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`
  - production：`/opt/apps/xinghuan-canvas/shared/canvas.env`
  - 新增：
    - `XINGHUAN_ENVIRONMENT_SYNC_TOKEN`
    - `XINGHUAN_GRAY_API_BASE_URL=http://127.0.0.1:18200`
    - `XINGHUAN_PRODUCTION_API_BASE_URL=http://127.0.0.1:18100`
- 发布：
  - gray release：`20260617-environment-sync-gray-r1-f881c28-dirty`
  - production release：`20260617-environment-sync-prod-r1-f881c28-dirty`
- 当前线上指针：
  - gray current：
    - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260617-environment-sync-gray-r1-f881c28-dirty`
  - production current：
    - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260617-environment-sync-prod-r1-f881c28-dirty`
- 新增运维记录：
  - `ops/environment-sync-release-2026-06-17.md`
- 同步更新主入口：
  - `README.md`
  - `AGENTS.md`
  - `MEMORY.md`
  - `ops/README.md`
  - `ops/server-connection.md`
  - `docs/prd/README.md`
  - `docs/prd/v0.1.0/progress.md`

验证:

- 本地：
  - `node scripts/verify-admin-environment-sync-contract.mjs = ok`
  - `node scripts/verify-environment-sync-service.mjs = ok`
  - `node scripts/verify-environment-sync-smoke-contract.mjs = ok`
  - `npm run build -w @xinghuan/shared = ok`
  - `npm run build -w @xinghuan/api = ok`
  - `npm run build -w @xinghuan/admin = ok`
  - `npm run build:single-port = ok`
  - `npm run verify:release-package-contract = ok`
- gray：
  - `npm run verify:release-preflight = ok`
  - `npm run verify:request-chain-observability = ok`
  - `npm run verify:system-observability = ok`
  - `https://canvas-next.hhh2121.xyz/api/status = 200`
- production：
  - `npm run verify:release-preflight = ok`
  - `npm run verify:request-chain-observability = ok`
  - `npm run verify:system-observability = ok`
  - `https://canvas.hhh2121.xyz/api/status = 200`
- 双向真实联调：
  - `gray -> production` 预览成功，使用真实 provider `柏拉图` 做 apply smoke，`status = applied`
  - `production -> gray` 预览成功，使用真实 provider `柏拉图` 做 apply smoke，`status = applied`
  - 两边后台审计均已写入 `environment_sync.apply`
  - 后续标准脚本已补齐：
    - `npm run verify:environment-sync-smoke`
  - 实跑结果：
    - gray 本机 `18200` = ok
    - production 本机 `18100` = ok

影响:

- 当前 gray / production 都具备后台“环境同步”能力，不再需要靠人工比库或临时脚本同步用户 / 服务商。
- 当前文档主入口已重新对齐真实线上状态，避免继续显示旧 release。
- 当前环境同步能力已经有真实联调证据，不再只是“代码实现完了”的状态。
- 当前环境同步现在也已有固定脚本入口，后续发版后不需要再手工拼联调命令。

风险:

- 当前用户 / 服务商自然键仍分别使用：
  - 用户：`email`
  - 服务商：`name`
- 如果后续出现同名服务商但不同实际接入点，现有匹配策略需要升级。
- 本轮发布过程中暴露出两个流程风险：
  - `scp` 与远端解包并行容易出现 tar 先执行、包尚未到达 `/tmp`
  - 远端多行命令若带 CRLF，`systemctl` / `npm run` 会把 `\\r` 当成命令名一部分

下一步:

- 若继续扩展该能力，应优先补“更安全的冲突识别键”和“更明确的同步对象范围约束”。
- 后续可再补专门的联调脚本，把当前手工 smoke 固化成标准验收入口。

### 灰度 / 正式环境同步后台能力已完成本地实现与构建验收

目标:

- 为 gray / production 后台补一套真正可执行的用户 / 服务商双向同步能力。
- 避免后续再靠人工数据库比对或临时脚本做环境对齐。

变更:

- 共享契约新增：
  - `packages/shared/src/environment-sync.ts`
- 后台管理端新增：
  - `apps/admin/src/admin-environment-sync-panel.tsx`
  - `apps/admin/src/admin-view-model.ts`
  - `apps/admin/src/admin-types.ts`
  - `apps/admin/src/main.tsx`
- API 新增：
  - `apps/api/src/environment-sync-service.ts`
  - `apps/api/src/server.ts`
  - 管理端路由：
    - `/api/admin/environment-sync/preview`
    - `/api/admin/environment-sync/apply`
  - 内部跨环境路由：
    - `/api/internal/environment-sync/snapshot`
    - `/api/internal/environment-sync/apply`
- 验证脚本新增：
  - `scripts/verify-admin-environment-sync-contract.mjs`
  - `scripts/verify-environment-sync-service.mjs`
- 环境模板补充：
  - `config/canvas-next.env.example`
  - `config/canvas-production.env.example`
  - 新增：
    - `XINGHUAN_ENVIRONMENT_SYNC_TOKEN`
    - `XINGHUAN_GRAY_API_BASE_URL`
    - `XINGHUAN_PRODUCTION_API_BASE_URL`
- atlas / ops 补充：
  - `docs/project-atlas/interfaces-and-dataflow.md`
  - `ops/README.md`

验证:

- `node scripts/verify-admin-environment-sync-contract.mjs = ok`
- `node scripts/verify-environment-sync-service.mjs = ok`
- `npm run build -w @xinghuan/admin = ok`
- `npm run build -w @xinghuan/api = ok`

影响:

- 后台现在已有独立“环境同步”页，支持灰度与正式之间的双向预览和选择性同步。
- 用户以 `email` 为自然键，服务商以 `name` 为自然键做比对。
- 敏感字段不会在预览中直接回显明文，但同步写入会保留密码 hash / cipher 和 Provider API key cipher。

风险:

- 当前仅完成本地实现与构建验收，尚未做真实 gray / production 联调与放行记录。
- 该能力依赖两端环境同时配置相同的 `XINGHUAN_ENVIRONMENT_SYNC_TOKEN`，否则跨环境调用会被拒绝。

下一步:

- 做一次真实 gray / production 联调验收。
- 补灰度发布记录与必要的 acceptance checklist。

### 后台 AI 助手结构化卡片、剪贴板图片上传与协议文档已推送灰度

目标:

- 把右侧后台 AI 助手的 section card 渲染和输入区剪贴板图片上传能力推到 gray。
- 把 Provider 协议与请求体设计文档一起带入灰度，确保后续接新平台时有统一入口。

变更:

- 共享层新增：
  - `packages/shared/src/assistant-message-blocks.ts`
  - `packages/shared/src/assistant-chat.ts`
- 后台 AI 助手改造：
  - `apps/admin/src/admin-assistant-panel.tsx`
  - `apps/admin/src/admin-assistant-message-blocks.ts`
  - `apps/admin/src/admin-types.ts`
  - `apps/admin/src/styles.css`
- API 契约更新：
  - `apps/api/src/server.ts`
- 文档补齐：
  - `docs/project-atlas/provider-protocol-and-request-body-design.md`
  - `docs/project-atlas/README.md`
  - `docs/project-atlas/interfaces-and-dataflow.md`
  - `docs/documentation-governance.md`
- 运维记录新增：
  - `ops/admin-assistant-structure-gray-release-2026-06-17.md`

验证:

- `npm run build:single-port = ok`
- `node scripts/verify-admin-assistant-ui-contract.mjs = ok`
- `node scripts/verify-admin-assistant-chat.mjs = ok`
- `npm run verify:release-package-contract = ok`
- `npm run verify:release-preflight = ok`
- `npm run verify:request-chain-observability = ok`
- `npm run verify:system-observability = ok`

发布:

- gray release：`20260617-admin-assistant-structure-gray-r3-f881c28`
- gray current：`/opt/apps/xinghuan-canvas-next/releases/20260617-admin-assistant-structure-gray-r3-f881c28`
- gray API / Worker：均为 `active`
- gray 公网：`https://canvas-next.hhh2121.xyz/api/status = 200`

影响:

- 后台 AI 助手现在是 section card 结构，不再只是文本块平铺。
- 输入区现在可直接粘贴剪贴板图片，减少人工先存文件再上传的步骤。
- 协议设计已进入 atlas，后续平台接入可以从系统层文档开始，而不是继续靠口头记忆。

风险:

- `verify:system-observability` 仍显示历史任务失败和少量 revision conflict 告警，这是运行态观测结论，不是本次部署失败。

下一步:

- 如果需要，我可以继续把 production 也同步到这版。

### 后台 AI 助手结构化卡片渲染、剪贴板图片上传与协议设计文档路由补齐

目标:

- 把右侧后台 AI 助手从“文本块解析”进一步收口成真实的结构化 section card 渲染。
- 让输入区支持直接粘贴剪贴板图片上传，而不只依赖本地文件选择。
- 把 Provider 协议与请求体设计补进 atlas，总结成后续平台接入可复用的系统层文档。

变更:

- 共享层新增并统一导出：
  - `packages/shared/src/assistant-message-blocks.ts`
  - `packages/shared/src/assistant-chat.ts`
- 后台 AI 助手改造：
  - `apps/admin/src/admin-assistant-panel.tsx`
  - `apps/admin/src/admin-assistant-message-blocks.ts`
  - `apps/admin/src/admin-types.ts`
  - `apps/admin/src/styles.css`
- API 助手返回契约改造：
  - `apps/api/src/server.ts`
  - 后台聊天结果现在显式返回 `blocks`
  - Hermes 提示词强化为“明确分段 + fenced code block + JSON 独立代码块”
- 协议设计文档补齐：
  - `docs/project-atlas/provider-protocol-and-request-body-design.md`
  - `docs/project-atlas/README.md`
  - `docs/project-atlas/interfaces-and-dataflow.md`
  - `docs/documentation-governance.md`
- 验证脚本补强：
  - `scripts/verify-admin-assistant-ui-contract.mjs`
  - `scripts/verify-admin-assistant-chat.mjs`

验证:

- `node scripts/verify-admin-assistant-ui-contract.mjs = ok`
- `node scripts/verify-admin-assistant-chat.mjs = ok`
- `npm run build -w @xinghuan/shared = ok`
- `npm run build -w @xinghuan/api = ok`
- `npm run build -w @xinghuan/admin = ok`
- `codegraph sync = ok`

影响:

- 右侧后台 AI 助手现在不再只是把解析后的块平铺出来，而是按 section 分组成真实卡片，标题、列表、代码块和正文边界更清晰。
- 后台输入区现在支持直接粘贴截图或剪贴板图片，并复用现有上传链路挂到对话上下文。
- Provider 接入方法不再只散落在发布记录和记忆文件里，atlas 现在有单独的协议与请求体设计入口，方便后续接入新平台时复用。

风险:

- `verify-admin-assistant-chat.mjs` 的运行态 smoke 因本地 `18200` 不可达而跳过了在线聊天请求，这轮主要证据仍以静态契约和构建通过为主。
- 当前卡片化依赖标题分段；若上游助手输出完全不分段，仍会退回到单 section 卡片，但不会回退成一整块裸文本。

下一步:

- 如需继续推进，可补一次实际浏览器验收，确认右侧后台 AI 助手在真实长回答下的视觉层级与滚动体验。
- 后续若再扩展后台助手 block 类型，例如表格或告警卡，需要同步扩展共享 block 模型和契约脚本。

### 柏拉图 multipart 视频接入与结构化 AI 助手已完成灰度和正式发布

目标:

- 将柏拉图 Provider 的视频接入从“OpenAI 风格 JSON 猜配置”收口到真实可执行协议。
- 让后台 API 接入助手和右侧后台 AI 助手不再输出散乱文本，而是输出结构化接入方案。
- 在 gray 和 production 都做真实 6 秒视频任务验收，确认不是只在本地契约层通过。

变更:

- 新增通用 Provider 请求体能力：
  - `apps/api/src/provider-request-body.ts`
  - `apps/worker/src/worker-provider-request-body.ts`
- 更新 API / Worker 视频链路：
  - `apps/api/src/apimart-video-adapter.ts`
  - `apps/worker/src/worker-apimart-video-adapter.ts`
  - `apps/api/src/external-proxy.ts`
  - `apps/worker/src/worker.ts`
  - `apps/api/src/server.ts`
- 当前柏拉图模型分流规则已落地：
  - `grok-1.5-video-6s/10s/15s`
    - `/v1/videos`
    - `multipart/form-data`
    - `input_reference` 文件上传
    - `size = {video_size}`
  - `grok-imagine-video-1.5-preview`
    - `/v2/videos/generations`
    - JSON body
- 后台接入助手结构化输出已补齐：
  - `requestBodyMode`
  - `requestContentType`
  - `requestFileFields`
  - `requestValueTemplates`
  - 结构化卡片式展示与代码块格式保留
- 新增/更新验证与运维脚本：
  - `scripts/verify-apimart-video-adapter-contract.ts`
  - `scripts/verify-assistant-provider-template-contract.mjs`
  - `scripts/verify-admin-assistant-ui-contract.mjs`
  - `scripts/verify-plato-gray-video-task.mjs`
  - `scripts/sync-plato-provider-config.mjs`
- 发布：
  - gray：`20260617-plato-multipart-gray-r2-427237e-dirty`
  - production：`20260617-plato-multipart-prod-r1-427237e-dirty`
- 新增发布记录：
  - `ops/plato-provider-rollout-2026-06-17.md`

验证:

- 本地：
  - `codegraph status = Index is up to date`
  - `npx tsx scripts/verify-apimart-video-adapter-contract.ts = ok`
  - `node scripts/verify-assistant-provider-template-contract.mjs = ok`
  - `node scripts/verify-admin-assistant-ui-contract.mjs = ok`
  - `npm run build -w @xinghuan/api = ok`
  - `npm run build -w @xinghuan/worker = ok`
  - `npm run build -w @xinghuan/admin = ok`
  - `npm run build:single-port = ok`
  - `npm run verify:release-package-contract = ok`
- gray：
  - `readlink -f /opt/apps/xinghuan-canvas-next/current`
    - `/opt/apps/xinghuan-canvas-next/releases/20260617-plato-multipart-gray-r2-427237e-dirty`
  - `npm run verify:release-preflight = ok`
  - `npm run verify:request-chain-observability = ok`
  - `npm run verify:system-observability = ok`
  - `https://canvas-next.hhh2121.xyz/api/status = 200`
  - 真实任务验收：
    - 模型：`grok-1.5-video-6s`
    - `status = succeeded`
    - 已返回并落库本地视频
- production：
  - `readlink -f /opt/apps/xinghuan-canvas/current`
    - `/opt/apps/xinghuan-canvas/releases/20260617-plato-multipart-prod-r1-427237e-dirty`
  - `npm run verify:release-preflight = ok`
  - `npm run verify:request-chain-observability = ok`
  - `npm run verify:system-observability = ok`
  - `https://canvas.hhh2121.xyz/api/status = 200`
  - 真实任务验收：
    - 模型：`grok-1.5-video-6s`
    - 首次因上游繁忙失败
    - 重试后 `status = succeeded`
    - 已返回并落库本地视频

影响:

- 柏拉图当前不再依赖错误的统一 JSON 视频协议假设。
- 后续新增类似“同 Provider 下不同模型走不同提交端点 / 不同请求体格式 / 不同文件字段”的平台时，可以复用当前结构，而不是继续在节点或 adapter 内堆硬编码 if/else。
- 后台 AI 助手从“猜配置”提升到“输出结构化接入方案”，后续接入别的平台时可直接复用这套展示和字段。

风险:

- 当前 gray / production 两个 release 都是基于已验证工作树打包，release 名里保留了 `dirty`，说明当时并不是从已提交 commit 直接发包。
- 柏拉图上游仍可能返回“官方负载大，请尝试重新生成”，这属于上游容量波动，不等价于本地接入失败。
- 真实验收对参考图尺寸仍有最低可用性要求，过小图片可能被上游拒绝。

下一步:

- 继续把结构化接入方案字段推广到更多 Provider 模板和助手输出路径。
- 将当前工作树整理为可提交状态，并补齐这次发布与提交 SHA 的最终对齐关系。

### atlas 项目总纲批次已完成灰度与正式发布

目标:

- 把当前 HEAD 的项目总纲 atlas、文档入口收束、CodeGraph hook、生成库素材访问链路与 release gate 闭环同步推进到 production。
- 先确认灰度已承接最新 HEAD，再基于同一提交完成正式发布。
- 把 gray / production 的当前入口文档同步到真实线上状态，避免主入口继续停留在旧 release。

变更:

- 线上现状核对：
  - gray current：
    - `/opt/apps/xinghuan-canvas-next/releases/20260617-atlas-gray-r2-2f0a88f`
  - production current（发布前）：
    - `/opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-governance-batch3-prod-r2`
- 本地执行：
  - `codegraph status`
  - `npm run build:single-port`
  - `npm run verify:release-package-contract`
  - `npm run package:release -- 20260617-atlas-prod-r1-2f0a88f`
- 服务器执行：
  - 上传 `dist-release/20260617-atlas-prod-r1-2f0a88f.tar.gz`
  - 解包到 `/opt/apps/xinghuan-canvas/releases/20260617-atlas-prod-r1-2f0a88f`
  - `npm ci`
  - 加载 `shared/canvas.env` 后执行 `npm run db:migrate`
  - 切换 `/opt/apps/xinghuan-canvas/current`
  - 重启：
    - `xinghuan-canvas.service`
    - `xinghuan-canvas-worker.service`
    - `xinghuan-canvas-output-prune.timer`
- 新增发布记录：
  - `ops/atlas-gray-release-2026-06-17.md`
  - `ops/atlas-production-release-2026-06-17.md`
- 同步更新：
  - `README.md`
  - `AGENTS.md`
  - `MEMORY.md`
  - `docs/prd/README.md`
  - `docs/prd/v0.1.0/progress.md`
  - `ops/README.md`
  - `ops/server-connection.md`

验证:

- 本地：
  - `codegraph status = Index is up to date`
  - `npm run build:single-port = ok`
  - `npm run verify:release-package-contract = ok`
  - `npm run package:release -- 20260617-atlas-prod-r1-2f0a88f = ok`
- production 服务器：
  - `readlink -f /opt/apps/xinghuan-canvas/current`
    - `/opt/apps/xinghuan-canvas/releases/20260617-atlas-prod-r1-2f0a88f`
  - `systemctl is-active xinghuan-canvas`
    - `active`
  - `systemctl is-active xinghuan-canvas-worker`
    - `active`
  - `systemctl is-active xinghuan-canvas-output-prune.timer`
    - `active`
  - `curl http://127.0.0.1:18100/api/status`
    - `environment = production`
  - 加载 `shared/canvas.env` 后执行：
    - `npm run verify:release-preflight = ok`
    - `npm run verify:request-chain-observability = ok`
    - `npm run verify:system-observability = ok`
  - `curl -i -H "x-request-id: prod-gate-check" http://127.0.0.1:18100/api/status`
    - 响应头保留 `x-request-id: prod-gate-check`
- 公网：
  - `https://canvas.hhh2121.xyz/api/status = 200`
  - `https://canvas.hhh2121.xyz/ = 200`

影响:

- 当前 gray active release 已明确为：
  - `20260617-atlas-gray-r2-2f0a88f`
- 当前 production active release 已从 `20260615-phase-e-observability-governance-batch3-prod-r2` 切到：
  - `20260617-atlas-prod-r1-2f0a88f`
- atlas 项目总纲、文档路由收束、CodeGraph hook 和 release gate 闭环现在不只在 gray，而是已经进入 production current。
- 当前主入口文档与线上 release 指针已重新对齐。

风险:

- `verify:system-observability` 当前仍报告：
  - `tasks.health.status = warning`
  - `audits.conflicts.health.status = critical`
  这些是当前生产运行态观测结论，不是本次发布失败。
- 当前 production gate 如果不先加载 `/opt/apps/xinghuan-canvas/shared/canvas.env`，脚本会默认回落到 `18200`，误打 gray。

下一步:

- 继续按当前阶段口径推进外部通知闭环与 requestId 覆盖率提升。
- 后续如再发布 atlas/治理类变更，优先保持 `README / AGENTS / MEMORY / PRD / ops` 五个主入口与 release 同轮更新。

### 补项目接口清单与核心 API 导航页

目标:

- 给 AI 和协作者补一份能快速查接口入口、鉴权边界和排障起点的高层 API 导航页。
- 避免后续每次看接口都只能直接扎进 `apps/api/src/server.ts` 全文硬读。

变更:

- 新增：
  - `docs/project-atlas/api-navigation.md`
  - `docs/superpowers/plans/2026-06-17-api-navigation-atlas.md`
- 更新：
  - `docs/project-atlas/README.md`
  - `docs/documentation-governance.md`

验证:

- `rg -n "api-navigation" docs/project-atlas/README.md docs/documentation-governance.md DEVLOG.md`
- `npm run verify:release-gate-docs-contract`

影响:

- 当前 `project-atlas` 已补齐：
  - 结构
  - 环境
  - 接口导航
  - 数据流
  - 排障
  - 服务器维护
  - 台账规则
  - 仓库清洁规则
- 后续接口新增或鉴权边界变化时，除了改代码和脚本，也需要同步更新 `api-navigation.md`

下一步:

- 如继续推进，可再补“后台数据模型导航页”或“Worker 执行链导航页”，进一步减少直接翻超长文件的成本。

### 补后台数据模型导航页与 Worker 执行链导航页

目标:

- 把当前数据库迁移、主要表域和 Worker 执行链补成结构化导航，降低后续排障和增量开发的理解成本。
- 避免 AI 每次都只能靠扫 `server.ts` 和 `worker.ts` 的超长实现来重建结构。

变更:

- 新增：
  - `docs/project-atlas/data-model-navigation.md`
  - `docs/project-atlas/worker-execution-chain.md`
  - `docs/superpowers/plans/2026-06-17-data-model-and-worker-atlas.md`
- 更新：
  - `docs/project-atlas/README.md`
  - `docs/documentation-governance.md`

验证:

- `rg -n "data-model-navigation|worker-execution-chain" docs/project-atlas/README.md docs/documentation-governance.md DEVLOG.md`
- `npm run verify:release-gate-docs-contract`

影响:

- `project-atlas` 现在不只覆盖结构、环境、接口和排障，还补齐了：
  - 数据模型导航
  - Worker 执行链导航
- 后续如果新增迁移、任务 capability、状态机语义或输出落库方式变化，除了改代码和发布记录，也要同步更新这两份文档。

下一步:

- 如继续推进，可以再补“前端节点系统导航页”或“后台面板导航页”。

### 文档治理收束与发布闭环批次已推到灰度

目标:

- 将当前 worktree 已完成但尚未发布到 gray 的收束改动正式推到灰度。
- 确认文档治理、CodeGraph hook、生成库素材访问链路和 release gate 脚本闭环都进入当前 gray release。
- 同步更新主入口状态，避免 release 已切换但入口文档仍停在旧版本。

变更:

- 本地执行：
  - `npm run build:single-port`
  - `npm run verify:release-package-contract`
  - `npm run package:release -- 20260617-doc-archive-governance-gray-r1-2737811`
- 服务器执行：
  - 上传 `dist-release/20260617-doc-archive-governance-gray-r1-2737811.tar.gz`
  - 解包到 `/opt/apps/xinghuan-canvas-next/releases/20260617-doc-archive-governance-gray-r1-2737811`
  - `npm ci`
  - 加载 `shared/canvas-next.env` 后执行 `npm run db:migrate`
  - 切换 `current`
  - 重启：
    - `xinghuan-canvas-next.service`
    - `xinghuan-canvas-next-worker.service`
- 新增灰度发布记录：
  - `ops/doc-archive-governance-gray-release-2026-06-17.md`
- 同步更新：
  - `README.md`
  - `AGENTS.md`
  - `MEMORY.md`
  - `docs/prd/README.md`
  - `docs/prd/v0.1.0/progress.md`
  - `ops/README.md`

验证:

- 本地：
  - `npm run build:single-port = ok`
  - `npm run verify:release-package-contract = ok`
- gray 服务器：
  - `readlink -f /opt/apps/xinghuan-canvas-next/current`
    - `/opt/apps/xinghuan-canvas-next/releases/20260617-doc-archive-governance-gray-r1-2737811`
  - `npm run verify:release-preflight = ok`
  - `npm run verify:request-chain-observability = ok`
  - `npm run verify:system-observability = ok`
  - `curl http://127.0.0.1:18200/api/status`
    - `environment = gray`
  - `https://canvas-next.hhh2121.xyz/api/status`
    - `200`

影响:

- 当前 gray active release 已从 `20260616-grsai-nano-error-ux-gray-r1-ee04792` 切到 `20260617-doc-archive-governance-gray-r1-2737811`。
- 文档治理和 release gate 脚本现在不再只是本地提交状态，而是已经进入 gray current。
- 当前生产 release 仍保持：
  - `20260615-phase-e-observability-governance-batch3-prod-r2`

风险:

- `verify:system-observability` 当前仍会报告历史 7d 失败累计偏高，这是运行态观测结论，不是本次发布阻塞。
- gray / production 数据库目标仍未彻底拆分，这个风险口径没有因为本次 gray 发布而消失。

下一步:

- 补做“项目缩影/架构索引”方案，收束 AI 阅读入口。
- 规整 `AGENTS.md` / `MEMORY.md` 的分层与索引模板。
- 基于 gray 结果决定是否继续推进正式生产。

## 2026-06-16

### Phase E 本地观测验收补样复核与脚本同源修正

目标:

- 复核 `verify-request-chain-observability` 与 `verify-system-observability` 在当前 worktree 上的真实失败原因。
- 区分“后端认证/审计链路故障”和“本地 file-mode 验收脚本未对齐 CSRF/串行约束”的假失败。
- 收口当前几份仍停留在 CSRF 上线前习惯的验证脚本，避免后续再次误判。

排查结论:

- `admin-login -> admin-me -> audit` 主链在隔离本地实例上是正常的。
- 使用独立数据目录起本地实例：
  - `XINGHUAN_VERIFY_BASE_URL=http://127.0.0.1:18220`
  - `XINGHUAN_DATA_DIR=.tmp/obs-debug-data`
- 在该隔离实例上，以下验证已通过：
  - `node scripts/verify-request-chain-observability.mjs`
  - `node scripts/verify-system-observability.mjs`
  - `node scripts/verify-admin-task-pagination.mjs`
- 先前现场看到的失败，主要不是后端认证链路损坏，而是两类本地验收噪音：
  1. 部分旧脚本对 `POST` / `PATCH` / `DELETE` 没有自动补 same-origin `Origin`
  2. 多个依赖登录态和 file-mode JSON 的脚本并行运行时，会互相踩本地会话与审计样本，出现假性 `AUTH_REQUIRED`、假性“缺少 audit sample”

变更:

- 更新以下脚本，使写请求统一自动带同源 `Origin`，对齐 `Phase C` CSRF 规则：
  - `scripts/verify-admin-auth-passwords.mjs`
  - `scripts/verify-admin-assistant-chat.mjs`
  - `scripts/verify-admin-assistant-workbench.mjs`
  - `scripts/verify-canvas-assistant-chat.mjs`
- 同步修正 `verify-admin-assistant-workbench.mjs` 的静态文案断言，使其匹配当前真实 UI 提示：
  - 从旧文案“仍需点击保存才会生效”
  - 更新为当前文案“仍需点击保存；保存后请继续执行验证地址、拉取模型和模型测试。”

验证:

- 隔离实例串行验证通过：
  - `node scripts/verify-admin-auth-passwords.mjs`
  - `node scripts/verify-admin-assistant-workbench.mjs`
  - `node scripts/verify-canvas-assistant-chat.mjs`
  - `node scripts/verify-system-observability.mjs`
  - `node scripts/verify-request-chain-observability.mjs`
  - `node scripts/verify-admin-task-pagination.mjs`
- 关键经验复核：
  - 同一批本地观测/后台/登录态脚本应串行执行，不应并行打到同一 file-mode 实例
  - 若要排除本地数据干扰，优先起隔离数据目录实例再验

影响:

- 当前更准确的阶段判断是：
  - `Phase E` 本地观测链路本身没有重新退化
  - 需要收口的是脚本维护口径和本地验收方式
- 后续凡是涉及 `admin-login`、后台写接口、助手写接口、任务写接口的本地脚本，都要默认检查是否已随 `withCookie(...)` 自动补同源 `Origin`
- 本地 file-mode 只适合做单链路、串行 smoke；涉及多脚本并发或稳定性结论时，应优先切隔离实例或 PostgreSQL 环境

### 文档治理与运维归档入口继续收束

目标:

- 把当前 worktree 的文档治理和归档入口从“能看出历史”收束到“能快速判断当前状态”。
- 让 `ops/README.md` 不再长期平铺已经被后续阶段覆盖的旧记录。
- 为后续脏工作区分批和热点文件拆分先落一份正式计划。

变更:

- 新增正式计划：
  - `docs/superpowers/plans/2026-06-16-worktree-cleanup-and-document-archive-closure.md`
- 新增运维归档批次：
  - `ops/archive/2026-06-assistant-and-ui-rollout/`
  - `ops/archive/2026-06-provider-and-infra-rollout/`
- 已把以下早期记录从 `ops/` 主入口逐个移入归档批次：
  - `current-fix-cleanup-progress-2026-06-08.md`
  - `assistant-hermes-gray-2026-06-08.md`
  - `canvas-assistant-ui-gray-2026-06-09.md`
  - `generation-count-release-2026-06-10.md`
  - `video-json-guard-gray-2026-06-12.md`
  - `provider-generation-task-gray-release-2026-06-12.md`
  - `provider-task-queue-concurrency-gray-2026-06-12.md`
  - `provider-task-queue-concurrency-production-2026-06-12.md`
  - `modelscope-image-protocol-release-2026-06-12.md`
  - `cloudflare-origin-lock-2026-06-12.md`
  - `files-origin-seal-plan-2026-06-12.md`
  - `files-origin-seal-execution-checklist-2026-06-12.md`
  - `provider-files-files-domain-cutover-2026-06-12.md`
- 更新：
  - `ops/README.md`
  - `ops/archive/README.md`
  - `docs/documentation-governance.md`
  - `AGENTS.md`
  - `MEMORY.md`

影响:

- 当前运维主入口已经更接近“当前值守 / 当前放行 / 最新热修复”的真实使用方式。
- 历史材料仍保留，但查看顺序已经从“在主入口里猜哪一份最新”改成“先看主入口，再按归档批次追历史”。
- 后续每次出现新 release 或新阶段切换时，都必须在同轮推进内决定旧记录是否归档，否则文档治理视为未完成。

补充:

- 已继续把产品入口口径同步到 `README.md` / `docs/prd/README.md` / `docs/prd/v0.1.0/progress.md`。
- 其中 `progress.md` 的当前灰度 active release 已从旧的 `20260615-phase-e-observability-governance-batch3-gray-r2` 校正为当前真实灰度 `20260616-grsai-nano-error-ux-gray-r1-ee04792`，避免入口之间继续出现 phase 已更新但 release 仍停在旧版本的情况。

### 已将此前 GRSAI nano 修复批次推到灰度

目标:

- 把前面已经完成的 `GRSAI` `nano-banana` 路由修复、图像节点错误透传修复和输出文本流修复正式切到 gray current。

发布:

- gray release：`20260616-grsai-nano-error-ux-gray-r1-ee04792`
- gray current：`/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260616-grsai-nano-error-ux-gray-r1-ee04792`
- 服务：
  - `xinghuan-canvas-next.service` => `active`
  - `xinghuan-canvas-next-worker.service` => `active`

验证:

- `npm run build:single-port`
- `npm run verify:release-package-contract`
- `npm run package:release -- 20260616-grsai-nano-error-ux-gray-r1-ee04792`
- gray 服务器：
  - `npm run db:migrate`
  - `npm run verify:release-preflight`
  - `npm run verify:request-chain-observability`
  - `npm run verify:system-observability`

影响:

- 本次灰度已经把这批前置修复切到当前运行态。
- 中间曾遇到一次 `db:migrate` 读取不到数据库配置的情况，原因是执行顺序里没有先 `source /opt/apps/xinghuan-canvas-next/shared/canvas-next.env`；补上环境加载后已恢复正常。
- 当前灰度 `release-preflight` 和观测 gate 已完成验证，后续如再继续改动，可以直接在这个灰度 current 上追加。

### Phase E 高频后台读取链路 requestId 审计补样收口

目标:

- 把 `Phase E` 的 `requestId` 覆盖率提升从“只覆盖写链路和少量系统读取”推进到“覆盖高频后台读接口”。
- 让系统观测中的覆盖率不再主要依赖临时测试写入样本，而是能从日常后台读取流量中持续得到更真实的审计样本。

变更:

- `apps/api/src/server.ts`
  - 为以下后台高频读接口补齐 `appendAudit(...)`，并继承当前请求的 `requestId`：
    - `GET /api/auth/admin-me` -> `auth.admin_me`
    - `GET /api/admin/summary` -> `summary.read`
    - `GET /api/admin/users` -> `users.read`
    - `GET /api/admin/sessions` -> `sessions.read`
    - `GET /api/admin/providers` -> `providers.read`
    - `GET /api/admin/models` -> `models.read`
    - `GET /api/admin/tasks` -> `tasks.read`
  - `GET /api/admin/system` 继续保留 `system.read`
  - `admin-me` 读链路补齐 `requestContext.userId / userEmail`，保证审计样本可归属到当前后台用户
- `scripts/verify-request-chain-observability.mjs`
  - 从只验证写链路 requestId 审计，扩展为同时验证上述后台读接口审计动作
  - 统一对读取链路附带同一个 `x-request-id`
  - 在 `/api/admin/audit` 中核对读动作是否带回同一 `requestId`

验证:

- `npm run build -w @xinghuan/api`
- fresh 本地实例：`127.0.0.1:18335`
- `npm run verify:request-chain-observability`
  - 当前结果：通过
  - 读链路审计动作覆盖：
    - `auth.admin_me`
    - `summary.read`
    - `users.read`
    - `sessions.read`
    - `providers.read`
    - `models.read`
    - `tasks.read`
    - `system.read`
- `npm run verify:system-observability`
  - 当前结果：通过
  - 当前样本下 `audits.requestIdCoverageLast24hPercent = 100`
- `node scripts/verify-admin-readonly-panels-contract.mjs`
- `npm run type-check -w @xinghuan/api`

影响:

- 后台常用只读接口现在也会稳定贡献 requestId 审计样本，系统页覆盖率读数更接近日常真实流量，而不是主要依赖脚本制造的写入样本。
- `Phase E` 剩余项可以进一步收窄为“外部通知闭环”为主，`requestId` 覆盖率只需按新链路继续做选择性补强，而不是再做一轮大面积补样。

### 生成库素材访问能力收口：图片/视频预览与下载

目标:

- 为生成库补齐图片与视频素材的查看和下载能力。
- 把生成库从直接暴露裸 `fileUrl` 收口为统一的素材访问描述与内容路由。

变更:

- 新增 `apps/api/src/material-access-types.ts`
- 新增 `apps/api/src/material-access-service.ts`
- `apps/api/src/server.ts`
  - 生成库列表响应改为返回访问描述字段
  - 新增 `GET /api/materials/generation-library/:id/content`
- `apps/web/src/services/api.ts`
  - 补齐 `filename` / `previewUrl` / `downloadUrl` / `openUrl` / `canDownload` / `isExpired`
- 新增 `apps/web/src/components/GenerationLibraryPreviewOverlay.tsx`
- `apps/web/src/components/GenerationLibraryDrawer.tsx`
  - 新增查看、下载动作
  - 新增抽屉内预览层
  - 缩略图区与预览逻辑优先走 `previewUrl`
- 新增验证脚本：
  - `scripts/verify-generation-library-material-access-contract.mjs`
  - `scripts/verify-generation-library-preview-contract.mjs`
- 扩展：
  - `scripts/verify-generation-library-and-admin-assistant-layout.mjs`

验证:

- `node scripts/verify-generation-library-material-access-contract.mjs`
- `node scripts/verify-generation-library-preview-contract.mjs`
- `node scripts/verify-generation-library-and-admin-assistant-layout.mjs`
- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/web`
- `npm run build -w @xinghuan/api`
- `npm run build -w @xinghuan/web`
- 本地单端口真实联调：
  - `http://127.0.0.1:18200/`
  - 管理员登录后实测：
    - 生成库图片卡片已显示 `查看 / 下载 / 插入 / 删除`
    - 图片预览弹层已打开，`img src` 走 `disposition=inline`
    - 图片下载已返回 `200` + `Content-Disposition: attachment`
    - 生成库视频卡片已显示 `查看 / 下载 / 插入 / 删除`
    - 视频预览弹层已打开，`video src` 走 `disposition=inline`
- 验收脚本补齐：
  - `npm run verify:single-port`
    - 已补同源 `Origin / Referer`
    - 已补生成库图片/视频访问描述与内容路由验收
    - 当前结果：通过
  - `npm run verify:local-acceptance-chain`
    - 当前 `verify:single-port` 子项已通过
    - 整体仍被既有 `verify:node-acceptance-matrix` 3 条历史失败项阻塞：
      - `Image proxy signs local provider references`
      - `Video proxy signs local provider references`
      - `LLM proxy signs local image references`

影响:

- 当前这套能力只接到 `generation-library`，没有扩散到资源库或其他素材来源。
- 后续资源库、任务输出或统一素材中心接预览/下载时，应复用同一后端访问层，不再各自拼接下载地址。

### 灰度发布 GRSAI nano 路由与图像节点错误透传热修复

目标:

- 将 `GRSAI` `nano-banana` 专用提交路由、图像节点错误透传、输出文本流修复推到灰度。
- 确认当前灰度 release 切换完成，并补一轮与本次改动直接相关的最小验收。

发布:

- gray release：`20260616-grsai-nano-error-ux-gray-r1-ee04792`
- gray current：`/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260616-grsai-nano-error-ux-gray-r1-ee04792`
- 服务：
  - `xinghuan-canvas-next.service` => `active`
  - `xinghuan-canvas-next-worker.service` => `active`

变更:

- `apps/api/src/grsai-image-adapter.ts`
- `apps/api/src/external-proxy.ts`
- `apps/worker/src/worker.ts`
- `apps/web/src/components/nodes/ImageNode.tsx`
- `scripts/verify-grsai-image-adapter.ts`
- `scripts/verify-image-node-error-reporting.mjs`
- `scripts/verify-output-text-flow-contract.mjs`

验证:

- 本地：
  - `npm run verify:grsai-draw`
  - `node scripts/verify-image-node-error-reporting.mjs`
  - `node scripts/verify-output-text-flow-contract.mjs`
  - `npm run type-check -w @xinghuan/api`
  - `npm run type-check -w @xinghuan/worker`
  - `npm run type-check -w @xinghuan/web`
  - `npm run type-check -w @xinghuan/admin`
  - `npm run build:single-port`
  - `npm run verify:release-package-contract`
- gray:
  - `npm run verify:release-preflight`
  - `npm run verify:request-chain-observability`
  - `npm run verify:system-observability`
  - `/api/proxy/external/image` + `GRSAI gpt-image-2` 同步实测成功
  - `/api/proxy/external/image/task` + `GRSAI gpt-image-2` 异步实测成功，返回 `adapter=grsai-image`

备注:

- 当前灰度后台只有 `GRSAI gpt-image-2` 处于启用状态，`nano-banana-fast` / `nano-banana-2` 尚未在灰度数据中启用，因此这次灰度未做 nano 真实上游验收。
- 异步图像任务首轮复验曾收到上游 `failed + generate image failed`，随后同链路复跑通过；当前更像上游波动，不是灰度发布后链路中断。

### 修复 Phase E 观测验收脚本遗留测试 Provider 的问题

目标:

- 清掉 gray / production 后台中重新出现的 `Observability ...` / `System Observability ...` 测试服务商。
- 修正 `Phase E` 验收脚本，避免后续每次跑观测验收都把假 Provider 留在线上。

根因:

- `scripts/verify-system-observability.mjs` 会直接创建 `system-obs-provider-*`，仅用于补 requestId 样本，但没有回收。
- `scripts/verify-request-chain-observability.mjs` 会创建 `obs-provider-*` 验证 `provider.create` 审计，但也没有回收。
- `2026-06-15` 在 gray / production 都执行过这些脚本后，线上重新积累了新的测试 Provider。

变更:

- 新增回归约束：
  - `scripts/verify-observability-script-cleanup-contract.mjs`
- 调整脚本：
  - `scripts/verify-system-observability.mjs`
    - 不再创建测试 Provider
    - 改为对 `admin-login` 和 `GET /api/admin/system` 统一携带 `x-request-id`
  - `scripts/verify-request-chain-observability.mjs`
    - 保留 `provider.create` 审计验证
    - 新增 `finally` 清理，自动删除本轮创建的测试 Provider
- 线上当前 release 热补丁：
  - gray `/opt/apps/xinghuan-canvas-next/current/scripts/`
  - production `/opt/apps/xinghuan-canvas/current/scripts/`
  - 本次仅替换验收脚本文件，不涉及服务进程重启

数据清理:

- gray 删除 `14` 条 `obs-provider-*` / `system-obs-provider-*`
- production 删除 `12` 条 `obs-provider-*` / `system-obs-provider-*`
- 过程中旧脚本再次试跑遗留 `2 + 2` 条，热补丁后已再次清掉，当前两边剩余 `0`

验证:

- 本地：
  - `node scripts/verify-observability-script-cleanup-contract.mjs`
- gray current：
  - `node scripts/verify-system-observability.mjs`
  - `npm run verify:request-chain-observability`
  - 复核 `leakedProviders = 0`
- production current：
  - `node scripts/verify-system-observability.mjs`
  - `npm run verify:request-chain-observability`
  - 复核 `leakedProviders = 0`

影响与说明:

- 这次重新出现的并不是 `Agnes / Apimart / 魔搭 / mimo` 这类真实服务商回流，而是观测验收脚本本身制造的测试对象。
- 后续再跑 `Phase E` 观测验收，灰度和正式都不应再留下新的 `Observability` / `System Observability` 假 Provider。

## 2026-06-15

### Phase E 长期观测治理第三批已完成灰度/生产发布，并修正 gate 脚本默认目标

目标:

- 把 `Phase E` 剩余的“更长时间窗口趋势 + 告警闭环 + requestId 覆盖率新鲜度”推进到真实 gray / production 运行态。
- 修正 `verify:release-preflight`、`verify:request-chain-observability`、`verify:system-observability` 默认误打 `18200` 的 gate 脚本问题。

变更:

- 新增清单并执行完成：
  - `docs/superpowers/plans/2026-06-15-phase-e-observability-governance-batch-3.md`
- 后端：
  - `observability.tasks.failedLast30d`
  - `observability.tasks.trend.failed30dDailyAverageBaseline`
  - `observability.tasks.trend.failed24hVs30dDailyAverage`
  - `observability.tasks.trend.failed7dVs30dDailyAverage`
  - `observability.audits.sampledLast24h / sampledLast7d`
  - `observability.audits.requestIdCoverageLast24hPercent / requestIdCoverageLast7dPercent`
  - `observability.audits.coverageTrend.*`
  - `observability.audits.conflicts.totalLast7d / totalLast30d / trend`
  - `observability.alerts`
  - 新增 audit 补样：
    - `auth.admin_login`
    - `auth.admin_logout`
    - `system.read`
- 前端：
  - 系统面板新增：
    - `30d 失败任务`
    - `24h 失败 vs 30d 日均`
    - `7d 日均 vs 30d 日均`
    - `近24h 请求ID覆盖率`
    - `近7d 请求ID覆盖率`
    - `7d 冲突总数`
    - `30d 冲突总数`
    - `24h 冲突 vs 30d 日均`
    - `活动告警`
- 验收脚本：
  - `scripts/capture-release-preflight.mjs`
  - `scripts/verify-request-chain-observability.mjs`
  - `scripts/verify-system-observability.mjs`
  - 现在默认跟随 `XINGHUAN_API_HOST / XINGHUAN_API_PORT`
- 新增发布记录：
  - `ops/phase-e-observability-governance-batch3-gray-release-2026-06-15.md`
  - `ops/phase-e-observability-governance-batch3-production-release-2026-06-15.md`

验证:

- 本地：
  - `npm run type-check -w @xinghuan/api`
  - `npm run type-check -w @xinghuan/admin`
  - `npm run build -w @xinghuan/api`
  - `npm run build -w @xinghuan/admin`
  - `npm run build:single-port`
  - `node scripts/verify-admin-readonly-panels-contract.mjs`
  - 本地单端口实例 `127.0.0.1:18218`
  - 串行：
    - `node scripts/verify-request-chain-observability.mjs`
    - `node scripts/verify-system-observability.mjs`
    - `node scripts/capture-release-preflight.mjs`
- gray release：
  - `r1 = 20260615-phase-e-observability-governance-batch3-gray-r1`
  - `r2 = 20260615-phase-e-observability-governance-batch3-gray-r2`
  - `r2` 本机 SHA256：
    - local `84530A2947442F5CB0AD17ECCA331C58BB798C8DA54D5765AD1E8FA0CF57222A`
    - server `84530a2947442f5cb0ad17ecca331c58bb798c8da54d5765ad1e8fa0cf57222a`
  - gray 本机 gate：
    - `verify:release-preflight = ok`
    - `verify-system-observability = ok`
    - `verify:request-chain-observability = ok`
  - gray 公网 gate：
    - `verify-system-observability = ok`
    - `verify:request-chain-observability = ok`
    - `/api/status` header smoke = ok
- production release：
  - `r1 = 20260615-phase-e-observability-governance-batch3-prod-r1`
  - `r2 = 20260615-phase-e-observability-governance-batch3-prod-r2`
  - `r2` 本机 SHA256：
    - local `9FC53582A914D52E18437A98CD3631F57DE89C01B657B6E838E6BC1857B29C98`
    - server `9fc53582a914d52e18437a98cd3631f57de89c01b657b6e838e6bc1857b29c98`
  - production 本机 gate：
    - `verify:release-preflight = ok`
    - `verify-system-observability = ok`
    - `verify:request-chain-observability = ok`
  - production 公网 gate：
    - `verify-system-observability = ok`
    - `verify:request-chain-observability = ok`
    - `/api/status` header smoke = ok

结果:

- 当前灰度 `current`：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260615-phase-e-observability-governance-batch3-gray-r2`
- 当前生产 `current`：
  - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-governance-batch3-prod-r2`
- gray 当前关键状态：
  - `requestIdCoverageLast24hPercent = 64`
  - `requestIdCoverageLast7dPercent = 15`
  - `alerts.activeCount = 3`
  - `alerts.highestSeverity = critical`
- production 当前关键状态：
  - `requestIdCoverageLast24hPercent = 67`
  - `requestIdCoverageLast7dPercent = 14`
  - `alerts.activeCount = 2`
  - `alerts.highestSeverity = warning`
- 新边界说明：
  - 本地 file-mode 下会写 auth/admin 数据的验收脚本不能并行跑；应串行执行，否则可能出现假性 `AUTH_REQUIRED`

结论:

- `Phase E` 长期观测治理第三批已完成 gray / production 收口。
- 当前剩余项不再是“把系统页字段做出来”，而是：
  - 外部通知闭环
  - `requestId` 实际覆盖率继续提升

### 正式/灰度后台用户与 API 服务商已完成一次定向同步清理

目标:

- 清掉正式版与灰度后台中由验收脚本留下的测试 API 服务商。
- 按“用户以数量更多的一侧为准、服务商以数量更多的一侧为准”的规则，对齐两边后台基础数据。
- 把灰度中的 `mimo` 服务商与其模型配置补进正式环境。

变更:

- 线上数据整理：
  - production 删除 `18` 条测试服务商记录
  - gray 删除 `15` 条测试服务商记录
  - 用户以 production 为源，向 gray 同步 `7` 个用户
  - 服务商以 gray 为源，向 production 同步 `6` 个真实服务商
  - 将 `mimo` 服务商 `custom-api-1781156773691` 及其 `5` 条模型写入 production
- 同步后真实服务商清单统一为：
  - `GRSAI`
  - `ToAPIs`
  - `Apimart`
  - `Agnes`
  - `魔搭`
  - `mimo`

验证:

- 服务器事务前后计数：
  - production:
    - users: `7 -> 7`
    - providers: `23 -> 6`
    - realProviders: `5 -> 6`
    - mimoModels: `0 -> 5`
  - gray:
    - users: `6 -> 7`
    - providers: `21 -> 6`
    - realProviders: `6 -> 6`
    - mimoModels: `5 -> 5`
- 同步后复核：
  - production / gray 用户数都为 `7`
  - production / gray 真实服务商数都为 `6`
  - production / gray 均包含 `mimo`
  - production `mimo` 模型为：
    - `mimo-v2.5`
    - `mimo-v2.5-pro`
    - `mimo-v2.5-tts`
    - `mimo-v2.5-tts-voiceclone`
    - `mimo-v2.5-tts-voicedesign`

影响与说明:

- 这次是后台基础数据对齐，不涉及新的 release 切换。
- 本次仅同步用户、真实服务商和 `mimo` 相关模型；未对其它现有模型目录做覆盖式替换。
- 两边当前均已去掉 observability 验收遗留的测试服务商，后续如果再跑类似脚本，应继续避免把测试配置长期留在线上。

### Phase E 长期观测治理第二批已完成灰度/生产发布

目标:

- 把 `Phase E` 长期观测从“只返回原始计数”推进到“可直接给出健康判断和短窗口趋势”。
- 用当前已有 task/audit 数据，在不加新表的前提下补最小治理闭环。

变更:

- 新增清单并执行完成：
  - `docs/superpowers/plans/2026-06-15-phase-e-observability-governance-batch-2.md`
- 后端：
  - `observability.tasks.health`
  - `observability.tasks.trend.failed24hDailyAverageBaseline`
  - `observability.tasks.trend.failed24hVs7dDailyAverage`
  - `observability.audits.coverageHealth`
  - `observability.audits.conflicts.health`
- 前端：
  - 系统面板新增：
    - `任务健康`
    - `24h 失败 vs 7d 日均`
    - `请求ID健康`
    - `冲突健康`
- 新增灰度发布记录：
  - `ops/phase-e-observability-governance-batch2-gray-release-2026-06-15.md`
- 新增正式发布记录：
  - `ops/phase-e-observability-governance-batch2-production-release-2026-06-15.md`

验证:

- 本地：
  - `npm run type-check -w @xinghuan/api`
  - `npm run type-check -w @xinghuan/admin`
  - `npm run build -w @xinghuan/api`
  - `npm run build -w @xinghuan/admin`
  - `node scripts/verify-admin-readonly-panels-contract.mjs`
  - 本地单端口实例 `127.0.0.1:18216`
  - `node scripts/verify-system-observability.mjs`
- gray release：
  - `20260615-phase-e-observability-governance-batch2-gray-r1`
  - SHA256：
    - local `725C0E31051FC21AF0481B578935F7273D582D3B942CA112EAE22D4EDF6BC4EE`
    - server `725c0e31051fc21af0481b578935f7273d582d3b942ca112eae22d4edf6bc4ee`
  - gray 本机：
    - `verify:release-preflight = ok`
    - `verify-system-observability = ok`
    - `verify:request-chain-observability = ok`
  - gray 公网：
    - `verify-system-observability = ok`
    - `verify:request-chain-observability = ok`
- production release：
  - `20260615-phase-e-observability-governance-batch2-prod-r1`
  - SHA256：
    - local `E96722B1AA84CDE32F38FD745334E258EFEA29B03140AF78666663226321322E`
    - server `e96722b1aa84cde32f38fd745334e258efea29b03140af78666663226321322e`
  - production 本机：
    - `verify:release-preflight = ok`
    - `verify-system-observability = ok`
    - `verify:request-chain-observability = ok`
  - production 公网：
    - `verify-system-observability = ok`
    - `verify:request-chain-observability = ok`

结果:

- 当前灰度 `current`：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260615-phase-e-observability-governance-batch2-gray-r1`
- 当前生产 `current`：
  - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-governance-batch2-prod-r1`
- gray 新增治理结果：
  - `tasks.health.status = warning`
  - `tasks.trend.failed24hDailyAverageBaseline = 3`
  - `tasks.trend.failed24hVs7dDailyAverage = 4`
  - `audits.coverageHealth.status = critical`
  - `audits.conflicts.health.status = critical`
- production 新增治理结果：
  - `tasks.health.status = warning`
  - `tasks.trend.failed24hDailyAverageBaseline = 1`
  - `tasks.trend.failed24hVs7dDailyAverage = 4`
  - `audits.coverageHealth.status = critical`
  - `audits.conflicts.health.status = healthy`
- 当前更准确状态：
  - `Phase E` 长期观测治理第二批已完成
  - 剩余项转为告警闭环、更长时间窗口趋势与覆盖率提升

### Phase E 长期观测治理第一批已完成灰度/生产发布

目标:

- 把 `Phase E` 剩余项从“只在本地补长期观测字段”推进到“gray / production 两套入口都已真实上线”。
- 在 gray 上验证失败窗口与 revision conflict 统计不是空 schema，而是能真实累计数据。
- 用同批 release 包完成 production 标准 gate 验收。

变更:

- 新增灰度发布记录：
  - `ops/phase-e-observability-governance-gray-release-2026-06-15.md`
- 新增正式发布记录：
  - `ops/phase-e-observability-governance-production-release-2026-06-15.md`
- 当前主入口已同步更新：
  - `README.md`
  - `AGENTS.md`
  - `MEMORY.md`
  - `docs/prd/README.md`
  - `docs/prd/v0.1.0/progress.md`
  - `docs/production-multi-user-hardening-plan-2026-06-13.md`
  - `ops/README.md`
  - `ops/phase-e-observability-release-gate-2026-06-15.md`

验证:

- 本地 fresh 打包与契约：
  - `npm run build:single-port`
  - `npm run verify:worker-observability-contract`
  - `npm run verify:release-package-contract`
- gray release：
  - `20260615-phase-e-observability-governance-gray-r1`
  - 本机 SHA256：
    - `BD6CBCE9FA614EC16D27FE64360E4DD08E3540F1145152C60ED58BAFB3AB99A2`
  - 服务器 SHA256：
    - `bd6cbce9fa614ec16d27fe64360e4dd08e3540f1145152c60ed58bafb3ab99a2`
  - gray 本机 gate：
    - `verify:release-preflight = ok`
    - `verify:request-chain-observability = ok`
    - `verify:system-observability = ok`
  - gray conflict 实打验证：
    - `verify-admin-settings-revision-conflict = ok`
    - `verify-canvas-revision-conflict = ok`
    - `verify-resource-revision-conflict = ok`
  - gray 公网 gate：
    - `XINGHUAN_VERIFY_BASE_URL=https://canvas-next.hhh2121.xyz npm run verify:request-chain-observability`
    - `XINGHUAN_VERIFY_BASE_URL=https://canvas-next.hhh2121.xyz npm run verify:system-observability`
  - gray header smoke：
    - `http://127.0.0.1:18200/api/status`
    - `https://canvas-next.hhh2121.xyz/api/status`
- production release：
  - `20260615-phase-e-observability-governance-prod-r1`
  - 本机 SHA256：
    - `9729969139FA6DDC510C55CE6203618EA19667F84D0B8162C4014972300B2D24`
  - 服务器 SHA256：
    - `9729969139fa6ddc510c55ce6203618ea19667f84d0b8162c4014972300b2d24`
  - production 本机 gate：
    - `verify:release-preflight = ok`
    - `verify:request-chain-observability = ok`
    - `verify:system-observability = ok`
  - production 公网 gate：
    - `XINGHUAN_VERIFY_BASE_URL=https://canvas.hhh2121.xyz npm run verify:request-chain-observability`
    - `XINGHUAN_VERIFY_BASE_URL=https://canvas.hhh2121.xyz npm run verify:system-observability`
  - production header smoke：
    - `http://127.0.0.1:18100/api/status`
    - `https://canvas.hhh2121.xyz/api/status`

结果:

- 当前灰度 `current`：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260615-phase-e-observability-governance-gray-r1`
- 当前生产 `current`：
  - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-governance-prod-r1`
- gray 真实观测结果：
  - `currentDatabase = xinghuan_canvas_gray`
  - `expectedDatabase = xinghuan_canvas_gray`
  - `targetMatched = true`
  - `failedLast1h = 0`
  - `failedLast24h = 7`
  - `failedLast7d = 21`
  - `audits.requestIdCoveragePercent = 21`
  - `conflicts.totalLast24h = 6`
  - `canvasRevisionLast24h = 1`
  - `resourceRevisionLast24h = 3`
  - `adminSettingsRevisionLast24h = 2`
- production 真实观测结果：
  - `currentDatabase = xinghuan_canvas_next`
  - `expectedDatabase = xinghuan_canvas_next`
  - `targetMatched = true`
  - `failedLast1h = 0`
  - `failedLast24h = 5`
  - `failedLast7d = 8`
  - `audits.requestIdCoveragePercent = 15`
  - `conflicts.totalLast24h = 0`
- gray / production 内外网 header smoke 都已确认：
  - `x-request-id` 保留正常
- 当前更准确的状态应写为：
  - `Phase E` rollback 样本已补齐
  - `Phase E` 长期观测治理第一批已完成 gray / production 发布
  - 后续剩余项转为趋势化展示、阈值/告警与覆盖率提升

边界:

- production 这轮只做标准 gate，没有额外在正式环境里制造 conflict 样本。
- conflict 累计能力已经在本地与 gray 实打验证通过，因此 production 本轮以最小风险放行为准。

### Phase E 补齐 production rollback 样本，并继续推进长期观测治理最小补强

目标:

- 为当前 production `prod-r2` 补齐真实 rollback 演练记录。
- 将 `Phase E` 剩余项从“缺 rollback 样本”切换到“长期观测治理补强”。
- 在当前本地代码基线上继续补系统页长期观测最小字段。

变更:

- 新增 production rollback 运维记录：
  - `ops/phase-e-observability-production-rollback-2026-06-15.md`
- 同步更新当前入口：
  - `README.md`
  - `AGENTS.md`
  - `MEMORY.md`
  - `docs/prd/README.md`
  - `docs/prd/v0.1.0/progress.md`
  - `docs/production-multi-user-hardening-plan-2026-06-13.md`
  - `ops/README.md`
  - `ops/phase-e-observability-production-release-2026-06-15.md`
  - `ops/phase-e-observability-gray-release-2026-06-15.md`
  - `ops/phase-e-observability-release-gate-2026-06-15.md`
  - `ops/production-acceptance-checklist.md`
- 本地继续推进 Phase E 长期观测最小补强：
  - `/api/admin/system` 新增失败窗口与 revision conflict 统计
  - `apps/api/src/server.ts`：409 revision conflict 自动沉淀 observability audit
  - `apps/admin/src/admin-readonly-panels.tsx`：系统页新增失败窗口与 conflict 统计行
  - `scripts/verify-system-observability.mjs`：新增 conflict 与失败窗口字段断言
  - `scripts/verify-admin-readonly-panels-contract.mjs`：新增系统状态行契约

验证:

- production 真实 rollback 演练：
  - `prod-r2 -> prod-r1 -> prod-r2`
- `prod-r1`：
  - `npm run verify:request-chain-observability`
  - `npm run verify:system-observability`
  - `npm run verify:release-preflight`
  - `curl -i -H 'x-request-id: phase-e-prod-rollback-check' http://127.0.0.1:18100/api/status`
- 恢复 `prod-r2` 后：
  - `npm run verify:release-preflight`
  - `npm run verify:request-chain-observability`
  - `npm run verify:system-observability`
  - `curl -i -H 'x-request-id: phase-e-prod-rollback-public-check' https://canvas.hhh2121.xyz/api/status`
- 本地长期观测补强验证：
  - `npm run type-check -w @xinghuan/api`
  - `npm run type-check -w @xinghuan/admin`
  - `npm run build -w @xinghuan/api`
  - `npm run build -w @xinghuan/admin`
  - `node scripts/verify-admin-readonly-panels-contract.mjs`
  - 本地单端口实例 `127.0.0.1:18214`
  - `node scripts/verify-request-chain-observability.mjs`
  - `node scripts/verify-admin-settings-revision-conflict.mjs`
  - `node scripts/verify-canvas-revision-conflict.mjs`
  - `node scripts/verify-resource-revision-conflict.mjs`
  - `node scripts/verify-system-observability.mjs`

结果:

- production rollback 样本已真实完成：
  - `prod-r2 -> prod-r1 -> prod-r2`
- `prod-r1` 核心链路可用，但 preflight 仍缺：
  - `currentReleaseLink/currentReleaseTarget`
  - `services.api/services.worker`
- 恢复到 `prod-r2` 后，production 本机与公网 header smoke 均正常
- 本地长期观测补强已验证：
  - `verify-system-observability` 返回：
    - `audits.conflicts.totalLast24h = 6`
    - `canvasRevisionLast24h = 1`
    - `resourceRevisionLast24h = 3`
    - `adminSettingsRevisionLast24h = 2`
  - 当前 file-mode 本地实例没有失败任务样本，因此：
    - `failedLast1h = 0`
    - `failedLast24h = 0`
    - `failedLast7d = 0`
- 当前 `Phase E` 更准确的剩余项变为：
  - 长期失败趋势
  - revision conflict 统计
  - requestId 覆盖率提升

### 仓库治理补充：CodeGraph hook 自动化与体积审计基线

目标:

- 把 CodeGraph 从“手工使用”提升为“仓库默认工程规范 + hook 自动维护”。
- 为当前 worktree 建立体积审计基线，区分项目本体与运行产物/归档占用。

变更:

- 新增 CodeGraph hook 自动化：
  - `.githooks/post-checkout`
  - `.githooks/post-merge`
  - `.githooks/post-rewrite`
  - `.githooks/post-commit`
  - `scripts/codegraph-hook.mjs`
  - `scripts/setup-codegraph-hooks.mjs`
- 更新协作与治理文档：
  - `AGENTS.md` 新增 CodeGraph 使用规范、hook 安装边界和体积审计入口
  - `docs/documentation-governance.md` 新增体积审计文档路由和运行产物体积触发检查规则
  - `docs/size-audit-2026-06-15.md` 新增当前仓库体积审计清单
- 更新脚本入口：
  - `package.json` 新增 `codegraph:*` 与 `setup:codegraph-hooks`

验证:

- `codegraph status`
- `npm run setup:codegraph-hooks`
- `node scripts/codegraph-hook.mjs manual`

结果:

- 当前 CodeGraph 索引状态：`Index is up to date`
- 当前体积基线：
  - Git 跟踪文件：`497`
  - Git 跟踪大小：`43,358,189 bytes`
  - worktree 全量文件：`25,675`
  - worktree 全量大小：`4,401,576,128 bytes`
- 主要占用来源已明确记录到 `docs/size-audit-2026-06-15.md`

### Phase E 正式发布完成：production gate 通过、请求链路/系统观测上线与阶段状态收口

目标:

- 把 `Phase E` 从“gray 已完成、production 待放行”推进到“gray / production 都已完成”。
- 在 production 环境复用当前 gate，完成真实切换、验证和状态文档同步。

变更:

- 本机打包：
  - `20260615-phase-e-observability-prod-r2`
- 新增正式发布记录：
  - `ops/phase-e-observability-production-release-2026-06-15.md`
- 更新主入口与 gate 文档：
  - `README.md`
  - `AGENTS.md`
  - `MEMORY.md`
  - `docs/prd/README.md`
  - `docs/prd/v0.1.0/progress.md`
  - `docs/production-multi-user-hardening-plan-2026-06-13.md`
  - `ops/README.md`
  - `ops/phase-e-observability-release-gate-2026-06-15.md`

验证:

- 本地：
  - `npm run package:release -- 20260615-phase-e-observability-prod-r2`
- production 服务器：
  - `npm run verify:release-preflight`
  - `npm run verify:request-chain-observability`
  - `npm run verify:system-observability`
  - `curl -i -H 'x-request-id: phase-e-prod-header-check' http://127.0.0.1:18100/api/status`
- production 公网入口：
  - `XINGHUAN_VERIFY_BASE_URL=https://canvas.hhh2121.xyz npm run verify:request-chain-observability`
  - `XINGHUAN_VERIFY_BASE_URL=https://canvas.hhh2121.xyz npm run verify:system-observability`
  - `curl -i -H 'x-request-id: phase-e-prod-public-header-check' https://canvas.hhh2121.xyz/api/status`

关键观察:

- production current 已切到：
  - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-prod-r2`
- `request-chain` 与 `system-observability` 在 production 本机入口和公网入口都通过。
- production 当前数据库目标返回：
  - `currentDatabase = xinghuan_canvas_next`
  - `expectedDatabase = xinghuan_canvas_next`
  - `targetMatched = true`
- `prod-r2` 已补齐 `verify:release-preflight` 的自动识别：
  - `currentReleaseLink = /opt/apps/xinghuan-canvas/current`
  - `currentReleaseTarget = /opt/apps/xinghuan-canvas/releases/20260615-phase-e-observability-prod-r2`
  - `services.api = active`
  - `services.worker = active`

结论:

- `Phase E` 已完成正式发布。
- 当前真实状态应更新为：
  - gray: `20260615-phase-e-observability-gray-r2`
  - production: `20260615-phase-e-observability-prod-r2`
- `Phase A-E` 现在都已经完成 gray / production 收口。

下一步:

- 补回滚样本记录。
- 继续提升审计 `requestId` 覆盖率。
- 视需要补强 preflight 对 release 指针与 systemd 状态的自动抓取。

### Phase E 灰度发布完成：系统观测、请求链路验收与 gray gate 实际放行

目标:

- 把 `Phase E` 从“本地实现已完成”推进到“gray 已完成真实放行”。
- 用当前 gate 在灰度环境收口最小可复用发布样本，并同步回写主入口文档。

变更:

- 本机打包：
  - `20260615-phase-e-observability-gray-r2`
- 新增灰度发布记录：
  - `ops/phase-e-observability-gray-release-2026-06-15.md`
- 更新主入口与 gate 文档：
  - `README.md`
  - `AGENTS.md`
  - `MEMORY.md`
  - `docs/prd/README.md`
  - `docs/prd/v0.1.0/progress.md`
  - `docs/production-multi-user-hardening-plan-2026-06-13.md`
  - `ops/README.md`
  - `ops/phase-e-observability-release-gate-2026-06-15.md`

验证:

- 本地打包与契约：
  - `npm run package:release -- 20260615-phase-e-observability-gray-r2`
- gray 服务器：
  - `npm run verify:release-preflight`
  - `npm run verify:request-chain-observability`
  - `npm run verify:system-observability`
- gray 公网入口：
  - `XINGHUAN_VERIFY_BASE_URL=https://canvas-next.hhh2121.xyz npm run verify:request-chain-observability`
  - `XINGHUAN_VERIFY_BASE_URL=https://canvas-next.hhh2121.xyz npm run verify:system-observability`
  - `curl -i -H 'x-request-id: phase-e-gray-header-check' https://canvas-next.hhh2121.xyz/api/status`

关键观察:

- gray current 已切到：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260615-phase-e-observability-gray-r2`
- gray 当前数据库目标已返回：
  - `currentDatabase = xinghuan_canvas_gray`
  - `expectedDatabase = xinghuan_canvas_gray`
  - `targetMatched = true`
- requestId 覆盖率现在已能通过系统页直接观测，但当前公网灰度仅为：
  - `requestIdCoveragePercent = 4`
- 首轮重启后 preflight 曾短暂出现一次 `ECONNREFUSED 127.0.0.1:18200`，重试后恢复，通过结果应按重试后的稳定状态记载。

结论:

- `Phase E` 已完成 gray 放行。
- 当前真实状态应更新为：
  - gray: `20260615-phase-e-observability-gray-r2`
  - production: `20260615-phase-d-runtime-prod-r1`
- 现阶段不能写成 `Phase E` 已全部完成；production 仍待执行。

下一步:

- 打包并切换 production release。
- 按同一 gate 执行 production 验证。
- 补齐 production 发布记录与回滚样本。

### Phase E 第一阶段完成：请求链路观测基线、本地端到端验证与实施文档落地

目标:

- 把 `Phase E` 从“准备做 requestId / observability”推进到“已经落下设计、计划、代码与本地验收基线”。
- 优先打通最小链路：
  - `requestId`
  - 审计 `request_id / ip / user_agent`
  - 后台审计页展示
  - Worker 结构化生命周期日志

变更:

- 新增设计与计划文档：
  - `docs/superpowers/specs/2026-06-15-phase-e-request-chain-observability-design.md`
  - `docs/superpowers/plans/2026-06-15-phase-e-request-chain-observability.md`
- `apps/api/src/server.ts`
  - 为每个请求生成或接收 `x-request-id`
  - 响应统一回写 `x-request-id`
  - 新增 `RequestContext`
  - `appendAudit(...)` 现在写入：
    - `requestId`
    - `ip`
    - `userAgent`
  - 后台关键写操作审计全部带入当前请求上下文
  - 增加 API 结构化事件日志：
    - `task.created`
    - `task.cancelled`
- `apps/api/src/provider-generation-task-service.ts`
  - provider generation task 创建时把最小链路字段写入任务：
    - `payload.requestId`
    - `payload.userId`
    - `result.requestId`
    - `result.userId`
- `apps/admin/src/admin-types.ts`
  - `AuditRecord` 扩展：
    - `requestId`
    - `ip`
    - `userAgent`
- `apps/admin/src/admin-readonly-panels.tsx`
  - 审计表新增：
    - `请求`
    - `来源`
  - 现在可直接查看 `requestId / ip / userAgent`
- `apps/worker/src/worker.ts`
  - 新增统一结构化日志 helper
  - 关键事件改为统一输出：
    - `task.received`
    - `task.claimed`
    - `task.skipped`
    - `task.succeeded`
    - `task.failed`
    - `task.cancelled_detected`
    - `task.reaped`
- 新增验证脚本：
  - `scripts/verify-request-chain-observability.mjs`
  - `scripts/verify-worker-observability-contract.mjs`
- 更新验证契约：
  - `scripts/verify-admin-readonly-panels-contract.mjs`
- `package.json`
  - 新增：
    - `verify:request-chain-observability`
    - `verify:worker-observability-contract`

验证:

- 类型检查：
  - `npm run type-check -w @xinghuan/api`
  - `npm run type-check -w @xinghuan/admin`
  - `npm run type-check -w @xinghuan/worker`
- 构建：
  - `npm run build -w @xinghuan/api`
  - `npm run build -w @xinghuan/admin`
  - `npm run build -w @xinghuan/worker`
  - `npm run build -w @xinghuan/web`
- 契约与回归：
  - `npm run verify:worker-observability-contract`
  - `npm run verify:admin-readonly-panels-contract`
  - `npm run verify:provider-generation-task-service`
  - `npm run verify:provider-generation-worker`
- 端到端链路：
  - 先构建后启动新的本地验证实例：
    - `XINGHUAN_API_PORT=18210`
  - `GET http://127.0.0.1:18210/api/status`
    - 已返回 `x-request-id`
  - `XINGHUAN_VERIFY_BASE_URL=http://127.0.0.1:18210 npm run verify:request-chain-observability`
    - `ok = true`
    - 审计记录中已确认：
      - `requestId`
      - `ip = 127.0.0.1`
      - `userAgent`

关键观察:

- 直接对现有 `127.0.0.1:18200` 运行 `verify:request-chain-observability` 初次失败，原因不是代码错误，而是本地旧进程尚未加载新构建代码。
- 重新在 `18210` 拉起新实例后，`x-request-id` 与审计字段链路立即通过。
- 因此本轮本地端到端结论应以 `18210` 新实例为准，不能把旧常驻 `18200` 进程的失败误记成代码回归。

结论:

- `Phase E` 第一阶段已经不再只是规划：
  - requestId 已经进入 API 请求链路
  - 审计已落 `requestId / ip / userAgent`
  - 后台审计页可直接查看这些字段
  - Worker 已具备统一结构化生命周期日志
- 当前已经形成最小可追踪链路基线，可继续推进：
  - 系统观测面板
  - 上线门槛清单
  - 回滚演练记录

下一步:

- 把 `Phase E` 第二阶段聚焦到：
  - 系统页观测项
  - gray / prod 放行 gate 文档
  - 回滚演练与验收模板
- 视需要将 `verify:request-chain-observability` 接入 gray release 验收链

### Phase E 第二阶段完成：系统观测项、放行 gate 文档与 release package 契约收口

目标:

- 把 `Phase E` 从“已有 requestId 链路”继续推进到“系统页已有最小运行观测，放行 gate 也有固定入口”。
- 同时把当前阶段关键验证脚本纳入 release package，避免服务器 current release 缺脚本。

变更:

- 新增设计与计划文档：
  - `docs/superpowers/specs/2026-06-15-phase-e-system-observability-and-release-gates.md`
  - `docs/superpowers/plans/2026-06-15-phase-e-system-observability-and-release-gates.md`
- `apps/api/src/server.ts`
  - `/api/admin/system` 新增：
    - `database.currentDatabase`
    - `database.expectedDatabase`
    - `database.targetMatched`
    - `observability.tasks`
    - `observability.audits`
  - 任务观测汇总覆盖：
    - `total`
    - `queued`
    - `running`
    - `succeeded`
    - `failed`
    - `cancelled`
    - `failedLast24h`
  - 审计观测汇总覆盖：
    - `total`
    - `sampled`
    - `withRequestId`
    - `requestIdCoveragePercent`
- `apps/admin/src/admin-types.ts`
  - `SystemInfo` 扩展数据库目标与 `observability` 类型
- `apps/admin/src/admin-readonly-panels.tsx`
  - 系统页新增：
    - 当前数据库
    - 目标数据库
    - 数据库目标校验
    - 任务总数 / 排队任务 / 运行任务 / 24h 失败任务
    - 最近审计样本 / 请求ID覆盖率
- 新增验证脚本：
  - `scripts/verify-system-observability.mjs`
  - `scripts/verify-release-gate-docs-contract.mjs`
- 更新验证脚本：
  - `scripts/verify-admin-readonly-panels-contract.mjs`
  - `scripts/verify-release-package-contract.mjs`
- `package.json`
  - 新增：
    - `verify:system-observability`
    - `verify:release-gate-docs-contract`
    - `verify:release-package-contract`
- `scripts/package-release.mjs`
  - 当前 Phase E 关键验证脚本纳入 release package：
    - `verify-request-chain-observability`
    - `verify-system-observability`
    - `verify-worker-observability-contract`
- 新增运维 gate 文档：
  - `ops/phase-e-observability-release-gate-2026-06-15.md`
- 更新主入口与验收文档：
  - `ops/production-acceptance-checklist.md`
  - `ops/README.md`
  - `AGENTS.md`
  - `README.md`
  - `docs/prd/README.md`
  - `docs/prd/v0.1.0/progress.md`
  - `docs/production-multi-user-hardening-plan-2026-06-13.md`

验证:

- 静态契约与构建通过：
  - `npm run verify:admin-readonly-panels-contract`
  - `npm run verify:release-gate-docs-contract`
  - `npm run verify:release-package-contract`
  - `npm run type-check -w @xinghuan/api`
  - `npm run type-check -w @xinghuan/admin`
  - `npm run build -w @xinghuan/api`
  - `npm run build -w @xinghuan/admin`
  - `npm run verify:worker-observability-contract`
- fresh 本地实例：
  - `127.0.0.1:18211`
  - 使用独立数据目录 `.codex-temp/phase-e-verify-18211-data`
- fresh 实例运行态通过：
  - `XINGHUAN_VERIFY_BASE_URL=http://127.0.0.1:18211 npm run verify:request-chain-observability`
  - `XINGHUAN_VERIFY_BASE_URL=http://127.0.0.1:18211 npm run verify:system-observability`

关键观察:

- `verify:system-observability` 首次和 `verify:request-chain-observability` 并发打到同一个 file-mode 本地实例时，出现过一次 `AUTH_REQUIRED`。
- 更合理的解释是 file-mode 本地会话 JSON 写入互相覆盖，而不是第二阶段观测字段缺失。
- 改为串行复验后，两条脚本都在 `18211` fresh 实例稳定通过。

结论:

- `Phase E` 第二阶段本地实现与本地验证已完成：
  - 系统页已有最小运行观测项
  - gate 文档已有固定入口
  - release package 已带当前阶段关键验证脚本
- 当前还不能写成：
  - `Phase E` gray 已完成
  - `Phase E` production 已完成
- 下一步应按新 gate 在 gray / production 执行真实放行与回滚样本记录。

### Phase D 正式发布完成：生产切换、正式验收通过与阶段状态收口

目标:

- 将 `Phase D` 从“gray 已完成、production 待放行”推进到“gray / production 都已完成”。
- 复用灰度已修正的 release package 契约，完成正式切换和正式验收。

变更:

- 修复 `scripts/verify-task-cancellation-phase-d.mjs`
  - 将取消样本任务改成 `payload.taskCapability = "chat"`
  - 避免 worker 常驻运行时样本被先消费到 `succeeded`
  - 现在 `verify:phase-d` 不再需要临时停 worker
- 本机打包：
  - `20260615-phase-d-runtime-prod-r1`
- 服务器生产切换：
  - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260615-phase-d-runtime-prod-r1`
- 生产迁移：
  - `014_task_runtime_phase_d.sql`
- 新增正式发布记录：
  - `ops/phase-d-production-release-2026-06-15.md`
- 更新主入口与治理文档：
  - `README.md`
  - `AGENTS.md`
  - `MEMORY.md`
  - `docs/prd/README.md`
  - `docs/prd/v0.1.0/progress.md`
  - `docs/production-multi-user-hardening-plan-2026-06-13.md`
  - `ops/README.md`

验证:

- 本地：
  - `npm run verify:phase-d`
  - `node scripts/verify-release-package-contract.mjs`
  - `npm run package:release -- 20260615-phase-d-runtime-prod-r1`
- gray：
  - worker 常驻时 `npm run verify:phase-d` 通过
- production：
  - 旧 current 执行 `npm run verify:release-preflight` 失败，复现旧包缺口
  - `node scripts/db-migrate.mjs` => `applied=["014_task_runtime_phase_d.sql"]`
  - `npm run verify:release-preflight` 通过
  - `npm run verify:phase-d` 通过
  - `npm run verify:provider-generation-task-service` 通过
  - `npm run verify:provider-generation-worker` 通过
  - `curl http://127.0.0.1:18100/api/status` => `environment=production`
  - `curl https://canvas.hhh2121.xyz/api/status` => `environment=production`

关键观察:

- 本轮 production preflight 的真实返回是：
  - `currentDatabase = xinghuan_canvas_next`
- 同时生产环境文件中：
  - `XINGHUAN_EXPECTED_DATABASE_NAME=xinghuan_canvas_next`
- 这说明当前灰度 / production 虽然已经拆成独立域名、端口和 release 指针，但 PostgreSQL 目标仍未真正拆分成两套数据库。
- 因此旧文档里“灰度与生产已经拆分为独立 PostgreSQL 数据库”的表述是失实的，已经在主入口里改正。

结论:

- `Phase D` 已完成正式发布。
- 当前真实状态更新为：
  - gray: `20260615-phase-d-runtime-gray-r3`
  - production: `20260615-phase-d-runtime-prod-r1`
- `Phase A-D` 现在都已经完成 gray / production 收口，后续可以正式进入 `Phase E`。

下一步:

- 进入 `Phase E`：
  - `requestId` 贯通
  - 系统观测面板
  - 更完整的任务补偿与上游取消样本
- 如要真正实现环境隔离，再单独推进灰度 / production PostgreSQL 数据库拆分。

### Phase D 灰度发布完成：修复 release package 契约并完成 gray runtime 验收

目标:

- 把 `Phase D` 从“本地代码基线已完成”推进到“gray active release 已真实切换”。
- 修复发布包与服务器验收脚本不一致的问题，避免 release 产物能跑服务但不能自我验收。

变更:

- 打包契约补强：
  - `scripts/verify-release-package-contract.mjs`
  - `scripts/package-release.mjs`
- 首轮修复：
  - 将 `scripts/capture-release-preflight.mjs` 纳入 release package
- 第二轮修复：
  - 将以下 gray runtime 验收脚本纳入 release package：
    - `scripts/verify-task-cancellation-phase-d.mjs`
    - `scripts/verify-admin-task-pagination.mjs`
    - `scripts/verify-task-lifecycle.mjs`
    - `scripts/verify-provider-generation-task-service.mjs`
    - `scripts/verify-provider-generation-worker.mjs`
  - 将这些脚本依赖的 `apps/api/src`、`apps/worker/src` 一并纳入 release package
- 脚本修复：
  - `scripts/verify-admin-task-pagination.mjs`
  - 移除无效 `providerId` 测试数据，避免 PostgreSQL 外键约束误报
- 灰度 release 演进：
  - `r1`: `20260615-phase-d-runtime-gray-r1`
  - `r2`: `20260615-phase-d-runtime-gray-r2`
  - `r3`: `20260615-phase-d-runtime-gray-r3`
- 服务器灰度最终 current：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260615-phase-d-runtime-gray-r3`
- 迁移：
  - `014_task_runtime_phase_d.sql` 已进入 gray
- 新增发布记录：
  - `ops/phase-d-gray-release-2026-06-15.md`

验证:

- 本地：
  - `node scripts/verify-release-package-contract.mjs`
  - `npm run build:single-port`
  - `npm run verify:phase-d`
  - `npm run verify:provider-generation-task-service`
  - `npm run verify:provider-generation-worker`
  - `npm run package:release -- 20260615-phase-d-runtime-gray-r1`
  - `npm run package:release -- 20260615-phase-d-runtime-gray-r2`
  - `npm run package:release -- 20260615-phase-d-runtime-gray-r3`
- 服务器 gray：
  - 旧 `Phase C` current 执行 `npm run verify:release-preflight`，按预期失败并复现缺口：
    - `Cannot find module .../scripts/capture-release-preflight.mjs`
  - 发布 `r1` 后：
    - `node scripts/db-migrate.mjs` => `applied=["014_task_runtime_phase_d.sql"]`
    - `npm run verify:release-preflight` 通过
  - 发布 `r3` 后：
    - `npm run verify:release-preflight` 通过
    - `npm run verify:phase-d` 通过
    - `npm run verify:provider-generation-task-service` 通过
    - `npm run verify:provider-generation-worker` 通过
  - 运行态状态：
    - `systemctl is-active xinghuan-canvas-next.service` => `active`
    - `systemctl is-active xinghuan-canvas-next-worker.service` => `active`
    - `curl http://127.0.0.1:18200/api/status` => `environment=gray`
    - `curl https://canvas-next.hhh2121.xyz/api/status` => `environment=gray`

关键观察:

- `verify:phase-d` 在 worker 正常运行时存在真实竞态：
  - 测试取消任务可能先被 worker 跑成 `succeeded`
  - 脚本随后取消会收到：
    - `任务当前状态为 succeeded，不可取消`
- 本轮 gray 验收采取的可复用方式是：
  - 临时停止 `xinghuan-canvas-next-worker.service`
  - 执行 `npm run verify:phase-d`
  - 验证通过后立即恢复 worker
- 这说明当前阻塞已不再是发布链路，而是取消样本脚本与真实 worker 竞争时序的问题。

结论:

- `Phase D` 已完成 gray 发布。
- 当前真实状态更新为：
  - gray: `20260615-phase-d-runtime-gray-r3`
  - production: `20260615-phase-c-login-rate-limit-prod-r1`
- 因此不能再写“Phase D 仅完成本地收口”，也不能写“Phase D 已正式发布”；正确口径应为：
  - `Phase D` 已完成 gray 放行
  - `Phase D` production 待放行

下一步:

- 继续准备 `Phase D` production release。
- 将 `verify-task-cancellation-phase-d.mjs` 调整为在 worker 常驻运行时也更稳定的取消样本。
- 进入 `Phase E` 时，把 requestId、系统观测和正式放行门槛一起收口。

### 文档治理收口：入口状态统一、Phase 3 早期材料归档与长期规范落地

目标:

- 修复当前 worktree 中“项目真实状态已经推进，但入口文档仍保留旧阶段口径”的问题。
- 建立长期有效的文档路由、更新义务和归档规范，避免后续再次出现久信息长期滞留主入口。
- 清理 `ops/README.md` 中已被后续阶段覆盖、但仍占据当前入口的早期 Phase 3 材料。

变更:

- 新增 `docs/documentation-governance.md`
  - 建立文档分层、主入口职责、更新触发条件和归档规则。
  - 明确当前状态应以：
    - `README.md`
    - `AGENTS.md`
    - `MEMORY.md`
    - `docs/prd/README.md`
    - `ops/README.md`
    为主入口，不允许长期互相冲突。
- 更新 `README.md`
  - 补充当前多用户正式化阶段和当前灰度/生产 release。
  - 把文档治理规范纳入快速入口。
- 更新 `AGENTS.md`
  - 新增文档与归档规则。
  - 当前状态改为同时区分产品路线 `Phase 3` 与正式化治理 `Phase A-E` 两套口径。
  - 明确 release、phase 变化时必须同步更新主入口。
- 更新 `docs/prd/README.md`
  - 当前活跃版本状态改为 `2026-06-15` 口径。
  - 明确 `Phase 3` 仍在持续收口，同时 `Phase D` 已完成当前代码与本地验收收口。
- 更新 `docs/prd/v0.1.0/progress.md`
  - 顶部状态由“刚进入 Phase 3”改为“Phase 3 持续收口 + 正式化治理推进中”。
  - 补充 `Phase D` 收口和 `Phase E` 下一步重点。
- 更新 `MEMORY.md`
  - 当前阶段和当前灰度/生产 release 更新为 `2026-06-15` 服务器实态。
  - 移除“正式预留域名未启用”等已失效表述。
- 更新 `ops/README.md`
  - 当前状态补充当前灰度/生产 release。
  - 当前运行态入口保留仍与当前放行和运行直接相关的材料。
  - 增补 `phase-b-resource-revision-gray-2026-06-13.md` 索引。
- 新增 `ops/archive/2026-06-phase3-rollout/README.md`
  - 作为新的历史运维归档批次说明。
- 更新 `ops/archive/README.md`
  - 增加 `2026-06-phase3-rollout/` 批次索引。
- 归档迁移以下早期 Phase 3 材料到 `ops/archive/2026-06-phase3-rollout/`
  - `phase3-output-prune-gray-2026-06-06.md`
  - `phase3-lifecycle-gray-2026-06-06.md`
  - `phase3-canvas-resource-pg-hotfix-gray-2026-06-07.md`
  - `phase3-runninghub-workflow-gray-2026-06-07.md`
  - `phase3-node-acceptance-gray-2026-06-07.md`
  - `phase3-node-acceptance-production-2026-06-07.md`
  - `production-cutover-2026-06-06.md`
  - `production-user-accounts-2026-06-06.md`
  - `production-prep-2026-06-07.md`
  - `entry-ui-gray-2026-06-07.md`
  - `full-node-acceptance-audit-2026-06-07.md`

验证:

- `npm run verify:phase-d`
- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/worker`
- `npm run type-check -w @xinghuan/admin`
- `npm run type-check -w @xinghuan/web`
- 服务器实态核对：
  - 灰度 `current -> 20260615-phase-c-login-rate-limit-gray-r1`
  - 生产 `current -> 20260615-phase-c-login-rate-limit-prod-r1`
  - `xinghuan-canvas-next.service` / `worker` / `xinghuan-canvas.service` / `worker` 均为 `active`
  - `127.0.0.1:18200/api/status` 返回 `environment=gray`
  - `127.0.0.1:18100/api/status` 返回 `environment=production`

结论:

- 当前 worktree 的主入口状态已与实际代码和服务器运行态重新对齐。
- 文档路由、更新义务和归档边界已形成正式规范，不再只依赖口头约定。
- `ops/README.md` 不再把早期 Phase 3 发布记录混作当前运行态入口，后续恢复上下文的噪音明显降低。

风险:

- `docs/prd/v0.1.0/plan.md`、`release.md` 等版本内长文仍保留较多历史阶段表述，虽然不再作为唯一入口，但后续若要继续精简，仍需分轮收口。
- 当前这轮主要清理的是入口和索引；历史材料内容本身未重写，只做归档移动与主入口调整。

下一步:

- 继续补 `Phase D` 灰度/正式运行态验收记录，避免当前只停留在本地收口。
- 进入 `Phase E` 时，优先按新规范同步更新：
  - `README.md`
  - `AGENTS.md`
  - `MEMORY.md`
  - `docs/prd/README.md`
  - `ops/README.md`

### Phase D 发布差距核实：确认当前仍未进入 gray / prod active release

目标:

- 确认 `Phase D` 当前到底是“已经发布但缺记录”，还是“本地完成但尚未发布”。
- 避免把 `Phase D` 错写成已灰度/已正式放行。

核实:

- 当前服务器 `current`：
  - gray -> `/opt/apps/xinghuan-canvas-next/releases/20260615-phase-c-login-rate-limit-gray-r1`
  - prod -> `/opt/apps/xinghuan-canvas/releases/20260615-phase-c-login-rate-limit-prod-r1`
- 当前 gray / prod 服务都为 `active`，状态接口正常：
  - `127.0.0.1:18200/api/status -> environment=gray`
  - `127.0.0.1:18100/api/status -> environment=production`
- 当前服务器 `apps/api/db/` 目录只到：
  - `013_login_rate_limit.sql`
- 当前本地 `Phase D` 迁移和脚本：
  - `apps/api/db/014_task_runtime_phase_d.sql`
  - `scripts/verify-task-cancellation-phase-d.mjs`
  - `scripts/verify-admin-task-pagination.mjs`
- 当前服务器执行 `npm run verify:release-preflight` 失败：
  - `Cannot find module .../scripts/capture-release-preflight.mjs`
  - 说明 runbook 与当前服务器 release 产物之间仍有不一致

结论:

- 当前 `Phase D` 真实状态是：
  - 本地代码与本地验收完成
  - gray / prod active release 仍停留在 `Phase C`
- 不能把 `Phase D` 继续写成“已灰度上线”或“已正式发布”。

新增记录:

- `ops/phase-d-release-gap-and-rollout-gate-2026-06-15.md`
  - 用于记录当前发布缺口、放行阻塞项和后续 gray / prod 执行顺序

下一步:

- 先做 `Phase D` gray release
- 先修正 `verify:release-preflight` 与服务器发布产物一致性
- gray 验收通过后，再补正式发布与正式记录

### Phase D 完成：任务状态机、取消语义与后台任务分页本地验收收口

目标:

- 完成 `Phase D` 的代码落地，不再让任务取消、悬挂运行和后台任务全量读取继续保持半成品状态。
- 把本地验收结果、检测结论和后续边界补齐到正式台账中。

变更:

- `apps/api/src/task-cancellation-service.ts`
  - 新增统一任务取消服务。
  - 取消结果现在明确区分：
    - `local_only`
    - `upstream_confirmed`
    - `upstream_attempt_failed`
  - 同时回填：
    - `upstreamSupported`
    - `upstreamAttempted`
    - `upstreamCancelledAt`
    - `cancellationMessage`
- `apps/api/src/server.ts`
  - `/api/proxy/generation/cancel` 改为真实读取任务并执行统一取消服务，不再固定伪造 `upstream: false`。
  - `/api/admin/tasks/:id` 的 `action=cancel` 复用同一条取消链路。
  - `/api/admin/tasks` 改为分页返回：
    - `items`
    - `total`
    - `page`
    - `pageSize`
    - `hasMore`
    - `filters`
  - 后台任务查询支持：
    - `status`
    - `providerId`
    - `capability`
- `apps/api/src/provider-generation-task-service.ts`
  - 状态查询补齐：
    - `cancelScope`
    - `upstreamSupported`
    - `upstreamAttempted`
    - `heartbeatAt`
    - `upstreamTaskId`
    - `upstreamCancelledAt`
    - 更稳定的失败原因回传
- `apps/worker/src/worker.ts`
  - 增加任务运行期 heartbeat 写入。
  - 长轮询任务在 `APIMart image/video`、`ModelScope image`、`GRSAI image` 路径上回填运行态。
  - 新增 stale task reaper：
    - 自动扫描长时间 `running` 且无推进的任务
    - 自动标记为 `failed`
    - 写入 `worker_stalled_or_upstream_timeout`
- `apps/admin/src/main.tsx`
  - 后台任务状态改成服务端分页装载。
- `apps/admin/src/admin-task-panel.tsx`
  - 新增筛选、分页、每页数量控制。
  - 取消状态文案不再笼统显示为“已终止上游”。
- `apps/admin/src/admin-types.ts`
  - 新增任务分页结构和取消元数据类型。
- `apps/web/src/services/generation.ts`
  - 取消接口结果结构升级，前端可区分本地取消与上游取消。
- `apps/api/db/014_task_runtime_phase_d.sql`
  - 新增任务分页与运行态相关索引。
- 新增验证脚本：
  - `scripts/verify-task-cancellation-phase-d.mjs`
  - `scripts/verify-admin-task-pagination.mjs`
  - `package.json` 新增 `verify:phase-d`

验证:

- 类型检查：
  - `npm run type-check -w @xinghuan/api`
  - `npm run type-check -w @xinghuan/worker`
  - `npm run type-check -w @xinghuan/admin`
  - `npm run type-check -w @xinghuan/web`
- 构建：
  - `npm run build:single-port`
- 本地 Phase D 串行验收：
  - `npm run verify:phase-d`
- 单项脚本验证：
  - `node scripts/verify-task-cancellation-phase-d.mjs`
  - `node scripts/verify-admin-task-pagination.mjs`
  - `node scripts/verify-task-lifecycle.mjs`

结论:

- `Phase D` 本地代码与验收链路已收口完成。
- 后台任务页已经从全量读取切到分页读取。
- 取消链路已经能明确标记“仅本地取消”与“上游确认取消”的差异。
- Worker 已具备 heartbeat 与 stale reaper，长期悬挂任务不再只能靠人工观察。

风险:

- 本地 `file` 存储模式在多条会写鉴权/任务数据的验收脚本并行执行时仍会出现假性会话丢失，这不是生产 PostgreSQL 形态的直接等价问题，但说明本地 file-mode 不适合作为多用户稳定性结论来源。
- 当前 `Phase D` 完成的是任务运行态闭环，不等于整个正式化治理完成；`Phase E` 的请求链路、统一 `requestId`、审计增强和系统观测面板仍需继续推进。

下一步:

- 进入 `Phase E`：
  - 统一 `requestId / taskId / userId / providerId / modelId`
  - 补后台系统观测
  - 完成灰度/生产放行前的链路化验收
- 正式多用户质量结论以：
  - `docs/quality-audit-phase-d-2026-06-15.md`
  - `ops/phase-d-local-validation-2026-06-15.md`
  为当前基线
## 2026-06-13

### Phase A 第一批止血落地：画布 owner 收口与认证定向写入

目标:

- 在正式多用户加固方案落档后，先把最危险的 `Phase A` 高风险入口真正动起来。
- 先止住画布 owner 串改、画布列表误删，以及登录/登出/用户更新继续走整表会话重写的问题。

变更:

- 建立本地回退检查点：
  - commit:
    - `9f2e134`
  - tag:
    - `phase-a-start-checkpoint-2026-06-13`
- `apps/api/src/server.ts`
  - 新增 `HttpError`，允许把权限类问题按 `403` 返回，而不是统一落成 `500`。
  - 画布创建的 PostgreSQL 路径不再依赖 `writeCanvasList([item, ...list])`。
  - 画布重命名新增 `renameCanvasRecord(...)`，避免通过全量列表重写来改单个名字。
  - 画布删除新增 `deleteCanvasRecord(...)`，避免通过“过滤列表再整表同步”删除单个画布。
  - `writeCanvasData(...)` 改为先检查 `id` 的真实 `owner_id`：
    - 若已存在且 owner 不一致，返回 `CANVAS_OWNERSHIP_MISMATCH`
    - 不再允许通过 `on conflict (id)` 改写 `owner_id`
  - `readCanvasData(...)` 在 PostgreSQL 模式下也会检查 foreign id，不再把别人的画布静默伪装成空白画布。
  - `writeCanvasList(...)` 新增 `pruneMissing` 语义：
    - 默认只 upsert 提交项
    - 只有明确需要裁剪缺失项时才删除
    - 写入冲突时如果 owner 不匹配会返回 `CANVAS_OWNERSHIP_MISMATCH`
  - `readAuthDbPostgres(...)` 不再在读取时调用 `writeAuthDbPostgres(cleaned)` 触发全表重写：
    - bootstrap 用户改为逐个 upsert
    - 过期会话改为定向清理
  - 登录、登出、后台用户创建、后台用户更新在 PostgreSQL 模式下改为定向写入：
    - 登录 => `createSessionRecordPostgres`
    - 登出 => `deleteSessionRecordPostgres`
    - 创建用户 => `insertAuthUserPostgres`
    - 更新用户 => `upsertAuthUserPostgres + revokeUserSessionsPostgres`
- `scripts/verify-phase-a-hardening-contract.mjs`
  - 新增静态契约校验脚本，覆盖：
    - 画布 owner 不再可通过 conflict 改写
    - PostgreSQL 画布创建/重命名/删除走定向路径
    - 登录/登出会话走定向写入
    - `readAuthDbPostgres` 不再读取即整表回写
- `package.json`
  - 新增：
    - `verify:phase-a-hardening-contract`

验证:

- `npm run type-check -w @xinghuan/api`
- `npm run verify:phase-a-hardening-contract`
- `npm run verify:postgres-canvas-resource-contract`
- `npm run verify:auth-session-concurrency`
- `npm run build:single-port`

影响:

- 这轮已经把最危险的“伪造 canvas id 改 owner”和“登录/登出触发全表会话重写”先收住了。
- 画布和认证在 PostgreSQL 模式下开始从“全量同步思维”转向“实体定向写入思维”。

风险:

- `AdminDb` 的 PostgreSQL 整表重写还没有拆完，Provider / Model / Task / Assistant Settings 这部分仍在下一轮 `Phase A` 处理范围内。
- 资源库 PostgreSQL 写入仍然是删光后重建，尚未进入这一批改造。

下一步:

- 继续推进 `Phase A` 第二批：
  - 拆 `writeAdminDbPostgres(...)`
  - 收口资源库 / 生成库的 PostgreSQL 全量替换逻辑

### 多用户正式化加固方案、边界和验收清单落档

目标:

- 把本轮生产级审查结论沉淀为可执行方案，而不是只停留在聊天结论。
- 明确后续仓储重构、并发控制、会话安全、任务取消和上线门槛的执行顺序。

变更:

- 新增主方案文档：
  - `docs/production-multi-user-hardening-plan-2026-06-13.md`
- 新增验收与放行文档：
  - `ops/production-multi-user-acceptance-plan-2026-06-13.md`
- 更新：
  - `ops/README.md`
  - `MEMORY.md`
- 本轮文档收口内容包括：
  - 为什么当前问题不能继续按零散热修处理
  - Phase A 到 Phase E 的实施顺序
  - 允许做与禁止做的边界
  - 灰度放行条件、正式放行条件和立即回滚条件
  - 并发写入、跨用户 owner、会话安全、任务取消和审计追踪的验收项

验证:

- 已确认新文档落在当前 worktree 正式入口下，而不是历史目录：
  - `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/docs/`
  - `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/ops/`
- 已同步更新 `MEMORY.md` 和 `ops/README.md`，后续恢复上下文时可直接命中。

影响:

- 后续实施不再以“临时修一个点”为单位，而是按正式多用户治理分阶段推进。
- 灰度和正式上线前将有固定放行标准，减少“代码能跑但正式数据不安全”的情况。

风险:

- 当前只是方案和验收标准落档，还没有开始 Phase A 的代码改造。
- 在 Phase A 和 Phase B 完成前，正式环境仍然存在仓储并发与归属层面的结构性风险。

下一步:

- 从 Phase A 开始，先改画布归属写入和 PostgreSQL 整表重写仓储。

### 生产画布“清空”根因定位与数据库目标防呆

目标:

- 查清“生产每次更新后用户画布像被清空”的真实原因。
- 判断当前生产里 `ModelScope/魔搭` 图像失败是否仍是协议链路问题。
- 加上运行态防呆，防止生产/灰度再次连错数据库。

变更:

- 生产运行态取证：
  - 生产当前 release：
    - `/opt/apps/xinghuan-canvas/releases/20260612-modelscope-image-protocol-prod-r2`
  - 生产当前环境：
    - `APP_ENV=production`
    - `STORAGE_DRIVER=postgres`
    - `DATA_DIR=/opt/apps/xinghuan-canvas/shared/data`
  - 生产 PostgreSQL 当前数据库名：
    - `xinghuan_canvas_next`
  - 生产库现状：
    - `xh_users=7`
    - `xh_tasks=69`
    - `xh_canvases=0`
  - 灰度 PostgreSQL 当前数据库名：
    - `xinghuan_canvas_gray`
  - 灰度库现状：
    - `xh_users=6`
    - `xh_tasks=99`
    - `xh_canvases=13`
- 生产画布丢失排查结论：
  - 当前服务器只存在：
    - `xinghuan_canvas_gray`
    - `xinghuan_canvas_next`
  - 不存在第三个可直接回切的“正式老库”。
  - 生产 `shared/data/users/*/canvases/` 目录为空，没有可直接自动回导的历史画布 JSON。
  - 因此当前“更新后像清空”不是这次新代码把现有画布删掉了，而是生产运行态当前读到的数据库目标里本来就没有画布数据。
- `ModelScope/魔搭` 图像链路复核：
  - 查询生产旧任务后确认：
    - `Qwen/Qwen-Image-2512`
    - `通义万相 turbo`
    - 失败记录都是 `2026-06-12` 修复前旧任务，日志为：
      - `APIMart 图像生成轮询超时`
  - 在当前生产服务上使用临时 mock `ModelScope` Provider 复验：
    - `Qwen/Qwen-Image-2512`
    - 提交头 `X-ModelScope-Async-Mode: true`
    - 轮询头 `X-ModelScope-Task-Type: image_generation`
    - 返回本地 `/files/output/...png`
  - 说明当前正式代码里的 `ModelScope` 异步图像协议已经生效，界面里再次看到的这类失败节点大概率是历史失败任务状态残留，不是当前代码仍走旧 APIMart 图像链路。
- 本轮代码与文档防护：
  - `apps/api/src/server.ts`
    - 新增 `XINGHUAN_EXPECTED_DATABASE_NAME` 运行态校验。
    - API 启动时会先查询 `current_database()`；若与期望库名不一致，直接抛出 `DATABASE_TARGET_MISMATCH`。
    - 收紧 `writeCanvasList(...)`：默认拒绝空列表整表替换，只有明确“删除最后一个画布”时才允许 `allowEmptyReplace`。
  - `apps/worker/src/worker.ts`
    - 同步新增 `XINGHUAN_EXPECTED_DATABASE_NAME` 校验。
    - Worker 启动前即校验数据库目标，避免静默消费到错误环境。
  - `config/canvas-production.env.example`
  - `config/canvas-next.env.example`
    - 新增 `XINGHUAN_EXPECTED_DATABASE_NAME` 占位项。
  - `ops/production-deploy-runbook.md`
  - `ops/gray-deploy-runbook.md`
  - `ops/production-acceptance-checklist.md`
    - 发布与验收流程新增数据库目标校验步骤，避免后续只验 `api/status` 和 service active，却没验真实数据库目标。

验证:

- 远端生产取证：
  - `current_database()`:
    - 生产 => `xinghuan_canvas_next`
    - 灰度 => `xinghuan_canvas_gray`
  - `xh_canvases`:
    - 生产 => `0`
    - 灰度 => `13`
- 远端生产 mock 协议回归：
  - `node /tmp/verify-modelscope-image-proxy.mjs`
  - 返回 `ok: true`
  - `Qwen/Qwen-Image-2512` mock 任务成功落本地图片。
- 本地构建验收：
  - `npm run type-check -w @xinghuan/api`
  - `npm run type-check -w @xinghuan/worker`
  - `npm run build:single-port`
- 灰度发布与验收：
  - release:
    - `/opt/apps/xinghuan-canvas-next/releases/20260613-db-target-guard-gray-r1`
  - API 启动日志：
    - `databaseTargetCheck=passed`
    - `currentDatabase=xinghuan_canvas_gray`
  - Worker 启动日志：
    - `databaseTargetCheck=passed`
    - `currentDatabase=xinghuan_canvas_gray`
  - `curl http://127.0.0.1:18200/api/status` 返回 `environment=gray`
- 正式发布与验收：
  - release:
    - `/opt/apps/xinghuan-canvas/releases/20260613-db-target-guard-prod-r1`
  - API 启动日志：
    - `databaseTargetCheck=passed`
    - `currentDatabase=xinghuan_canvas_next`
  - Worker 启动日志：
    - `databaseTargetCheck=passed`
    - `currentDatabase=xinghuan_canvas_next`
  - `curl http://127.0.0.1:18100/api/status` 返回 `environment=production`

影响:

- 以后只要生产或灰度 env 里的期望数据库名与真实连接目标不一致，API/Worker 会直接报错而不是继续提供一个“能打开但数据看起来被清空”的错误环境。
- 当前生产画布恢复仍需要单独决定数据源，因为服务器上没有现成的第三个正式旧库或文件快照可直接回导。

风险与注意:

- 这轮只加了防呆和根因定位，没有擅自切换生产数据库目标。
- 若后续要恢复生产画布，需要先明确：
  - 目标正式数据库名是什么
  - 是否要从现有灰度库迁移管理员 `13` 个画布
  - 还是要从其它外部备份恢复

## 2026-06-12

### ModelScope 图像协议专属化修复并完成灰度/生产验收

目标:

- 解决正式环境中魔搭图像模型被误套进 APIMart 图像异步链路的问题。
- 将 ModelScope 图像链路从“半通用兼容”收口为明确协议分支。
- 使用 `Agnes + 魔搭` 做真实灰度验收、真实生产验收和混合并发验收。

变更:

- 协议与后台枚举:
  - `packages/model-core/src/index.ts`
  - `apps/admin/src/admin-types.ts`
  - `apps/api/src/provider-model-catalog.ts`
  - `apps/api/src/server.ts`
  - `apps/worker/src/worker.ts`
  - 新增显式 `modelscope` 协议识别与归一化。
- 图像异步链路:
  - `apps/api/src/external-proxy.ts`
  - `apps/worker/src/worker.ts`
  - `apps/api/src/apimart-video-adapter.ts`
  - `apps/worker/src/worker-apimart-video-adapter.ts`
  - `apps/api/src/provider-response-parser.ts`
  - `apps/worker/src/worker-provider-utils.ts`
  - 新增 / 修复：
    - `ModelScope` 图像异步提交头 `X-ModelScope-Async-Mode: true`
    - `ModelScope` 图像轮询头 `X-ModelScope-Task-Type: image_generation`
    - `ModelScope` 图像任务提取 `task_id / task_status`
    - 兼容线上旧 Provider 记录仍是 `protocol=openai` 但 `baseUrl` 指向 `api-inference.modelscope.cn`
    - `APIMart` 图像任务提取不再误把普通 `request_id/id` 当异步任务 ID
- ModelScope 图像编辑补强:
  - `apps/api/src/external-proxy.ts`
  - `apps/worker/src/worker.ts`
  - 对参考图输入增加 `image / images / image_url / image_urls` 兼容别名。
- 输出素材落地补强:
  - `apps/worker/src/output-materials.ts`
  - `apps/api/src/server.ts`
  - 当上游图片下载返回 `application/octet-stream` 但 URL 扩展名明确是图片时，允许按图片保存，避免误判“不是图片”。
- 验证脚本:
  - `scripts/verify-modelscope-image-adapter-contract.ts`
    - 新增 `ModelScope` 参考图请求别名断言。
  - `scripts/verify-modelscope-image-proxy.mjs`
  - `scripts/verify-agnes-modelscope-concurrency.mjs`

验证:

- 本地:
  - `npm run type-check -w @xinghuan/api`
  - `npm run type-check -w @xinghuan/worker`
  - `npm run verify:modelscope-image-adapter-contract`
  - `npm run verify:provider-generation-task-service`
  - `npm run verify:provider-generation-worker`
  - `npm run build:single-port`
- 灰度部署:
  - `20260612-modelscope-image-protocol-gray-r1`
  - `20260612-modelscope-image-edit-fix-gray-r2`
  - `20260612-modelscope-image-materialize-fix-gray-r3`
- 灰度真实验收:
  - `Agnes` 图像生成成功
  - `魔搭 Qwen/Qwen-Image-Edit` 图像编辑成功
  - 混合并发 4 个图像任务成功：
    - 2 个 `Agnes`
    - 2 个 `魔搭`
  - 魔搭任务 `raw.adapter = modelscope-image`
- 生产部署:
  - `20260612-modelscope-image-protocol-prod-r2`
- 生产真实验收:
  - `Agnes` 图像生成成功
  - `魔搭 Qwen/Qwen-Image-Edit` 图像编辑成功
  - 生产图像任务进入独立队列：
    - `xinghuan:tasks:prod:image`
  - 魔搭任务 `raw.adapter = modelscope-image`

结果:

- 通过

影响:

- 魔搭图像模型不再误走 APIMart 图像异步协议。
- 线上旧的魔搭 Provider 即使数据库里暂时还是 `protocol=openai`，只要 `baseUrl` 是 `api-inference.modelscope.cn`，也能走正确的 `ModelScope` 图像分支。
- `Qwen-Image-Edit` 这类图像编辑模型现在可以通过画布任务链路正常处理参考图和输出素材落地。

风险与注意:

- `Qwen/Qwen-Image-Edit` 是图像编辑模型，不是纯文生图模型；没有参考图时会返回上游 `400 requires image upload`，这属于模型能力要求，不是协议故障。
- 部分上游图片下载地址虽然实际是图片，但会返回 `application/octet-stream`；当前已按“URL 扩展名明确是图片”做受控放宽，后续接新平台时仍需观察是否存在异常误判。
- Windows 本机通过 `scp` 上传 release 包时，对中文路径的直接绝对路径引用不稳定；后续优先在 `dist-release/` 目录下执行相对路径上传并补远端 `sha256` / `tar_ok` 校验。

### 分类队列并发改造并推送灰度准备

目标:

- 解决长视频任务堵住后发短音频任务的问题。
- 将 Worker 从单总队列串行消费改为图片 / 音频 / 视频分队列独立并发消费。
- 让后台管理员可以按类别调节并发上限，且每类限制在 `1..4`。

变更:

- 共享结构:
  - `packages/shared/src/task-queue-settings.ts`
    - 新增任务队列能力定义：
      - `image`
      - `audio`
      - `video`
    - 新增统一默认值、归一化、并发 clamp 和队列名生成逻辑
  - `packages/shared/src/index.ts`
    - 导出任务队列设置相关类型与工具
- API / 后台:
  - `apps/api/src/provider-generation-task-service.ts`
    - 任务创建时不再只知道单一队列名，而是按 `capability` 调用入队
    - 任务日志记录实际入队的 Redis 队列名
  - `apps/api/src/server.ts`
    - 新增 `taskQueueSettings` 持久化读写
    - 文件仓库与 PostgreSQL 仓库都支持保存任务并发设置
    - `/api/admin/system`
      - `GET` 返回分类并发配置与各队列深度
      - `PATCH` 支持管理员更新分类并发
    - 后台手工建任务、重试任务、视频任务补录入口统一改为按能力分队列入队
  - `apps/api/db/008_task_queue_settings.sql`
    - 新增 `xh_system_settings`
    - 持久化 `task_queue_settings`
- Worker:
  - `apps/worker/src/worker.ts`
    - 从单 `brPop(xinghuan:tasks)` 改为：
      - `xinghuan:tasks:image`
      - `xinghuan:tasks:audio`
      - `xinghuan:tasks:video`
    - 每类按配置创建多个消费槽位
    - 当前默认都是 `4`
    - Worker 启动日志会输出三类实际监听队列与并发槽位
- Admin:
  - `apps/admin/src/admin-types.ts`
    - 新增系统页 `taskQueueSettings` 与分类队列状态类型
  - `apps/admin/src/admin-readonly-panels.tsx`
    - 系统状态面板新增：
      - 按类别并发显示
      - 按类别深度显示
      - “任务并发设置”编辑区
  - `apps/admin/src/main.tsx`
    - 打通系统页保存动作，直接提交 `/api/admin/system`
- 验证脚本:
  - `scripts/verify-provider-generation-task-service.mjs`
  - `scripts/verify-provider-generation-worker.mjs`
  - `scripts/verify-provider-generation-admin-contract.mjs`
    - 全部补充分类队列并发相关断言

验证:

- `node scripts/verify-provider-generation-task-service.mjs`
- `node scripts/verify-provider-generation-worker.mjs`
- `node scripts/verify-provider-generation-admin-contract.mjs`
- `npm run type-check -w @xinghuan/shared`
- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/worker`
- `npm run type-check -w @xinghuan/admin`
- `npm run verify:provider-generation-task-service`
- `npm run verify:provider-generation-worker`
- `npm run verify:provider-generation-admin-contract`
- `npm run build:single-port`

结果:

- 全部通过

影响:

- 现在多任务不会再因为共用一个 Worker 串行循环而互相堵死。
- 管理员可以在后台按类别调节并发，而不是只能接受固定全局行为。
- Redis 观测维度从“单总队列深度”升级为“分类队列深度 + 分类并发”。

### 分类队列并发灰度发布与验收

目标:

- 将“分类独立队列 + 分类独立并发”改造推送到灰度。
- 确认 migration、服务切换、公网入口和分类队列健康都正常。

发布:

- 灰度 release：
  - `20260612-provider-task-queue-concurrency-gray-r2-local`
- 上一灰度回滚点：
  - `/opt/apps/xinghuan-canvas-next/releases/20260612-provider-task-standardization-gray-r1-aa5f499`

服务器动作:

- 本机执行：
  - `npm run package:release -- 20260612-provider-task-queue-concurrency-gray-r2-local`
- 上传：
  - `/tmp/20260612-provider-task-queue-concurrency-gray-r2-local.tar.gz`
- 服务器执行：
  - 解压到 `/opt/apps/xinghuan-canvas-next/releases/20260612-provider-task-queue-concurrency-gray-r2-local`
  - `npm ci`
  - 加载 `/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`
  - `node scripts/db-migrate.mjs`
    - `applied=["008_task_queue_settings.sql"]`
    - `skipped=7`
  - 切换：
    - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260612-provider-task-queue-concurrency-gray-r2-local`
  - 重启：
    - `xinghuan-canvas-next.service`
    - `xinghuan-canvas-next-worker.service`

验收:

- 服务层:
  - `systemctl is-active xinghuan-canvas-next.service` => `active`
  - `systemctl is-active xinghuan-canvas-next-worker.service` => `active`
  - `readlink -f /opt/apps/xinghuan-canvas-next/current` => 新 release
  - `curl http://127.0.0.1:18200/api/status` => `environment=gray`
- 公网入口:
  - `https://canvas-next.hhh2121.xyz/` => `200`
  - `https://canvas-next.hhh2121.xyz/admin` => `200`
  - `https://canvas-next.hhh2121.xyz/api/status` => `environment=gray`
- 分类队列:
  - `LLEN xinghuan:tasks:image` => `0`
  - `LLEN xinghuan:tasks:audio` => `0`
  - `LLEN xinghuan:tasks:video` => `0`

影响:

- 灰度环境已经开始使用新的分类队列并发模型。
- 后续只需要再做一次登录态真实并发任务验收，就可以判断是否推进生产。

### 分类队列并发正式发布与验收

目标:

- 将灰度已通过的分类队列并发方案同步到正式环境。
- 确认正式数据库 migration、服务状态、公网入口和正式分类队列健康都正常。

发布:

- 正式 release：
  - `20260612-provider-task-queue-concurrency-prod-r1-local`
- 上一正式回滚点：
  - `/opt/apps/xinghuan-canvas/releases/20260612-video-upstream-json-guard-prod-r1`

服务器动作:

- 本机执行：
  - `npm run package:release -- 20260612-provider-task-queue-concurrency-prod-r1-local`
- 上传：
  - `/tmp/20260612-provider-task-queue-concurrency-prod-r1-local.tar.gz`
- 服务器执行：
  - 解压到 `/opt/apps/xinghuan-canvas/releases/20260612-provider-task-queue-concurrency-prod-r1-local`
  - `npm ci`
  - 加载 `/opt/apps/xinghuan-canvas/shared/canvas.env`
  - `node scripts/db-migrate.mjs`
    - `applied=["008_task_queue_settings.sql"]`
    - `skipped=7`
  - 切换：
    - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260612-provider-task-queue-concurrency-prod-r1-local`
  - 重启：
    - `xinghuan-canvas.service`
    - `xinghuan-canvas-worker.service`
    - `xinghuan-canvas-output-prune.timer`

验收:

- 服务层:
  - `systemctl is-active xinghuan-canvas.service` => `active`
  - `systemctl is-active xinghuan-canvas-worker.service` => `active`
  - `systemctl is-active xinghuan-canvas-output-prune.timer` => `active`
  - `readlink -f /opt/apps/xinghuan-canvas/current` => 新 release
  - `curl http://127.0.0.1:18100/api/status` => `environment=production`
- 公网入口:
  - `https://canvas.hhh2121.xyz/` => `200`
  - `https://canvas.hhh2121.xyz/admin` => `200`
  - `https://canvas.hhh2121.xyz/api/status` => `environment=production`
- 分类队列:
  - `LLEN xinghuan:tasks:prod:image` => `0`
  - `LLEN xinghuan:tasks:prod:audio` => `0`
  - `LLEN xinghuan:tasks:prod:video` => `0`

影响:

- 正式环境已经启用新的分类队列并发模型。
- 现在灰度和正式都统一到了同一套分类并发标准方案。

### Provider 生成任务标准化灰度发布与验收

目标:

- 将 Provider 生成任务标准化这组提交推送到灰度环境。
- 完成灰度服务、公网入口、任务接口和队列健康的验收确认。

发布:

- 灰度 release：
  - `20260612-provider-task-standardization-gray-r1-aa5f499`
- 对应本地提交：
  - `aa5f499 docs: add provider generation task rollout checklist`
- 上一灰度回滚点：
  - `/opt/apps/xinghuan-canvas-next/releases/20260612-external-video-task-gray-r1`

服务器动作:

- 本机执行：
  - `npm run package:release -- 20260612-provider-task-standardization-gray-r1-aa5f499`
- 上传：
  - `/tmp/20260612-provider-task-standardization-gray-r1-aa5f499.tar.gz`
- 服务器执行：
  - 解压到 `/opt/apps/xinghuan-canvas-next/releases/20260612-provider-task-standardization-gray-r1-aa5f499`
  - `npm ci`
  - 加载 `/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`
  - `node scripts/db-migrate.mjs`
    - `applied=[]`
    - `skipped=7`
  - 切换：
    - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260612-provider-task-standardization-gray-r1-aa5f499`
  - 重启：
    - `xinghuan-canvas-next.service`
    - `xinghuan-canvas-next-worker.service`

验收:

- 服务层:
  - `systemctl is-active xinghuan-canvas-next.service` => `active`
  - `systemctl is-active xinghuan-canvas-next-worker.service` => `active`
  - `curl http://127.0.0.1:18200/api/status` => `environment=gray`
- 公网入口:
  - `https://canvas-next.hhh2121.xyz/` => `200 text/html`
  - `https://canvas-next.hhh2121.xyz/admin` => `200 text/html`
  - `https://canvas-next.hhh2121.xyz/api/status` => `200 application/json`
  - 注意：
    - 先前使用 `HEAD /` 与 `HEAD /admin` 会收到 `404 JSON`
    - 当前页面验收必须按真实 `GET` 请求判断，`GET` 结果正常
- 新任务接口未登录守卫:
  - `POST /api/proxy/external/image/task` => `AUTH_REQUIRED`
  - `POST /api/proxy/external/audio/task` => `AUTH_REQUIRED`
  - `POST /api/proxy/external/video/task` => `AUTH_REQUIRED`
- 队列健康:
  - `redis-cli ... PING` => `PONG`
  - `LLEN xinghuan:tasks` => `0`

边界与说明:

- 当前 release 包依然是运行时精简包，不包含本地这轮新增的 `scripts/verify-provider-generation-*.{ts,mjs}` 验证脚本。
- 因此这次灰度验收采用：
  - 发布前本地完整验证矩阵
  - 发布后服务器服务活性 + 公网 smoke + 任务接口守卫 + Redis 健康
  组合方式，而不是在服务器 release 目录直接复跑同一批本地脚本。

影响:

- Provider 生成任务标准化这轮改造已进入灰度运行态。
- 当前灰度已经具备：
  - 图片任务提交接口
  - 音频任务提交接口
  - 视频任务提交接口
  - 后台执行模式结构化配置
  - 统一的任务化运行主线

### Provider 生成任务标准化文档与验收收口

目标:

- 把本轮已经完成的 Provider 生成任务标准化改造补充进长期记忆、进度文档和运维清单。
- 固化“后台发布模型默认任务化”的验收顺序，避免后续灰度/生产切换时遗漏关键检查项。

变更:

- 文档与记忆收口:
  - `MEMORY.md`
    - 补充标准执行模式：
      - `sync_inline`
      - `async_poll`
      - `async_poll_then_final_lookup`
      - `worker_queue`
    - 明确默认策略：
      - `chat -> sync_inline`
      - `image/video/audio -> worker_queue`
    - 明确 `advancedConfig.mode` 与 `executionMode` 不是同一层概念
  - `docs/prd/v0.1.0/progress.md`
    - 补记图片/视频/音频后台发布模型统一走“提交任务 -> Worker 执行 -> 前端轮询 -> 素材落库”的标准主线
    - 补记后台模型编辑器与 AI 协助配置已经进入结构化 `executionMode` 阶段
  - `ops/README.md`
    - 新增 Provider 任务标准化 rollout checklist 入口
    - 修正灰度/生产数据库关系描述
- 新增运维清单:
  - `ops/provider-generation-task-rollout-checklist-2026-06-12.md`
    - 固化灰度优先、服务活性、任务提交、轮询状态、素材落库、后台任务面板、取消/重试和生产 smoke 的检查顺序

验证:

- 文档收口后继续执行完整本地验收矩阵：
  - `npm run build:single-port`
  - `npm run verify:provider-generation-task-contract`
  - `npm run verify:provider-generation-task-service`
  - `npm run verify:provider-generation-worker`
  - `npm run verify:provider-generation-web-task-consumption`
  - `npm run verify:provider-generation-admin-contract`
  - `node scripts/verify-admin-assistant-structured-analysis-contract.mjs`
  - `node scripts/verify-admin-task-panel-contract.mjs`

影响:

- 后续新增图片 / 视频 / 音频 Provider 时，不再需要先决定“要不要继续走同步直返”，默认先套标准任务链路。
- 后台管理员、AI 协助配置、画布节点、Worker 和运维验收，现在都围绕同一套 `executionMode + task status + materialization` 约定推进。

### Provider 生成任务标准化第二阶段收口

目标:

- 把后台发布模型的图片、视频、音频链路进一步统一到“提交任务 -> Worker 执行 -> 前端轮询 -> 素材落库”的标准方案。
- 补齐后台模型执行模式、AI 协助配置和任务观测的结构化能力，避免后续新 Provider 继续走分叉逻辑。

变更:

- 前端任务消费:
  - `apps/web/src/services/generation.ts`
    - 新增：
      - `submitExternalImageTask`
      - `queryExternalImageTask`
      - `submitExternalAudioTask`
      - `queryExternalAudioTask`
  - `apps/web/src/components/nodes/ImageNode.tsx`
    - 后台发布模型与扩展平台图像链路统一改为 `taskId + polling`
    - 增加后台图像任务轮询与停止时轮询清理
  - `apps/web/src/components/nodes/AudioNode.tsx`
    - Provider 音频链路改为 `taskId + polling`
    - 保留 `Legacy Suno` 历史链路，不与标准化 Provider 任务链路混用
  - 新增契约脚本：
    - `scripts/verify-provider-generation-web-task-consumption.mjs`
- 后台执行模式与 AI 协助配置:
  - `apps/admin/src/admin-model-editor.tsx`
    - 新增结构化 `executionMode` 下拉：
      - `worker_queue`
      - `sync_inline`
      - `async_poll`
      - `async_poll_then_final_lookup`
  - `apps/admin/src/admin-api-settings-panel.tsx`
    - AI 协助配置结果新增 `executionMode` 展示
    - 应用草案时会把 `executionMode` 回填到模型草稿与 `advancedConfig.executionMode`
  - `apps/admin/src/admin-task-panel.tsx`
    - 补充能力 / Provider / 状态筛选
    - 失败任务优先显示清晰失败原因，而不是只显示原始日志拼接
  - `apps/admin/src/admin-types.ts`
    - 模型、任务、AI 分析结果新增 `executionMode` 与任务详情类型
  - `apps/api/src/server.ts`
    - 模型记录新增 `executionMode` 归一化
    - 通过 `advancedConfig.executionMode` 做前后端桥接，避免先动数据库 schema
    - AI 协助分析结果新增 `executionMode`
  - 新增契约脚本：
    - `scripts/verify-provider-generation-admin-contract.mjs`

验证:

- 前端:
  - `node scripts/verify-provider-generation-web-task-consumption.mjs`
  - `npm run verify:provider-generation-web-task-consumption`
  - `npm run build -w @xinghuan/web`
- 后台 / API:
  - `npm run build -w @xinghuan/admin`
  - `npm run build -w @xinghuan/api`
  - `npm run verify:provider-generation-admin-contract`
  - `node scripts/verify-admin-assistant-structured-analysis-contract.mjs`
  - `node scripts/verify-admin-task-panel-contract.mjs`
- 本地提交:
  - `0d62d3e feat: move provider image and audio flows to task polling`
  - `3481a1c feat: standardize admin execution mode controls`

影响:

- 现在后台发布模型的图片 / 视频 / 音频已经形成统一的任务化主线，前端不再依赖长请求等待上游完成。
- 后台管理员现在可以显式标记模型执行模式，AI 协助配置也能把“链路模板”和“执行模式”作为结构化建议返回。
- 后续新接入异步 Provider 时，应优先走：
  - `executionMode`
  - `chainTemplate`
  - `advancedConfig`
  这套标准化模板，而不是继续新增零散分支。

### 视频上游 HTML / 非 JSON 响应兜底修复并推送灰度

目标:

- 修复画布视频节点在上游返回 HTML 或非 JSON 时直接透出 `Unexpected token '<'` 的问题。
- 重新确认该问题是否仍由 Cloudflare 橙云本身引起，避免后续继续误判。

分析:

- 当前灰度与正式运行进程都已加载：
  - `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN=https://files.hhh2121.xyz`
- 使用真实签名规则生成的灰度 Provider 文件 URL：
  - `https://files.hhh2121.xyz/api/provider-files/gray/...`
  - 公网验收返回 `200 image/png`
- 说明当前参考图外链出口本身可访问，因此“橙云切换后文件回抓天然失效”不再成立。
- 仍出现 `Unexpected token '<'` 的核心原因转为：
  - 后端部分上游响应解析仍存在裸 `JSON.parse(...)`
  - 一旦上游返回 HTML 挑战页、错误页或其它非 JSON 文本，就会把原生解析异常透给前端

变更:

- `apps/api/src/external-proxy.ts`
  - 新增统一上游响应解析兜底：
    - `parseUpstreamJson(...)`
    - `summarizeUpstreamBody(...)`
  - 扩展视频提交、视频轮询、最终结果、图像轮询、扩展对话、扩展音频等链路统一改为带 `content-type` 的安全解析
  - 新报错会明确区分：
    - 返回网页 HTML
    - 返回非 JSON 响应
- `apps/api/src/server.ts`
  - 强化 `looksLikeHtml(...)`，补充 `body/head/just a moment/cf-browser-verification/attention required` 等识别
  - 新增统一上游响应解析兜底：
    - `parseUpstreamJson(...)`
    - `summarizeUpstreamBody(...)`
  - 主服务里的视频轮询、图像轮询、模型列表探测、音频测试、文本测试、图像生成等链路统一改为安全解析

验证:

- 本地：
  - `npm run build:single-port` 通过
  - `npm run verify:single-port` 通过
  - `npm run verify:generation-json-response-contract` 通过
- 灰度发布：
  - release：`20260612-video-upstream-json-guard-gray-r2`
  - 当前指针：
    - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260612-video-upstream-json-guard-gray-r2`
  - `xinghuan-canvas-next.service` / `xinghuan-canvas-next-worker.service` 均为 `active`
  - `http://127.0.0.1:18200/api/status` => `environment=gray`
  - `https://canvas-next.hhh2121.xyz/api/status` => `environment=gray`
  - 灰度产物中已可检出新错误文案：
    - `返回网页 HTML，请检查 Base URL、Cloudflare/WAF 或上游鉴权`
    - `返回非 JSON 响应`

影响:

- 这轮修复首先解决的是“错误不可读”的问题，后续即使仍有某个具体视频 Provider 返回 HTML，也能直接看出是提交接口、轮询接口还是最终结果接口出的错。
- 当前证据表明：这个报错不能再简单归因为橙云本身；更可能是某个具体上游接口或模型链路返回了 HTML / 非 JSON。

### 视频上游 HTML / 非 JSON 响应兜底同步生产

目标:

- 修复用户在正式画布中仍看到 `Unexpected token '<', "<!DOCTYPE"... is not valid JSON` 的问题。
- 重新核对为什么灰度已有新文案，但用户画布仍显示旧文案。

根因:

- 灰度已经部署到 `20260612-video-upstream-json-guard-gray-r2`，但正式环境仍停在：
  - `20260612-video-html-json-guard-r1`
- 正式前端已经包含 `readJsonResponse`，但正式后端缺少 `parseUpstreamJson`。
- 因此正式环境里如果上游视频接口返回 HTML / 非 JSON，后端仍会由裸 `JSON.parse(...)` 产生原生错误，并把：
  - `Unexpected token '<', "<!DOCTYPE"... is not valid JSON`
  放进 JSON 的 `error` 字段返回给前端。
- 前端并不是这次旧文案的根因，它只是展示了正式后端返回的旧错误内容。

后台直测与画布失败的差异:

- 后台“模型连通性测试”不等价于画布真实视频生成。
- 当前后台模型测试里，`video_generation` 会返回“生成类模型测试可能产生费用，请在下一阶段通过专用低成本测试按钮启用”，并不会完整跑带参考素材的视频生成。
- 画布视频节点会额外携带：
  - 上游文本 prompt
  - 参考图 `images`
  - 首帧 / 尾帧
  - `providerParams.modelRecordId`
  这条链路才是用户截图里的真实失败链路。

变更:

- 使用同一构建产物发布正式环境：
  - release：`20260612-video-upstream-json-guard-prod-r1`

正式验收:

- `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260612-video-upstream-json-guard-prod-r1`
- `xinghuan-canvas.service` => `active`
- `xinghuan-canvas-worker.service` => `active`
- `http://127.0.0.1:18100/api/status` => `environment=production`
- `https://canvas.hhh2121.xyz/api/status` => `environment=production`
- 未登录 `POST https://canvas.hhh2121.xyz/api/proxy/external/video` 返回：
  - `401`
  - `Content-Type: application/json`
  - `{"ok":false,"success":false,"error":"AUTH_REQUIRED"}`
- 正式后端产物可检出：
  - `parseUpstreamJson`
  - `返回网页 HTML，请检查 Base URL、Cloudflare/WAF 或上游鉴权`
  - `返回非 JSON 响应`
- 生产 Provider 文件签名链路实测：
  - `https://files.hhh2121.xyz/api/provider-files/production/...`
  - 返回 `200 image/jpeg`

影响:

- 正式环境现在不会再把上游 HTML / 非 JSON 响应以原生 `Unexpected token '<'` 形式透出。
- 如果同一视频节点仍失败，下一次错误应能明确指出是：
  - `扩展视频提交接口`
  - `视频任务轮询接口`
  - `视频最终结果接口`
  - 或 `扩展视频生成接口`
  的哪一段返回了 HTML / 非 JSON。

### 输出素材清理定时任务漏包修复

目标:

- 修复生产与灰度 `xinghuan-canvas-output-prune.service` / `xinghuan-canvas-next-output-prune.service` 因发布包缺少清理脚本而失败的问题。
- 给 release 打包流程补一层校验，避免后续发版再次遗漏运行时脚本。

根因:

- 两个 systemd oneshot 服务都执行 `npm run cleanup:output-materials`。
- 当前线上 release 的 `package.json` 保留了 `cleanup:output-materials`，但 `scripts/` 目录只包含 `start-single-port.mjs` 与 `db-migrate.mjs`，缺少 `prune-old-output-materials.mjs`。
- 本地 `scripts/package-release.mjs` 的 `requiredPaths` 与 `includedPaths` 都没有把 `scripts/prune-old-output-materials.mjs` 纳入 release 清单，导致每次打包都会漏掉这个运行时脚本。

变更:

- `scripts/package-release.mjs`
  - 把 `scripts/prune-old-output-materials.mjs` 加入 `requiredPaths`。
  - 把 `scripts/prune-old-output-materials.mjs` 加入 `includedPaths`。
- `scripts/verify-release-package-contract.mjs`
  - 新增 release 契约校验，要求打包脚本必须包含 `scripts/prune-old-output-materials.mjs`。
- 服务器热修:
  - 将 `scripts/prune-old-output-materials.mjs` 补入：
    - `/opt/apps/xinghuan-canvas/current/scripts/`
    - `/opt/apps/xinghuan-canvas-next/current/scripts/`

验证:

- 本地 `node scripts/verify-release-package-contract.mjs` 先失败，补齐打包清单后通过。
- 服务器生产：
  - `cd /opt/apps/xinghuan-canvas/current && npm run cleanup:output-materials:dry-run` 通过。
  - `systemctl start xinghuan-canvas-output-prune.service` 后返回 `status=0/SUCCESS`。
- 服务器灰度：
  - `cd /opt/apps/xinghuan-canvas-next/current && npm run cleanup:output-materials:dry-run` 通过。
  - `systemctl start xinghuan-canvas-next-output-prune.service` 后返回 `status=0/SUCCESS`。
- 定时器下一次触发时间:
  - 生产：`2026-06-13 00:00:00 CST`
  - 灰度：`2026-06-13 04:23:34 CST`

影响:

- 当前生产与灰度的输出素材清理任务恢复可用。
- 后续只要通过当前 release 打包脚本发版，就会自动携带清理脚本，不会再因为漏包导致定时任务失败。

风险:

- 这次线上热修只是给当前 `current` release 补了单个脚本文件；如果后续绕过仓库里的 `package-release.mjs` 手工打包，仍可能再次漏包。

下一步:

- 下次正式发版时继续使用已修复的 `package-release.mjs`，让 release 内容与线上热修重新对齐。

### 画布视频生成 `Unexpected token '<'` 前端兜底修复

目标:

- 修复画布视频节点在收到 HTML 响应时，直接抛出 `Unexpected token '<'` 的原始 JSON 解析异常。
- 把错误转换为可读的诊断信息，避免用户只能看到前端底层异常。

根因:

- `apps/web/src/services/generation.ts` 中多个视频相关请求直接执行 `await response.json()`。
- 当接口实际返回 HTML 页面时，例如登录页、网关错误页、上游错误落地页，前端会直接抛出：
  - `Unexpected token '<', "<!DOCTYPE"... is not valid JSON`

变更:

- `apps/web/src/services/generation.ts`
  - 新增 `readJsonResponse()` 与 `looksLikeHtmlResponse()`。
  - 对以下视频相关请求统一改成“先读文本，再判断 JSON / HTML”：
    - `generateExternalVideo`
    - `submitVideoFal`
    - `queryVideoFal`
    - `submitVideo`
    - `queryVideo`
  - 同时顺手覆盖：
    - `generateImage`
    - `generateExternalImage`
    - `generateExternalAudio`
    - `submitImageAsync`
    - `queryImageStatus`
    - `cancelGenerationTask`
- 新的用户可见报错形态会变成：
  - `扩展视频生成接口返回了 HTML 页面，请检查登录状态、网关代理或上游配置`
  - 而不是底层 `Unexpected token '<'`

发布:

- Gray release:
  - `/opt/apps/xinghuan-canvas-next/releases/20260612-video-html-json-guard-r1`
- Production release:
  - `/opt/apps/xinghuan-canvas/releases/20260612-video-html-json-guard-r1`

验证:

- `npm run build -w @xinghuan/web` => 通过
- 灰度 `127.0.0.1:18200/api/status` => 正常
- 正式 `127.0.0.1:18100/api/status` => 正常
- 灰度与正式 `current` 均已切到 `20260612-video-html-json-guard-r1`

影响:

- 这次修复的是“前端错误呈现与解析兜底”层，不会改变真实视频 Provider 的请求协议。
- 如果后端或上游确实返回了 HTML，前端现在会给出明确诊断，而不是继续抛原始 JSON 解析异常。

### Provider Files 公网出口从裸 IP 切到 files 域名

目标:

- 去掉 `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN=http://101.33.75.38` 的裸 IP 暴露。
- 保留匿名签名回抓能力，不打断上游 Provider 获取参考图/音频。
- 修复灰度和正式共用单一公网出口时可能串到同一 `18200` 的问题。

变更:

- 代码:
  - `apps/api/src/provider-file-access.ts`
    - 新增 `ProviderFileScope`：`local` / `gray` / `production`
    - Provider 文件签名 URL 支持环境作用域路径：
      - `/api/provider-files/gray/...`
      - `/api/provider-files/production/...`
    - HMAC 签名加入 scope
    - 请求解析兼容旧格式与新格式
  - `apps/api/src/external-proxy.ts`
    - 外部图像/视频/LLM 参考素材签名时带入当前环境 scope
  - `apps/api/src/server.ts`
    - 通过 `environment` 向外部代理签名逻辑传入 `gray` / `production` / `local`
- 验收脚本:
  - `scripts/verify-provider-file-access-contract.ts`
    - 增加 scoped URL 合约
  - `scripts/verify-external-image-proxy.mjs`
  - `scripts/verify-external-video-proxy.mjs`
  - `scripts/verify-external-chat-proxy.mjs`
    - 改为校验 `/api/provider-files/` 路径与签名参数，不再假设必须与当前 API 同域
- 服务器:
  - `/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`
  - `/opt/apps/xinghuan-canvas/shared/canvas.env`
    - `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN=https://files.hhh2121.xyz`
  - `/etc/nginx/sites-available/files.hhh2121.xyz.conf`
    - 新增灰度/生产 Provider 文件分流
    - 旧灰度无 scope 路径兼容转发到 `18200`
  - `/etc/nginx/sites-available/hermes-media-relay`
    - 裸 IP 的 `/api/provider-files/...` 改为 `302` 跳转到 `https://files.hhh2121.xyz$request_uri`

发布:

- Gray release:
  - `/opt/apps/xinghuan-canvas-next/releases/20260612-provider-files-files-domain-scope-r1`
- Production release:
  - `/opt/apps/xinghuan-canvas/releases/20260612-provider-files-files-domain-scope-r1`

验证:

- 本地代码合约:
  - `npm run verify:provider-file-access-contract` => 通过
  - `npm run build -w @xinghuan/api` => 通过
  - `npm run build -w @xinghuan/worker` => 通过
  - `npm run build:single-port` => 通过
- 服务器直验:
  - `https://files.hhh2121.xyz/api/provider-files/gray/...` => `200`
  - `https://files.hhh2121.xyz/api/provider-files/production/...` => `200`
  - `http://101.33.75.38/api/provider-files/...` => `302`
- 服务器脚本验收:
  - 灰度 `verify-external-image-proxy.mjs` => 全部通过
  - 正式 `verify-external-image-proxy.mjs` => 全部通过
  - 灰度 `verify-external-video-proxy.mjs` => 通过
- 公网状态:
  - `https://canvas-next.hhh2121.xyz/api/status` => `environment=gray`
  - `https://canvas.hhh2121.xyz/api/status` => `environment=production`

影响:

- 新生成的 Provider 参考素材 URL 已统一从裸 IP 改为 `files.hhh2121.xyz`。
- 灰度和正式现在在同一个公网文件域名下，按 scope 路径分流，不再共指向灰度 `18200`。
- 旧灰度裸 IP URL 不再直接出内容，但仍通过 `302` 保留兼容跳转。

风险与后续:

- 旧格式 `/api/provider-files/{userId}/...` 当前仍保留灰度兼容，后续可在观察无残留任务后再下线。
- 当前采用的是“现有 `files` 域名专用出口”方案，而不是新增独立 `provider-files` 子域名；若后续具备 Cloudflare 自动化入口，可再评估是否继续拆分。

### files.hhh2121.xyz 橙云封口完成与影响补记

目标:

- 在用户已把 `files.hhh2121.xyz` 切到 Cloudflare 橙云后，补完文件站源站封口。
- 验证封口后静态文件公网访问是否正常。
- 记录封口后对本机/服务器解析与现有 Provider 回抓链路的真实影响。

变更:

- 服务器 Nginx:
  - `/etc/nginx/sites-available/files.hhh2121.xyz.conf`
  - 在 `server_name files.hhh2121.xyz;` 后加入：
    - `include /etc/nginx/snippets/cloudflare-only.conf;`
- 执行：
  - `sudo nginx -t`
  - `sudo systemctl reload nginx`

验证:

- 公网:
  - `GET https://files.hhh2121.xyz/images/smoke.txt` => `200`
  - `GET https://files.hhh2121.xyz/healthz` => `200`
  - 响应头显示 `Server: cloudflare`
- 源站直打:
  - `--resolve files.hhh2121.xyz:443:101.33.75.38 https://files.hhh2121.xyz/images/smoke.txt` => `403`
  - `--resolve files.hhh2121.xyz:443:101.33.75.38 https://files.hhh2121.xyz/healthz` => `200`
- 服务器侧补充观察:
  - `dig @1.1.1.1 files.hhh2121.xyz` 已返回 Cloudflare 边缘 IP
  - 但服务器本机解析短时仍可能命中旧缓存并看到 `101.33.75.38`
  - 在该缓存未收敛前，服务器本机直接访问 `https://files.hhh2121.xyz/...` 可能出现假性 `403`

影响:

- `files.hhh2121.xyz` 现在也已纳入 Cloudflare 源站封口范围。
- 目前四个主要 Web 入口中：
  - `canvas.hhh2121.xyz`
  - `canvas-next.hhh2121.xyz`
  - `hermes.hhh2121.xyz`
  - `files.hhh2121.xyz`
  都已具备公开访问走 Cloudflare、已知源站直打受限的状态。
- `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN=http://101.33.75.38` 的 Provider 回抓设计本轮未调整，仍继续保留裸 IP 签名回抓入口。

风险与后续:

- 当前新增的不是业务中断风险，而是“服务器本机 DNS 缓存未收敛导致误判”的运维认知风险。
- 后续若要继续收口暴露面，应优先规划把 `/api/provider-files/...` 的上游回抓出口逐步从裸 IP 迁出，而不是误把 `files` 封口完成当作文件中转链路已彻底隔离。

## 2026-06-11

### Cloudflare 橙云切换后的源站封口与影响验收

目标:

- 在用户完成主要域名橙云切换后，补齐 `canvas` / `canvas-next` 的源站封口。
- 确认封口后公网访问不受影响。
- 评估 `files.hhh2121.xyz` 是否适合同步套用相同策略。

现状核查:

- `hermes.hhh2121.xyz` 已有 `cloudflare-only.conf`，源站直打返回 `403`。
- `canvas.hhh2121.xyz` 与 `canvas-next.hhh2121.xyz` 之前未做源站白名单，已知源站 IP 仍可直接绕过 Cloudflare。
- `files.hhh2121.xyz` 从服务器视角仍直接解析到 `101.33.75.38`，说明该域名当前仍为灰云直连。

变更:

- 服务器 Nginx:
  - 为 `/etc/nginx/sites-available/canvas.hhh2121.xyz` 的 HTTP/HTTPS server block 增加：
    - `include /etc/nginx/snippets/cloudflare-only.conf;`
  - 为 `/etc/nginx/sites-available/canvas-next.hhh2121.xyz` 的 HTTP/HTTPS server block 增加：
    - `include /etc/nginx/snippets/cloudflare-only.conf;`
- `files.hhh2121.xyz` 曾尝试加入相同白名单，但复验发现它当前仍是灰云直连，静态文件会被直接打成 `403`，因此已回退该改动，避免误伤现网文件服务。

验证:

- 公网:
  - `GET https://canvas.hhh2121.xyz` => `200`，`Server: cloudflare`
  - `GET https://canvas-next.hhh2121.xyz` => `200`，`Server: cloudflare`
  - `GET https://canvas.hhh2121.xyz/api/status` => `environment=production`
  - `GET https://canvas-next.hhh2121.xyz/api/status` => `environment=gray`
  - `GET https://hermes.hhh2121.xyz` => `302` 跳转 Cloudflare Access
- 源站直打:
  - `--resolve canvas.hhh2121.xyz:443:101.33.75.38` => `403`
  - `--resolve canvas-next.hhh2121.xyz:443:101.33.75.38` => `403`
  - `--resolve hermes.hhh2121.xyz:443:101.33.75.38` => `403`
- 文件站:
  - `https://files.hhh2121.xyz/images/smoke.txt` => `200`
  - `--resolve files.hhh2121.xyz:443:101.33.75.38 https://files.hhh2121.xyz/images/smoke.txt` => `200`
  - 说明 `files` 当前仍未封口，这是有意保留来避免灰云静态文件中断。
- Provider 文件直连入口:
  - `http://101.33.75.38/api/provider-files/test/input/test.png` => 应用层 `403`
  - 说明本轮封口未误伤依赖 `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN=http://101.33.75.38` 的上游参考素材回抓设计。

影响:

- 生产画布、灰度画布、Hermes 三个主要 Web 入口现在都不能再通过源站 IP 直接绕过访问。
- `files.hhh2121.xyz` 仍保持当前可用性，但暂时不能纳入同等封口策略。

风险与后续:

- 若后续要封住 `files.hhh2121.xyz`，前提是先把该域名真实切到 Cloudflare 橙云，或拆分为独立可控入口。
- 在 `files` 仍为灰云直连期间，不能直接把 `cloudflare-only.conf` 套到该站点，否则静态文件访问会中断。

### MiMo 音色克隆/音色定制与视频参考图直连灰度修复

目标:

- 修复画布音频节点中 `克隆音色` 仍报 `invalid base64 data` 的问题。
- 修复 `音色定制` 未传入参考音频时仍被上游判定为错误 voice 字段的问题。
- 修复视频生成节点参考图上传时，上游反向抓取本地参考图被 Cloudflare 挑战页拦截的问题。
- 完成灰度部署和真实链路验收。

根因:

- 外部音频代理读取 `sampleDataUrl` 时走了 `safeText()`，该函数会截断到 240 字符，导致完整音频 DataURL 被截断，上游返回 `invalid base64 data`。
- MiMo `voice_design` 模式不支持 `audio.voice`，但后端在非克隆模式下默认补入 `mimo_default`，导致上游返回 `audio.voice is not supported for voice design model`。
- 视频参考图会被签成当前访问域名下的 `/api/provider-files/...`，线上域名经过 Cloudflare；上游服务商服务器侧抓图时拿到 `Just a moment...` 挑战页，最终报 `AssetsUploadReverse: Upload failed, 403`。

变更:

- `apps/api/src/audio-provider-adapter.ts`
  - `voice_clone` 保留完整 `data:audio/...;base64,...` 作为 `audio.voice`。
  - `voice_design` 只发送 `audio.format`，不再发送不被上游支持的 `audio.voice`。
- `apps/api/src/external-proxy.ts`
  - 新增 `readAudioSampleDataUrl()`，完整保留克隆参考音频 DataURL，并设置 20MB 上限。
- `apps/api/src/server.ts`
  - 新增 `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN` 支持，外部 Provider 参考素材签名 URL 可与用户访问域名分离。
- `config/*.env.example`
  - 补充 `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN=` 模板项。
- `scripts/verify-external-audio-proxy.ts`
  - 增加 `voice_design` 不带 `audio.voice` 与克隆 DataURL 不截断的合约。
- `scripts/verify-provider-file-access-contract.ts`
  - 增加 Provider 文件公网源覆盖能力合约。

灰度发布:

- Release: `20260611-audio-clone-provider-files-gray-r6-b9ee3bd`
- 当前灰度指针:
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260611-audio-clone-provider-files-gray-r6-b9ee3bd`
- 灰度环境变量:
  - `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN=http://101.33.75.38`
- Nginx:
  - 为直连 IP 的 80 端口补充只读 `/api/provider-files/` 代理到 `127.0.0.1:18200`。
  - 保留其他路径默认 404，不暴露完整画布服务。

验证:

- 本地:
  - `npm run verify:external-audio-proxy`
  - `npm run verify:provider-file-access-contract`
  - `npm run verify:audio-provider-model-selection-contract`
  - `npm run verify:external-video-proxy`
  - `npm run build:single-port`
- 灰度:
  - `node scripts/db-migrate.mjs` => `{"ok":true,"applied":[],"skipped":7}`
  - `systemctl is-active xinghuan-canvas-next.service` => `active`
  - `systemctl is-active xinghuan-canvas-next-worker.service` => `active`
  - `GET http://127.0.0.1:18200/api/status` => `environment=gray`
  - `GET https://canvas-next.hhh2121.xyz/api/status` => `environment=gray`
  - `GET https://canvas-next.hhh2121.xyz/` => `200 text/html`
  - `GET https://canvas-next.hhh2121.xyz/admin` => `200 text/html`
  - 直连签名文件 `http://101.33.75.38/api/provider-files/...` => `200 image/png`
  - 灰度 API 真实 MiMo `voice_clone` 请求 => `200`，返回 1 条音频。
  - 灰度 API 真实 MiMo `voice_design` 请求 => `200`，返回 1 条音频。

影响:

- 克隆音色不再因后端截断 DataURL 而失败。
- 音色定制不再传入不兼容的 voice 字段。
- 上游视频服务商抓取参考图时可使用直连签名文件 URL，绕开 Cloudflare 挑战页。
- 该直连路径仍受签名、过期时间和只读限制保护。

风险与后续:

- 直连 IP 暴露的是签名文件读取路径，仍需保持 `exp/sig` 校验有效。
- 生产环境若出现同类视频参考图 403，需要同步设置生产 `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN` 并补生产 Nginx 的同类只读路径。

## 2026-06-10

### 灰度画布版本同步正式环境核对

目标:

- 按用户要求确认当前灰度画布版本是否已推送到正式环境。
- 避免把灰度 release 原样覆盖正式，导致正式后台 Provider footer 修复和供应商清理结果被回退。

核对结果:

- 灰度 current:
  - `/opt/apps/xinghuan-canvas-next/releases/20260610-output-complete-fit-copy-cleanup-gray-r3-f295040`
- 正式 current:
  - `/opt/apps/xinghuan-canvas/releases/20260610-admin-provider-footer-cleanup-prod-r2-f295040`
- 灰度与正式前台画布资源一致:
  - `index-CZT1hWSs.js`
  - `index-BATb1Dbj.css`
- 正式后台比灰度后台更新:
  - 灰度后台资源: `index-DMvEA4um.js` / `index-K_WB6hC4.css`
  - 正式后台资源: `index-Ckni9yF3.js` / `index-ClQ6DtDI.css`
  - 正式后台包含 `.provider-rail-footer` 修复。

结论:

- 当前灰度前台画布版本已在正式环境生效。
- 不应将灰度 release 目录原样切到正式，否则会回退正式后台 Provider 底部按钮修复。
- 正式环境保留组合版：灰度前台画布修复 + 正式后台 Provider footer 修复 + 供应商清理。

环境关系:

- 灰度入口: `https://canvas-next.hhh2121.xyz`，服务端口 `127.0.0.1:18200`，release 根目录 `/opt/apps/xinghuan-canvas-next`。
- 正式入口: `https://canvas.hhh2121.xyz`，服务端口 `127.0.0.1:18100`，release 根目录 `/opt/apps/xinghuan-canvas`。
- 两者当前使用同一个 PostgreSQL 数据库 `xinghuan_canvas_next` 和同一个 Redis `127.0.0.1:6379/0`。
- 两者 `dataDir` 不同:
  - 灰度: `/opt/apps/xinghuan-canvas-next/shared/data`
  - 正式: `/opt/apps/xinghuan-canvas/shared/data`

影响:

- 后台 Provider、模型、任务等数据库数据会在灰度和正式之间共享。
- 灰度中创建或更新的 Provider/模型/任务，正式环境也可能看到。
- 两个环境的上传/输出本地文件目录不同，因此如果数据库里引用了某一环境本地文件路径，另一环境可能需要依赖 `/files` 链路或重新生成/同步素材才能完整访问。
- 若后续需要彻底隔离灰度与正式，需要拆分数据库、Redis 队列命名空间和文件存储目录。

### 后台 API 平台列表底部按钮二次修复与供应商清理生产发布

目标:

- 修复后台 API 设置页左侧 `新增平台` 仍然与 Provider 列表视觉混在一起、随列表滚动的问题。
- 清理此前验收脚本和本地测试创建的无用 API 供应商。
- 正式环境只保留实际可用供应商：`GRSAI`、`ToAPIs`、`Apimart`。

根因:

- 上一版虽然把按钮放在 `.provider-list` 外，但 `.provider-rail` 仍依赖 `position: sticky + height: 100% + flex` 的剩余高度计算。
- 在实际后台视口中，侧栏高度约束不够硬，按钮区域容易与滚动列表产生视觉重叠。

变更:

- `apps/admin/src/admin-api-settings-panel.tsx`
  - 将 `新增平台` 按钮包入独立 `.provider-rail-footer`。
- `apps/admin/src/styles.css`
  - `.provider-rail` 改为明确三行 grid：标题、滚动列表、底部按钮区。
  - `.provider-list` 独占滚动。
  - `.provider-rail-footer` 增加顶部边界和背景，固定作为列表 UI 底部操作区。
- `scripts/verify-admin-provider-rail-layout.mjs`
  - 验证 DOM 中按钮必须位于 `.provider-rail-footer`，且不能回到 `.provider-list`。
  - 验证 CSS 必须保留三行 grid、列表滚动、footer 分隔和按钮满宽。

验证:

- `npm run verify:admin-provider-rail-layout`
- `npm run verify:static-html-cache-contract`
- `npm run build -w @xinghuan/admin`
- `npm run build:single-port`

生产数据清理:

- 清理前生产 PostgreSQL `xh_providers` 共 21 个 Provider。
- 事务移除 18 个测试 Provider：
  - `verify-provider-*`
  - `verify-image-*`
  - `默认 Provider`
  - `图像 Provider`
  - `https://verify.local`
  - `http://127.0.0.1:*`
- 同步移除 1 个测试模型。
- 清理后仅剩：
  - `custom-api-1780893241867 | Apimart | apimart | 2 models`
  - `toapis | ToAPIs | openai | 1 model`
  - `grsai | GRSAI | grsai_draw | 1 model`
- 本次未输出或记录任何 API Key。

生产发布:

- Release: `20260610-admin-provider-footer-cleanup-prod-r2-f295040`
- 当前生产:
  - `/opt/apps/xinghuan-canvas/releases/20260610-admin-provider-footer-cleanup-prod-r2-f295040`
- 公网后台 `GET https://canvas.hhh2121.xyz/admin` 已返回新资源：
  - 后台 JS: `index-Ckni9yF3.js`
  - 后台 CSS: `index-ClQ6DtDI.css`
- 远端 bundle 已确认包含：
  - `.provider-rail-footer`
  - `grid-template-rows:auto minmax(0,1fr) auto`
  - `.provider-list{...overflow-y:auto...}`
- 生产状态:
  - `https://canvas.hhh2121.xyz/api/status` -> `environment=production`
  - `xinghuan-canvas.service` -> `active`
  - `xinghuan-canvas-worker.service` -> `active`

注意:

- `HEAD https://canvas.hhh2121.xyz/admin` 当前返回 `404`，但 `GET /admin` 正常返回后台 HTML，且 `cache-control: no-store`。这是当前路由对 HEAD 的处理差异，不影响后台访问。

### 后台 API 平台列表新增按钮固定底部并发布生产

目标:

- 修复后台 API 设置页左侧平台列表滚动时，`新增平台` 按钮跟随列表内容一起滚动的问题。
- 让按钮固定在左侧列表 UI 底部，只有 Provider 列表区域本身滚动。
- 修复完成后发布到正式环境。

变更:

- `apps/admin/src/styles.css`
  - `.provider-rail` 改为固定三段式 flex column 容器。
  - `.provider-rail` 自身不再滚动，改为 `overflow: hidden`。
  - `.provider-list` 负责滚动，设置 `flex: 1 1 auto`、`min-height: 0`、`overflow-y: auto`。
  - `.provider-rail > .ghost-action` 固定在底部，设置 `flex: 0 0 auto` 和 `width: 100%`。
- `scripts/verify-admin-provider-rail-layout.mjs`
  - 新增后台 Provider 侧栏布局契约验证，防止按钮再次进入滚动内容流。
- `package.json`
  - 新增 `verify:admin-provider-rail-layout`。

验证:

- `npm run verify:admin-provider-rail-layout`
- `npm run verify:static-html-cache-contract`
- `npm run build -w @xinghuan/admin`
- `npm run build:single-port`

生产发布:

- Release: `20260610-admin-provider-rail-fixed-prod-r1-f295040`
- 当前生产:
  - `/opt/apps/xinghuan-canvas/releases/20260610-admin-provider-rail-fixed-prod-r1-f295040`
- 公网后台:
  - `https://canvas.hhh2121.xyz/admin` -> `200`
  - `cache-control: no-store`
  - 后台 JS: `index-DytMYiMH.js`
  - 后台 CSS: `index-DEbHk4VC.css`
- 生产状态:
  - `https://canvas.hhh2121.xyz/api/status` -> `environment=production`
  - `xinghuan-canvas.service` -> `active`
  - `xinghuan-canvas-worker.service` -> `active`
- 远端 CSS 检查:
  - `.provider-list`
  - `overflow-y:auto`
  - `flex:1 1 auto`
  - `.provider-rail>.ghost-action`
  - `flex:0 0 auto`

### 输出素材完整显示与生成节点 T8 预留清理灰度热修复

目标:

- 修复单图输出节点初始显示不全、必须滚动才能看到文件名和下载入口的问题。
- 修复输出节点拉伸后底部文件名/下载行被遮挡、素材两侧出现黑色填充、缩放到一定尺寸后交互异常的问题。
- 清理图像、视频、LLM 生成节点中暴露的 `本地 T8 内置模型` 预留入口和实现解释文案。

变更:

- 输出节点:
  - 单图/单视频按素材比例计算完整显示高度，自动补足标题区和底部文件名/下载区高度。
  - 内层素材容器不再使用内部滚动条遮挡内容。
  - 单图/单视频移除黑色背景填充，保持素材自身完整显示。
  - 缩放改为自由宽高，设置最大宽高边界，避免无限横向/纵向延伸。
- 生成节点:
  - `ImageNode`、`VideoNode`、`LLMNode` 的发布模型供应商下拉移除 `本地 T8 内置模型`。
  - 移除 `参数来源...`、`当前模型尺寸...` 等实现说明型可见文案。

验证:

- `npm run verify:output-node-preview-layout`
- `npm run verify:generation-node-copy-cleanup`
- `npm run verify:node-resize-sync-contract`
- `npm run verify:static-html-cache-contract`
- `npm run build:single-port`

灰度:

- Release: `20260610-output-complete-fit-copy-cleanup-gray-r3-f295040`
- 当前灰度:
  - `/opt/apps/xinghuan-canvas-next/releases/20260610-output-complete-fit-copy-cleanup-gray-r3-f295040`
- 公网首页资源:
  - `index-CZT1hWSs.js`
  - `OutputNode-BT411FHf.js`
  - `ImageNode-7laYmbZx.js`
  - `VideoNode-BbiszG2e.js`
  - `LLMNode-CFRAkwAc.js`
- 远端 bundle 检查:
  - 未发现 `本地 T8 内置模型`
  - 未发现 `参数来源：当前发布模型`
  - 未发现 `当前模型的尺寸会随比例自动匹配`
- API/Worker 均为 `active`。

### 输出集合智能网格 r2 灰度热修复

目标:

- 修复 r1 消除黑边后，宽高输出节点中素材仍停留在左上角、下方大面积空白的问题。
- 让多图/多视频输出集合根据素材数量、节点宽度、节点高度和素材比例智能选择列数与卡片高度。

变更:

- 两个产物在宽节点中固定采用均衡两列，不再被误排成四列缩小。
- 多素材卡片拆分为卡片总高度和媒体视口高度，文件名/下载栏不再撑坏媒体网格。
- 多素材节点的自动高度收敛到内容需要的高度，避免节点被拉高后无限空白延伸。

验证:

- `npm run verify:output-node-preview-layout`
- `npm run verify:node-resize-sync-contract`
- `npm run verify:static-html-cache-contract`
- `npm run build:single-port`

灰度:

- Release: `20260610-output-grid-smart-layout-gray-r2-f295040`
- 当前灰度:
  - `/opt/apps/xinghuan-canvas-next/releases/20260610-output-grid-smart-layout-gray-r2-f295040`
- 公网首页资源:
  - `index-Vxk81PeH.js`
  - `OutputNode-DRI5JIF7.js`
- API/Worker 均为 `active`。

### 节点尺寸同步与输出素材比例修复灰度发布

目标:

- 修复节点运行态/完成态切换后，节点视觉缩小或高度变化导致连线锚点不同步的问题。
- 修复输出集合节点在窄高尺寸下，多图/多视频出现严重上下黑边和素材比例观感畸变的问题。
- 将本机已验证版本发布到灰度 `canvas-next.hhh2121.xyz`，供继续实测。

变更范围:

- `OutputNode`、`UploadNode`、`ImageNode`、`VideoNode`、`SeedanceNode`、`AudioNode`
  - 接入 `ResizeObserver` 驱动的节点内部测量同步。
- `OutputNode`
  - 多图/多视频网格按素材宽高比计算行高，不再为了填满节点高度而拉高媒体容器。
- `outputPreviewLayout`
  - 补齐输出集合网格行高计算契约。

本机验证:

- `npm run verify:output-node-preview-layout`
- `npm run verify:node-resize-sync-contract`
- `npm run verify:generation-count-contract`
- `npm run verify:static-html-cache-contract`
- `npm run build:single-port`

灰度发布:

- Release: `20260610-node-resize-sync-output-layout-gray-r1-f295040`
- 灰度 current:
  - `/opt/apps/xinghuan-canvas-next/releases/20260610-node-resize-sync-output-layout-gray-r1-f295040`
- 服务器动作:
  - 上传 `/tmp/20260610-node-resize-sync-output-layout-gray-r1-f295040.tar.gz`
  - 解压到灰度 release 目录
  - 执行 `npm ci`
  - 执行 `npm run db:migrate`
    - `applied=[]`
    - `skipped=6`
  - 重启 `xinghuan-canvas-next.service`
  - 重启 `xinghuan-canvas-next-worker.service`

灰度验证:

- `systemctl is-active xinghuan-canvas-next.service`
  - `active`
- `systemctl is-active xinghuan-canvas-next-worker.service`
  - `active`
- `curl -fsS http://127.0.0.1:18200/api/status`
  - `environment=gray`
- 公网 `GET https://canvas-next.hhh2121.xyz/`
  - `200`
  - `cache-control: no-store`
  - 资源 hash: `index-BnZP74ac.js`
- 公网 `GET https://canvas-next.hhh2121.xyz/admin`
  - `200`
  - `cache-control: no-store`
  - 资源 hash: `index-DMvEA4um.js`
- 服务器当前前端 bundle 已包含:
  - `ResizeObserver`
  - 输出节点 `gridTemplateColumns`
- in-app browser 打开灰度页面后进入登录门禁页，控制台未出现 error。

影响:

- 这次只发布灰度，不切生产。
- 用户继续在灰度画布中验证生成节点状态切换、输出集合节点拖拽缩放、图像和视频集合显示即可。

### 灰度“发布后仍像旧版本”根因排查与静态 HTML 缓存修复

目标:

- 查明“已经推送灰度，但页面仍像旧版本”的真实原因。
- 避免后续灰度或生产发布后，浏览器继续持有旧 `index.html` 导致前端资源 hash 不刷新。

根因结论:

- 灰度服务、`current` 符号链接、systemd 工作目录和 Node 进程都已经指向新 release，不是“没部署成功”。
- 真正的问题是单端口静态文件响应把 `apps/web/dist/index.html` 和 `apps/admin/dist/index.html` 也按 `cache-control: public, max-age=3600` 返回。
- 浏览器一旦缓存旧 HTML，就会继续引用旧的 JS/CSS 资源路径；即使服务器已经切到新 release，用户侧仍可能在 1 小时内继续看到旧版本。

变更范围:

- `apps/api/src/server.ts`
  - `trySendStaticFile()` 按扩展名拆分缓存策略：
    - `.html` 返回 `cache-control: no-store`
    - 其他静态资源继续保留 `cache-control: public, max-age=3600`
- `scripts/verify-static-html-cache-contract.mjs`
  - 新增静态缓存契约验收：
    - `/` 与 `/admin` HTML 必须禁用缓存
    - `/assets/*` 与 `/admin/assets/*` 仍需保持缓存
- `package.json`
  - 新增 `verify:static-html-cache-contract`

验证证据:

- 本机排查证据:
  - `http://127.0.0.1:18200/api/status`
    - `environment=local`
  - `https://canvas-next.hhh2121.xyz/api/status`
    - `environment=gray`
  - 灰度 `realpath /opt/apps/xinghuan-canvas-next/current`
    - 已指向 `20260610-assistant-media-chain-gray-r3-f295040`
  - 灰度与本机返回的首页资源 hash 一致：
    - `/assets/index-Du4Et5fv.js`
    - `/admin/assets/index-DMvEA4um.js`
- 修复前失败:
  - `npm run verify:static-html-cache-contract`
    - `FAIL GET / cache-control disables HTML caching`
    - `FAIL GET /admin cache-control disables HTML caching`
- 修复后通过:
  - `curl -i http://127.0.0.1:18200/`
    - `cache-control: no-store`
  - `curl -i http://127.0.0.1:18200/admin`
    - `cache-control: no-store`
  - `npm run verify:static-html-cache-contract`
  - `npm run verify:single-port`

影响:

- 后续发布后，浏览器不会再因为缓存旧 HTML 而长时间停留在旧版入口。
- 带 hash 的 JS/CSS 资源仍保留缓存，不影响正常静态资源命中率。

风险:

- 当前本机 `build:single-port` 存在一次 `apps/web/dist/index.html` 的 Windows `EPERM` 写入残差；本轮修复本身已通过 API 构建与运行态验收，不影响静态缓存策略正确性。

下一步:

- 将静态 HTML 缓存修复补发到灰度。
- 灰度复验 `/`、`/admin` 的 `cache-control` 响应头，确认发布后旧版残留问题不再复现。

## 2026-06-09

### 后台任务视频输出本地化闭环补齐

目标:

- 补齐后台任务 Worker 视频链路与图像链路之间的不对称问题。
- 让 Worker 成功生成的视频也像图片一样落到本地 `/files/output/`，并在资源库中写入稳定 `fileUrl`。
- 增加强度更高的 Worker 视频验收与输出素材验收，避免只验证直连代理、不验证后台任务闭环。

变更范围:

- `apps/worker/src/output-materials.ts`
  - 新增 `materializeVideoOutput()`。
  - Worker 视频输出现在会下载远端视频并落到本地 `output` 目录，再把 `fileUrl/fileRel/mime/size` 写入资源项。
  - `resultPatch.materializedVideoUrls` 改为优先返回本地 `fileUrl`，不再只回传远端 URL。

- 验收脚本:
  - `scripts/verify-worker-output-materializer.ts`
    - 提升为图片和视频都必须本地落盘的标准。
    - 新增本地 mock 视频服务器，视频不再只用静态远端占位 URL。
  - `scripts/verify-worker-video-adapter.mjs`
    - 新增后台任务 Worker 视频链路 runtime 验收脚本。
  - `package.json`
    - 新增 `verify:worker-video-adapter`。

验证证据:

- 本机通过:
  - `npm run verify:worker-output-materializer`
  - `npm run verify:worker-adapter-contract`
  - `npm run verify:admin-assistant-chat`
  - `npm run verify:admin-assistant-ui-contract`
  - `npm run verify:admin-api-layout-contract`
  - `npm run verify:external-image-proxy`
  - `npm run verify:external-video-proxy`
  - `npm run type-check`
  - `npm run build:single-port`

- 本机环境限制已确认:
  - `GET /api/admin/system` 当前返回:
    - `database.status = not_configured`
    - `redis.status = not_configured`
    - `storageDriver = file`
  - 因此依赖真实 Redis 队列与数据库的 `verify:worker-image-adapter` / `verify:worker-video-adapter` 在当前本机轻量服务上无法完成 runtime 证明，失败原因是环境未配置，不是业务链路回归。

影响:

- 后台任务的视频产物现在和图片产物一样，具备真正的本地 `fileUrl`，后续资源库、拖拽和回放链路更一致。
- 图像/视频生成链路的验收证据比之前更完整，至少把“直连代理成功但后台任务闭环不完整”的隐患补掉了。

风险:

- Worker 视频与图像的真实异步队列 runtime 验收仍需要在带 Redis/DB 的完整环境继续跑一次，当前本机服务不具备这个条件。

### deadlock / GRSAI / 助手图片输入 / API 站点协助配置灰度完成

目标:

- 修复后台并发打开多个管理面板时的 PostgreSQL `deadlock detected`
- 让 GRSAI 站点即使被误填为 `OpenAI 兼容` 也能正确识别、验证和拉模型
- 补齐前后台 AI 助手图片输入与传输
- 完成后台 `AI 协助配置` 对 API 站点的真实灰度可用性

灰度 release:

- 最终通过版本: `20260609-deadlock-grsai-assistant-image-gray-r5`

验证证据:

- 本机:
  - `npm run verify:admin-api-layout-contract`
  - `npm run verify:admin-assistant-chat`
  - `npm run verify:canvas-assistant-chat`
  - `npm run verify:admin-assistant-ui-contract`
  - `npm run verify:canvas-assistant-ui-contract`
  - `npm run type-check`
  - `npm run build:single-port`
- 灰度服务器:
  - `parallel_admin_reads pass`
  - `grsai_probe pass`
  - `grsai_fetch_models pass`
  - `assistant_analyze_provider_protocol grsai_draw`
  - `assistant_analyze_provider_mode hermes`
  - `assistant_analyze_provider pass`
  - `assistant_image_upload pass`
  - `assistant_chat_with_image pass`
  - `journalctl -u xinghuan-canvas-next.service` 未出现新的 `deadlock detected`
  - `systemctl is-active xinghuan-canvas-next.service` => `active`
  - `systemctl is-active xinghuan-canvas-next-worker.service` => `active`
  - `https://canvas-next.hhh2121.xyz/api/status` => `environment=gray`
  - `https://canvas-next.hhh2121.xyz/` 可返回最新页面

影响:

- 后台 `AI 协助配置` 现在可以稳定给出 `GRSAI -> grsai_draw -> adapter -> gpt-image-2` 的管理员草案
- 后台并发初始化不再因为读请求触发整库写入而自锁
- 前后台助手都可以把上传图片作为真实上下文发给聊天链路

### AI 助手会话上下文、Hermes Profile 隔离与后台配置助手灰度发布

目标:

- 修复 AI 助手每次消息都会在 Hermes 后端新建会话、导致缺少上下文连续性的问题。
- 将 Hermes 接入收敛到独立的 `无限画布AI助手` Profile 字段，并默认关闭持久记忆，避免污染个人 Hermes。
- 降低助手上下文 payload 体积，避免把完整节点、Provider、任务等原始 JSON 打包发送或展示。
- 修复后台助手设置保存可能触发 PostgreSQL deadlock 的整库重写风险。
- 增加后台 Provider/API 参数的 AI 协助配置流程，草案必须由管理员确认后才回填表单。
- 将完成版本推送到灰度环境 `canvas-next.hhh2121.xyz`。

变更范围:

- 后端助手协议:
  - `apps/api/src/server.ts`
    - `AssistantChatRequest` 增加 `conversationId`。
    - Hermes chat 按 `workspace + scope + actor + conversationId` 缓存 session，复用同一对话上下文。
    - 新增 Hermes session/chat payload 构造函数，支持 `XINGHUAN_HERMES_PROFILE` 和 `persistMemory` 策略。
    - canvas scope 强制非持久化记忆，后台持久化记忆默认关闭。
    - 附件进入 prompt 前改为摘要，避免发送完整 `payload`。
    - 流式回复默认不再发送 raw process JSON。
    - AI 助手设置保存改为专用 `xh_assistant_settings` upsert，不再整库 delete/reinsert。

- 前端与后台助手:
  - `apps/web/src/components/CanvasAssistant.tsx`
    - 生成稳定 `conversationId`，仅新建会话时重置。
    - 发送前压缩附件，避免继续上传完整节点数据。
  - `apps/admin/src/admin-assistant-panel.tsx`
    - 使用后台专用 `/api/admin/assistant/chat/stream`。
    - 生成稳定 `conversationId`，移除 Hermes/Fallback/过程等实现标签。
  - `apps/admin/src/admin-assistant-settings-panel.tsx`
    - 增加助手 Profile 与后台记忆策略控制。
    - 清理旧的描述性/调试性文案。
  - `apps/admin/src/admin-api-settings-panel.tsx`
    - 增加“AI 协助配置”卡片。
    - 调用 `/api/admin/assistant/analyze-provider` 生成草案。
    - 草案只在管理员点击“应用到表单”后回填本地表单，仍需点击保存才生效。

- 验证脚本:
  - `scripts/verify-admin-assistant-settings-save-contract.mjs`
  - `scripts/verify-admin-assistant-chat.mjs`
  - `scripts/verify-canvas-assistant-chat.mjs`
  - `scripts/verify-admin-assistant-workbench.mjs`
  - `scripts/verify-admin-assistant-ui-contract.mjs`
  - `scripts/verify-canvas-assistant-ui-contract.mjs`
  - `scripts/verify-admin-api-layout-contract.mjs`

- 灰度发布:
  - 本机 release 包:
    - `dist-release/20260609-async-assistant-context-profile-gray.tar.gz`
  - 服务器灰度 release:
    - `/opt/apps/xinghuan-canvas-next/releases/20260609-async-assistant-context-profile-gray`
  - 灰度 `current` 已切换到新 release，并重启:
    - `xinghuan-canvas-next.service`
    - `xinghuan-canvas-next-worker.service`

验证证据:

- 本机:
  - `npm run verify:admin-assistant-settings-save-contract`
  - `npm run verify:admin-assistant-chat`
  - `npm run verify:canvas-assistant-chat`
  - `npm run verify:admin-assistant-workbench`
  - `npm run verify:admin-assistant-ui-contract`
  - `npm run verify:canvas-assistant-ui-contract`
  - `npm run verify:admin-api-layout-contract`
  - `npm run type-check`
  - `npm run build:single-port`
  - `npm run verify:single-port`

- 服务器本机:
  - `npm run db:migrate`
    - `applied=[]`, `skipped=6`
  - `systemctl is-active xinghuan-canvas-next.service`
    - `active`
  - `systemctl is-active xinghuan-canvas-next-worker.service`
    - `active`
  - `readlink -f /opt/apps/xinghuan-canvas-next/current`
    - 指向 `20260609-async-assistant-context-profile-gray`
  - `curl -fsS http://127.0.0.1:18200/api/status`
    - 返回 `environment=gray`
  - 服务器内联 smoke:
    - `PASS status gray api`
    - `PASS admin login`
    - `PASS admin assistant chat`
    - `PASS canvas assistant chat`
    - `PASS assistant audit`

- 公网灰度:
  - `https://canvas-next.hhh2121.xyz/api/status`
    - `200`
  - `https://canvas-next.hhh2121.xyz/`
    - `200`
  - `https://canvas-next.hhh2121.xyz/admin`
    - `200`

影响:

- 后台和画布 AI 助手具备真实连续对话能力。
- Hermes Profile 字段已接入，但当前未找到 Hermes 官方/本项目直接 Profile API 证据，因此持久记忆仍默认关闭。
- 后台助手设置保存不再锁住 Provider、Model、Task、Audit 等无关表，降低死锁概率。
- 灰度环境已更新，不影响生产域名 `canvas.hhh2121.xyz`。

风险:

- Hermes 是否真正按 `profile` 字段隔离，需要后续结合 Hermes 侧接口或日志进一步确认。
- 运行时 release 包按现有策略不包含 verify 脚本，因此服务器灰度验收使用内联 smoke，不在 release 中新增测试脚本。
- 当前 worktree 仍存在大量既有未提交改动，本次未做 Git 提交，避免夹带他人变更。

下一步:

- 在灰度环境继续观察后台助手连续对话是否稳定复用上下文。
- 若确认 Hermes Profile API 支持独立 Profile，再考虑开启后台助手长期记忆。
- 若灰度无异常，再安排正式生产发布窗口。

### 画布助手 UI 自适应修复与可见文案清理灰度发布

目标:

- 将本机已确认通过的画布 AI 助手自适应修复、模型注意事项移除和可见测试文案清理发布到灰度环境。
- 保持灰度入口 `canvas-next.hhh2121.xyz`、单端口 `127.0.0.1:18200` 与 Worker 服务继续正常运行。
- 用服务器本机验收和公网灰度验收确认这次更新已真实生效。

变更范围:

- 画布助手 UI:
  - `apps/web/src/styles/index.css`
    - 助手面板固定为 `header / context / messages / composer` 四行 grid，避免空上下文状态撑大输入区。
    - 上下文按钮、附件卡片、消息区和输入区补齐自适应布局与文本溢出保护。
  - `apps/web/src/components/Canvas.tsx`
    - 移除模型注意事项入口。
  - `apps/web/src/components/CanvasAssistant.tsx`
    - 保持浮层可拖动、可缩放，并维持紧凑上下文卡片显示。

- 可见文案清理:
  - `apps/api/src/server.ts`
    - 对画布名、节点文本、Provider/模型/任务等返回给界面的可见字段做运行时中性化清洗。
  - `apps/api/data/canvases/canvas-list.json`
  - `apps/api/data/users/usr-admin/canvases/canvas-list.json`
  - 若干默认画布 JSON
    - 将直接可见的“测试 / 验收 / smoke / Verify”命名改为中性名称。

- 灰度发布:
  - 本机生成源码包 `releases/20260609-152648-canvas-assistant-ui-gray.tar.gz`
  - 服务器灰度 release:
    - `/opt/apps/xinghuan-canvas-next/releases/20260609-152648-canvas-assistant-ui-gray`
  - 灰度 `current` 已切换到新 release，并重启：
    - `xinghuan-canvas-next.service`
    - `xinghuan-canvas-next-worker.service`

验证证据:

- 本机:
  - `npm run verify:single-port`
  - `npm run build:single-port`
  - `node scripts/verify-canvas-assistant-ui-contract.mjs`
  - `node scripts/verify-canvas-model-help-removal.mjs`

- 服务器本机:
  - `npm run verify:single-port`
  - `curl -fsS http://127.0.0.1:18200/api/status`
    - 返回 `environment=gray`
  - `readlink -f /opt/apps/xinghuan-canvas-next/current`
    - 指向 `20260609-152648-canvas-assistant-ui-gray`
  - `systemctl is-active xinghuan-canvas-next.service`
    - `active`
  - `systemctl is-active xinghuan-canvas-next-worker.service`
    - `active`

- 公网灰度:
  - `curl -fsS https://canvas-next.hhh2121.xyz/api/status`
    - 返回 `environment=gray`
  - `XINGHUAN_VERIFY_BASE_URL=https://canvas-next.hhh2121.xyz npm run verify:single-port`
    - 全部 PASS

- 浏览器现场:
  - 当前加载 bundle 为 `/assets/index-GdU9SDud.js` 与 `/assets/index-BE6LaMzV.css`
  - 助手空状态下输入框与发送按钮尺寸正常
  - 选中节点后，上下文按钮正常出现
  - 点击“发送当前节点”后，节点卡片保持紧凑，消息区和输入区不再消失
  - 首页可见画布名称不再显示“测试 / 验收 / smoke”等残留

影响:

- 当前灰度环境已经同步了这轮画布助手 UI 修复和可见文案清理结果。
- 后续用户在灰度域名上继续验收时，不需要再依赖本地缓存绕过或手动排查旧 bundle。

风险:

- 本轮灰度发布的是当前工作树整体版本，而不是只包含单一 UI 文件的极小补丁；后续若要精细回滚，建议直接按 release ID 回退。
- 服务端对 `/` 和 `/admin` 的 `HEAD` 请求仍返回 `404`；后续公网 smoke 继续应以 `GET` 或 `verify:single-port` 为准。

### AI 助手保存流、登录预填与生成节点运行态卡片收口

目标:

- 修复后台 AI 助手设置页“边输边保存”和重复入口问题，并完成真实浏览器验收。
- 修复前台登录页预填管理员邮箱的安全问题。
- 修复前台画布 AI 助手的空媒体占位、会话保持和可缩放交互。
- 为生成类节点补统一运行态卡片，显示进度和耗时。

变更范围:

- 后台 AI 助手:
  - `apps/admin/src/admin-assistant-settings-panel.tsx`
    - 设置页改为本地 draft 态，新增“保存 AI 助手配置 / 重置未保存修改”。
  - `apps/admin/src/main.tsx`
    - 顶栏移除重复的 AI 助手按钮，只保留右侧抽屉开关和侧栏页签。
  - `apps/admin/src/styles.css`
    - 增加设置页操作条样式。
    - 修复关闭态后台助手抽屉仍覆盖主内容点击区的问题：关闭态 dock 不再拦截主内容点击，只保留外露开关可点击。
  - 契约补强:
    - `scripts/verify-admin-assistant-settings-save-contract.mjs`
    - `scripts/verify-admin-assistant-ui-contract.mjs`

- 前台登录与画布助手:
  - `apps/web/src/components/LoginGate.tsx`
    - 登录页邮箱初始值改为空字符串，不再预填 `admin@xinghuan.local`。
  - `apps/web/src/components/CanvasAssistant.tsx`
    - 过滤空媒体附件，避免空白附件卡片。
    - 保留开关前后的会话和消息。
    - 增加可缩放面板壳子。
  - `apps/web/src/styles/index.css`
    - 助手面板启用 `resize: both`，补最小/最大尺寸和文本换行保护。
  - 契约补强:
    - `scripts/verify-canvas-assistant-ui-contract.mjs`
    - `scripts/verify-login-gate-security-contract.mjs`

- 生成节点运行态卡片:
  - `apps/web/src/components/nodes/NodeRuntimeCard.tsx`
    - 新增共享运行态卡片，统一显示状态、进度和耗时。
  - `apps/web/src/components/nodes/ImageNode.tsx`
  - `apps/web/src/components/nodes/VideoNode.tsx`
  - `apps/web/src/components/nodes/SeedanceNode.tsx`
  - `apps/web/src/components/nodes/AudioNode.tsx`
    - 接入 `startedAt / finishedAt / lastDurationMs` 元数据和共享运行态卡片。
  - 契约补强:
    - `scripts/verify-node-runtime-card-contract.mjs`

验证证据:

- 契约 / 烟测:
  - `node scripts/verify-admin-assistant-settings-save-contract.mjs`
  - `npm run verify:admin-assistant-ui-contract`
  - `npm run verify:canvas-assistant-ui-contract`
  - `node scripts/verify-login-gate-security-contract.mjs`
  - `npm run verify:admin-auth-passwords`
  - `node scripts/verify-node-runtime-card-contract.mjs`
  - `npm run verify:canvas-node-render-smoke`
  - `npm run build:single-port`

- 本机浏览器验收:
  - `http://127.0.0.1:18200/` 登录页邮箱默认值为空。
  - `http://127.0.0.1:18200/admin/` 的 AI 助手设置页输入后不会立刻落盘；“重置未保存修改”可恢复原值，“保存 AI 助手配置”后 `admin.json` 实际更新。
  - 后台顶栏不再有重复 AI 助手按钮，右侧抽屉开关仍可用。
  - 前台 AI 助手面板真实渲染为 `resize: both`，关闭再打开后会话号和未发送草稿保持不变。
  - 当前打开的本地验收画布只有文本节点，因此本轮浏览器现场未直接看到运行态卡片实例；该项以节点烟测和代码契约验收为主。

影响:

- 后台 AI 助手设置不再因为每次击键触发 PATCH，编辑与验收都稳定得多。
- 关闭态后台助手抽屉不再遮挡主内容点击，保存/重置按钮恢复真实可用。
- 登录页不再暴露本地默认管理员邮箱。
- 前台 AI 助手在真实使用时不会因为空媒体输出生成空白附件卡片，也不会在临时收起后丢上下文。
- 生成类节点具备统一运行态视觉反馈，后续排查“卡住 / 成功 / 失败 / 耗时”更直接。

风险:

- 本轮浏览器现场没有直接运行包含生成类节点的验收画布，因此运行态卡片的真实页面观感主要依赖 `verify:canvas-node-render-smoke` 与代码契约，而不是一次完整生成任务录像式验收。
- 当前工作树仍存在大量无关脏改动；提交时必须继续只挑本轮目标文件，不能误带运行期 JSON 和其他历史变更。

## 2026-06-08

### 后台 AI 助手 Hermes 灰度链路打通与开发区收口

目标:

- 打通后台 AI 助手到服务器 Hermes 的真实分析链路，并完成灰度上线。
- 修复后台助手验收脚本的登录态与模式判断问题。
- 收口当前开发区中的结构索引、记忆、运维记录和临时调试残留。

变更范围:

- `apps/api/src/server.ts`
  - Hermes 响应补读 `answer` 字段。
  - Hermes HTTP 桥接底层改为 `fetch`。
  - CSRF token 改为可选，不再把缺失视为致命失败。
- `scripts/verify-admin-assistant-workbench.mjs`
  - 登录链路改为管理员可用的 `/api/auth/login`。
  - 增加 `XINGHUAN_VERIFY_REQUIRE_HERMES=1`，用于灰度强校验 `mode=hermes`。
  - Cookie 捕获兼容 `headers.getSetCookie()`。
- 文档与结构收口:
  - `docs/prd/README.md`
  - `development/README.md`
  - `ops/README.md`
  - `ops/assistant-hermes-gray-2026-06-08.md`
  - `MEMORY.md`
  - `.gitignore`
  - `package.json`

验证证据:

- 灰度最终 release:
  - `20260608-2312-assistant-hermes-csrf-fix-gray`
- 服务器状态:
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
- 定向后台助手灰度验收:
  - 管理员登录成功
  - `POST /api/admin/assistant/analyze-provider` 返回 `mode=hermes`
  - `protocol=apimart`
  - `recommendedLayer=adapter`
- 本机脚本验收:
  - `node scripts/verify-admin-assistant-workbench.mjs`
- 灰度脚本验收:
  - `XINGHUAN_VERIFY_BASE_URL=http://127.0.0.1:18200`
  - `XINGHUAN_VERIFY_EMAIL=1161964493@qq.com`
  - `XINGHUAN_VERIFY_PASSWORD=Hejiajun@020728`
  - `XINGHUAN_VERIFY_REQUIRE_HERMES=1`
  - `node scripts/verify-admin-assistant-workbench.mjs`

影响:

- 后台 AI 助手最小链路已经在灰度环境真实走 Hermes，不再停留在 fallback。
- 验收脚本现在可以区分“本地只要求有 mode”与“灰度必须是 Hermes 模式”。
- `development / ops / prd / MEMORY / DEVLOG` 的入口关系更清晰，后续继续推进不会再主要靠回忆找状态。

风险:

- `.codex-temp/` 中仍有本地临时快照目录，按当前安全规则不适合做递归批量删除；后续如要彻底清空，需要单独列清单或由用户手动处理。
- 当前只完成后台助手最小闭环，前端创作助手仍未实施。

### APIMart 图像异步任务与轮询时长配置修复

目标:

- 修复 APIMart `gpt-image-2` 在画布中生成失败的问题。
- 将 APIMart 视频轮询最大时长默认放宽到 `360s`。
- 在后台模型配置中补一个可直接调整的“最大轮询时长”配置位，避免后续只能手写 JSON。

变更范围:

- `apps/api/src/provider-response-parser.ts`
  - 图像结果解析补齐递归提取，支持 APIMart 完成态 `data.result.images[].url[]` 这种嵌套结构。
- `apps/api/src/server.ts`
  - `pollApimartVideoTask` 默认超时从 `180000ms` 调整为 `360000ms`，并继续保留基于 `estimated_time` 的自适应延长。
  - 图像代理新增“提交返回 `task_id` 则自动轮询”的异步任务处理，统一走 `GET /v1/tasks/{task_id}`。
- `apps/admin/src/admin-model-editor.tsx`
  - 模型高级设置新增“最大轮询时长（秒）”结构化输入，默认 `360`，保存时写入 `advancedConfig.pollTimeoutMs`。
- `apps/admin/src/styles.css`
  - 补齐运行时配置区样式，保持后台模型编辑器布局一致。
- 验收补强:
  - `scripts/verify-provider-response-parser-contract.ts`
  - `scripts/verify-admin-api-layout-contract.mjs`
  - `scripts/verify-external-image-proxy.mjs`

验证证据:

- 本机先确认灰度 APIMart 图像模型真实提交返回：
  - `code=200`
  - `data[0].status=submitted`
  - `data[0].task_id=...`
- 同时核对 APIMart 官方文档，`gpt-image-2` 图像接口明确要求提交后轮询 `/v1/tasks/{task_id}`，完成态图片位于 `data.result.images[0].url[0]`。
- 本机通过：
  - `npx tsx scripts/verify-provider-response-parser-contract.ts`
  - `node scripts/verify-admin-api-layout-contract.mjs`
  - `node scripts/verify-external-image-proxy.mjs`
  - `npm run type-check -w @xinghuan/api`
  - `npm run type-check -w @xinghuan/admin`
  - `npm run build:single-port`
  - `npm run build -w @xinghuan/admin`

影响:

- 这次 APIMart 图像失败与此前视频问题同源，根因不是“GRSAI 修复失效”，而是 APIMart 图像本身也是异步任务链路，之前后端只补到了视频，没有补到图像。
- 现在 APIMart 图像和视频都会按异步任务模式处理，后续再接类似返回 `task_id` 的供应商时，复用成本会低很多。
- 后台模型配置现在可以直接调最大轮询时长，默认 `360s` 更适合真实视频和高耗时生图任务。

风险:

- APIMart 真实上游任务时长仍可能受分辨率、质量档位和平台负载影响，`360s` 是当前更稳妥的默认值，但不是无限等待。
- 灰度和生产共用同一 PostgreSQL 底座，若管理员直接修改模型高级配置，仍需注意不要把明显错误的 `pollPathTemplate` / `taskStatusPath` 写进生产模型。

下一步:

- 发布到灰度 `canvas-next.hhh2121.xyz`。
- 用真实 APIMart 图像与视频模型分别做一次灰度实测，确认图像异步轮询、视频长轮询和后台配置位都已闭环。

### Provider 视频能力与 APIMart 适配灰度修复完成

目标:

- 将 Provider 灵活配置、视频模型输入能力开关和 APIMart 异步视频适配正式推上灰度。
- 修复灰度数据库因历史迁移文件已执行而未自动补齐 `input_capabilities` / `advanced_config` 的问题。
- 完成灰度级验证，确认 `canvas-next.hhh2121.xyz` 恢复到可验收状态。

变更范围:

- 新增 `apps/api/db/004_provider_model_framework_backfill.sql`，以前向增量迁移方式补齐 Provider/模型框架新增列。
- 打包并先后发布：
  - `20260608-1515-provider-video-capability-gray`
  - `20260608-1535-provider-video-capability-gray-fix`
- 在服务器修复 release 目录执行 `npm ci`、`npm run build:single-port`、`npm run db:migrate`，并切换灰度 `current`。
- 新增灰度发布记录 `ops/provider-video-capability-gray-2026-06-08.md`。

验证证据:

- 首个 gray release 切换后，服务器 `npm run verify:single-port` 首次失败，报错：
  - `column "input_capabilities" does not exist`
- 已确认根因是把新列直接追加进历史 `002_provider_model_framework.sql`，而灰度 `xh_schema_migrations` 只按文件名记账，旧 `002` 不会重跑。
- 修复后服务器 `npm run db:migrate` 成功应用：
  - `004_provider_model_framework_backfill.sql`
- 修复后灰度服务器通过：
  - `npm run verify:single-port`
  - `npm run verify:model-catalog`
  - `npm run verify:external-video-proxy`
  - `node scripts/verify-generic-node-catalog.mjs`
  - `npx tsx scripts/verify-video-node-backend-inputs-contract.ts`
  - `npm run verify:apimart-video-adapter-contract`
- 公网灰度 `https://canvas-next.hhh2121.xyz/`、`/admin`、`/api/status` 均返回 `200`。
- `readlink -f /opt/apps/xinghuan-canvas-next/current` 返回：
  - `20260608-1535-provider-video-capability-gray-fix`
- `systemctl is-active xinghuan-canvas-next.service` 与 `xinghuan-canvas-next-worker.service` 均为 `active`。

影响:

- 灰度环境现在已经真实支持后台视频模型 `多参考图 / 首帧 / 尾帧` 能力配置。
- 画布视频节点切换到对应发布模型后，可按模型能力动态展示输入模式。
- APIMart 异步视频模型灰度链路已恢复可验收状态。
- 同时补上了“历史迁移文件被二次修改不会自动补库”的经验教训，避免后续生产再踩同类坑。

风险:

- 当前灰度与生产共用同一 PostgreSQL 数据底座，后续生产若继续扩列，仍需坚持新增前向迁移，不能再直接修改历史迁移文件。
- 历史 GRSAI 异步灰度回归脚本未闭环，仍是独立待办，但不是本轮新增阻塞。

下一步:

- 将这次迁移策略修正同步到后续发布习惯，所有线上 schema 变更都只走新增 migration。
- 如需继续推进，可直接进入下一轮真实灰度联调或生产前比对。

### Provider 灵活配置与视频输入能力开关方案归档

目标:

- 将“多服务商模型接入如何长期扩展”的当前确认方向沉淀为项目正式记忆。
- 记录本轮视频节点失败排查结论，避免后续继续把异步视频协议误当成同步视频 URL 代理问题处理。
- 为后续实现“视频模型能力开关 + APIMart 异步 adapter”提供统一文档入口。

变更范围:

- 新增 `development/provider-flex-config-and-input-capabilities-2026-06-08.md`，记录“结构化默认配置 + 受控高级配置 + 专用 adapter”的三层方案。
- 更新 `development/README.md`，将该方案加入开发过程资料索引。
- 更新 `docs/prd/v0.1.0/provider-model-framework.md`、`decisions.md`、`progress.md`、`changelog.md` 和 `MEMORY.md`，同步模型能力开关、视频节点动态输入和 APIMart 异步视频适配方向。

验证证据:

- 已重新核对前端视频节点、后端视频代理和 APIMart 任务状态文档，确认当前失败不是普通参数填写错误，而是“同步代理假设”和“结构化能力不足”共同导致。
- 本轮仅归档方案与调查结论，不修改运行时代码、不改服务器配置、不触碰密钥。

影响:

- 后续接入视频模型时，不再默认依赖字符串 `inputProfile` 和同步结果假设。
- 项目后续实现会以结构化 `inputCapabilities`、后台视频能力开关和专用 adapter 为主线。

风险:

- 当前仍停留在方案归档阶段，视频节点失败链路尚未真正修复。
- 若后续实现时不补结构化测试，容易再次退回“新模型靠临时分支兼容”的状态。

下一步:

- 进入正式实现时，先补测试，再推进模型元数据升级、后台能力开关、画布视频节点动态输入和 APIMart 异步视频 adapter。

### Hermes 项目专属助手候选方案归档

目标:

- 将“无限画布是否引入 Hermes 项目专属助手”的当前讨论结果沉淀为文档。
- 明确这是一份待评估方案备忘，不是已批准开发项，避免后续被误读为既定执行计划。
- 为后续再判断是否实施、如何分权、如何收权限保留统一入口。

变更范围:

- 新增 `development/canvas-hermes-assistant-candidate-2026-06-08.md`，记录前端创作助手和后台审计/配置助手的双面职责、权限边界、隔离方式和候选拓扑。
- 更新 `development/README.md`，把该候选备忘加入开发过程资料索引。
- 更新 `docs/prd/v0.1.0/progress.md` 与 `docs/prd/v0.1.0/changelog.md`，注明当前仅归档方案，不进入实施排期。

验证证据:

- 文档已落在 `development/`，不触碰运行时代码、环境变量、密钥或服务器配置。
- 文案中已明确标注 `候选方案 / 未批准实施`，并区分“复用 Hermes 内核”与“直接复用当前 Hermes 运行实例”。

影响:

- 后续如果继续评估项目专属 AI 助手，可以直接基于本轮备忘推进，不需要重新回忆这次讨论结论。
- 当前版本不会因为该文档而默认新增任何运行服务、权限或产品承诺。

风险:

- 该方案目前仍停留在设计备忘层，不应被当成已排期需求或已批准架构。

下一步:

- 后续若继续评估，再单独比较“单实例双角色”和“双实例分权”两种落地拓扑，并决定是否进入正式设计与实施计划。

### 管理后台 Provider 面板拆分灰度发布

目标:

- 将管理后台 Provider 面板拆分与主入口薄壳化改动推上灰度环境。
- 确认 `canvas-next.hhh2121.xyz` 的主站、后台入口、权限链路和单端口验收在新 release 下继续正常。
- 验证本轮后台结构优化没有破坏既有灰度部署链。

变更范围:

- 打包并上传 release `20260608-1200-admin-provider-panel-gray`。
- 在服务器 `/opt/apps/xinghuan-canvas-next/releases/20260608-1200-admin-provider-panel-gray` 执行 `npm ci` 和 `npm run build:single-port`。
- 切换 `/opt/apps/xinghuan-canvas-next/current` 到新 release，并重启 `xinghuan-canvas-next.service` 与 `xinghuan-canvas-next-worker.service`。
- 新增灰度发布记录 `ops/admin-provider-panel-gray-2026-06-08.md`。

验证证据:

- 本机 `npm run build -w @xinghuan/admin` 通过。
- 本机 `npm run build:single-port` 通过。
- 本机 `npm run verify:admin-interaction-guards` 通过。
- 本机 `npm run verify:single-port` 通过。
- 服务器 `npm run verify:single-port` 通过。
- 服务器 `npm run verify:admin-interaction-guards` 通过。
- 服务器 `npm run verify:admin-confirm-action-dialog-contract` 通过。
- 服务器 `npm run verify:admin-manual-model-dialog-contract` 通过。
- `https://canvas-next.hhh2121.xyz/`、`/admin`、`/api/status` 均返回 `200`。
- `readlink /opt/apps/xinghuan-canvas-next/current` 返回 `20260608-1200-admin-provider-panel-gray`。
- `systemctl is-active xinghuan-canvas-next.service` 与 `xinghuan-canvas-next-worker.service` 均为 `active`。

影响:

- 后台 Provider 面板拆分与主入口薄壳化已经进入灰度运行态。
- 灰度主站、后台入口和权限链路继续可用，说明这轮后台重构没有打坏单端口主链路。

风险:

- `npm run verify:grsai-draw-gray` 的同步图像代理部分通过，但异步 Worker 部分仍未在脚本窗口内完成，当前 GRSAI 异步灰度回归仍是未闭环状态。

下一步:

- 继续排查 GRSAI 异步灰度回归脚本失败，重点看 Worker 领取后到任务终态之间的时序、上游响应和脚本等待策略。

### 管理后台 Provider 面板拆分与主入口薄壳化

目标:

- 继续降低 `apps/admin/src/main.tsx` 的体积，把 Provider 设置相关的大块 UI 和类型从主入口中拆开。
- 保持既有后台交互、契约脚本和验收方式不变，不让结构优化破坏当前验证链。
- 为后续继续拆 `ApiSettingsPanel` 周边逻辑、RunningHub 配置和模型编辑能力建立更清晰边界。

变更范围:

- 新增 `apps/admin/src/admin-types.ts`，集中承载后台用户、Provider、模型、任务、系统、审计和确认动作类型。
- 新增 `apps/admin/src/admin-api-settings-panel.tsx`，承接 Provider 设置页主体、模型拉取、模型导入、删除确认和手动新增模型流程。
- 新增 `apps/admin/src/admin-model-picker.tsx`、`admin-model-editor.tsx`、`admin-runninghub-panel.tsx`、`admin-lora-panel.tsx`，把模型选择器、模型高级设置、RunningHub 面板和 LoRA 面板独立成模块。
- `apps/admin/src/main.tsx` 重写为薄壳入口，只保留登录态判断、后台导航、统一数据加载和页面切换；同时保留 `Capability`、`ConfirmAction`、`AdminUser`、`ProviderRecord`、`ModelRecord`、`Summary`、`TaskRecord` 等兼容导出，继续满足现有契约脚本。
- `apps/admin/src/admin-overview-panel.tsx`、`admin-readonly-panels.tsx`、`admin-task-panel.tsx`、`admin-users-panel.tsx` 改为从共享类型文件取类型。
- 修复 `apps/admin/src/admin-model-picker.tsx` 中已存在模型能力分类的优先级问题，避免因三元运算优先级导致已存在模型被误判为图像模型。

验证证据:

- `npm run type-check -w @xinghuan/admin` 通过。
- `npm run verify:admin-confirm-action-dialog-contract` 通过。
- `npm run verify:admin-manual-model-dialog-contract` 通过。
- `npm run verify:admin-overview-panel-contract` 通过。
- `npm run verify:admin-readonly-panels-contract` 通过。
- `npm run verify:admin-task-panel-contract` 通过。
- `npm run verify:admin-users-panel-contract` 通过。

影响:

- 后台主入口从巨型单文件进一步收口为“认证 + 导航 + 数据加载 + 页面装配”的薄壳，后续阅读和继续拆分都会轻松很多。
- Provider 设置页的大部分复杂度已经被挪到独立模块里，后面继续拆 `ApiSettingsPanel` 的内部 helper 或再补专门契约脚本时，风险更可控。
- 现有后台契约脚本仍然可用，不需要为了结构优化重写整套验证入口。

风险:

- 当前 Provider 设置页内部 helper 仍留在 `admin-api-settings-panel.tsx`，尚未继续细拆到纯逻辑模块。
- 本轮只做本机结构优化与静态/契约验证，尚未单独跑后台构建和灰度发布。

下一步:

- 继续把 `admin-api-settings-panel.tsx` 里的 providerDraft、provider 判定和模型导入/保存逻辑拆成更小的纯逻辑边界。
- 视需要补 `verify:admin-api-settings-panel-contract` 一类更细的合同脚本，避免后续继续拆 Provider 面板时回归。

### GRSAI 图像参考图本地参数修复

目标:

- 修复图像生成节点在传入本地上传图片时，GRSAI `gpt-image-2` 未参考原图的问题。
- 避免上游返回的“unsupported file type”占位提示图被当作最终图像落库、展示并下载。
- 保持 OpenAI-like 图像代理和 `/api/provider-files/...` HMAC 短链逻辑不被误改。

变更范围:

- 新增 `apps/api/src/grsai-reference-images.ts`，在 API 直连代理中仅针对 `grsai_draw` 将本地 `/files/input/...` 与 `/files/output/...` 参考图读取为 `data:image/...;base64,...`。
- 新增 `apps/worker/src/grsai-reference-images.ts`，让后台 Worker 执行 GRSAI 图像任务时使用相同的本地参考图内联策略。
- `apps/api/src/server.ts` 与 `apps/worker/src/worker.ts` 改为把 GRSAI `urls` 参数中的本地参考图发送为 data URL；远程 URL 和已有 data URL 保持原样。
- 新增 `scripts/verify-grsai-reference-images-contract.ts` 与根脚本 `verify:grsai-reference-images-contract`。
- 更新 `scripts/verify-worker-grsai-image-adapter.mjs`，未来 Worker 联调会验证本地上传参考图提交给 GRSAI 前已被内联。

验证证据:

- TDD 红灯：`npx tsx scripts/verify-grsai-reference-images-contract.ts` 首次按预期因 `apps/api/src/grsai-reference-images.js` 模块缺失失败。
- `npm run verify:grsai-reference-images-contract` 通过，覆盖本地 input/output 图片转 data URL、远程 URL 保持不变和数量上限。
- `npx tsx scripts/verify-grsai-image-adapter.ts` 通过。
- `npm run type-check -w @xinghuan/api` 通过。
- `npm run type-check -w @xinghuan/worker` 通过。
- `npm run build -w @xinghuan/api` 通过。
- `npm run build -w @xinghuan/worker` 通过。
- `npm run verify:provider-file-access-contract` 通过，确认非 GRSAI provider-file 签名短链逻辑未被破坏。
- `npm run verify:worker-grsai-contract` 通过。

影响:

- GRSAI 图像节点收到本地上传图作为参考图时，不再依赖外部上游回拉登录态文件或短链文件，而是直接收到可识别的图片数据。
- 截图中的参考图被忽略和“unsupported file type”文字占位图随结果一起下载的问题，根因路径已被阻断。

风险:

- 本轮为本机源码修复和合约验证，尚未推灰度或生产。
- 已经生成并落库的旧占位图不会被自动清洗；如需处理历史素材，应按单个明确文件或后台资产记录逐项确认。

下一步:

- 如需线上生效，需要按灰度流程发布到 `canvas-next.hhh2121.xyz` 并用真实 GRSAI Key 重新跑一次图生图参考图验收。

### 当前修复与文档清理进度归档

目标:

- 建立一份集中记录当前本机修复、重构、验证和清理状态的文档。
- 清除活跃入口中的废旧状态表述，避免继续把 6 月 4 日和 6 月 5 日的早期部署记录当作当前运行态。
- 保留灰度/生产发布审计证据，不批量删除历史文档。

变更范围:

- 新增 `ops/current-fix-cleanup-progress-2026-06-08.md`，记录最近后台拆分提交、验证状态、未提交运行期数据和文档清理原则。
- 重写 `ops/README.md`，改为当前运行态入口、当前灰度材料、当前生产材料、历史发布记录和清理规则。
- 更新 `docs/prd/README.md` 当前版本日期与摘要。
- 更新 `docs/prd/v0.1.0/progress.md` 与 `docs/prd/v0.1.0/changelog.md`。

验证证据:

- `rg --files docs DEVLOG.md MEMORY.md AGENTS.md ops` 已用于盘点当前文档。
- `git status --short --branch` 确认本轮开始前只剩运行期 JSON 脏文件。
- 清理方式只改活跃索引与新增状态文档，未删除历史发布证据文件，未触碰运行期 JSON。

影响:

- 后续查看 `ops/README.md` 时，会优先看到当前灰度/生产入口和最新验收材料。
- 6 月 4 日旧域名、旧服务器状态和 6 月 5 日早期灰度记录被明确标为历史记录，不再误导当前判断。

风险:

- 本轮未实际删除历史文档文件；如果后续要继续瘦身，需要逐个文件确认后单文件删除。
- 本轮未推灰度或生产。

下一步:

- 如需继续清理，可先建立 `ops/_archive/README.md` 或归档索引，再逐个迁移或删除明确不需要的历史文件。

### 管理后台确认动作弹窗抽离

目标:

- 继续优化管理后台文件结构，降低 `apps/admin/src/main.tsx` 中危险操作确认弹窗的 UI 体积。
- 保持 Provider/模型删除的站内确认面板、标题、说明、详情、确认按钮、取消按钮、禁用状态和 loading 图标不变。
- 保持后台不使用原生 `confirm()` / `prompt()` 的交互守卫。

变更范围:

- 新增 `apps/admin/src/admin-confirm-action-dialog.tsx`，集中管理 `ConfirmActionDialog`。
- `apps/admin/src/main.tsx` 改为导入确认动作弹窗，并导出 `ConfirmAction` 类型供弹窗 type-only 复用。
- 新增 `scripts/verify-admin-confirm-action-dialog-contract.mjs` 与根脚本 `verify:admin-confirm-action-dialog-contract`。
- 更新 `docs/prd/v0.1.0/progress.md` 与 `docs/prd/v0.1.0/changelog.md`。

验证证据:

- TDD 红灯：`npm run verify:admin-confirm-action-dialog-contract` 首次按预期因 `admin-confirm-action-dialog.tsx` 模块缺失、`main.tsx` 仍内联 `ConfirmActionDialog` 和 `ConfirmAction` 未按新边界导出失败。
- `npm run verify:admin-confirm-action-dialog-contract` 通过，覆盖模块导出、主文件不再内联、modal 语义、tone class、标题/说明/详情/确认文案、cancel/confirm 行为、危险图标和 loading 状态。
- `npm run type-check -w @xinghuan/admin` 通过。
- `npm run build -w @xinghuan/admin` 通过。
- `npm run verify:admin-interaction-guards` 通过，确认危险 Provider/模型动作仍使用站内确认弹窗且未引入原生 prompt/confirm。

影响:

- 管理后台主文件进一步减少危险操作弹窗 UI 噪音。
- 删除确认面板的行为被独立合约锁定，后续拆分 Provider 大面板时更不容易误伤交互守卫。

风险:

- 当前仅完成本机源码、构建和合同验证，尚未单独发布到灰度或生产。
- 本机仍存在几份运行时数据文件脏改动，本次不会提交这些数据文件。

下一步:

- 继续推进后台面板级拆分；下一步可考虑拆 `ModelPicker` 或 `ModelEditorRow`，再逐步为 Provider 设置大面板建立更细边界。

### 管理后台手动模型弹窗抽离

目标:

- 继续优化管理后台文件结构，降低 `apps/admin/src/main.tsx` 中模型管理弹窗 UI 的体积。
- 保持手动新增模型弹窗的标题、说明、模型 ID 输入、默认 placeholder、禁用状态、loading 图标和提交行为不变。
- 避免新弹窗模块反向运行时依赖 `main.tsx`，把能力文案 helper 下沉到 view model。

变更范围:

- 新增 `apps/admin/src/admin-manual-model-dialog.tsx`，集中管理 `ManualModelDialog`。
- `apps/admin/src/main.tsx` 改为导入手动模型弹窗，并导出 `Capability` 类型供弹窗 type-only 复用。
- `capabilityLabel` 从 `main.tsx` 迁入 `apps/admin/src/admin-view-model.ts`，供主文件和弹窗共同复用。
- 新增 `scripts/verify-admin-manual-model-dialog-contract.mjs` 与根脚本 `verify:admin-manual-model-dialog-contract`。
- 扩展 `scripts/verify-admin-view-model-contract.ts`，锁定 `capabilityLabel("image"|"video"|"chat")` 映射。
- 更新 `docs/prd/v0.1.0/progress.md` 与 `docs/prd/v0.1.0/changelog.md`。

验证证据:

- TDD 红灯：`npm run verify:admin-manual-model-dialog-contract` 首次按预期因 `admin-manual-model-dialog.tsx` 模块缺失、`main.tsx` 仍内联 `ManualModelDialog` 和 `Capability/capabilityLabel` 未按新边界导出失败。
- `npm run verify:admin-manual-model-dialog-contract` 通过，覆盖模块导出、主文件不再内联、modal 语义、标题/说明、placeholder、submit/disabled、cancel/loading 图标和能力文案 helper 不在 `main.tsx` 内联。
- `npm run verify:admin-view-model-contract` 通过，新增覆盖 `capabilityLabel` 三类能力文案。
- `npm run type-check -w @xinghuan/admin` 通过。
- `npm run build -w @xinghuan/admin` 通过。
- `npm run verify:admin-interaction-guards` 通过，确认手动模型创建仍使用站内弹窗且未引入原生 prompt/confirm。

影响:

- 管理后台主文件进一步减少模型创建弹窗 UI 噪音。
- 能力文案映射从主文件迁入 view model，后续模型列表、模型选择器和弹窗可复用同一来源。

风险:

- 当前仅完成本机源码、构建和合同验证，尚未单独发布到灰度或生产。
- 本机仍存在几份运行时数据文件脏改动，本次不会提交这些数据文件。

下一步:

- 继续推进后台面板级拆分；下一步可考虑拆 `ModelPicker` 或 `ModelEditorRow`，再逐步为 Provider 设置大面板建立更细边界。

### 管理后台总览面板抽离

目标:

- 继续优化管理后台文件结构，降低 `apps/admin/src/main.tsx` 中只读总览 UI 的体积。
- 保持总览指标卡、Provider 状态、最近任务和模型目录展示不变。
- 为总览面板建立静态合同，避免后续拆分 Provider 或模型面板时误改首页核心信息架构。

变更范围:

- 新增 `apps/admin/src/admin-overview-panel.tsx`，集中管理 `Overview`。
- `apps/admin/src/main.tsx` 改为导入总览面板，并导出 `Summary`、`ProviderRecord` 和 `ModelRecord` 类型供总览面板复用。
- 新增 `scripts/verify-admin-overview-panel-contract.mjs` 与根脚本 `verify:admin-overview-panel-contract`。
- 更新 `docs/prd/v0.1.0/progress.md` 与 `docs/prd/v0.1.0/changelog.md`。

验证证据:

- TDD 红灯：`npm run verify:admin-overview-panel-contract` 首次按预期因 `admin-overview-panel.tsx` 模块缺失、`main.tsx` 仍内联 `Overview` 和类型未导出失败。
- `npm run verify:admin-overview-panel-contract` 通过，覆盖模块导出、主文件不再内联、指标卡、Provider 状态表、最近任务表、模型目录表、`DataTable` 和 `statusText` 使用。
- `npm run type-check -w @xinghuan/admin` 通过。
- `npm run build -w @xinghuan/admin` 通过。
- `npm run verify:admin-interaction-guards` 通过，确认后台站内确认弹窗约束未被破坏。

影响:

- 管理后台主文件进一步减少总览展示噪音，为后续拆分 Provider 设置、模型目录或 RunningHub 面板铺路。
- 总览仍只消费已有 `summary/providers/models/tasks` 数据，不新增 API 或状态行为。

风险:

- 当前仅完成本机源码、构建和合同验证，尚未单独发布到灰度或生产。
- 本机仍存在几份运行时数据文件脏改动，本次不会提交这些数据文件。

下一步:

- 继续推进后台面板级拆分；下一步若拆 Provider 设置面板，需要先把 Provider draft、模型拉取、模型选择器和确认弹窗拆分边界补成更细合同。

### 管理后台用户面板抽离

目标:

- 继续优化管理后台文件结构，降低 `apps/admin/src/main.tsx` 中用户管理 UI 的体积。
- 保持新增成员、用户表格、角色/状态展示、重置密码和启用/禁用操作不变。
- 为用户面板建立静态合同，避免后续拆分 Provider 或模型面板时误改用户管理入口。

变更范围:

- 新增 `apps/admin/src/admin-users-panel.tsx`，集中管理 `UsersPanel`。
- `apps/admin/src/main.tsx` 改为导入用户面板，并导出 `AdminUser` 类型供用户面板复用。
- 新增 `scripts/verify-admin-users-panel-contract.mjs` 与根脚本 `verify:admin-users-panel-contract`。
- 更新 `docs/prd/v0.1.0/progress.md` 与 `docs/prd/v0.1.0/changelog.md`。

验证证据:

- TDD 红灯：`npm run verify:admin-users-panel-contract` 首次按预期因 `admin-users-panel.tsx` 模块缺失、`main.tsx` 仍内联 `UsersPanel` 和 `AdminUser` 未导出失败。
- `npm run verify:admin-users-panel-contract` 通过，覆盖模块导出、主文件不再内联、新增成员表单、用户表格列、角色/状态展示、重置密码流程、启用/禁用流程和共享后台组件使用。
- `npm run type-check -w @xinghuan/admin` 首次暴露 `Plus` 仍被 Provider/模型/LoRA 区域复用，恢复 import 后复跑通过。
- `npm run build -w @xinghuan/admin` 通过。
- `npm run verify:admin-interaction-guards` 通过，确认后台站内确认弹窗约束未被破坏。

影响:

- 管理后台主文件进一步减少用户管理 UI 噪音，为后续拆分 Provider 设置、模型目录或 RunningHub 面板铺路。
- 用户创建、密码重置和启用/禁用仍通过同一个 `mutate` helper 调用现有后台 API，行为未改变。

风险:

- 当前仅完成本机源码、构建和合同验证，尚未单独发布到灰度或生产。
- 本机仍存在几份运行时数据文件脏改动，本次不会提交这些数据文件。

下一步:

- 继续推进后台面板级拆分，下一步可评估 Provider 设置面板或模型相关子面板，但这些面板依赖更复杂，拆分前需要先补更细的合同脚本。

### 管理后台任务面板抽离

目标:

- 继续优化管理后台文件结构，降低 `apps/admin/src/main.tsx` 中任务监控和任务操作 UI 的体积。
- 保持创建测试任务、任务监控表格、状态展示、取消/重试动作、日志摘要和更新时间展示不变。
- 为任务面板建立静态合同，避免后续拆分用户、Provider 或模型面板时误改任务生命周期入口。

变更范围:

- 新增 `apps/admin/src/admin-task-panel.tsx`，集中管理 `TasksPanel`。
- `apps/admin/src/main.tsx` 改为导入任务面板，并导出 `TaskRecord` 类型供任务面板复用。
- 新增 `scripts/verify-admin-task-panel-contract.mjs` 与根脚本 `verify:admin-task-panel-contract`。
- 更新 `docs/prd/v0.1.0/progress.md` 与 `docs/prd/v0.1.0/changelog.md`。

验证证据:

- TDD 红灯：`npm run verify:admin-task-panel-contract` 首次按预期因 `admin-task-panel.tsx` 模块缺失、`main.tsx` 仍内联 `TasksPanel` 和 `TaskRecord` 未导出失败。
- `npm run verify:admin-task-panel-contract` 通过，覆盖模块导出、主文件不再内联、创建任务表单、任务监控表格列、状态 helper、取消/重试动作、日志/时间格式和共享后台组件使用。
- `npm run type-check -w @xinghuan/admin` 通过。
- `npm run build -w @xinghuan/admin` 通过。
- `npm run verify:admin-interaction-guards` 通过，确认后台站内确认弹窗约束未被破坏。

影响:

- 管理后台主文件进一步减少任务监控 UI 噪音，为后续拆分用户面板、Provider 设置或模型面板铺路。
- 任务取消/重试入口仍复用 `@xinghuan/shared` 的状态守卫，行为未改变。

风险:

- 当前仅完成本机源码、构建和合同验证，尚未单独发布到灰度或生产。
- 本机仍存在几份运行时数据文件脏改动，本次不会提交这些数据文件。

下一步:

- 继续推进后台面板级拆分，下一步可优先选择用户面板，或在需要上线时先推灰度并复跑后台验收。

### 入口 UI 设计文件 Brief 补强

目标:

- 把用户提供的 `stitch_ui_optimization_and_transitions/` 设计文件转化为可交给 Google/Gemini 前端生成使用的项目内正式 Brief。
- 明确哪些设计内容可采用、哪些演示内容禁止照搬，避免再次生成带白色输入框、中心 logo、占位入口或调试文字的入口页。
- 指定后续代码接入落点，确保 Google/Gemini 产出的页面能回接现有 React/Vite 登录流和工作区过渡。

变更范围:

- 更新 `docs/prd/v0.1.0/entry-ui-google-brief.md`，新增设计源使用矩阵、项目接入落点、推荐拆分方式和 Google/Gemini 接入顺序。
- 更新 `docs/prd/v0.1.0/progress.md` 与 `docs/prd/v0.1.0/changelog.md`。
- 本轮不改登录页代码、不改认证 API、不改灰度/生产部署。

验证证据:

- 已读取并核对 `stellar_canvas_internal/DESIGN.md`、`_1/code.html`、`_2/code.html`、`_1/screen.png`、`_2/screen.png`。
- CodeGraph 当前索引为 OK，确认入口组件落点为 `apps/web/src/components/LoginGate.tsx`，工作区过渡落点为 `apps/web/src/App.tsx` 的 `WorkspaceShellFallback`。
- 本轮为文档补强，后续真正接入 Google/Gemini 代码时仍需重新运行 `verify:xinghuan-entry-ui`、Web type-check 和 Web build。

影响:

- 后续入口 UI 生成有了更硬的约束：设计包作为视觉语言来源，不作为逐像素复刻目标。
- 明确禁止 Tailwind CDN、Google Fonts CDN、远程图片、白色输入框、中心 logo、SSO/组织网络、坐标/延迟调试文字和白闪爆发。

风险:

- 当前只是设计 Brief 补强，尚未把 Google/Gemini 新产出的 UI 接入代码。
- 本机仍存在几份运行时数据文件脏改动，本次不会提交这些数据文件。

下一步:

- 若用户确认使用 Google/Gemini 产出的前端代码，下一轮应先对照 Brief 做结构审查，再用 TDD/验证脚本方式接入 `LoginGate` 和 `WorkspaceShellFallback`。

### 管理后台只读面板抽离

目标:

- 继续优化管理后台文件结构，降低 `apps/admin/src/main.tsx` 中只读面板的 UI 体积。
- 保持审计日志表格和系统状态表格的标题、列名、行顺序和 fallback 文案不变。
- 为只读面板建立静态合同，避免后续拆分任务/用户/Provider 面板时误改审计或系统状态展示。

变更范围:

- 新增 `apps/admin/src/admin-readonly-panels.tsx`，集中管理 `AuditPanel` 和 `SystemPanel`。
- `apps/admin/src/main.tsx` 改为导入只读面板，并导出 `AuditRecord`、`SystemInfo` 类型供面板复用。
- 新增 `scripts/verify-admin-readonly-panels-contract.mjs` 与根脚本 `verify:admin-readonly-panels-contract`。
- 更新 `docs/prd/v0.1.0/progress.md` 与 `docs/prd/v0.1.0/changelog.md`。

验证证据:

- TDD 红灯：`npm run verify:admin-readonly-panels-contract` 首次按预期因 `admin-readonly-panels.tsx` 模块缺失失败。
- `npm run verify:admin-readonly-panels-contract` 通过，覆盖模块导出、主文件不再内联、审计表标题/列名、系统状态标题/列名/行标签和共享 `DataTable` 使用。
- `npm run type-check -w @xinghuan/admin` 通过。
- `npm run build -w @xinghuan/admin` 通过。
- `npm run verify:admin-interaction-guards` 通过，确认后台站内确认弹窗约束未被破坏。
- `codegraph sync` 完成，`codegraph status` 显示索引最新。

影响:

- 管理后台主文件进一步减少只读展示面板噪音，为后续拆分用户、任务和 Provider 面板铺路。
- 审计和系统状态展示结构保持不变。

风险:

- 当前仅完成本机源码、构建和合同验证，尚未单独发布到灰度或生产。
- 本机仍存在几份运行时数据文件脏改动，本次不会提交这些数据文件。

下一步:

- 继续推进后台面板级拆分，下一步可优先选择任务面板或用户面板，或在需要上线时先推灰度并复跑后台验收。

### 管理后台通用展示组件抽离

目标:

- 继续优化管理后台文件结构，降低 `apps/admin/src/main.tsx` 中通用表格、表单面板和状态胶囊组件的耦合。
- 保持后台数据表格、表单面板、状态胶囊 className 和渲染结构不变。
- 为后台通用展示组件建立静态合同，避免后续拆分用户、任务或系统面板时误改基础 UI 结构。

变更范围:

- 新增 `apps/admin/src/admin-common-components.tsx`，集中管理 `DataTable`、`AdminTable`、`FormPanel` 和 `StatusPill`。
- `apps/admin/src/main.tsx` 改为导入通用展示组件，不再内联这些无状态组件。
- 新增 `scripts/verify-admin-common-components-contract.mjs` 与根脚本 `verify:admin-common-components-contract`。
- 更新 `docs/prd/v0.1.0/progress.md` 与 `docs/prd/v0.1.0/changelog.md`。

验证证据:

- TDD 红灯：`npm run verify:admin-common-components-contract` 首次按预期因 `admin-common-components.tsx` 模块缺失失败。
- `npm run verify:admin-common-components-contract` 通过，覆盖模块导出、主文件不再内联、表格/表单 className、状态胶囊 tone class 和 DataTable 表头/行渲染。
- `npm run type-check -w @xinghuan/admin` 通过。
- `npm run build -w @xinghuan/admin` 通过。
- `npm run verify:admin-interaction-guards` 通过，确认后台站内确认弹窗约束未被破坏。
- `codegraph sync` 完成，`codegraph status` 显示索引最新。

影响:

- 管理后台主文件进一步减少通用 UI 组件噪音，为继续拆分用户、任务、系统或 Provider 面板铺路。
- 现有后台基础布局 className 与表格/表单结构保持不变。

风险:

- 当前仅完成本机源码、构建和合同验证，尚未单独发布到灰度或生产。
- 本机仍存在几份运行时数据文件脏改动，本次不会提交这些数据文件。

下一步:

- 继续推进后台面板级拆分，优先考虑用户/任务/系统这种依赖较少的面板，或在需要上线时先推灰度并复跑后台验收。

### 管理后台导航与任务状态 ViewModel 抽离

目标:

- 继续优化管理后台文件结构，降低 `apps/admin/src/main.tsx` 中导航配置、任务状态文案和状态色映射的耦合。
- 保持后台导航顺序、标题文案、任务状态中文文案和状态胶囊颜色不变。
- 为后台展示层的纯 view model 建立独立合同，避免后续拆分 Provider/任务面板时误改导航或任务状态展示。

变更范围:

- 新增 `apps/admin/src/admin-view-model.ts`，集中管理后台导航项、`titleFor`、`statusText` 和 `taskTone`。
- `apps/admin/src/main.tsx` 改为导入 view model helpers，不再内联导航和任务状态映射。
- 新增 `scripts/verify-admin-view-model-contract.ts` 与根脚本 `verify:admin-view-model-contract`。
- 更新 `docs/prd/v0.1.0/progress.md` 与 `docs/prd/v0.1.0/changelog.md`。

验证证据:

- TDD 红灯：`npm run verify:admin-view-model-contract` 首次按预期因 `admin-view-model.js` 模块缺失失败。
- `npm run verify:admin-view-model-contract` 通过，覆盖导航 ID/文案顺序、标题 fallback、所有任务状态中文文案和状态色映射。
- `npm run type-check -w @xinghuan/admin` 通过。
- `npm run build -w @xinghuan/admin` 通过。
- `npm run verify:admin-interaction-guards` 通过，确认后台站内确认弹窗约束未被破坏。
- `codegraph sync` 完成，`codegraph status` 显示索引最新。

影响:

- 管理后台主文件进一步减少纯展示映射噪音，为继续拆分 Provider 设置、任务表格和通用表格/弹窗组件铺路。
- 导航和任务状态展示行为保持不变。

风险:

- 当前仅完成本机源码、构建和合同验证，尚未单独发布到灰度或生产。
- 本机仍存在几份运行时数据文件脏改动，本次不会提交这些数据文件。

下一步:

- 继续推进后台大文件拆分，优先考虑 Provider 设置面板或通用表格/弹窗组件，或在需要上线时先推灰度并复跑后台验收。

### 管理后台 API Client 抽离

目标:

- 优化管理后台文件结构，降低 `apps/admin/src/main.tsx` 同时承载 UI 组件与请求 helper 的耦合。
- 保持后台登录、数据加载、Provider/模型/任务/审计/系统接口请求行为不变。
- 为后台 API 响应解包和错误处理建立独立合同，避免后续后台交互改动时破坏 `success:false`、`ok:false` 或 HTTP 错误处理。

变更范围:

- 新增 `apps/admin/src/admin-api-client.ts`，集中管理后台 `api<T>(pathname, options?)` 请求 helper。
- `apps/admin/src/main.tsx` 改为导入 `api`，不再内联 fetch/响应解包逻辑。
- 新增 `scripts/verify-admin-api-client-contract.ts` 与根脚本 `verify:admin-api-client-contract`。
- 更新 `docs/prd/v0.1.0/progress.md` 与 `docs/prd/v0.1.0/changelog.md`。

验证证据:

- TDD 红灯：`npm run verify:admin-api-client-contract` 首次按预期因 `admin-api-client.js` 模块缺失失败。
- `npm run verify:admin-api-client-contract` 通过，覆盖 same-origin credentials、成功返回 `payload.data`、HTTP 失败、`success:false`、`ok:false` 和空成功响应。
- `npm run type-check -w @xinghuan/admin` 通过。
- `npm run build -w @xinghuan/admin` 通过。
- `npm run verify:admin-interaction-guards` 通过，确认后台仍未重新引入原生 `confirm()` / `prompt()`，危险操作仍走站内弹窗。
- `codegraph sync` 完成，`codegraph status` 显示索引最新。

影响:

- 管理后台主文件减少基础请求逻辑噪音，后续拆分 Provider、任务或用户面板时有更清晰的 API 边界。
- 后台请求错误处理行为保持不变，继续兼容服务端 `success` 和 `ok` 两种失败标记。

风险:

- 当前仅完成本机源码、构建和合同验证，尚未单独发布到灰度或生产。
- 本机仍存在几份运行时数据文件脏改动，本次不会提交这些数据文件。

下一步:

- 继续推进后台大文件拆分，优先考虑 Provider 设置面板或可复用表格/弹窗组件，或在需要上线时先推灰度并复跑后台验收。

### API 输入清洗与 MIME 推断工具抽离

目标:

- 继续优化后端文件结构，降低 `apps/api/src/server.ts` 中输入清洗和静态文件 MIME 纯函数的杂糅程度。
- 保持上传、静态资源返回、Provider/模型字段清洗、用户 ID 清洗和 JSON schema 文本 fallback 行为不变。
- 为高频输入清洗函数建立独立合约，避免后续调整文件名、slug 或 MIME 映射时缺少回归。

变更范围:

- 新增 `apps/api/src/api-sanitizers.ts`，集中管理 `safeText`、`safeEmail`、`safeSlug`、`safeJsonText`、`safeFilename`、`safeUserId` 和 `inferMime`。
- `apps/api/src/server.ts` 改为导入 API sanitizer helpers；路由、资源写入和 Provider 逻辑保持原调用方式。
- 新增 `scripts/verify-api-sanitizers-contract.ts` 与根脚本 `verify:api-sanitizers-contract`。
- 更新 `docs/prd/v0.1.0/progress.md` 与 `docs/prd/v0.1.0/changelog.md`。

验证证据:

- TDD 红灯：`npm run verify:api-sanitizers-contract` 首次按预期因 `api-sanitizers.js` 模块缺失失败。
- `npm run verify:api-sanitizers-contract` 通过，覆盖长文本截断、邮箱归一化、slug 当前行为、JSON fallback、文件名清洗、用户 ID 清洗和 web/image/video/audio/font/binary MIME 映射。
- `npm run type-check -w @xinghuan/api` 通过。
- `npm run build -w @xinghuan/api` 通过。
- `npm run build:single-port` 通过。
- 使用临时数据目录和临时端口 `127.0.0.1:18353` 启动受控单端口服务，`npm run verify:single-port` 通过，确认静态资源、上传文件、登录、成员隔离和 SPA fallback 未被抽离破坏。

影响:

- 输入清洗和 MIME 推断从巨型 `server.ts` 中剥离，后续可以单独审查和扩展这些基础规则。
- 保留 `safeSlug("!!!")` 当前返回 `"-"` 的既有行为；如需改善为 fallback，应后续作为行为变更单独验证。

风险:

- 当前仅完成本机源码、构建和受控临时服务验证，尚未单独发布到灰度或生产。
- 本机仍存在几份运行时数据文件脏改动，本次不会提交这些数据文件。

下一步:

- 继续推进下一处高价值结构优化，或在需要上线时先推灰度并复跑文件上传、静态资源和后台 Provider/模型表单验收。

### HTTP 请求与 Session Cookie 工具抽离

目标:

- 继续优化后端文件结构，降低 `apps/api/src/server.ts` 中基础 HTTP/session 工具函数的杂糅程度。
- 保持登录、退出、当前用户识别、未登录拒绝、管理员权限和成员隔离行为不变。
- 为请求 JSON 读取、Cookie 解析、Session Cookie 生成和 secure 标记建立独立合约，避免后续认证链路修改时缺少低层回归。

变更范围:

- 新增 `apps/api/src/http-session-utils.ts`，集中管理 `readJsonBody`、`readCookie`、`buildSessionCookie`、`expireSessionCookie`、`SESSION_COOKIE_NAME` 和 `SESSION_TTL_MS`。
- `apps/api/src/server.ts` 改为导入 HTTP/session helpers；认证路由、用户查找和 session 持久化逻辑仍保留在服务端主流程中。
- 新增 `scripts/verify-http-session-utils-contract.ts` 与根脚本 `verify:http-session-utils-contract`。
- 更新 `docs/prd/v0.1.0/progress.md` 与 `docs/prd/v0.1.0/changelog.md`。

验证证据:

- TDD 红灯：`npm run verify:http-session-utils-contract` 首次按预期因 `http-session-utils.js` 模块缺失失败。
- `npm run verify:http-session-utils-contract` 通过，覆盖 JSON body 读取、空 body、URL encoded cookie、缺失 cookie、secure 请求识别、7 天 session TTL、登录 cookie 和过期 cookie。
- `npm run type-check -w @xinghuan/api` 通过。
- `npm run build -w @xinghuan/api` 通过。
- `npm run build:single-port` 通过。
- 使用临时数据目录和临时端口 `127.0.0.1:18352` 启动受控单端口服务，`npm run verify:single-port` 通过，确认登录、当前用户、管理员接口、成员隔离、文件上传和 SPA fallback 未被抽离破坏。

影响:

- 基础请求/session 工具从巨型 `server.ts` 中剥离，认证底层行为可以独立验证。
- 主服务文件减少纯工具函数噪音，后续认证与请求解析问题更容易定位。

风险:

- 当前仅完成本机源码、构建和受控临时服务验证，尚未单独发布到灰度或生产。
- 本机仍存在几份运行时数据文件脏改动，本次不会提交这些数据文件。

下一步:

- 继续推进下一处高价值结构优化，或在需要上线时先推灰度并复跑登录、后台和文件上传验收。

### 入口登录页分栏微缩星系 UI 收口

目标:

- 按用户最终反馈，把入口登录页从居中星云卡片调整为桌面端左右分栏构图。
- 左侧仅保留轻量伪 3D 微缩星系星图，不再展示开发描述、标识、说明文字或占位入口。
- 右侧保留星幻磨玻璃登录 UI，并降低鼠标跟随带来的卡片倾斜强度，避免视觉过重。

变更范围:

- 更新 `apps/web/src/components/LoginGate.tsx`，新增 `xh-login-orbit-layout`、`xh-login-visual-pane` 和 `xh-login-form-pane` 分栏结构。
- 更新 `apps/web/src/styles/index.css`，补齐桌面右侧登录卡、左侧微缩星系、移动端叠层和 reduced-motion 安全样式。
- 更新 `scripts/verify-xinghuan-entry-ui.mjs`，把入口 UI 静态验收从居中卡片改为分栏微缩星系方案。

验证证据:

- 本机临时预览 `127.0.0.1:18351` 已完成桌面与移动端浏览器截图核对，桌面左侧无文字、右侧登录卡对齐，移动端无横向溢出。
- `npm run verify:xinghuan-entry-ui` 通过。
- `npm run type-check -w @xinghuan/web` 通过。
- `npm run build -w @xinghuan/web` 通过。
- `codegraph sync` 完成，`codegraph status` 显示索引最新。

影响:

- 登录首页更接近“左侧星图、右侧登录”的最终方向，同时保留现有登录、错误提示和提交行为。
- 移动端回退为登录卡覆盖星云背景，避免小屏分栏导致横向滚动。

风险:

- 当前仅完成本机源码、构建和浏览器视觉验证，尚未单独发布到灰度或生产。
- 本机仍存在几份运行时数据文件脏改动，本次不会提交这些数据文件。

下一步:

- 提交入口 UI 收口改动后，继续按计划推进下一处前后端/后台高价值优化，或在需要上线时先推灰度并复验公网入口页。

### Provider 响应解析模块抽离

目标:

- 继续优化后端文件结构，降低 `apps/api/src/server.ts` 中外部 Provider 返回解析逻辑的复杂度。
- 保持图片、视频和 LLM 三类外部代理对上游响应的兼容能力不变。
- 为聊天文本、图片 URL/base64 和视频 URL 抽取建立独立合约，避免后续新增 Provider 时在路由主文件中堆叠纯解析逻辑。

变更范围:

- 新增 `apps/api/src/provider-response-parser.ts`，集中管理聊天内容抽取、图片输出抽取、视频 URL 抽取、base64 图片识别和 data URL 转换。
- `apps/api/src/server.ts` 改为导入 provider response parser helpers；外部代理路由继续负责鉴权、请求转发、任务落库和响应组装。
- 新增 `scripts/verify-provider-response-parser-contract.ts` 与根脚本 `verify:provider-response-parser-contract`。
- 更新 `docs/prd/v0.1.0/progress.md` 与 `docs/prd/v0.1.0/changelog.md`。

验证证据:

- TDD 红灯：`npx tsx scripts/verify-provider-response-parser-contract.ts` 首次按预期因 `provider-response-parser.js` 模块缺失失败。
- `npm run verify:provider-response-parser-contract` 通过，覆盖 OpenAI message/text/array 文本抽取、图片 URL/base64 去重、视频 URL 递归抽取、非视频 URL 排除和 data URL 转换。
- `npm run type-check -w @xinghuan/api` 通过。
- `npm run build -w @xinghuan/api` 通过。
- 受控临时单端口服务 `http://127.0.0.1:18350` 下，`npm run verify:external-image-proxy`、`npm run verify:external-chat-proxy`、`npm run verify:external-video-proxy` 均通过。
- `npm run type-check` 通过。
- `npm run build:single-port` 通过。

影响:

- 外部 Provider 响应解析从巨型 `server.ts` 中剥离，图片、视频和 LLM 代理的纯解析规则可以独立验证与扩展。
- 现有三类外部代理行为保持不变，供应商短链和输出解析链路已在临时服务中复验。

风险:

- 当前仅完成本机源码与受控临时服务验证，尚未单独发布到灰度或生产。
- 本机仍存在几份运行时数据文件脏改动，本次不会提交这些数据文件。

下一步:

- 继续推进下一处高价值结构优化，或回到入口 UI 方向读取用户提供的设计目录并落地新视觉。

### Provider 模型目录解析模块抽离

目标:

- 继续优化后端文件结构，降低 `apps/api/src/server.ts` 中 Provider 模型拉取、协议 URL 和模型分类逻辑的复杂度。
- 保持后台 Provider 探测、模型拉取、模型目录动态 schema 和密钥不泄露行为不变。
- 为后续细化 RunningHub、Volcengine、Gemini 等 Provider 的模型列表规则建立独立合约。

变更范围:

- 新增 `apps/api/src/provider-model-catalog.ts`，集中管理 Provider 协议归一化、模型列表 URL、鉴权 header、上游模型列表解析、模型能力分类。
- `apps/api/src/server.ts` 改为导入 provider model catalog helpers；Provider 探测和代理请求继续由服务端路由负责。
- 新增 `scripts/verify-provider-model-catalog-contract.ts` 与根脚本 `verify:provider-model-catalog-contract`。
- 更新 `docs/prd/v0.1.0/progress.md` 与 `docs/prd/v0.1.0/changelog.md`。

验证证据:

- TDD 红灯：`npx tsx scripts/verify-provider-model-catalog-contract.ts` 首次按预期因 `provider-model-catalog.js` 模块缺失失败。
- `npm run verify:provider-model-catalog-contract` 通过，覆盖协议归一化、模型 URL、鉴权 header、模型 ID 去重、Gemini `models/` 前缀移除和图像/视频/聊天分类。
- `npm run type-check -w @xinghuan/api` 通过。
- `npm run build -w @xinghuan/api` 通过。
- 受控临时单端口服务 `http://127.0.0.1:18349` 下，`npm run verify:model-catalog` 通过。
- `npm run type-check` 通过。
- `npm run build:single-port` 通过。

影响:

- 后台 Provider 模型拉取与分类规则有了独立合约，后续新增或调整 Provider 协议时不必在巨型 `server.ts` 中直接改纯逻辑。
- API 现有模型目录接口行为保持不变，动态参数 schema 和密钥不泄露验收继续通过。

风险:

- 当前仅完成本机源码与受控临时服务验证，尚未单独发布到灰度或生产。
- 本机仍存在几份运行时数据文件脏改动，本次不会提交这些数据文件。

下一步:

- 继续推进下一处高价值结构优化，或在需要发版时先推灰度并复跑 Provider 拉取和模型目录相关验收。

### 任务生命周期纯逻辑模块抽离

目标:

- 继续优化后端文件结构，降低 `apps/api/src/server.ts` 中任务取消/重试逻辑的耦合度。
- 保持后台任务取消、重试、日志和队列行为不变。
- 为 Phase 3 任务状态机建立更明确的纯逻辑合约，方便后续扩展运行中取消、重试策略或 Worker 状态守卫。

变更范围:

- 新增 `apps/api/src/task-lifecycle.ts`，集中管理取消补丁、取消应用、重试任务构造、可取消/可重试状态守卫。
- `apps/api/src/server.ts` 改为调用任务生命周期 helpers；路由仍负责鉴权、持久化、Redis 入队和审计日志。
- 新增 `scripts/verify-task-lifecycle-contract.ts` 与根脚本 `verify:task-lifecycle-contract`。
- 更新 `docs/prd/v0.1.0/progress.md` 与 `docs/prd/v0.1.0/changelog.md`。

验证证据:

- TDD 红灯：`npx tsx scripts/verify-task-lifecycle-contract.ts` 首次按预期因 `task-lifecycle.js` 模块缺失失败。
- `npm run verify:task-lifecycle-contract` 通过，覆盖取消 actor/timestamp、取消 result 合并、不可取消状态拒绝、重试保留输入与模型信息、重试来源元数据和不可重试状态拒绝。
- `npm run type-check -w @xinghuan/api` 通过。
- `npm run build -w @xinghuan/api` 通过。
- 受控临时单端口服务 `http://127.0.0.1:18348` 下，`npm run verify:task-lifecycle` 通过。
- `npm run type-check` 通过。
- `npm run build:single-port` 通过。

影响:

- 任务取消/重试的核心状态变更规则不再散落在路由和 repository 逻辑中，后续修改任务生命周期时可以先跑独立合约。
- 后台 API 行为保持不变，现有任务生命周期接口验收继续通过。

风险:

- 当前仅完成本机源码与受控临时服务验证，尚未单独发布到灰度或生产。
- 本机仍存在几份运行时数据文件脏改动，本次不会提交这些数据文件。

下一步:

- 继续推进下一处高价值结构优化，或在需要发版时先推灰度并复跑 `verify:task-lifecycle` 与核心验收链。

### Provider 文件访问签名模块抽离

目标:

- 优化后端文件结构，降低 `apps/api/src/server.ts` 中供应商参考素材签名逻辑的复杂度。
- 保持 `/api/provider-files/...` 短期 HMAC 供应商短链行为不变，避免图像、视频和 LLM 上游再次无法拉取本地参考素材。
- 为签名、过期、篡改拒绝和危险路径处理建立独立合约验证。

变更范围:

- 新增 `apps/api/src/provider-file-access.ts`，集中管理本地素材引用归一化、供应商短链生成、请求解析、HMAC 签名与校验、危险用户 ID 归一化。
- `apps/api/src/server.ts` 改为导入 provider file access helpers；`sendProviderFile()` 只负责根据解析结果发送用户目录里的 input/output 文件。
- 新增 `scripts/verify-provider-file-access-contract.ts` 与根脚本 `verify:provider-file-access-contract`。
- 更新 `docs/prd/v0.1.0/progress.md` 与 `docs/prd/v0.1.0/changelog.md`。

验证证据:

- `npm run verify:provider-file-access-contract` 通过，覆盖模块存在、服务端不再内联签名函数、危险用户 ID 归一化、签名 URL、解析、过期拒绝、篡改拒绝和路径穿越文件名收敛。
- `npm run type-check -w @xinghuan/api` 通过。
- `npm run build -w @xinghuan/api` 通过。
- `npm run type-check` 通过。
- `npm run build:single-port` 通过。
- 受控临时单端口服务 `http://127.0.0.1:18347` 下，`npm run verify:external-image-proxy`、`npm run verify:external-chat-proxy`、`npm run verify:external-video-proxy` 均通过。

影响:

- Provider 签名短链成为独立可测试模块，后续修改图片、视频或 LLM 代理时更容易避免误伤素材访问链路。
- `server.ts` 的安全敏感纯逻辑减少，职责边界更清晰。

风险:

- 当前仅完成本机源码与受控临时服务验证，尚未单独发布到灰度或生产。
- 本机仍存在几份运行时数据文件脏改动，本次不会提交这些数据文件。

下一步:

- 继续按项目优化计划推进前端入口 UI 生产切换或下一块后端/后台结构优化。
- 如准备发布，应先在灰度重新跑 `verify:single-port` 与三类外部代理验证。

## 2026-06-07

### 设计稿最终入口页与过渡动画收口

目标:

- 按用户提供的 `stitch_ui_optimization_and_transitions` 设计文件，替换此前登录页分栏方案。
- 登录页采用居中磨玻璃星云卡片，保留科技风、深度感、鼠标跟随和轻量动画。
- 权限校验启动阶段采用量子同步过渡动画，移除旧 T8/开发占位文案。

变更范围:

- `apps/web/src/components/LoginGate.tsx`：改为居中 `xh-login-card-stellar` 登录卡，CSS-only 星云背景、星点、鼠标跟随卡片倾斜；移除设计稿演示用的 `SSO 接入`、`组织网络` 和分隔说明。
- `apps/web/src/App.tsx`：认证检查阶段改为 `xh-quantum-transition`，包含量子环、粒子吸入、状态文案切换、进度条和闪白过渡。
- `apps/web/src/styles/index.css`：新增 `xh-nebula-bg`、`xh-login-card-stellar`、`xh-input-stellar`、`xh-btn-stellar`、`xh-transition-*` 样式与 reduced-motion 兜底。
- `scripts/verify-xinghuan-entry-ui.mjs`：入口 UI 合约改为要求最终设计稿结构、禁止占位按钮、校验量子过渡动画。

验证证据:

- `npm run verify:xinghuan-entry-ui` 通过。
- `npm run type-check -w @xinghuan/web` 通过。
- `npm run build -w @xinghuan/web` 通过；仅保留既有大 chunk 和空 `vendor-react` chunk 警告。
- 服务器 release `20260607-entrance-ui-gray` 执行 `npm ci`、`npm run build:single-port` 通过。
- 服务器 `npm run verify:xinghuan-entry-ui` 和 `npm run verify:single-port` 通过。
- 本机 Vite 预览 `http://127.0.0.1:18313` 截图通过，桌面截图见 `output/xinghuan-entry-ui/login-desktop.png`，移动端截图见 `output/xinghuan-entry-ui/login-mobile.png`。
- 浏览器 DOM 确认登录页包含 `星幻画布`、`XingHuan Canvas`、`进入创作星域` 和 `量子星图系统已就绪`，且不包含 `SSO 接入` 或 `组织网络`。
- 公网灰度 `https://canvas-next.hhh2121.xyz/` 截图通过，控制台 error 数量为 0，截图见 `output/xinghuan-entry-ui/gray-login-desktop.png`。

影响:

- 登录前页面现在与用户提供的最终设计稿一致：居中、沉浸、轻量星云，不再出现左侧开发说明区或演示入口。
- 启动过渡页从旧 `READY / STELLAR GRAPH WARMUP` 改为中文星幻量子同步语义。

风险:

- 当前已推灰度并通过公网入口验收，生产域名暂未切换。
- 仍存在既有 Web bundle 大 chunk 警告，不阻断本次入口 UI 发布。

下一步:

- 若灰度视觉确认通过，再决定是否同步到生产 `canvas.hhh2121.xyz`。

### B 方案量子星图入口 UI 落地

目标:

- 按用户确认的 B「量子星图」方向，重做登录首页、权限校验启动过渡、无画布创建首页和侧栏空状态。
- 加入磨玻璃 UI 动画与鼠标跟随光场，形成完整的星幻入口体验。

变更范围:

- 新增 `apps/web/src/components/StellarCursorAura.tsx`，提供全局鼠标跟随光晕组件。
- `apps/web/src/components/LoginGate.tsx`：替换为量子星图登录首页，保留原登录 API 行为。
- `apps/web/src/App.tsx`：权限校验阶段改为星图装载过渡页。
- `apps/web/src/components/Canvas.tsx`：无 active canvas 时显示“开启第一张星图”创建首页，并可直接创建星图画布。
- `apps/web/src/components/Sidebar.tsx`：侧栏无画布状态改为星图语言和小型磨玻璃卡片。
- `apps/web/src/styles/index.css`：新增星图背景、磨玻璃面板、入场动画、轨道动画、扫描动画、鼠标跟随光场和 reduced-motion 兜底。
- 新增 `scripts/verify-xinghuan-entry-ui.mjs` 与 `npm run verify:xinghuan-entry-ui`，覆盖入口 UI 合约。

验证证据:

- 先运行 `node scripts/verify-xinghuan-entry-ui.mjs`，8 项检查按预期失败，证明脚本能捕获未落地状态。
- 落地后 `npm run verify:xinghuan-entry-ui` 通过，8/8 检查全绿。
- `npm run type-check -w @xinghuan/web` 通过。
- `npm run build -w @xinghuan/web` 通过；仅保留既有大 chunk 和空 `vendor-react` chunk 警告。
- 本机 Vite 预览 `http://127.0.0.1:18311` 返回 200。
- 登录页截图已生成：`output/xinghuan-entry-ui/login-stellar-graph-final.png`。
- CodeGraph 已同步。

影响:

- 登录前、认证检查、无画布状态和侧栏创建入口现在统一为星幻量子星图风格。
- 用户可在无画布主区域直接创建第一张星图画布，不再只依赖侧栏。

风险:

- 当前只完成本机落地和本地渲染截图验收，尚未推灰度或生产。
- 登录页截图已确认，登录后无画布主区域因需真实会话与数据态，当前主要由构建和静态 UI 合约覆盖。

下一步:

- 如确认视觉方向，可打包并推灰度 `canvas-next.hhh2121.xyz`，再用真实登录账号验收登录页、启动过渡、空画布创建和鼠标跟随效果。

### 全节点验收矩阵与本地完整验收链路

目标:

- 把“所有节点是否已注册、能否在真实画布渲染、同类输出预览是否继续自适应”变成可重复的一键验收。
- 修复全节点浏览器烟测暴露的去 AI 水印节点挂载时 `/api/ai-watermark/status` 返回 404 的问题。
- 在不恢复 RunningHub 真实工作流测试的前提下，完成当前非 RH 真实运行项的本地完整验收链路。

变更范围:

- `scripts/verify-node-acceptance-matrix.mjs`：修复常量初始化顺序问题，并覆盖 46 个注册节点的组件映射、端口声明、默认数据、可执行节点和关键代理节点合同。
- 新增 `scripts/verify-canvas-node-render-smoke.mjs` 与 `npm run verify:canvas-node-render-smoke`：创建临时画布，放入 46 个注册节点，并通过本机 Chrome/CDP 验证真实页面无缺失节点、无旧 T8 空态、无登录页残留、无错误边界和无运行时错误。
- `apps/api/src/server.ts`：新增 `GET /api/ai-watermark/status` 和 `POST /api/ai-watermark/process` 的结构化未配置兜底，避免节点挂载时报 404；处理接口当前明确返回 `AI_WATERMARK_NOT_CONFIGURED`。
- 新增 `scripts/verify-ai-watermark-api.mjs` 与 `npm run verify:ai-watermark-api`。
- 新增 `scripts/verify-local-acceptance-chain.mjs` 与 `npm run verify:local-acceptance-chain`，串联构建、单端口、节点矩阵、浏览器渲染、模型目录、三类外部代理、任务生命周期、素材 API、输出预览、RunningHub 合同/API、Worker 合同、输出落库和 14 天清理验证。
- 补充 `npm run verify:output-node-preview-layout`，让输出节点预览布局验证纳入根脚本。
- `scripts/verify-worker-output-materializer.ts`：兼容 PostgreSQL 灰度环境，验证时使用真实存在的未禁用用户作为 owner，并在 PostgreSQL 模式下查询 `xh_assets` 验证去重；文件模式仍验证 `resource-library.json`。
- 发布灰度 release `20260607-1545-node-acceptance-gray`。
- 新增运维记录 `ops/phase3-node-acceptance-gray-2026-06-07.md`。

验证证据:

- 本机 `npm run verify:local-acceptance-chain` 已通过，临时服务地址为 `http://127.0.0.1:18333`，最终输出 `ok=true`。
- 该链路已包含并通过：`build:single-port`、`verify:single-port`、`verify:node-acceptance-matrix`、`verify:canvas-node-render-smoke`、`verify:generic-node-catalog`、`verify:model-catalog`、`verify:ai-watermark-api`、`verify:external-image-proxy`、`verify:external-video-proxy`、`verify:external-chat-proxy`、`verify:task-payload-api`、`verify:task-lifecycle`、`verify:canvas-resource-api`、`verify:output-node-preview-layout`、`verify:runninghub-workflow-contract`、`verify:runninghub-workflow-api`、`verify:worker-adapter-contract`、`verify:worker-grsai-contract`、`verify:worker-output-materializer`、`verify:output-material-prune`。
- 节点验收矩阵结果：`totalRegistryNodes=46`、`visibleNodes=34`、`hiddenNodes=12`、`executableNodes=33`。
- 浏览器真实渲染烟测结果：`expectedNodeCount=46`、`renderedNodeCount=46`、`missingIds=[]`、`classMismatches=[]`、`legacyFound=[]`、`runtimeErrors=[]`。
- 输出预览布局验证继续通过，覆盖竖图、横视频和多图网格高度规则。
- 14 天输出素材保守清理验证继续通过，覆盖收藏、归类、共享文件保护。
- 灰度 `current` 已切换到 `/opt/apps/xinghuan-canvas-next/releases/20260607-1545-node-acceptance-gray`，API/Worker 均为 `active`，`/api/status` 返回 `environment=gray`。
- 服务器灰度已通过：`verify:single-port`、`verify:node-acceptance-matrix`、`verify:ai-watermark-api`、`verify:generic-node-catalog`、`verify:model-catalog`、`verify:external-image-proxy`、`verify:external-video-proxy`、`verify:external-chat-proxy`、`verify:task-payload-api`、`verify:task-lifecycle`、`verify:canvas-resource-api`、`verify:output-node-preview-layout`、`verify:runninghub-workflow-contract`、`verify:runninghub-workflow-api`、`verify:worker-adapter-contract`、`verify:worker-grsai-contract`、`verify:worker-output-materializer`、`verify:output-material-prune`。
- 公网灰度 `https://canvas-next.hhh2121.xyz` 已通过本机 Chrome 浏览器烟测：46/46 节点渲染成功，旧空态、错误边界和 runtime error 均为 0。

影响:

- 现在可以用一个命令在本机复验当前核心交付链路，避免只靠单点 smoke 判断生产可用性。
- 去 AI 水印节点即使暂未接入真实 Adapter，也不会因为状态接口缺失破坏全画布节点渲染。
- RH 当前仍只验证合同和空目录 API；真实工作流卡片录入、字段展开和预览运行继续按用户要求暂缓。

风险:

- `verify:worker-grsai-image-adapter` 需要 Redis/PostgreSQL 队列环境，本机临时服务未纳入该真实队列验收；已用静态/合同验证覆盖 Worker GRSAI 分支。
- Web 构建仍提示大 chunk 警告和空 `vendor-react` chunk，需要后续作为性能优化项单独收口。

下一步:

- 观察灰度运行状态。
- 若用户确认灰度无异常，再评估是否同步生产。
- 待用户恢复 RH 事项后，再补 RunningHub 首条真实工作流卡片与预览运行验收。

### 全节点验收链路生产同步

目标:

- 将灰度已通过的全节点验收矩阵、浏览器渲染烟测、AI watermark API 兜底和验证脚本兼容修复同步到生产。
- 确认生产 `canvas.hhh2121.xyz` 仍保持核心链路可用。
- 不恢复 RunningHub 真实工作流卡片录入、字段展开和预览运行测试。

变更范围:

- 发布生产 release `20260607-1610-node-acceptance-prod`。
- 将 `scripts/verify-output-material-prune.ts` 修复为导入清理模块前强制文件模式，避免生产 PostgreSQL 环境变量影响临时沙盒验证。
- 新增运维记录 `ops/phase3-node-acceptance-production-2026-06-07.md`。

验证证据:

- 生产 `current` 已切换到 `/opt/apps/xinghuan-canvas/releases/20260607-1610-node-acceptance-prod`。
- `xinghuan-canvas.service` 和 `xinghuan-canvas-worker.service` 均为 `active`。
- `http://127.0.0.1:18100/api/status` 与 `https://canvas.hhh2121.xyz/api/status` 均返回 `environment=production`。
- 服务器生产已通过：`verify:single-port`、`verify:node-acceptance-matrix`、`verify:ai-watermark-api`、`verify:generic-node-catalog`、`verify:model-catalog`、`verify:external-image-proxy`、`verify:external-video-proxy`、`verify:external-chat-proxy`、`verify:task-payload-api`、`verify:task-lifecycle`、`verify:canvas-resource-api`、`verify:output-node-preview-layout`、`verify:runninghub-workflow-contract`、`verify:runninghub-workflow-api`、`verify:worker-adapter-contract`、`verify:worker-grsai-contract`、`verify:worker-output-materializer`、`verify:worker-output-materials`、`verify:output-material-prune`。
- 公网生产 `https://canvas.hhh2121.xyz` 已通过本机 Chrome 浏览器烟测：46/46 节点渲染成功，旧空态、错误边界和 runtime error 均为 0。

影响:

- 生产现在具备与灰度一致的全节点验收链路、AI watermark API 兜底和验证脚本兼容修复。
- 生产真实 Worker 输出素材落库链路已复验通过。

风险:

- Web 构建仍存在大 chunk 和空 `vendor-react` chunk 警告，属于后续性能优化项。
- RunningHub 仍只覆盖合同和空目录 API；真实工作流卡片录入、字段展开和预览运行继续按用户要求暂缓。

下一步:

- 对完整验收目标做最终审计，区分“已验收通过”和“用户明确暂缓”的范围。

### 供应商参考素材短链与星幻空态修复

目标:

- 解释并验证灰度域名与生产域名的实际运行关系。
- 修复图像节点参考图仍报 `image upload failed, please check the image` 的根因。
- 检查并覆盖视频、LLM 等同类参考素材转发节点。
- 将进入工作区的过渡页和无画布空态从 T8/企鹅文案替换为星幻画布设计。

变更范围:

- `apps/api/src/server.ts`：
  - 新增 `/api/provider-files/...` 供应商短链入口。
  - 本地 `/files/input/...`、`/files/output/...`、`/input/...`、`/output/...` 参考素材在发给图像/视频/LLM 上游前，会转换为带过期时间和 HMAC 签名的短链。
  - 普通 `/files` 仍保持登录保护，短链只允许读取单个明确文件。
- `scripts/verify-external-image-proxy.mjs`、`verify-external-video-proxy.mjs`、`verify-external-chat-proxy.mjs`：
  - 新增真实上传参考图、上游收到短链、未登录可读取短链单文件的回归验证。
- `apps/web/src/App.tsx`、`Canvas.tsx`、`Sidebar.tsx`、`CanvasManager.tsx`：
  - 替换权限校验过渡页。
  - 替换无画布空态，移除“贞贞的无限画布（企鹅共创版）/请先在左侧创建或选择一个画布”等旧文案。
- 发布生产 release `20260606-1810-provider-signed-refs-xinghuan-empty`。
- 发布灰度 release `20260606-1818-provider-signed-refs-xinghuan-empty-gray`。

验证证据:

- 灰度和生产 Nginx 映射不同：`canvas.hhh2121.xyz -> 127.0.0.1:18100`，`canvas-next.hhh2121.xyz -> 127.0.0.1:18200`。
- 灰度和生产 release 不同，但 `XINGHUAN_DATABASE_URL` 脱敏 hash 一致，当前共用同一 PostgreSQL 数据底座。
- 未登录访问普通素材 URL 返回 `401`，确认上次“绝对 URL”仍不足以让外部供应商拉取素材。
- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run build -w @xinghuan/web` 通过。
- 本机 `npm run build:single-port` 通过。
- 生产 `npm run verify:single-port` 通过。
- 生产公网 `verify:external-image-proxy`、`verify:external-video-proxy`、`verify:external-chat-proxy` 均通过。
- 生产当前静态资源引用 `index-DKFUNYas.js` / `index-CPrY09TR.css`，当前 `dist` 中已搜不到旧空态文案。
- 灰度 `npm run verify:single-port` 通过。
- 灰度公网 `verify:external-image-proxy`、`verify:external-video-proxy`、`verify:external-chat-proxy` 均通过。
- 灰度当前 `dist` 中已搜不到旧空态文案。

影响:

- GRSAI 等外部供应商现在拿到的是可匿名读取的短期签名参考图链接，不再是需要登录 cookie 的普通素材 URL。
- 同类图像参考链路已覆盖图像、视频和 LLM 后端代理。
- 两个域名仍保持灰度/生产角色区分，但当前数据底座相同，用户在两个域名看到相近数据是预期结果。

风险:

- 短链默认有效期为 20 分钟；若某些供应商排队超过该时间才拉取参考图，需要后续把有效期配置化或按任务生命周期续签。
- 灰度和生产当前共用数据库；如果后续需要严格隔离资产库和用户数据，需要单独开生产库并迁移。

下一步:

- 让用户刷新页面后复测图像节点参考图生成。
- 如 GRSAI 仍报上传失败，再专项确认其是否要求 Base64/文件上传接口而不是 URL 拉取。

### 生产图像参考素材与视频模型修复

目标:

- 修复图像生成节点在使用本地/资产库参考图时，上游报 `image upload failed, please check the image` 的问题。
- 让视频节点从旧的内置 Grok Video 面板切到后台发布模型目录驱动的状态。

变更范围:

- `apps/api/src/server.ts`：图像/视频外部代理在转发参考素材前，会把 `/files/...`、`/input/...`、`/output/...` 和无前导斜杠的同类路径归一化为当前请求公网 origin 下的绝对 URL；`data:image/...` 与已有 `http(s)` URL 保持不变。
- `scripts/verify-external-image-proxy.mjs`：新增本地素材引用转公网绝对 URL 的断言。
- `scripts/verify-external-video-proxy.mjs`：新增视频参考素材引用转公网绝对 URL 的断言。
- 生产后台启用既有模型 `toapis-grok-video`，使 `/api/models` 返回 `videoModels=1`。
- 发布生产 release `20260606-1715-image-ref-video-model-fix`。

验证证据:

- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run build:single-port` 通过。
- 生产 `readlink -f /opt/apps/xinghuan-canvas/current` 返回 `/opt/apps/xinghuan-canvas/releases/20260606-1715-image-ref-video-model-fix`。
- 生产 `curl http://127.0.0.1:18100/api/status` 返回 `environment=production`。
- 生产 `npm run verify:single-port` 通过。
- 生产模型目录验证返回 `imageCount=1`、`videoCount=1`、`firstVideo=ToAPIs Grok Video`。
- 生产公网 `XINGHUAN_VERIFY_BASE_URL=https://canvas.hhh2121.xyz npm run verify:external-image-proxy` 通过，包含 `Proxy normalizes local reference URL`。
- 生产公网 `XINGHUAN_VERIFY_BASE_URL=https://canvas.hhh2121.xyz npm run verify:external-video-proxy` 通过。

影响:

- GRSAI 图像生成拿到的参考图不再是服务内部相对路径，而是公网可访问 URL，降低上游“图片上传失败”的概率。
- 视频节点刷新后应显示后台发布模型 `ToAPIs Grok Video`，进入与图像节点同类的发布模型消费状态。

风险:

- 若上游要求 Base64 上传而不是 URL 拉取，仍可能需要补充厂商专用上传 Adapter；当前修复优先解决截图中最符合的本地相对 URL 不可访问问题。
- 视频节点 UI 进入发布模型目录后，视觉主题仍与图像节点不完全一致；若需要完全同款布局，可作为后续前端统一任务推进。

下一步:

- 让用户在生产页面刷新后复测图像参考图生成与视频节点显示。
- 若图像上游仍报错，再进入 GRSAI 参考图上传格式专项排查。

### 生产普通用户账号创建

目标:

- 按用户要求创建 3 个普通成员账号，账号以 `zezhen` 开头，密码使用随机码。
- 遵守项目安全规则，不在聊天、文档或 Git 中记录真实密码。

变更范围:

- 在生产站点通过后台 API 创建：
  - `zezhen01@xinghuan.local`
  - `zezhen02@xinghuan.local`
  - `zezhen03@xinghuan.local`
- 新增运维记录 `ops/production-user-accounts-2026-06-06.md`。

验证证据:

- 管理员登录生产后台 API 成功。
- 3 个新成员账号均通过 `/api/auth/login` 登录验证。
- 临时凭据文件保存在服务器 `/opt/apps/xinghuan-canvas/shared/credentials/` 下，权限为 `0600`。

影响:

- 生产站点现在已有 3 个可用普通成员账号。
- 真实密码只在服务器受限权限文件中交付，未进入仓库、文档或聊天输出。

风险:

- 临时凭据文件交付后应尽快移入密码管理器，或完成密码轮换后删除。

下一步:

- 由管理员完成密码分发、轮换策略和临时凭据文件处置。

### 生产位 18100 运维模板与切换清单补齐

目标:

- 为正式域名 `canvas.hhh2121.xyz` 和生产端口 `127.0.0.1:18100` 补齐独立于灰度的运维材料。
- 明确生产环境文件、systemd、Nginx、Redis 队列、数据路径和日志路径不复用灰度。

变更范围:

- 新增 `config/canvas-production.env.example`。
- 新增 `ops/production-deploy-runbook.md` 和 `ops/production-acceptance-checklist.md`。
- 新增 `ops/nginx/canvas.hhh2121.xyz.conf.example`。
- 新增 `ops/systemd/xinghuan-canvas*.example` 生产 systemd 模板。
- 更新 `ops/README.md`、`ops/production-preflight-2026-06-06.md` 和 `MEMORY.md`。

验证证据:

- 已核对现有仓库中此前只有灰度版 env、Nginx、systemd 和 runbook，生产位材料缺失。
- 本轮新增模板已明确：
  - 生产目录根为 `/opt/apps/xinghuan-canvas/`
  - 生产环境文件为 `/opt/apps/xinghuan-canvas/shared/canvas.env`
  - 生产端口为 `127.0.0.1:18100`
  - 生产 Redis 队列为 `xinghuan:tasks:prod`
- `ops/production-preflight-2026-06-06.md` 已回写这些模板入口。

影响:

- 后续正式切生产时，不需要再临时拿灰度配置改端口，而是可以直接按独立生产模板执行。
- 生产与灰度的运行目录、日志目录、数据目录和队列命名边界更清晰，降低误用风险。

风险:

- 这轮补的是模板和 runbook，不代表服务器上的生产站点已经安装或启用。
- PostgreSQL 生产连接串、证书、bootstrap 密码和真实日志路径仍需在服务器侧单独填写与验证。

下一步:

- 继续把生产预检清单收口到可执行状态，并准备生产 smoke 的命令级步骤。

### 生产位目录骨架与 env 示例服务器落地

目标:

- 在不启服务、不切域名的前提下，把生产位服务器侧的最小目录骨架先准备出来。
- 验证生产位当前确实尚未安装 active env、Nginx 和 systemd，避免误判为“已部署”。

变更范围:

- 服务器创建 `/opt/apps/xinghuan-canvas/releases`、`/opt/apps/xinghuan-canvas/shared/data`、`/opt/apps/xinghuan-canvas/shared/logs`。
- 上传本地 `config/canvas-production.env.example`，落到服务器 `/opt/apps/xinghuan-canvas/shared/canvas.env.example`。
- 新增运维记录 `ops/production-prep-2026-06-07.md`。

验证证据:

- 服务器检查返回：
  - `PROD_DIR_MISSING`
  - `PROD_CURRENT_MISSING`
  - `NGINX_PROD_SITE_MISSING`
  - `PROD_API_SERVICE_MISSING`
  - `PROD_WORKER_SERVICE_MISSING`
  - `PROD_ENV_MISSING`
- 同时确认灰度底座仍正常：`xinghuan-canvas-next.service`、`xinghuan-canvas-next-worker.service`、`nginx`、`postgresql`、`redis-server` 均为 `active`。
- 创建目录后，服务器返回 `PROD_DIRS_CREATED`，并可见：
  - `/opt/apps/xinghuan-canvas`
  - `/opt/apps/xinghuan-canvas/releases`
  - `/opt/apps/xinghuan-canvas/shared/data`
  - `/opt/apps/xinghuan-canvas/shared/logs`
- 服务器上已存在 `/opt/apps/xinghuan-canvas/shared/canvas.env.example`。
- 服务器检查确认 active env 仍不存在：`PROD_ENV_ACTIVE_MISSING`。

影响:

- 生产位现在至少具备了独立目录骨架，不再是纯文档状态。
- 但这仍不代表生产服务已部署；真正的 `canvas.env`、systemd、Nginx 和 release 仍需后续安装。

风险:

- 这轮还没有安装任何生产服务单元，也没有生成真正的生产环境文件。
- 若后续直接把模板误当 active 配置使用，仍可能导致 bootstrap 密码或连接串未填完整。

下一步:

- 填写真实 `canvas.env` 后，再准备 `18100` 本机 smoke。

### 生产 Nginx / systemd 模板服务器安装但保持未启用

目标:

- 将生产 Nginx 和 systemd 模板正式安装到服务器标准路径。
- 保持这些模板未启用，避免误触发生产切流。

变更范围:

- 服务器安装：
  - `/etc/nginx/sites-available/canvas.hhh2121.xyz`
  - `/etc/systemd/system/xinghuan-canvas.service`
  - `/etc/systemd/system/xinghuan-canvas-worker.service`
  - `/etc/systemd/system/xinghuan-canvas-output-prune.service`
  - `/etc/systemd/system/xinghuan-canvas-output-prune.timer`
- 运行 `systemctl daemon-reload`
- 更新 `ops/production-prep-2026-06-07.md`、`ops/production-preflight-2026-06-06.md` 和 `MEMORY.md`

验证证据:

- 服务器返回 `PROD_TEMPLATES_INSTALLED`。
- 复查可见上述 Nginx/systemd 文件均已存在于服务器目标路径。
- 复查确认：
  - `NGINX_PROD_NOT_ENABLED`
  - `systemctl is-enabled xinghuan-canvas.service` 返回 `disabled`
  - `systemctl is-enabled xinghuan-canvas-worker.service` 返回 `disabled`
  - `systemctl is-enabled xinghuan-canvas-output-prune.timer` 返回 `disabled`
- `systemd-analyze verify` 未对新安装的生产 unit 报错；输出中仅出现与本项目无关的 `tat_agent.service` 旧路径警告。
- 同时确认：
  - `PROD_ENV_ACTIVE_MISSING`
  - `PROD_CURRENT_MISSING`

影响:

- 生产位已从“只有本地模板”推进到“服务器模板已落位但未启用”状态。
- 下轮只需要补 active env、release 和最小 smoke，就可以进入真正的生产服务启动前检查。

风险:

- 生产 env 真值仍未落地，生产 release 也尚未创建，因此现在仍不能启动这些 unit。
- Nginx 站点未启用，说明正式域名切流仍未开始。

下一步:

- 填写真实 `canvas.env`。
- 准备生产 release 并创建 `/opt/apps/xinghuan-canvas/current`。
- 在 `127.0.0.1:18100` 做本机 smoke 后，再决定是否启用站点和服务。

### 生产 release 启动与 18100 本机 smoke

目标:

- 将当前灰度基线复制为生产 release。
- 在不启用生产 Nginx 站点的前提下，先验证 `127.0.0.1:18100` 能完整跑通。

变更范围:

- 服务器创建 `/opt/apps/xinghuan-canvas/shared/canvas.env`，从灰度 env 派生并调整为生产端口、生产 data dir、生产 dist dir、生产队列名。
- 服务器创建 production release `20260606-1604-phase3-prod-prep`。
- 设置 `/opt/apps/xinghuan-canvas/current` 指向该 release。
- 启动并启用：
  - `xinghuan-canvas.service`
  - `xinghuan-canvas-worker.service`
  - `xinghuan-canvas-output-prune.timer`

验证证据:

- `/api/status` 返回 `environment=production`，`dataDir=/opt/apps/xinghuan-canvas/shared/data`。
- `127.0.0.1:18100` 已监听。
- 生产服务状态：
  - `xinghuan-canvas.service` 为 `active` / `enabled`
  - `xinghuan-canvas-worker.service` 为 `active` / `enabled`
  - `xinghuan-canvas-output-prune.timer` 为 `active` / `enabled`
- `npm run verify:single-port` 在 `http://127.0.0.1:18100` 全部通过。
- `npm run verify:canvas-resource-api` 在 `http://127.0.0.1:18100` 通过，当前生产位 `canvasCount=0`、`imageResourceCount=0`。
- `npm run verify:task-lifecycle` 在 `http://127.0.0.1:18100` 通过，重试任务进入 `running`。
- `npm run verify:worker-output-materials` 在 `http://127.0.0.1:18100` 通过，输出素材已写入 `/files/output/task_output_task-1780733666575-mj87s4_1.png`。
- `npm run cleanup:output-materials:dry-run` 使用 export 后通过，确认读取生产 shared data：`/opt/apps/xinghuan-canvas/shared/data`。
- `sudo nginx -t` 通过。
- `/etc/nginx/sites-enabled/canvas.hhh2121.xyz` 仍不存在，返回 `NGINX_PROD_NOT_ENABLED`。

影响:

- 生产服务已经在服务器本机端口 `18100` 跑通，具备正式切域名前的核心运行条件。
- 公网域名仍未切换，灰度与生产可以并行运行。

风险:

- 生产 env 目前沿用灰度数据库连接作为同一数据底座切换预演；若后续要求生产独立数据库，需要另行开库、迁移和复验。
- 生产 Nginx 站点尚未启用，因此公网生产域名还未完成最终验收。

下一步:

- 启用 production Nginx site 并 reload。
- 验证 `https://canvas.hhh2121.xyz/api/status`、登录、后台、画布和素材 smoke。

### 生产域名切换与 HTTPS smoke

目标:

- 将 `canvas.hhh2121.xyz` 正式接入 production `127.0.0.1:18100`。
- 为生产域名签发 HTTPS 证书，并完成公网 smoke。

变更范围:

- 启用 `/etc/nginx/sites-enabled/canvas.hhh2121.xyz`。
- 使用 certbot 签发并部署 `canvas.hhh2121.xyz` 证书。
- 新增 `ops/production-cutover-2026-06-06.md`。
- 更新 `ops/README.md`、`ops/production-preflight-2026-06-06.md` 和 `MEMORY.md`。

验证证据:

- certbot 成功签发证书：
  - `Certificate Name: canvas.hhh2121.xyz`
  - 到期时间：`2026-09-04 07:19:20+00:00`
  - 证书路径：`/etc/letsencrypt/live/canvas.hhh2121.xyz/fullchain.pem`
- `sudo nginx -t` 通过。
- `https://canvas.hhh2121.xyz/api/status` 返回 `environment=production`。
- 公网 `npm run verify:single-port` 全部通过。
- 公网 `npm run verify:canvas-resource-api` 通过。
- 公网 `npm run verify:task-lifecycle` 通过。
- 公网 `npm run verify:worker-output-materials` 通过。
- `npm run cleanup:output-materials:dry-run` 通过，读取生产 shared data。
- 服务状态：
  - `xinghuan-canvas.service` 为 `active` / `enabled`
  - `xinghuan-canvas-worker.service` 为 `active` / `enabled`
  - `xinghuan-canvas-output-prune.timer` 为 `active` / `enabled`

影响:

- `canvas.hhh2121.xyz` 现在已是星幻无限画布 2.0 的生产入口。
- 灰度 `canvas-next.hhh2121.xyz` 仍保留运行，用于后续灰度。

风险:

- RunningHub 真实工作流验收仍按用户要求暂缓。
- 生产 env 当前沿用灰度数据库连接作为同一数据底座切换；如需生产独立数据库，后续必须单独迁移。

下一步:

- 发布后观察生产服务、Nginx 和 certbot 自动续期状态。
- 准备 bootstrap 密码轮换与独立数据库策略评估。

### RunningHub 真实测试暂缓记录与生产预检基线更新

目标:

- 按用户要求暂停 RunningHub 真实工作流卡片录入、字段展开和预览运行类测试。
- 把最新灰度状态、`verify:single-port` 复验结果和生产预检基线写回文档，转入下一步生产切换准备。

变更范围:

- 更新 `MEMORY.md`、`docs/prd/v0.1.0/progress.md`、`changelog.md`、`release.md`、`decisions.md` 和 `ops/production-preflight-2026-06-06.md`。
- 明确记录“当前只保留 RunningHub 目录/字段映射第一版进入灰度，真实工作流测试暂缓”的决策。
- 将生产预检基线切换到当前灰度 release `20260607-0218-phase3-runninghub-workflow-gray`。

验证证据:

- 本机 `npm run verify:single-port` 已重新通过。
- 灰度 `npm run verify:single-port` 已重新通过。
- 历史 `POST /api/admin/providers` `401` 在本机和灰度复验中均未再复现。
- 灰度 `npm run verify:runninghub-workflow-api` 仍通过，当前返回 `workflowCount=0`、`appCount=0`、`firstWorkflow=null`。

影响:

- RunningHub 第一版链路继续保留在灰度，但当前推进重心不再是补真实工作流卡片，而是先推进生产切换准备中的非 RH 项。
- 旧的 `verify:single-port` `401` 不再作为当前阻塞项，也不为这个已消失的问题做猜测性修复。

风险:

- RunningHub 真实工作流卡片和预览运行验收仍未完成，后续恢复时仍需补真实数据。
- 生产切换仍需继续完成独立 `18100` 运行位、生产环境文件和运维轮换项确认。

下一步:

- 继续推进生产切换准备，并优先收口不依赖 RunningHub 真实卡片的预检项。

### Phase 3 RunningHub 工作流字段映射与画布消费灰度发布

目标:

- 完成 Phase 3 计划表中的 RunningHub 工作流字段映射第一版闭环。
- 让后台不只是保存 RunningHub 工作流卡片标题，而是能持久化工作流 JSON 和字段映射，并让画布 `RunningHubNode` 直接消费这些后台配置。

变更范围:

- `apps/api/src/server.ts`：
  - 扩展 `RunningHubEntry`，新增 `runTargetId`、`workflowJson`、结构化 `fields`。
  - 新增 `normalizeRunningHubFieldDefinitions`、`normalizeOptionalJsonText` 等归一化逻辑。
  - 新增公开接口 `GET /api/runninghub/catalog`，向登录用户返回已启用 RunningHub Provider 下的应用/工作流目录。
- `apps/admin/src/main.tsx`：
  - RunningHub 工作流卡片新增高级编辑器，可编辑 `runTargetId`、工作流 JSON 和字段映射 JSON。
  - 工作流编辑本地带 JSON 合法性校验，避免把非法配置直接保存进后台。
- `apps/web/src/services/runninghubCatalog.ts`：
  - 新增前端 RunningHub 目录服务和 `buildRunningHubAppInfoFromCatalog`，把后台字段映射转成节点可直接使用的 `appInfo.nodeInfoList`。
- `apps/web/src/components/nodes/RunningHubNode.tsx`：
  - 新增“工作流预设”下拉，自动读取后台工作流目录。
  - 选中预设后自动注入 `webappId`、`appInfo`、字段映射和工作流 JSON，不再只能手填再现拉上游。
- `scripts/verify-runninghub-workflow-contract.mjs`：
  - 新增结构级 contract 验证。
- `scripts/verify-runninghub-workflow-api.mjs`：
  - 新增真实接口验收脚本，登录后验证 `/api/runninghub/catalog` 返回形态。
- 灰度发布：
  - 发布 release `20260607-0218-phase3-runninghub-workflow-gray` 到 `/opt/apps/xinghuan-canvas-next/releases/20260607-0218-phase3-runninghub-workflow-gray`。

验证证据:

- 本机：
  - `npm run verify:runninghub-workflow-contract` 通过。
  - `npm run type-check -w @xinghuan/api`、`@xinghuan/admin`、`@xinghuan/web` 全部通过。
  - `npm run build:single-port` 通过。
- 灰度：
  - `readlink /opt/apps/xinghuan-canvas-next/current` 返回 `/opt/apps/xinghuan-canvas-next/releases/20260607-0218-phase3-runninghub-workflow-gray`。
  - `systemctl is-active xinghuan-canvas-next.service`、`xinghuan-canvas-next-worker.service` 均返回 `active`。
  - 灰度 `npm run verify:runninghub-workflow-contract` 通过。
  - 灰度 `npm run verify:runninghub-workflow-api` 通过，当前返回 `workflowCount=0`、`appCount=0`、`firstWorkflow=null`。

影响:

- RunningHub 工作流现在首次具备“后台配置一次，画布节点直接消费”的基础能力。
- 后续再配置真实工作流时，节点侧不需要重新硬编码字段表，只需要消费后台目录即可。

风险:

- 灰度当前没有已启用的 RunningHub 工作流卡片，因此真实“选择预设后自动展开字段”的视觉验收还缺一条真实配置数据。
- 这轮只完成了“字段映射持久化 + 目录消费”；真实预览运行和上游工作流 JSON 拉取仍是下一步。

下一步:

- 在后台录入第一条真实 RunningHub 工作流卡片，补一轮真实节点选择与字段展开验收。
- 继续推进 RunningHub 预览运行与更完整的上游同步。

### Phase 3 画布 / 素材 PostgreSQL repository 灰度热修复

目标:

- 收口 Phase 3 画布 / 素材 PostgreSQL repository 的灰度异常，确认运行态真正使用 PostgreSQL 持久化，而不是只在后台状态页里显示 `storageDriver=postgres`。
- 修复 `/api/canvas` 在灰度首次读取时触发的 PostgreSQL 列名错误，并把这类 schema/query 漏洞纳入自动验收。

变更范围:

- `apps/api/src/server.ts`：修正画布 PostgreSQL repository 对 `xh_canvases` 的列名引用，全部从错误的 `title` 改为现网 schema 实际存在的 `name`，覆盖 `readCanvasList`、`writeCanvasList`、`writeCanvasData` 和 `toCanvasListItem`。
- `scripts/verify-postgres-canvas-resource-contract.mjs`：补强 contract，显式校验 `001_admin_core.sql` 中 `xh_canvases.name` 的定义，并要求 API 侧画布 SQL 读取/写入同样使用 `name`。
- `scripts/verify-canvas-resource-api.mjs`：新增轻量灰度 API 验证脚本，覆盖登录后读取 `/api/canvas`、首个画布详情和 `/api/resources/items?kind=image`。
- `package.json`：新增 `npm run verify:canvas-resource-api`。
- 灰度发布：打包并上传 release `20260607-0115-phase3-canvas-pg-hotfix-gray`，部署到 `/opt/apps/xinghuan-canvas-next/releases/20260607-0115-phase3-canvas-pg-hotfix-gray`，切换 `current` 并重启单端口 API/Worker 服务。

验证证据:

- 根因复现：
  - 灰度登录后请求 `GET /api/canvas` 返回 `500`，错误为 `column "title" does not exist`。
  - 服务器 `information_schema.columns` 确认 `xh_canvases` 列为 `id/owner_id/project_id/name/node_count/data/created_at/updated_at`，不存在 `title`。
  - 同一灰度环境下 `/api/resources/items?kind=image` 可返回 `2` 条资源，说明素材 repository 已在 PostgreSQL 生效，而画布链路被列名错误单独阻断。
- 本机验证：
  - `npm run verify:postgres-canvas-resource-contract` 通过。
  - `npm run type-check -w @xinghuan/api` 通过。
  - `npm run build:single-port` 通过。
  - `node --check scripts/verify-canvas-resource-api.mjs` 通过。
- 灰度验证：
  - `readlink /opt/apps/xinghuan-canvas-next/current` 返回 `/opt/apps/xinghuan-canvas-next/releases/20260607-0115-phase3-canvas-pg-hotfix-gray`。
  - `systemctl is-active xinghuan-canvas-next.service`、`xinghuan-canvas-next-worker.service` 均返回 `active`。
  - 灰度 `npm run verify:canvas-resource-api` 通过，返回 `canvasCount=13`、首个画布 `nodeCount=4`、`edgeCount=2`、`imageResourceCount=2`。
  - 灰度 PostgreSQL 计数变为：`xh_canvases=13`、`xh_assets=2`、`xh_resource_categories=0`。

影响:

- Phase 3 的“画布 / 素材 PostgreSQL repository”现在已在灰度运行态真正打通，不再只是素材能落库、画布却因为列名不一致无法导入。
- 以后若再出现 migration/schema 与 API 查询不一致，contract 和灰度 API 验证都会更早暴露问题，而不是等到后台或真实用户读画布时才发现。

风险:

- 当前灰度资源分类表 `xh_resource_categories` 仍为 `0`，这符合现状，因为还没有真实分类数据；后续若启用分类操作，仍需补一轮分类 CRUD 灰度验收。
- `verify:single-port` 之前在灰度出现的 `POST /api/admin/providers 401` 这轮没有顺带处理，它与本次画布 repository 列名问题是独立问题，需要后续单独收口。

下一步:

- 继续推进 RunningHub 工作流字段映射与预览运行。
- 评估是否把 `verify:canvas-resource-api` 纳入固定灰度验收清单和生产切换前检查。

## 2026-06-06

### Phase 3 素材空间读取闭环与任务生命周期灰度发布

目标:

- 完成素材空间读取闭环，让资源库抽屉打开后能自动看到新生成素材，而不是必须手动重开。
- 把后台任务从“直接翻状态”收口为真实的取消 / 重试语义，并保护 Worker 不覆盖运行中被取消的任务。
- 将这两项一起推上灰度，并用真实队列重新验收。

变更范围:

- `packages/shared/src/index.ts`：新增任务状态共享类型，以及 `canCancelTask` / `canRetryTask` helper。
- `apps/api/src/server.ts`：新增语义化取消接口、`/api/admin/tasks/:id/retry`、任务级定向读写 helper，避免灰度 PostgreSQL 环境继续依赖整库回写。
- `apps/worker/src/worker.ts`：任务领取、成功、失败写回均增加取消态保护；若任务执行过程中被取消，Worker 记录日志并保留 `cancelled` 状态，不再覆写为 `succeeded/failed`。
- `apps/admin/src/main.tsx`：任务页操作按钮改为按状态显示“取消”或“重试”，不再做 `cancelled <-> queued` 状态翻转。
- `apps/web/src/components/ResourceLibraryDrawer.tsx`：资源库抽屉在打开状态下增加静默轮询，配合现有 `penguin:resources-changed` 事件形成素材空间读取闭环。
- 灰度发布：打包当前 worktree，上传并发布 release `20260606-2358-phase3-lifecycle-gray` 到 `/opt/apps/xinghuan-canvas-next/releases/20260606-2358-phase3-lifecycle-gray`。

验证证据:

- 本机 `npm run type-check -w @xinghuan/shared`、`@xinghuan/api`、`@xinghuan/worker`、`@xinghuan/admin`、`@xinghuan/web` 全部通过。
- 本机隔离 API `http://127.0.0.1:18300` 上 `npm run verify:task-lifecycle` 通过，返回 `ok=true`。
- 本机隔离后台 `/admin` 浏览器抽查通过：任务页对排队任务显示“取消”，对已取消任务显示“重试”，并能看到“管理员取消任务”“管理员发起重试”日志。
- 本机 `npm run build:single-port` 通过。
- 灰度 `readlink /opt/apps/xinghuan-canvas-next/current` 返回 `/opt/apps/xinghuan-canvas-next/releases/20260606-2358-phase3-lifecycle-gray`。
- 灰度 `systemctl is-active xinghuan-canvas-next.service` 和 `xinghuan-canvas-next-worker.service` 均返回 `active`。
- 灰度 `npm run verify:task-lifecycle` 通过，返回 `ok=true`；原任务保持 `cancelled`，重试任务已被 Worker 消费进入 `running`。
- 灰度 `npm run verify:worker-output-materials` 通过，返回 `ok=true`、`resourceItemId=res-1780727541745-9nva3d`、`fileUrl=/files/output/task_output_task-1780727541467-w0fpn7_1.png`。
- 灰度 `curl -fsS http://127.0.0.1:18200/api/status` 返回 `environment=gray`。

影响:

- Phase 3 的“任务输出进入素材空间”和“素材空间能及时读到新增输出”现在已经闭环，不再需要手动重开抽屉才能看到新素材。
- 灰度后台任务系统现在具备更真实的生命周期语义：取消不会再把运行中任务误改回成功，重试会生成新任务并保留原任务审计线索。

风险:

- 资源库抽屉当前使用 4 秒静默轮询作为第一版闭环，功能已可用，但后续仍可以继续收口为更细粒度的事件推送。
- `verify:task-lifecycle` 在灰度队列可用时，重试任务可能很快从 `queued` 进入 `running`；这符合当前异步系统行为，但后续如果需要固定断言排队态，需要在脚本里额外锁住队列消费窗口。

下一步:

- 继续推进画布 / 素材 PostgreSQL repository。
- 继续推进 RunningHub 工作流字段映射和生产切换准备。

### Phase 3 输出素材落库与自动清理灰度发布

目标:

- 把本地已经完成的“Worker 输出素材落库”和“14 天保守自动清理”一起推到灰度。
- 让项目 CodeGraph 保持已建立且同步到最新状态。
- 用真实灰度环境补做队列联调与清理 dry-run 验收，而不是停留在本机验证。

变更范围:

- CodeGraph：执行 `codegraph status`、`codegraph sync`，确认项目索引可用且已更新。
- 灰度发布：打包当前 worktree，上传并发布 release `20260606-1515-phase3-output-prune-gray` 到 `/opt/apps/xinghuan-canvas-next/releases/20260606-1515-phase3-output-prune-gray`。
- 服务器环境：为 `canvas-next.env` 补入 `XINGHUAN_OUTPUT_MATERIAL_RETENTION_DAYS=14`。
- systemd：安装并启用 `xinghuan-canvas-next-output-prune.service` 与 `xinghuan-canvas-next-output-prune.timer`。
- 验收：执行灰度 `verify:worker-output-materials` 与 `cleanup:output-materials:dry-run`。

验证证据:

- 本机 `codegraph status` 返回 `Index is up to date`。
- 灰度 `readlink /opt/apps/xinghuan-canvas-next/current` 返回 `/opt/apps/xinghuan-canvas-next/releases/20260606-1515-phase3-output-prune-gray`。
- 灰度 `systemctl is-active xinghuan-canvas-next`、`xinghuan-canvas-next-worker`、`xinghuan-canvas-next-output-prune.timer` 均返回 `active`。
- 灰度 `curl -fsS http://127.0.0.1:18200/api/status` 返回 `environment=gray`。
- 灰度 `npm run verify:worker-output-materials` 通过，返回 `ok=true`、`taskId=task-1780725769684-pvlouq`、`resourceItemId=res-1780725770036-i16lge`。
- 灰度 `npm run cleanup:output-materials:dry-run` 通过，返回 `ok=true`、`apply=false`、`retentionDays=14`、`deletedItemIds=[]`。
- 灰度 timer 状态显示下一次计划触发时间为 `2026-06-07 04:16 CST`。

影响:

- Phase 3 的两条新能力现在已经不只是本地代码，而是正式进入灰度运行态。
- 灰度环境从今天起具备每日自动回收旧任务输出素材的能力，同时保持保守保护规则。

风险:

- `xinghuan-canvas-next-output-prune.timer` 虽然已经启用，但首轮真实自动执行要等到 `2026-06-07 04:16 CST` 之后才能看到完整运行记录。
- `verify:worker-output-materials` 会在灰度留下 1 条测试任务和 1 条资源记录，用于证明链路真实打通。

下一步:

- 在 `2026-06-07` 首轮自动清理执行后，补一条灰度审计记录。
- 继续推进素材空间读取闭环与取消/重试。

### 输出素材 14 天自动清理脚本与定时器模板

目标:

- 为 Phase 3 新增的输出素材库补一个保守型生命周期清理能力。
- 默认只清理超过 14 天、明确属于任务输出的旧素材，避免误伤收藏、已整理或仍在使用的资产。
- 提前准备好灰度/生产接入 systemd timer 的部署材料。

变更范围:

- `scripts/prune-old-output-materials.mjs`：新增输出素材清理脚本，支持 `dry-run` 和 `--apply`，按用户目录扫描 `resource-library.json`，逐条判断后再逐个文件删除。
- `package.json`：新增 `cleanup:output-materials` 与 `cleanup:output-materials:dry-run`。
- `scripts/verify-output-material-prune.ts`：新增回归验证，覆盖“删除过期任务输出、保留收藏、保留分类、保留最近使用、保留非任务输出、共享文件不误删”。
- `config/canvas-next.env.example`：新增 `XINGHUAN_OUTPUT_MATERIAL_RETENTION_DAYS=14`。
- `ops/systemd/xinghuan-canvas-next-output-prune.service.example`、`ops/systemd/xinghuan-canvas-next-output-prune.timer.example`：新增每日定时清理模板。
- `ops/README.md`：补充新的 systemd 模板索引。

验证证据:

- 红测：`npm run verify:output-material-prune` 首次执行失败，报 `ERR_MODULE_NOT_FOUND`，证明清理脚本尚未实现。
- 绿测：`npm run verify:output-material-prune` 通过，确认过期任务输出会删，收藏/分类/非任务输出会保留，共享文件不会被误删。
- CLI：`npm run cleanup:output-materials:dry-run` 通过，证明命令入口可直接挂到定时器环境。
- 本机 `npm run build:single-port` 通过。

影响:

- 用户目录式资产库现在不仅能积累素材，也具备了可控的自动回收机制。
- 默认策略偏保守，更适合先在灰度和生产跑起来，不会因为定时任务把用户手工保留的素材误删。

风险:

- 当前自动清理只覆盖“任务输出旧素材”，没有触碰手工收藏和其他资源类型；如果后续想扩大范围，需要先再定规则。
- 这轮只交付了脚本和 timer 模板，还没有真正接到灰度服务器的 systemd 定时任务里。

下一步:

- 在灰度服务器接入 `xinghuan-canvas-next-output-prune.timer`，先跑一次 dry-run，再做一次真实 apply 验收。
- 继续推进素材空间读取闭环和取消/重试。

### Phase 3 第一刀: Worker 输出素材落库本地实现

目标:

- 把 Phase 3 从“任务成功只回写 `result`”推进到“任务成功会沉淀出可管理素材”。
- 先完成图像任务的最小纵切：输出转存到用户输出目录、资源库索引可追踪、同任务重复回写不脏重复。
- 在本机缺少 Redis/worker 联调条件时，先补齐可以离线运行的定向验证脚本。

变更范围:

- `apps/worker/src/output-materials.ts`：新增 Worker 输出素材 helper，负责把 data URL/远程图像 materialize 到用户 `/files/output/...`，并把资源项写入 `resource-library.json`。
- `apps/worker/src/worker.ts`：任务成功后新增输出素材落库步骤，回写 `resourceItemIds`、`resourceCount`、`materializedImageUrls` 到任务 `result`，并在日志中记录已写入素材数量。
- `apps/api/src/server.ts`、`apps/web/src/services/api.ts`：扩展资源项结构，补齐 `sourceUrl`、`originalName`、`sourceNodeId`、`sourceCanvasId`、`taskId`、`providerId`、`modelId`。
- `scripts/verify-worker-output-materializer.ts`：新增本地定向验证，覆盖输出文件落地、资源库写入和同任务去重。
- `scripts/verify-worker-output-materials.mjs`：新增联调验证脚本，留给 Redis/worker 可用环境做“任务成功后资源库可见”的真实链路验收。
- `package.json`：新增 `verify:worker-output-materializer`、`verify:worker-output-materials`。

验证证据:

- 红测 1：`npm run verify:worker-output-materializer` 初次执行失败，报 `ERR_MODULE_NOT_FOUND`，证明落库 helper 尚未实现。
- 红测 2：`npm run verify:worker-output-materials` 在本机 `18200` 上失败，任务长期停留 `queued`；随后确认本机 `verify:worker` 同样因为 `redis is not connected` 不能作为联调环境。
- 绿测：`npm run verify:worker-output-materializer` 通过，确认 data URL 输出已落到用户输出目录、资源库生成 1 条记录，且同任务重复写入仍保持 1 条。
- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run type-check -w @xinghuan/worker` 通过。
- 本机 `npm run build -w @xinghuan/worker` 通过。
- 本机 `npm run build:single-port` 通过。

影响:

- Phase 3 已经不再停留在“讨论方案”，而是落下了第一段真正可运行的输出素材闭环。
- 后续素材空间/API 只要读取现有资源库，就能看到这批由 Worker 成功任务沉淀出的图像素材。
- 同一任务重复回写会按 `taskId` 去重，避免后续补偿写入把资源库刷脏。

风险:

- 当前只完成了图像任务这条最小纵切，视频/音频结果 materialize 还没接上。
- 本机 `18200` 没有 Redis/worker 联调条件，所以这轮不能把“队列消费 + 资源库可见”作为本地端到端凭据。
- 资源库和素材索引仍是 file-based；真正的 PostgreSQL repository 推进还在后面。

下一步:

- 把这批改动推到灰度，运行 `verify-worker-output-materials.mjs` 做真实队列联调。
- 补素材空间读取联动，确认资源抽屉能稳定展示这批新输出。
- 继续推进取消/重试和素材索引 PostgreSQL repository。

### Phase 2 收口补充、灰度凭据对齐与 Phase 3 计划重排

目标:

- 把 Phase 2 最后几项“看起来已完成但文档和环境还没完全收口”的事项补平。
- 修复输出素材节点单图/单视频预览高度不收口的问题。
- 将灰度管理员密码重新对齐到服务器 bootstrap 环境，避免灰度凭据继续漂移。
- 按实际状态重写 Phase 3 计划，明确后续先做任务输出素材闭环，再谈生产切换。

变更范围:

- `apps/admin/src/main.tsx`、`apps/admin/src/styles.css`：后台模型高级设置新增说明卡片和 schema 示例，明确 Provider 协议、参数 schema 与 `inputProfile` 的职责边界。
- `apps/web/src/components/nodes/OutputNode.tsx`：输出素材节点单图/单视频根据真实媒体宽高比重新计算预览框和节点高度，不再继承历史固定高。
- `apps/web/src/components/nodes/outputPreviewLayout.ts`：抽出输出预览高度计算逻辑，供脚本回归验证。
- `scripts/verify-output-node-preview-layout.mjs`：新增输出节点预览布局回归，覆盖单张竖图、单条横视频和多图网格。
- `scripts/align-gray-admin-password.py`：新增灰度管理员密码对齐脚本，通过服务器环境中的 bootstrap 管理员密码重写 PostgreSQL 中的管理员密码哈希。
- `docs/prd/README.md`、`docs/prd/v0.1.0/plan.md`、`progress.md`、`release.md`、`changelog.md`、`decisions.md`、`ops/production-preflight-2026-06-06.md`：按实际状态收口并把计划切换到 Phase 3。

验证证据:

- 本机 `npm run type-check -w @xinghuan/admin` 通过。
- 本机 `npm run build -w @xinghuan/admin` 通过。
- 本机 `npm run type-check -w @xinghuan/web` 通过。
- 本机 `npm run build -w @xinghuan/web` 通过。
- 本机 `npx tsx scripts/verify-output-node-preview-layout.mjs` 通过。
- 本机 `npm run build:single-port` 通过。
- 灰度 release `20260606-1150-admin-schema-gray` 已部署。
- 灰度 release `20260606-1217-output-preview-layout-gray` 已部署。
- `readlink /opt/apps/xinghuan-canvas-next/current` 返回 `20260606-1217-output-preview-layout-gray`。
- `curl -fsS http://127.0.0.1:18200/api/status` 返回 `environment=gray`。
- 通过 `scripts/align-gray-admin-password.py` 将灰度管理员密码重新对齐到服务器 `canvas-next.env` 中的 bootstrap 管理员密码。
- 服务器本地使用 bootstrap 管理员邮箱/密码登录 `/api/auth/login` 成功。

影响:

- Phase 2 现在不仅“功能上可用”，而且灰度说明、输出节点 UI、运维基线和计划文档都重新对齐到了同一状态。
- 输出素材节点在单张长图/横视频场景下，不再出现两侧黑边正常但下方整块空面板被撑开的体验问题。
- 后续 Phase 3 的优先级被明确为“任务结果沉淀为素材资产”，而不是继续提前讨论生产切换。

风险:

- 灰度管理员密码虽然已经与环境对齐，但生产前仍需要独立的正式密码轮换策略，不能长期停留在 bootstrap 口令模式。
- 输出素材节点预览问题已修复，但更大的 Phase 3 风险仍在于结果落库、素材空间联动、取消/重试和 repository 切换尚未完成。

下一步:

- 按修订后的 Phase 3 计划，优先实现 Worker 输出写入输出素材与资源库。
- 再补任务取消/重试和素材空间读取闭环。

### GRSAI Worker 异步链路补齐、灰度双链路验收与测试清理

目标:

- 将 `grsai_draw` 从同步图像代理继续下沉到 Worker 图像 Adapter。
- 把 GRSAI 的同步/异步灰度验收固化成可复用脚本，不再依赖人工点页面。
- 清理灰度环境里残留的 `verify-*` 和 `phase2-*` 测试 Provider、任务记录。

变更范围:

- `apps/worker/src/worker.ts`：新增 `grsai_draw` 协议识别、GRSAI Draw 提交与轮询逻辑，Worker 结果新增 `adapter: "grsai-image"`、`taskId`、`remoteImageUrls`。
- `scripts/verify-worker-grsai-contract.mjs`：新增 Worker `grsai_draw` 合约回归，覆盖协议识别、分支路由和上下游接口常量。
- `scripts/verify-worker-grsai-image-adapter.mjs`：新增 Worker + mock GRSAI 上游端到端验收，覆盖任务入队、提交 draw、轮询结果和 result 回写。
- `scripts/verify-grsai-draw-gray.mjs`：新增灰度真实双链路验收，自动登录后台、定位已启用 GRSAI Provider/模型，分别验证同步代理和异步 Worker。
- `package.json`：新增 `verify:grsai-draw`、`verify:grsai-draw-gray`、`verify:worker-grsai-contract`、`verify:worker-grsai-image-adapter`。

验证证据:

- 红绿测试：本机 `npm run verify:worker-grsai-contract` 先 FAIL 后 PASS。
- 本机 `npm run verify:grsai-draw` 通过。
- 本机 `npm run type-check -w @xinghuan/worker` 通过。
- 本机 `npm run build -w @xinghuan/worker` 通过。
- 本机 `npm run build:single-port` 通过。
- 新灰度 release：`20260606-2335-grsai-worker-gray`。
- 服务器 `npm ci`、`npm run build:single-port` 通过。
- `readlink /opt/apps/xinghuan-canvas-next/current` 指向 `20260606-2335-grsai-worker-gray`。
- `systemctl is-active xinghuan-canvas-next.service` 和 `xinghuan-canvas-next-worker.service` 均为 `active`。
- 服务器 `npm run verify:grsai-draw-gray` 通过：同步 `/api/proxy/external/image` 和异步 `/api/admin/tasks` + Worker 均成功。
- 服务器 `npm run verify:worker-grsai-image-adapter` 通过：mock 上游任务最终 `succeeded`，结果适配器为 `grsai-image`。
- `curl -fsS http://127.0.0.1:18200/api/status` 返回 `environment=gray`。
- 灰度清理后 PostgreSQL 中 `verify-*`、`phase2-*` 测试 Provider 为 0 条，新增两条 GRSAI 验收任务也已删除。

影响:

- GRSAI 现在同时具备同步代理链路和 Worker 异步任务链路，后台任务中心可以统一承载这类图像任务。
- 灰度环境现在有“本机无依赖回归 + 服务器真实双链路验收”两层脚本，后续发版前可直接复跑。
- 测试 Provider 与临时验收任务已清理，后台配置更干净。

风险:

- `verify:grsai-draw-gray` 依赖灰度环境中已有已启用的 GRSAI Provider/模型；如果后台配置被改名或禁用，脚本会失败。
- Worker 目前已补齐 GRSAI 图像任务，但输出素材落库、资源库联动、取消/重试策略仍属于 Phase 3。

下一步:

- 准备生产域名切换前的预检清单，但不在未确认前直接切生产。
- 继续推进任务输出素材落库和资源库联动。

### GRSAI Draw 协议补齐与灰度真实生图复验

目标:

- 让当前 2.0 灰度环境重新具备 GRSAI `gpt-image-2` 真实文生图能力。
- 补齐当前 API 缺失的 `grsai_draw` 协议支持，避免把 GRSAI 误当 OpenAI 兼容接口调用。
- 在灰度服务器上完成一次新的真实图像生成与本地落盘验收。

变更范围:

- `apps/api/src/grsai-image-adapter.ts`：新增 GRSAI Draw 图像客户端，支持 `/v1/draw/completions` 提交、`/v1/draw/result` 轮询和成功结果解析。
- `apps/api/src/server.ts`：`/api/proxy/external/image` 新增 `grsai_draw` 协议分支；Provider probe/fetch-models 增加 GRSAI Draw 手动模型目录逻辑；Provider 协议枚举补齐。
- `packages/model-core/src/index.ts`：Provider 协议枚举新增 `grsai_draw`。
- `apps/admin/src/main.tsx`：后台 Provider 协议下拉和模型协议覆盖下拉新增 `GRSAI Draw`。
- `scripts/verify-grsai-image-adapter.ts`：新增 GRSAI Draw 协议红绿测试，覆盖“提交后轮询”和“上游立即成功”两种响应形态。

验证证据:

- 本机 `npx tsx scripts/verify-grsai-image-adapter.ts` 通过。
- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机真实 GRSAI smoke 通过：`createGrsaiImageClient` 调 `https://grsai.dakka.com.cn` 成功返回 1 张图像 URL。
- 新灰度 release：`20260606-2140-grsai-draw-gray`。
- 服务器 `npm ci`、`npm run build:single-port` 通过。
- `systemctl is-active xinghuan-canvas-next.service` 和 `xinghuan-canvas-next-worker.service` 均为 `active`。
- 灰度公网真实图像代理复验通过：`/api/proxy/external/image` 使用 `grsai_draw` + `gpt-image-2` 成功生成本地文件 `/files/output/external_image_1780715075124_joztk5.png`，`GET` 返回 `200 image/png`，文件大小 `2254013` bytes。

影响:

- 当前 2.0 灰度环境已重新具备 GRSAI `gpt-image-2` 真实图像生成能力。
- GRSAI 不再被错误地走 OpenAI 兼容图像接口，后续后台和画布都可直接复用统一协议。
- 灰度后台当前已将 `grsai` Provider 调整为 `https://grsai.dakka.com.cn` + `grsai_draw`，模型 `grsai-gpt-image-2` 已启用并覆盖同协议。

风险:

- GRSAI 上游模型集合仍采用手动目录方式；当前 `probe/fetch-models` 不做自动发现，只固定提供 `gpt-image-2` 入口。

下一步:

- 若继续做用户侧可视验收，可在公网后台确认 Provider 协议显示为 `GRSAI Draw`，再从画布图像节点手点一次真实生成。
- 将本次灰度复验结论同步到进度与变更记录。

### Phase 2 通用节点与服务器灰度验收收口

目标:

- 完成 Phase 2 节点与模型治理闭环。
- 确认图像、视频、LLM 三类通用节点都从后台 Provider/Model 目录读取模型。
- 确认后台模型 schema 变化会驱动画布节点参数和参考图上限动态变化。
- 在灰度服务器和公网画布上完成真实连通、视觉和操控验收。

变更范围:

- `apps/api/src/server.ts`：补齐 `/api/proxy/external/llm`、`/api/proxy/external/video`，并修复任务入队后全库写回覆盖 Worker 状态的竞态。
- `apps/worker/src/worker.ts`：补充任务领取和执行日志，便于定位队列问题。
- `apps/web/src/components/nodes/ImageNode.tsx`、`VideoNode.tsx`、`LLMNode.tsx`：三类通用节点接入后台模型目录；图像/视频节点根据模型 schema 渲染比例、尺寸、时长、分辨率和参考图上限；schema 更新后自动归一化旧参数。
- `apps/admin/src/main.tsx`、`apps/admin/src/styles.css`：后台模型行增加高级设置，可编辑显示名、模型 ID、能力分类、协议覆盖、输入 Profile 和参数 Schema JSON。
- 新增/升级 `verify:external-chat-proxy`、`verify:external-video-proxy`、`verify:generic-node-catalog`、`verify:model-catalog` 等自动验收脚本。

验证证据:

- 本机 `npm run type-check -w @xinghuan/web`、`npm run type-check -w @xinghuan/admin`、`npm run build:single-port` 通过。
- 本机 `verify:model-catalog` 通过，覆盖模型 `inputProfile` 和 `parameterSchema` 编辑后 `/api/models` 动态 UI 元数据同步。
- 灰度 release：`20260606-0945-phase2-complete-gray`。
- 灰度服务器完整自动验收通过：`verify:single-port`、`verify:model-catalog`、`verify:external-image-proxy`、`verify:external-chat-proxy`、`verify:external-video-proxy`、`verify:generic-node-catalog`、`verify:task-payload-api`、`verify:worker-adapter-contract`、`verify:worker-image-adapter`、`verify:worker`。
- 公网 `https://canvas-next.hhh2121.xyz/` 真实画布验收通过：文本节点连接图像、视频、LLM；图像输出 `/files/output/external_image_...png`，视频输出 `/files/output/external_video_...mp4`，LLM 返回 `Phase 2 LLM 节点连通成功`。
- 公网后台模型高级设置验收通过：保存新图像 schema 后，画布图像节点显示 `3:4`、`800x1200`、`prompt,image_reference,multi_image`、`图像 (0/5)`，再次点击生成成功且控制台 0 error。
- 视觉截图：`output/playwright/phase2-gray-model-advanced-editor.png`、`output/playwright/phase2-gray-dynamic-schema-after-admin-edit.png`、`output/playwright/phase2-gray-public-after.png`、`output/playwright/phase2-gray-admin-api-narrow.png`。

影响:

- Phase 2 的后台 Provider/模型、选择导入、三类模型目录、通用节点消费、真实代理调用、Worker 图像 Adapter 和服务器灰度验收已经形成闭环。
- 画布前端不再暴露服务商设置入口，模型治理集中在统一后台。
- 真实 Key 仍只在服务器环境文件或后台加密字段中保存，前端和文档不记录明文。

风险:

- 当前真实同步代理覆盖 OpenAI 兼容、APIMart、自定义协议路径；RunningHub 工作流字段映射、预览运行和更多厂商专用 Adapter 后续继续补。
- 输出文件已经生成到 `/files/output` 并能在输出素材节点下载，但画布内容和素材资源库的完整 PostgreSQL repository 迁移仍属于后续阶段。
- Web 包仍有大 chunk 警告，需后续继续分包优化。

下一步:

- 进入 Phase 3：任务取消/重试、输出素材资源库联动、画布/素材 PostgreSQL repository、生产域名切换准备。

### Phase 2 通用图像节点接入后台模型目录

目标:

- 让画布通用图像节点不再只依赖本地/T8 内置模型，而是读取后台已启用 Provider/Model。
- 图像节点的模型、比例、尺寸和参考图上限根据后台模型 schema 动态变化。
- 补齐 `/api/proxy/external/image`，让后台模型可通过后端代理生成并转存输出文件。

变更范围:

- `packages/model-core/src/index.ts`：统一模型能力为 `chat/image/video`，新增 Provider 协议和图像/视频参数 schema 默认合并逻辑。
- `apps/api/src/server.ts`：新增登录保护的 `/api/models` 成员可见模型目录；新增 `/api/proxy/external/image`，从后台 Provider 取 Key、调用 OpenAI 兼容图像接口、解析 URL/base64 返回并转存到 `/files/output/`。
- `apps/web/src/services/api.ts`、`apps/web/src/stores/modelCatalog.ts`、`apps/web/src/App.tsx`：新增模型目录客户端和登录后预加载。
- `apps/web/src/components/nodes/ImageNode.tsx`：新增“后台模型”选择区；后台模型选中时展示动态比例/尺寸，并隐藏本地模型/MJ 专属参数面板。
- `scripts/verify-model-catalog.mjs`：升级为临时创建 Provider/Model 后验证模型目录，确保至少存在图像模型、动态 UI 元数据和无 Key 泄漏。
- `scripts/verify-external-image-proxy.mjs`：新增 mock OpenAI 兼容上游，验证后端图像代理会转发模型、prompt 和授权头，并保存本地输出图像。

验证证据:

- `npm run type-check -w @xinghuan/api` 通过。
- `npm run build -w @xinghuan/api` 通过。
- `npm run type-check -w @xinghuan/web` 通过。
- `npm run build -w @xinghuan/web` 通过。
- `npm run verify:model-catalog` 通过，覆盖临时 Provider/Model、图像模型目录、动态参数和无密钥泄漏。
- `npm run verify:external-image-proxy` 通过，mock 上游返回 base64 图片后成功转存为 `/files/output/...`。
- Chrome headless 动态 UI smoke 通过：截图 `output/playwright/phase2-canvas-ui-dynamic-model-clean.png`；确认图像节点显示“后台模型”、服务商名、比例、尺寸，且后台模型模式下不再显示 Midjourney 专属面板；控制台无 error。
- 本机 `npm run verify:worker` 当前未通过，原因是本地 Redis 未连接；worker 真实 Provider Adapter 仍未完成。

影响:

- 后台模型目录已经成为画布通用图像节点的可消费来源。
- 前端不再接触 Provider API Key，图像生成走后端代理。
- 后台模型模式的参数展示开始由模型 schema 驱动，为后续语言/视频通用节点复用同一目录奠定基础。

风险:

- 当前图像代理第一版支持 `openai/apimart/custom` 兼容协议；RunningHub、Gemini、ModelScope 专用生成 Adapter 仍需继续补。
- 参考图在部分 OpenAI 兼容服务商中可能需要 `/images/edits` 或厂商专用字段，当前第一版优先保证文生图和兼容 JSON 路径。
- Worker 仍是 mock 执行，任务 payload/result 和真实 Provider Adapter 需要进入下一段实现与灰度 Redis/PostgreSQL 验收。

下一步:

- 扩展 Worker 读取 `payload/result`，并接入 Provider Adapter。
- 在灰度服务器执行模型目录、外部图像代理、动态 UI 和 worker 队列 smoke。
- 更新 release/验收清单后再切灰度 release。

### Phase 2 Worker 图像 Adapter 接入

目标:

- 让后台任务不再只有 mock 执行路径。
- 让任务表的 `payload/result` 被 API 和 Worker 真实读写。
- Worker 可以读取 Provider/Model/Key，按图像任务调用 OpenAI 兼容图像接口并回写结果。

变更范围:

- `apps/api/src/server.ts`：`AdminTaskRecord` 新增 `payload` 和 `result`；后台创建/更新任务支持写入 payload/result；PostgreSQL repository 读写 `xh_tasks.payload` 和 `xh_tasks.result`。
- `apps/worker/src/worker.ts`：移除 `executeMockTask` 调用；读取任务、Provider、Model、payload 和加密 Key；新增图像 Adapter，支持 `openai/apimart/custom` 协议的 `/images/generations`；结果回写 `imageUrls`、`remoteImageUrls`、`imageCount` 和完成时间。
- `scripts/verify-worker-adapter-contract.mjs`：新增 Worker Adapter 合约验证，防止回退到 mock。
- `scripts/verify-task-payload-api.mjs`：新增不依赖 Redis 的任务 payload/result API 验证。

验证证据:

- `npm run type-check -w @xinghuan/api` 通过。
- `npm run type-check -w @xinghuan/worker` 通过。
- `npm run build -w @xinghuan/api` 通过。
- `npm run build -w @xinghuan/worker` 通过。
- `npm run verify:worker-adapter-contract` 通过。
- `npm run verify:task-payload-api` 通过，创建带 payload/result 的 cancelled 任务后可读回完整字段，测试数据已恢复。
- `npm run verify:external-image-proxy` 顺序复跑通过。
- `npm run verify:worker` 本机仍未通过，原因是本地 Redis 未连接；需要灰度服务器端到端复验。

影响:

- 后台任务已经具备承载真实节点执行参数的结构。
- Worker 第一版真实图像 Adapter 已落地，后续可以把画布异步生成任务接入同一队列。
- 无 Provider/Model 的旧后台健康检查任务仍可 no-op 成功，避免破坏现有 worker 队列验收语义。

风险:

- 本机没有 Redis/PostgreSQL 队列环境，尚未完成 worker 端到端运行验收。
- Worker 图像 Adapter 当前只回写任务 result，尚未把输出自动写入素材资源库。
- 专用协议 Provider 仍需后续接入独立 adapter。

下一步:

- 灰度部署后执行 `npm run verify:worker` 和一条带真实/Mock Provider 的图像任务端到端验收。
- 将 Worker 输出写入资源库和画布可消费素材。

## 2026-06-05

### 后台 API 设置按 Infinite-Canvas 重做

目标:

- 将当前粗表格式 Provider/模型后台重做为参考 `D:\AI canvas\Infinite-Canvas` 的 API 设置体验。
- 合并 Provider 和模型两个后台 Tab，形成统一 `API 设置` 模块。
- 实现服务商验证、模型拉取、选择性导入和语言/图像/视频三类模型管理闭环。

变更范围:

- `apps/admin/src/main.tsx`：新增参考式 API 设置页面，包含左侧平台列表、右侧 Provider 编辑器、拉取模型、选择模型弹窗和三类模型列表。
- `apps/admin/src/styles.css`：新增科技风后台 API 设置样式，贴近参考项目的信息结构和交互层级，同时保持与其他后台区域一致的深色视觉语言。
- `apps/api/src/server.ts`：Provider 增加 `protocol`、探测状态、最近拉取时间；模型能力统一为 `chat/image/video`；新增 Provider probe、fetch-models、import-models、delete Provider、delete Model 接口。
- `apps/api/db/002_provider_model_framework.sql`：新增 Provider/模型框架迁移，补齐 `protocol`、探测字段、`protocol_override` 和三类模型约束。
- 修正模型拉取交互：拉取时携带当前表单内尚未保存的 Base URL、API Key 和协议；选择模型弹窗只展示本次真实拉取结果，不再把已有预设模型混入拉取结果。

验证证据:

- `npm run type-check -w @xinghuan/api` 通过。
- `npm run type-check -w @xinghuan/admin` 通过。
- `npm run build:single-port` 通过。
- 临时 `127.0.0.1:18221` 执行 `npm run verify:single-port` 全部 PASS。
- 新 Provider 接口烟测通过：`/api/admin/providers` 返回 `protocol`；草稿 `/probe` 和 `/fetch-models` 返回稳定结构。
- 空 Key/拉取失败烟测通过：`/api/admin/providers/grsai/fetch-models` 返回 `ok=false`、`modelCount=0` 和空模型列表，不会打开包含预设模型的选择器。
- 修复“拉取模型点击后无响应”的可感知反馈问题：模型列表卡片内新增拉取状态/失败原因提示，拉取中按钮显示 spinner 并禁用，选择模型按钮在拉取中或无结果时禁用。
- 已启动新版本机单端口服务 `127.0.0.1:18200`，供当前浏览器刷新检查。

影响:

- 后台不再把 Provider 和模型割裂为两个粗表格。
- 拉取模型不会自动导入，必须经过选择器勾选。
- 拉取失败或没有上游模型时不会伪装成已有模型列表，管理员能明确区分“已配置模型”和“本次上游拉取结果”。
- 管理员在当前模型列表卡片视口内即可看到“正在拉取 / 缺 Key / 无模型 / 已拉取数量”等反馈。
- 模型目录按照 `chat`、`image`、`video` 维护，为后续通用节点和 Worker Adapter 打基础。

风险:

- RunningHub 和 ModelScope LoRA 的高级配置已进入第一版；火山方舟高级配置按用户要求暂不加入。
- PostgreSQL 环境部署前需要执行 `npm run db:migrate` 应用 `002_provider_model_framework.sql`。

下一步:

- 做浏览器视觉验收和小屏检查。
- 继续补 RunningHub/火山/ModelScope 高级配置细节。
- 将画布通用节点的模型下拉切到后台发布模型。

### RunningHub 和 ModelScope 高级配置加入后台

目标:

- 按用户要求跳过火山方舟高级配置。
- 将 `D:\AI canvas\Infinite-Canvas` 中的 RunningHub 应用/工作流与 ModelScope LoRA 管理能力加入统一后台。

变更范围:

- `apps/api/src/server.ts`：Provider 增加 `rhApps`、`rhWorkflows`、`msLoras` 字段，读写时统一规范化。
- `apps/api/db/002_provider_model_framework.sql`：新增 `rh_apps`、`rh_workflows`、`ms_loras` JSONB 字段。
- `apps/admin/src/main.tsx`：RunningHub Provider 显示应用/工作流配置面板，支持粘贴 `/run/ai-app/...` 或 `/run/workflow/...` 创建卡片、编辑标题/备注、启停和删除；ModelScope Provider 显示 LoRA 面板，支持新增、目标模型、强度、启停和删除。
- `apps/admin/src/styles.css`：补充 RunningHub 和 LoRA 面板样式。

验证证据:

- `npm run type-check -w @xinghuan/api` 通过。
- `npm run type-check -w @xinghuan/admin` 通过。
- `npm run build:single-port` 通过。
- 本机 `127.0.0.1:18200` 已重启到最新构建。
- RH/LoRA 字段保存烟测通过，创建临时 Provider 后已删除，并恢复测试数据文件。

影响:

- 后台 API 设置开始覆盖参考项目中除火山外的高级服务商配置。
- RunningHub 和 ModelScope LoRA 目前完成的是配置管理层，后续还需接入真实节点消费和 RunningHub 工作流参数图形编辑。

风险:

- RunningHub 工作流字段映射、工作流 JSON 拉取和预览运行尚未迁入。
- LoRA 配置已可保存，但画布图像节点仍需后续切到后台发布模型和 LoRA 目录。

下一步:

- 将画布通用节点模型/LoRA 来源切到后台目录。
- 继续迁入 RunningHub 工作流字段映射和应用参数编辑。

### 后台 Provider/模型框架重设与画布入口收口

目标:

- 根据新的后台模型服务商需求，校正当前文档和执行计划。
- 移除画布前端的 API/服务商设置入口，服务商配置后续只保留在统一后台。
- 参考 `D:\AI canvas\Infinite-Canvas` 的 Provider 和模型拉取实现，重设星幻后台模型框架。

变更范围:

- 更新 `apps/web/src/App.tsx`，移除画布顶部 `API 设置` 齿轮按钮和 `ApiSettingsModal` 挂载。
- 新增 `docs/prd/v0.1.0/provider-model-framework.md`。
- 更新 `docs/prd/v0.1.0/plan.md`，将 Phase 2 拆为后台 Provider/模型治理任务级计划。
- 更新 `docs/prd/v0.1.0/progress.md`，校正 Phase 1 完成状态，并移除 Redis/worker 仍待办的矛盾记录。
- 更新 `docs/prd/v0.1.0/release.md` 和 `docs/prd/README.md`，同步当前灰度验收状态。

验证证据:

- 静态检索确认画布 API 设置入口集中在 `apps/web/src/App.tsx`，本次已移除。
- 参考项目确认可复用的核心模式：Provider CRUD、Key/Base URL 验证、上游模型拉取、语言/图像/视频三类分类、拉取后选择导入、模型手工维护。
- 本轮代码和文档不记录真实 API Key、Token、Cookie 或数据库密码。

影响:

- 画布前端不再承担服务商配置职责。
- 后台 Provider/模型框架从简单表格升级为可执行的服务商管理、模型拉取、选择导入和三类模型目录方案。

风险:

- 当前后台代码仍未完整实现新的 Provider 拉取模型和选择导入交互，需要作为 Phase 2 的下一组开发任务推进。
- 迁移期仍保留旧 T8 API settings store 加载，避免现有节点兼容逻辑突然失效；后续画布模型消费接口完成后再彻底清理。

下一步:

- 扩展 Provider schema 和 API。
- 实现后台 Provider 验证地址、拉取模型和模型选择器。
- 将通用节点模型来源切换到后台已启用模型目录。

### 代码同步到灰度服务器完成

目标:

- 将本地代码通过 SSH 同步到灰度服务器。
- 验证服务正常运行。

变更范围:

- 创建 release `20260605-1506-xinghuan-mimo-sync`。
- 同步代码到 `/opt/apps/xinghuan-canvas-next/releases/20260605-1506-xinghuan-mimo-sync/`。
- 执行 `npm ci`，0 vulnerabilities。
- 执行 `npm run build:single-port`，构建成功。
- 切换 `current` 符号链接到新 release。
- 重启 `xinghuan-canvas-next.service` 和 `xinghuan-canvas-next-worker.service`。

验证证据:

- `curl -s https://canvas-next.hhh2121.xyz/` 返回 HTTP 200。
- `curl -s https://canvas-next.hhh2121.xyz/api/status` 返回 `service=xinghuan-api`、`environment=gray`。
- 管理员登录成功，`/api/admin/system` 返回 `storageDriver=postgres`、`databaseStatus=connected`、`redisStatus=connected`。
- `xinghuan-canvas-next.service` 和 `xinghuan-canvas-next-worker.service` 均为 `active`。

影响:

- 灰度服务器已更新到最新代码。
- 项目状态文档和服务器信息已同步。

风险:

- 验收脚本因环境变量传递问题未完全通过，但核心功能已验证。

下一步:

- 实现 Provider Adapter。

### 服务器信息同步到项目文件夹

目标:

- 将 `D:\codex\服务器` 中的服务器连接信息和基础设施状态同步到无限画布 2.0 项目。
- 确保项目文件夹包含完整的运维参考信息，便于后续部署和调试。

变更范围:

- 新增 `ops/server-connection.md`，包含：
  - SSH 连接方式和安全配置
  - 本地路由修复（代理绕过）
  - 域名与端口映射
  - 灰度基础设施服务清单
  - 部署目录结构
  - 数据库和 Redis 配置
  - 密钥管理策略
  - 常用运维命令
- 更新 `MEMORY.md` 服务器记忆：
  - 补充 SSH 密钥位置
  - 补充 DNS 和 HTTPS 证书信息
  - 补充内部代理服务说明
  - 补充部署目录结构
  - 补充密钥管理详情
  - 添加 `ops/server-connection.md` 引用

验证证据:

- `ops/server-connection.md` 已创建。
- `MEMORY.md` 服务器记忆已更新。
- 未包含真实密钥或密码。

影响:

- 项目文件夹现在包含完整的服务器运维参考。
- 后续部署和调试可以直接参考 `ops/server-connection.md`。

风险:

- 本机 `.env.local` 包含真实测试 Key，已确认被 `.gitignore` 忽略。

下一步:

- 推送代码到服务器进行同步和测试。
- 实现 Provider Adapter。

### Mimo 代码补全提交与 Web 分包优化

目标:

- 补全未入库的核心代码，消除代码丢失风险。
- 优化 Web 构建分包策略，解决大 chunk 警告。
- 分析项目风险并给出处理方案。

变更范围:

- 更新 `.gitignore`，新增 `output/` 和 `releases/` 排除规则。
- 分 9 个提交将 apps/、packages/、scripts/、ops/、config/、development/ 全部代码入库：
  - `56cb7bd` feat: add monorepo root config and shared packages
  - `4aa9c4a` feat: add web workspace with canvas UI
  - `5f9d6b7` feat: add api workspace with PostgreSQL and Redis
  - `af8e351` feat: add admin dashboard and worker consumer
  - `bc613b5` feat: add deployment scripts and config templates
  - `60505d3` docs: add ops deployment records and runbooks
  - `81efdfa` docs: add development baseline and migration notes
  - `df3388a` docs: update progress, changelog and release records
  - `882480b` perf(web): add manual chunks for vendor splitting
- `apps/web/vite.config.ts` 新增 `build.rollupOptions.output.manualChunks`：
  - vendor-react: React/ReactDOM
  - vendor-flow: @xyflow/react
  - vendor-mediapipe: @mediapipe/tasks-vision
  - vendor-icons: lucide-react
  - chunkSizeWarningLimit: 600KB
- 更新 `AGENTS.md` 当前状态为 Phase 1 完成。
- 更新 `MEMORY.md` 当前阶段、已完成能力和服务器基础设施状态。
- 更新 `DEVLOG.md` 补充本条记录。

验证证据:

- `git status` 显示 clean，所有代码已入库。
- `git log --oneline -9` 显示 9 个新提交，均包含 `[mimo-init]` 或 `[mimo-perf]` 标记。
- `npm run type-check -w @xinghuan/web` 通过。
- `.gitignore` 已排除 `output/` 和 `releases/`。

影响:

- 项目代码安全性大幅提升，不再依赖单机本地存储。
- Web 首屏加载性能将改善，vendor 分包可独立缓存。
- 项目状态文档已同步到最新进展。

风险:

- Provider Adapter 尚未实现，worker 仍为 mock 执行器。
- 画布/素材元数据尚未切 PostgreSQL repository。

下一步:

- 实现 GRSAI Provider Adapter（P0 图像验收）。
- Worker 接入真实 Provider 调用。
- 任务输出素材落库。

### PostgreSQL readiness 灰度部署完成

目标:

- 为统一后台补齐 PostgreSQL 表结构和迁移入口。
- 在后台系统页展示数据库配置、连接和迁移状态。
- 将数据库 readiness 部署到灰度环境，但不在 PostgreSQL 尚未启用时强制切换数据源。

变更范围:

- 新增 `apps/api/db/001_admin_core.sql`，覆盖用户、会话、项目、画布、素材、Provider、模型、任务、审计和迁移表。
- 新增 `scripts/db-migrate.mjs` 和根脚本 `npm run db:migrate`。
- `apps/api` 新增数据库状态探测，`/api/admin/system` 返回 `database` 状态对象。
- `apps/admin` 系统页新增数据库状态、迁移状态和错误展示。
- `scripts/verify-single-port.mjs` 覆盖后台系统数据库状态字段。
- `config` 模板预留 `XINGHUAN_DATABASE_URL`。
- 新增运维记录 `ops/gray-db-readiness-2026-06-05.md`。

验证证据:

- 本机 `node --check scripts\db-migrate.mjs` 通过。
- 本机 `node --check scripts\verify-single-port.mjs` 通过。
- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run type-check -w @xinghuan/admin` 通过。
- 本机 `npm run build:single-port` 通过。
- 本机未配置数据库时 `npm run db:migrate` 返回 `DATABASE_NOT_CONFIGURED`，退出码 2，符合预期。
- 本机 `npm run verify:single-port` 通过。
- 本机后台系统页可见 `数据库状态 not_configured`。
- 服务器 release `20260605-1315-xinghuan-db-ready-gray` 已部署。
- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- 服务器 `npm run verify:single-port` 通过。
- 服务器未配置数据库时 `npm run db:migrate` 返回 `DATABASE_NOT_CONFIGURED`，退出码 2，符合预期。
- 公网 `/api/status` 返回 `service=xinghuan-api`、`environment=gray`。
- 公网 `/api/admin/system` 未登录返回 401。
- 管理员登录后 `/api/admin/system` 返回 `databaseStatus=not_configured`、`databaseConfigured=false`、`migrations=0`。

影响:

- 后台已经具备数据库接入前的可观测状态。
- 迁移脚本已经可以作为 PostgreSQL 启用后的标准入口。
- 当前仍保持文件型运行数据，不影响灰度服务连续性。

风险:

- 灰度服务器 PostgreSQL 当前尚未配置连接，因此还没有真实落库。
- 后续切库需要数据迁移策略，不能直接丢弃现有文件型 auth/admin/canvas 数据。
- 数据库连接串属于密钥，不能写入文档、Git 或聊天。

下一步:

- 启用 PostgreSQL 服务、创建灰度数据库和最小权限账号。
- 写入服务器环境变量后执行 `npm run db:migrate`。
- 实现 repository 层和文件数据迁移/切换策略。
- 接入 Redis/worker 任务队列。

### PostgreSQL 灰度启用和首轮迁移完成

目标:

- 在灰度服务器启用 PostgreSQL。
- 创建灰度数据库和专用应用账号。
- 将数据库连接串写入服务器环境文件。
- 执行首轮 schema migration。

变更范围:

- 服务器安装 PostgreSQL 16.14。
- PostgreSQL 仅监听 `127.0.0.1:5432`。
- 创建数据库 `xinghuan_canvas_next`。
- 创建应用账号 `xinghuan_canvas_next`。
- 将 `XINGHUAN_DATABASE_URL` 写入 `/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`，明文未写入仓库和文档。
- 执行 `npm run db:migrate`，应用 `001_admin_core.sql`。
- 新增运维记录 `ops/postgresql-gray-migration-2026-06-05.md`。

验证证据:

- `systemctl is-active postgresql` 返回 `active`。
- `psql --version` 返回 PostgreSQL 16.14。
- `ss -ltnp` 确认 PostgreSQL 监听 `127.0.0.1:5432`。
- `npm run db:migrate` 返回 `ok: true`，`applied: ["001_admin_core.sql"]`。
- 管理员登录后 `/api/admin/system` 返回 `databaseStatus=connected`、`databaseConfigured=true`、`migrations=["001_admin_core.sql"]`。
- 服务器 `npm run verify:single-port` 全部 PASS。
- 数据库 `xh_schema_migrations` 包含 `001_admin_core.sql`。

影响:

- 灰度环境已经具备真实 PostgreSQL schema。
- 后台系统页可以实时观测数据库连接和迁移状态。
- 现有文件型运行数据未被破坏。

风险:

- auth/admin/canvas 仍未切换到 PostgreSQL repository。
- 后续需要设计数据导入、双写或切换策略。
- 数据库账号密码需要纳入后续备份和轮换流程。

下一步:

- 实现 PostgreSQL repository 层。
- 将 auth/admin/canvas 数据迁移进数据库。
- 接入 Redis/worker 和真实任务表。

### 后台 auth/admin PostgreSQL repository 切换完成

目标:

- 将统一后台的用户、会话、Provider、模型、任务和审计数据切到 PostgreSQL repository。
- 保留文件型 fallback，确保本地开发和回滚路径可用。
- 导入灰度现有文件型后台数据。

变更范围:

- `apps/api` 新增 auth/admin PostgreSQL repository。
- `apps/api` 保留 file repository fallback。
- `/api/admin/system` 新增 `storageDriver`。
- `apps/admin` 系统页新增“存储驱动”。
- 新增 `scripts/db-import-files.mjs`。
- 新增 `npm run db:import-files`。
- `config` 模板新增 `XINGHUAN_STORAGE_DRIVER=file`。
- 新增运维记录 `ops/postgresql-repository-cutover-2026-06-05.md`。

验证证据:

- 本机 `node --check scripts\db-import-files.mjs` 通过。
- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run type-check -w @xinghuan/admin` 通过。
- 本机 `npm run build:single-port` 通过。
- 本机 file driver 下 `npm run verify:single-port` 通过。
- 服务器 release `20260605-1410-xinghuan-pg-repo-gray` 已部署。
- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- 服务器 `npm run db:import-files` 导入 users=2、sessions=2、providers=5、models=2、tasks=1、auditLogs=3。
- 服务器设置 `XINGHUAN_STORAGE_DRIVER=postgres` 后服务 active。
- 服务器 `npm run verify:single-port` 全部 PASS。
- 管理员登录后 `/api/admin/system` 返回 `storageDriver=postgres`、`databaseStatus=connected`、`migrations=["001_admin_core.sql"]`。
- 数据库复核 `users=2`、`providers=6`、`audit=4`。
- PostgreSQL `xh_providers` 明文测试 Key 计数为 0，`enc:v1` 加密 Key 计数为 4。

影响:

- 后台核心数据已进入 PostgreSQL。
- 现有自动验收仍覆盖登录、后台权限、Provider Key 脱敏、审计、画布保存、用户隔离和文件上传。
- 画布内容、素材文件和资源库仍保留文件型存储。

风险:

- 画布和资源库 repository 尚未切 PostgreSQL。
- Redis/worker 任务队列尚未接入，`xh_tasks` 当前只承接后台任务记录。
- Provider Adapter 尚未接入真实模型调用。

下一步:

- 设计并接入 Redis/worker 任务队列。
- 实现 Provider Adapter。
- 后续再推进画布/素材元数据 PostgreSQL repository。

### Redis/worker 任务队列灰度部署完成

目标:

- 后台任务从静态记录升级为真实队列闭环。
- API 创建 queued 任务后进入 Redis。
- worker 常驻领取任务并回写 PostgreSQL 状态和日志。

变更范围:

- `apps/api` 新增 Redis 入队和状态探测。
- `/api/admin/system` 新增 `redis` 状态对象。
- `apps/admin` 系统页展示 Redis 状态、队列名、队列深度和错误。
- `apps/admin` 任务页展示更多日志和更新时间。
- `apps/worker` 从占位服务升级为 Redis 队列消费者。
- 新增 `scripts/verify-worker-queue.mjs` 和 `npm run verify:worker`。
- `build:single-port` 纳入 `@xinghuan/worker`。
- 新增 worker systemd 示例和灰度实际服务 `xinghuan-canvas-next-worker.service`。
- 新增运维记录 `ops/worker-queue-gray-deploy-2026-06-05.md`。

验证证据:

- 本机 `node --check scripts\verify-worker-queue.mjs` 通过。
- 本机 `node --check scripts\verify-single-port.mjs` 通过。
- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run type-check -w @xinghuan/admin` 通过。
- 本机 `npm run type-check -w @xinghuan/worker` 通过。
- 本机 `npm run build:single-port` 通过，包含 worker 构建。
- 本机无 Redis/file driver 下 `npm run verify:single-port` 通过。
- 服务器 Redis 为 `active`，`redis-cli ping` 返回 `PONG`。
- 服务器 release `20260605-1505-xinghuan-worker-queue-gray` 已部署。
- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过，`apps/worker/dist/worker.js` 存在。
- 服务器 API 和 worker systemd 服务均为 `active`。
- 服务器 `npm run verify:worker` 通过，worker 将验收任务回写为 `succeeded`。
- 服务器 `npm run verify:single-port` 全部 PASS。
- 公网管理员登录后 `/api/admin/system` 返回 `redisStatus=connected`、`redisQueue=xinghuan:tasks`、`redisDepth=0`。

影响:

- 后台任务已经具备排队、领取、执行、成功/失败回写和日志链路。
- worker 已作为独立 systemd 服务常驻运行。
- 当前执行器仍为 mock，真实模型调用由下一步 Provider Adapter 接入。

风险:

- 当前还没有任务超时、重试次数、取消中断和死信队列。
- worker 执行器尚未接入真实 Provider。
- 输出素材落库还未接入任务结果。

下一步:

- 实现 Provider Adapter 和后台连接测试。
- worker 根据 provider/model 调用 Adapter。
- 任务成功后写入输出素材和资源库。

### 后台安全增强灰度部署完成

目标:

- 补齐统一后台安全底座。
- Provider Key 不明文落盘。
- 管理员可以通过后台重置用户密码。
- 后台关键操作可审计。

变更范围:

- `apps/api` 新增 Provider Key AES-256-GCM 加密存储。
- `apps/api` 新增 `/api/admin/audit`。
- 后台用户、Provider、模型、任务变更写入审计日志。
- `apps/admin` 用户管理增加密码重置。
- `apps/admin` Provider 管理增加 Key 更新和清除。
- `apps/admin` 新增审计页面。
- `config` 模板新增 `XINGHUAN_SECRET_KEY`。
- 新增运维记录 `ops/gray-admin-security-2026-06-05.md`。

验证证据:

- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run type-check -w @xinghuan/admin` 通过。
- 本机 `npm run build:single-port` 通过。
- 本机 `npm run verify:single-port` 通过，包含 Key 脱敏和审计验收。
- 本机 `admin.json` 不包含测试 Key 明文，包含 `enc:v1` 和 `provider.create`。
- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- 服务器 `npm run verify:single-port` 通过。
- 服务器 `admin.json` 不包含测试 Key 明文，包含 `enc:v1` 和 `provider.create`。
- 公网审计页截图 `output/playwright/gray-admin-audit-https.png` 通过。

影响:

- 灰度后台的 Provider Key 已从文件明文升级为加密字段。
- 后台关键操作可在审计页查看。
- 后台具备基础密码重置能力。

风险:

- 当前仍是文件型后台数据。
- `XINGHUAN_SECRET_KEY` 后续需要正式备份和轮换流程。
- 审计日志仍缺少 IP、User-Agent 和请求 ID。

下一步:

- 进入 PostgreSQL 迁移。
- 补充生产级审计字段。
- 接入真实任务队列和 Provider Adapter。

### 统一后台灰度部署完成

目标:

- 完成统一后台 `/admin` 的真实可用版本。
- 后台采用星幻科技风。
- 后台接口必须管理员登录后访问。
- 部署到灰度服务器并完成命令与视觉验收。

变更范围:

- `apps/api` 新增 `/api/admin/*` 管理接口。
- 新增文件型后台数据 `admin.json`。
- 新增管理员守卫：未登录 401，成员 403。
- `apps/admin` 从占位页升级为真实后台应用。
- 单端口服务新增 `/admin` 和 `/admin/assets/*` 静态托管。
- `build:single-port` 纳入 `@xinghuan/admin`。
- 新增部署记录 `ops/gray-admin-deploy-2026-06-05.md`。

验证证据:

- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run type-check -w @xinghuan/admin` 通过。
- 本机 `npm run build:single-port` 通过。
- 本机 `npm run verify:single-port` 通过，包含后台 API 和权限验收。
- 本机 Chrome 截图 `output/playwright/admin-dashboard-local-2.png` 通过。
- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- `xinghuan-canvas-next.service` 为 `active`。
- `/opt/apps/xinghuan-canvas-next/current` 指向 `20260605-1215-xinghuan-admin-gray`。
- 服务器 `npm run verify:single-port` 全部 PASS。
- 公网 Chrome 截图 `output/playwright/gray-admin-dashboard-https.png` 通过。

影响:

- 灰度域名现在可通过 `/admin` 访问统一后台。
- 管理员可查看和维护用户、Provider、模型、任务和系统状态。
- 普通成员不能访问后台数据接口。
- 后台仍使用文件型数据，后续迁移 PostgreSQL。

风险:

- Provider Key 目前仍是文件型存储，后续必须加密。
- 模型 schema 目前是文本配置，后续需要结构化编辑器。
- 任务监控是骨架，后续要接 Redis/worker。

下一步:

- 进入 PostgreSQL 数据模型和迁移层。
- 进入真实任务队列和 Provider Adapter。

### 灰度认证版部署完成

目标:

- 将最小登录、退出、用户隔离和科技风登录门禁部署到 `canvas-next.hhh2121.xyz`。
- 完成服务器命令验收和公网视觉验收。
- 不切换生产域名，不修改内部代理服务。

变更范围:

- 新增灰度认证版 release `20260605-1135-xinghuan-auth-gray`。
- 服务器 `/opt/apps/xinghuan-canvas-next/current` 已指向新 release。
- 服务器 `canvas-next.env` 已配置管理员和成员 bootstrap secret。
- 新增运维记录 `ops/gray-auth-deploy-2026-06-05.md`。
- 更新 `docs/prd/v0.1.0/progress.md`、`changelog.md` 和 `release.md`。

验证证据:

- 本机 `npm run build:single-port` 通过。
- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- `systemctl is-active xinghuan-canvas-next.service` 返回 `active`。
- `readlink /opt/apps/xinghuan-canvas-next/current` 返回新 release 目录。
- `curl -fsS http://127.0.0.1:18200/api/status` 返回 `environment: gray`。
- 服务器 `npm run verify:single-port` 全部 PASS，包含认证和用户隔离验收。
- `sudo nginx -t` 通过。
- `systemctl is-active nginx` 返回 `active`。
- `https://canvas-next.hhh2121.xyz/api/status` 返回 200。
- `https://canvas-next.hhh2121.xyz/api/canvas` 未登录返回 401 `AUTH_REQUIRED`。
- Chrome headless 公网未登录截图 `output/playwright/gray-auth-login-gate-https-cdp.png` 通过。
- Chrome headless 公网登录后截图 `output/playwright/gray-auth-logged-canvas-https.png` 通过。

影响:

- 灰度域名已进入认证版。
- 未登录用户只能看到星幻科技风登录门禁。
- 登录后仍进入 T8 成熟无限画板主体。
- 画布、素材和资源库已按账号隔离。

风险:

- 当前认证仍是文件型最小实现，不是最终数据库认证。
- bootstrap 密码只适合初始化阶段，后续需要正式后台用户管理和密码重置。
- Web bundle 仍存在大 chunk 警告。

下一步:

- 建立统一后台骨架和管理员权限守卫。
- 建立 PostgreSQL 数据模型。
- 建立 Redis/worker 任务队列。
- 接入真实 Provider 调用。

### 本机登录隔离和科技风门禁完成

目标:

- 在保留 T8 成熟无限画板主体 UI 的前提下，补齐星幻平台最小登录能力。
- 先完成本机认证、用户隔离和自动验收，再进入灰度服务器部署。
- 新增平台界面统一采用星幻科技风。

变更范围:

- `apps/api` 新增最小账号、session cookie、登录、退出和当前用户接口。
- `/api/canvas`、`/files`、`/input`、`/output` 等工作区能力需要登录后访问。
- 画布、输入素材、输出素材和资源库改为按用户目录隔离。
- `apps/web` 新增科技风登录门禁和顶部用户/退出入口。
- 前端设置预加载改为登录后执行，避免未登录时产生认证接口噪声。
- `scripts/verify-single-port.mjs` 升级为认证验收流。
- `config/.env.example` 和 `config/canvas-next.env.example` 补充 bootstrap 管理员变量占位。
- `docs/prd/v0.1.0/plan.md` 和 `design.md` 记录任务级计划、视觉验收和统一科技风后台方向。

验证证据:

- `npm run type-check -w @xinghuan/api` 通过。
- `npm run type-check -w @xinghuan/web` 通过。
- `node --check scripts/verify-single-port.mjs` 通过。
- `npm run build:single-port` 通过。
- `npm run verify:single-port` 通过，包含未登录拒绝、管理员登录、成员登录和跨用户画布不可见。
- Chrome headless 本机截图 `output/playwright/auth-login-gate.png` 确认未登录时展示科技风登录页，不渲染画布。

影响:

- 本机已经具备最小公司内部登录隔离形态。
- 后台和后续管理页面的视觉方向固定为星幻科技风。
- T8 原画板主体 UI 保持稳定，不重做节点和画布交互。

风险:

- 当前认证仍是文件型最小实现，后续需要迁移 PostgreSQL。
- 灰度服务器部署认证版本前必须设置真实 bootstrap 管理员密码。
- 真实密码不能写入仓库、文档、日志或聊天输出。

下一步:

- 配置灰度服务器 bootstrap 管理员密码并部署认证版本。
- 补齐独立统一后台骨架和管理员权限守卫。
- 继续推进 PostgreSQL 数据模型和任务队列。

### 灰度服务器部署完成

目标:

- 将星幻无限画布部署到灰度域名 `canvas-next.hhh2121.xyz`。
- 使用服务器单端口服务 `127.0.0.1:18200`。
- 不修改内部代理项目，不切换生产域名。

变更范围:

- 新增灰度部署记录 `ops/gray-deploy-2026-06-05.md`。
- 服务器 release：`20260605-0903-xinghuan-gray`。
- 服务器目录：`/opt/apps/xinghuan-canvas-next/releases/20260605-0903-xinghuan-gray`。
- systemd 服务：`xinghuan-canvas-next.service`。
- Nginx 站点：`canvas-next.hhh2121.xyz`。
- HTTP/HTTPS 均代理到 `127.0.0.1:18200`。

验证证据:

- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- 首次 systemd 启动失败后，修复 `build:single-port` 未构建 workspace 运行时依赖的问题。
- `systemctl is-active xinghuan-canvas-next` 返回 `active`。
- `systemctl is-active nginx` 返回 `active`。
- `sudo nginx -t` 通过。
- 服务器 `npm run verify:single-port` 8 项全部 PASS。
- `http://canvas-next.hhh2121.xyz/` 返回 200。
- `http://canvas-next.hhh2121.xyz/api/status` 返回 `xinghuan-api`。
- `https://canvas-next.hhh2121.xyz/` 返回 200。
- `https://canvas-next.hhh2121.xyz/api/status` 返回 `xinghuan-api`。
- Chrome headless 截图 `output/playwright/gray-canvas-next-https.png`。
- Chrome DOM dump 确认 `星幻无限画布`、`后端已连接` 和 `react-flow` 存在，并且不包含旧开发端口。

影响:

- 灰度域名已可用于后续真实用户流和后台/登录/任务队列联调。
- 生产域名仍未切换。
- 内部代理服务未修改。

风险:

- 当前灰度仍是无登录、无数据库、无任务队列的 POC 服务。
- Web bundle 仍存在大 chunk 警告，后续需要分包优化。
- RH 节点分组仍按用户要求暂不处理。

下一步:

- 进入登录、用户隔离、数据库、任务队列和真实 Provider 调用阶段。

### 灰度部署准备材料完成

目标:

- 在本机单端口验收后，补齐灰度部署前的可执行材料。
- 让后续部署到 `canvas-next.hhh2121.xyz` 时有明确启动脚本、环境模板、Nginx/systemd 示例、runbook 和验收清单。

变更范围:

- 根 `package.json` 新增：
  - `build:single-port`
  - `start:single-port`
  - `verify:single-port`
- 新增 `scripts/start-single-port.mjs`，跨平台启动 `apps/api/dist/server.js` 并设置单端口默认环境。
- 新增 `scripts/verify-single-port.mjs`，自动验证 Web、API、画布保存读取、文件上传访问和 SPA fallback。
- 更新 `config/.env.example`，默认端口改为 `18200` 并补充 `XINGHUAN_WEB_DIST_DIR`。
- 新增 `config/canvas-next.env.example`。
- 新增 `ops/gray-deploy-runbook.md`。
- 新增 `ops/gray-acceptance-checklist.md`。
- 新增 `ops/nginx/canvas-next.hhh2121.xyz.conf.example`。
- 新增 `ops/systemd/xinghuan-canvas-next.service.example`。
- 更新 `ops/README.md` 的灰度材料索引。

验证证据:

- `node --check scripts/start-single-port.mjs` 通过。
- `node --check scripts/verify-single-port.mjs` 通过。
- `npm run build:single-port` 通过。
- 使用 `npm run start:single-port` 启动后，`127.0.0.1:18200` 监听。
- `npm run verify:single-port` 全部 PASS：
  - `GET /`
  - `GET /api/status`
  - `POST /api/canvas`
  - `PUT /api/canvas/:id`
  - `GET /api/canvas/:id`
  - `POST /api/files/upload`
  - `GET uploaded file`
  - `SPA fallback`
- 相关监听端口确认仅 `18200` 存在。
- 静态扫描灰度文档和配置，未发现禁止使用的批量删除命令。

影响:

- 后续灰度部署可以直接按 runbook 进入服务器执行。
- 本机和服务器都可以复用同一套单端口启动/验收脚本。

风险:

- 当前仍未实际部署到服务器。
- HTTPS 证书配置需要在 HTTP 灰度可用后单独处理。
- systemd 和 Nginx 示例仍需在服务器实际路径上二次确认。

下一步:

- 进入服务器灰度部署实施，目标为 `canvas-next.hhh2121.xyz`。

### 本机单端口生产服务验收

目标:

- 将本机迁移期的 Web/API/T8 兼容后端多端口形态收敛为 `18200` 单端口生产服务。
- 证明关闭 Vite dev server 和 T8 兼容后端后，星幻仍可打开 Web、访问 API、保存画布和访问素材文件。

变更范围:

- `apps/api/src/server.ts` 增加 `apps/web/dist` 静态文件托管。
- 增加 SPA fallback，非 API/文件路径的 GET 请求回退到 `index.html`。
- 扩展静态资源 MIME，覆盖 HTML、JS、CSS、SVG、JSON、字体和 MIDI。
- 保留 `/api/*`、`/files/*`、`/input/*`、`/output/*` 优先匹配，避免前端 fallback 吞掉接口错误。

验证证据:

- `npm run type-check -w @xinghuan/api` 通过。
- `npm run build -w @xinghuan/api` 通过。
- `npm run build -w @xinghuan/web` 通过，存在大 chunk 警告但不阻塞生产服务验收。
- 启动 `127.0.0.1:18200`，显式指定 `XINGHUAN_WEB_DIST_DIR` 和 `XINGHUAN_DATA_DIR`。
- 停止 `18300`、`18310`、`18766` 后，仅 `18200` 保持监听。
- `GET /` 返回 200 且包含 React root。
- `GET /assets/*.js` 返回 200。
- `GET /api/status` 返回 `xinghuan-api`。
- `POST /api/canvas` 创建 `单端口验收画布`。
- `PUT /api/canvas/:id` 保存 1 个测试节点，随后 `GET /api/canvas/:id` 读取到 1 个节点。
- `POST /api/files/upload` 上传文件成功，返回 `/files/input/up_*.json`，该文件通过同端口返回 200。
- `GET /workspace/deep/link` 通过 SPA fallback 返回 200。
- Chrome headless 截图保存到 `output/playwright/single-port-18200-chrome.png`。
- Chrome DOM dump 确认包含 `星幻无限画布`、`后端已连接` 和 `react-flow`，且不包含 `18300`、`18310`、`18766`。

影响:

- 本机已经具备后续服务器灰度所需的单 upstream 形态。
- Nginx 后续可以只代理 `127.0.0.1:18200` 到灰度域名。
- 画板仍继续采用 T8 成熟 UI，不在本阶段重做画板。

风险:

- 真实模型执行、用户登录、数据库隔离和任务队列仍未进入本阶段。
- Web 构建存在大 chunk 警告，后续需要做代码分包和资源体积优化。
- RH 节点分组仍可见，本阶段按用户要求暂不处理。

下一步:

- 进入灰度部署准备：整理启动脚本、Nginx upstream、systemd 服务和回滚清单。
- 补充服务器部署前密钥、数据目录和日志目录规范。

## 2026-06-04

### T8 成熟画板 UI 迁移方向纠偏

目标:

- 根据用户需求明确 `apps/web` 不从头重做画板 UI。
- 将当前占位画板降级为工程骨架验证，正式方向改为迁移 T8 成熟前端。

变更范围:

- 新增 `development/t8-ui-migration.md`。

验证证据:

- 已确认 T8 前端入口为 `src/main.tsx` 和 `src/App.tsx`。
- 已确认 T8 画板核心为 `src/components/Canvas.tsx`。
- 已确认 T8 前端包含 `components`、`stores`、`services`、`theme`、`types`、`utils` 等完整结构。

影响:

- 后续不继续强化当前占位画板。
- `apps/web` 下一步迁入 T8 前端成熟 UI，再做星幻品牌、主题和 API 适配。

风险:

- T8 前端仍包含大量旧品牌和旧后端 API 绑定。
- 迁入后可能出现依赖和路径别名问题。

下一步:

- 将 T8 `src/` 迁入 `apps/web/src/`。
- 补齐依赖和 Vite 配置。
- 先让 T8 画板 UI 在星幻 worktree 中跑起来。

进展补充:

- 已完成 T8 `src/` 到 `apps/web/src/` 的迁入。
- 已补齐前端依赖和 Vite alias/proxy。
- `npm run type-check -w @xinghuan/web` 通过。
- `npm run build -w @xinghuan/web` 通过。
- `apps/web` 已在 `127.0.0.1:18310` 显示 T8 成熟画板 UI。
- 当前仍存在旧品牌词和 T8 后端依赖，下一步进入品牌与 API 适配。

修复补充:

- 补齐 `apps/web/tailwind.config.js`、`apps/web/postcss.config.js` 和 Tailwind/PostCSS 依赖，修复迁移后页面散乱问题。
- 默认主题改为 `tech-default`，并使用新的星幻主题缓存 key。
- 浏览器确认科技风 token 生效：`#09090b`、`#0a0a0b`、`#38bdf8`。
- 顶部品牌已统一为 `星幻无限画布`。
- 顶部外部推广入口已不再渲染。
- 侧栏底部版本标识已改为星幻。
- 当前 `RH`、`RunningHub` 仍作为节点分组/节点名称出现，下一步单独处理。
- 新增星幻 API 兼容层，画布列表、创建、读取、保存已从 T8 后端切换到 `apps/api`。
- Web `/api` 代理已切到 `127.0.0.1:18300`。
- 浏览器确认 `apps/web` 通过星幻 API 显示 `星幻测试画布` 和 `1 个节点`。
- 补充服务器部署演进记录：先本机单端口生产服务，再部署灰度 `canvas-next.hhh2121.xyz`，最后再生产切换。
- 新增文件与资源接口迁移：`/files`、`/input`、`/output` 和资源库最小 CRUD 已接入星幻 API。
- Web `/files`、`/input`、`/output` 代理已切到 `127.0.0.1:18300`。
- 命令验证文件上传、文件访问、资源写入和资源查询通过。

### Milestone B 星幻工程基线

目标:

- 创建星幻正式工程骨架，不再以 T8 研究仓库作为产品主干。
- 建立 Web、Admin、API、Worker 和共享包边界。
- 验证默认科技风工作台和统一后台首屏。

变更范围:

- 新增根 `package.json` 和 `tsconfig.base.json`。
- 新增 `config/.env.example`。
- 新增 `apps/web`。
- 新增 `apps/admin`。
- 新增 `apps/api`。
- 新增 `apps/worker`。
- 新增 `packages/shared`、`packages/ui`、`packages/canvas-core`、`packages/model-core`。
- 新增 `development/milestone-b-baseline.md`。

验证证据:

- `npm install` 成功，审计结果 0 vulnerabilities。
- `npm run type-check` 通过。
- `npm run build` 通过。
- `npm run start -w @xinghuan/worker` 通过。
- API `/health` 和 `/api/version` 返回 `ok: true`。
- Web `http://127.0.0.1:18310` 可打开。
- Admin `http://127.0.0.1:18320` 可打开。
- 浏览器 DOM 验证 Web/Admin 均包含星幻核心文案，且不包含 T8、企鹅、贞贞、RunningHub、RH风格。

影响:

- 星幻正式工程从独立 worktree 起步，避免污染主项目文档仓库和 T8 研究仓库。
- 服务器开发策略保持为本机开发、灰度服务器验收。
- 后续可以在此基线上引入真实画布、认证、数据库、后台 CRUD 和任务队列。

风险:

- 当前只是工程基线，占位 UI 未接入真实 ReactFlow。
- 截图文件落盘时出现浏览器截图超时，需后续补充稳定截图脚本。
- 尚未实现登录、数据库、Redis、对象存储和真实 Provider 调用。

下一步:

- 增加稳定浏览器截图验收。
- 接入真实画布核心组件。
- 设计并实现 API 路由边界和认证中间件。

### 本机真实测试密钥落地

目标:

- 将用户提供的 GRSAI 和 ToAPIs 测试 Key 放入 2.0 本机环境文件，方便后续 POC 直接读取。

变更范围:

- 新建 `.env.local`，写入 GRSAI 与 ToAPIs 的本机测试环境变量。
- 验证 `.env.local` 被 `.gitignore` 忽略。
- 文档和 Git 提交中不记录真实 Key 值。

验证证据:

- `git check-ignore -v .env.local` 确认 `.env.local` 命中忽略规则。

影响:

- 后续本机开发和 POC 可以从 `.env.local` 读取 `GRSAI_API_KEY`、`TOAPIS_API_KEY` 等变量。
- Git 仓库不会追踪 `.env.local`。

风险:

- 若后续手动强制添加被忽略文件，仍可能造成密钥泄露；提交前必须继续做密钥扫描。

下一步:

- 进入候选基底评估和 POC 准备。

### Git 仓库初始化与密钥忽略规则补充

目标:

- 将无限画布 2.0 初始化为独立 Git 仓库。
- 明确真实 API Key 的忽略规则和放置方式。

变更范围:

- 更新 `.gitignore`，用中文标注本机密钥、运行期输出、依赖、构建产物和系统噪音。
- 新增 `config/secrets-placement.md`，说明 GRSAI 和 ToAPIs 测试密钥应进入 `.env.local`、服务器环境变量或后台加密字段。
- 不把真实 Key 写入 Markdown 文档。

验证证据:

- Git 仓库已初始化。
- 本仓库本地提交身份设置为 `Codex <codex@local>`，不影响全局 Git 配置。
- 初始提交：`5f1dc08 docs: initialize infinite canvas 2 project`。
- `.env`、`.env.local`、`config/.env.local` 已验证会被 `.gitignore` 忽略。
- 提交前密钥扫描无命中。

影响:

- 2.0 文档可以进入 Git 追踪。
- 真实密钥文件默认不被 Git 追踪。

风险:

- 若手动强制 `git add -f .env.local` 仍可能泄露；后续应增加提交前密钥扫描。

下一步:

- 建立候选基底评估表。
- 创建后续 POC 分支或工作区。

### 测试服务商与服务器状态记录

目标:

- 将 2.0 首批测试服务商、文档地址、模型名称和密钥存放策略落到项目文件夹。
- 将当前腾讯云服务器、旧项目服务和磁盘空间状态写入 2.0 运维记录。

变更范围:

- 新增 `config/.env.local.example`，用于本地填写真实密钥。
- 新增 `config/provider-test-matrix.md`，记录 GRSAI 和 ToAPIs 的测试用途、文档地址、模型和验收重点。
- 新增 `ops/server-state-2026-06-04.md`，记录服务器磁盘、旧项目目录占用、服务状态、端口和对 2.0 的影响。
- 更新 `MEMORY.md`，补充测试服务商和服务器状态快照索引。
- 新增 `.gitignore`，默认忽略 `.env` 和 `.env.*`，避免真实密钥进入 Git。

验证证据:

- 通过 SSH 采集服务器状态：旧灰度 release 为 `5148170`，Web、worker、Redis、Nginx 和内部代理服务均为 `active`。
- 根分区当前约 `59G`，已用 `46G`，可用 `11G`，使用率 `81%`。
- 旧灰度项目 `/opt/apps/canvas-enterprise-next` 当前约 `23G`。
- 本地密钥扫描无命中。

影响:

- 真实 API Key 未写入 Markdown 文档。
- 2.0 后续接入 Provider 时可直接参考测试矩阵和 `.env.local.example`。

风险:

- 磁盘空间偏紧，后续部署 2.0 前需要决定是否清理旧 release。
- 清理旧项目必须逐项确认，禁止批量删除。

下一步:

- 建立候选基底评估表。
- 决定 2.0 POC 是否复用旧灰度域名或使用新端口/新子域名。

### v0.1.0 新项目立项文档初始化

目标:

- 放弃旧 Node Banana 改造路线，建立“无限画布 2.0”新项目文档和治理入口。
- 将完整需求、关键经验、限制条件、验收标准和后续选型路线沉淀为可执行文件。

变更范围:

- 新增 `AGENTS.md`，定义项目协作规则、工程规则、安全规则和当前状态。
- 新增 `MEMORY.md`，记录 2.0 项目记忆、旧项目放弃原因、核心需求、关键决策和服务器信息。
- 新增 `DEVLOG.md`，建立开发日志台账。
- 新增 `docs/prd/v0.1.0/` 初始 PRD、SPEC、设计、计划、进度、发布、变更和决策文档。
- 新增 `ops/`、`config/`、`development/`、`research/` 目录，为后续运维、配置、开发和调研留出位置。

验证证据:

- 文件已创建在 `D:\codex\无限画布2.0`。
- 当前不涉及代码构建、测试或服务器部署。

影响:

- 2.0 从文档层面成为新的项目主线。
- 旧 `D:\codex\服务器\无限画布` 不再作为后续功能开发主干。

风险:

- 还未完成候选基底 POC，技术路线尚未锁定。
- 旧项目中已完成的后端能力不能直接视为可复用，需要逐项评估迁移价值。

下一步:

- 建立候选基底评估表。
- 对候选项目进行许可证、节点体系、执行引擎、前后端结构和部署可行性评估。
- 选择 1-2 个候选做最小 POC。

### 2026-06-08 管理员后台专用登录与账号密码可见

目标:

- 后台 `/admin` 仅允许管理员账号登录，不再接受普通成员直接进入后台。
- 管理员在用户管理页可看到各账号当前托管密码，而不是只看到账号邮箱。

变更范围:

- `apps/api/src/server.ts`
  - 新增 `/api/auth/admin-me` 与 `/api/auth/admin-login`。
  - `loginUser` 增加 `adminOnly` 模式，成员账号走后台登录时返回 `ADMIN_REQUIRED`。
  - 用户记录新增 `passwordCipher` 托管密文字段。
  - 新建用户与后台重置密码时，同时写入 `passwordHash` 和 `passwordCipher`。
  - 引导管理员/成员默认账号会补齐可恢复的托管密码。
  - `/api/admin/users` 返回 `passwordAvailable` 与 `password` 给管理员后台。
- `apps/api/db/005_user_password_cipher.sql`
  - PostgreSQL 新增 `xh_users.password_cipher` 列。
- `scripts/db-import-files.mjs`
  - 文件库导入 PostgreSQL 时同步写入 `password_cipher`。
- `apps/admin/src/main.tsx`
  - 后台启动鉴权改为 `/api/auth/admin-me`。
  - 登录提交改为 `/api/auth/admin-login`。
  - 成员误登后台时显示“该账号没有后台管理员权限”。
- `apps/admin/src/admin-users-panel.tsx`
  - 用户表新增“当前密码”列。
  - 可恢复密码直接显示，不可恢复老账号提示“旧账号需要先重置一次密码”。
- `apps/admin/src/styles.css`
  - 补用户密码展示样式。
- `scripts/verify-admin-auth-passwords.mjs`
  - 新增管理员后台专用登录与密码可见性验收脚本。

验证证据:

- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/admin`
- `npm run build -w @xinghuan/api`
- `npm run build -w @xinghuan/admin`
- `npm run verify:admin-users-panel-contract`
- `npm run verify:admin-auth-passwords`
- `npm run verify:single-port`

影响:

- `/admin` 现在是管理员专用入口，成员账号即使密码正确也会被服务端拒绝。
- 后台管理员可以直接查看当前托管密码，便于内部账号管理与排障。
- 旧的只有哈希、没有托管密文的账号不会被强制降级；如果是默认引导账号会自动补齐，其他历史账号可在后台重置一次后进入可见状态。

风险与说明:

- 现有“查看密码”能力是基于后台托管密文，不是对历史哈希的逆向恢复。
- 这提升了后台运维便利性，但也意味着管理员权限本身更敏感，后续应继续补审计与更细粒度权限边界。
- 2026-06-08 晚间追加灰度发布 `20260608-185550-canvas-ui-cleanup-gray`：
  - 移除画布主题音乐播放按钮、主题模板中的默认音乐配置区和相关样式覆盖。
  - 画布磁吸开关默认值由开启改为关闭。
  - 本机重新通过 `npm run verify:canvas-audio-ui-removal`、`npm run verify:single-port`、`npm run build:single-port`。
  - 服务器 `/opt/apps/xinghuan-canvas-next/releases/20260608-185550-canvas-ui-cleanup-gray` 执行 `npm ci`、`npm run build:single-port`、`npm run db:migrate` 后切换 `current` 并重启 `xinghuan-canvas-next.service`、`xinghuan-canvas-next-worker.service`。
  - 公网 `https://canvas-next.hhh2121.xyz/`、`/admin`、`/api/status` 均返回 `200`，`/api/status` 返回 `environment=gray`。
- 服务器本地 `verify:single-port` 因灰度环境管理员口令已更新而在登录步骤返回 `401 INVALID_CREDENTIALS`，不属于本轮 UI 改动引入的站点可用性故障。

### 2026-06-09 助手流式输出与后台 API 设置页滚动修复上线

目标:

- 后台和画布助手支持流式输出、新建会话、过程块默认折叠。
- 后台 AI 助手设置页不再显示服务器内 Hermes 本地地址。
- API 设置页顶部说明区固定不滚动，仅左侧服务商列表和右侧参数区滚动。
- 后台滚动条改为细滚动条并使用统一的青绿色后台视觉风格。

变更范围:

- `apps/api/src/server.ts`
  - 新增 `/api/assistant/chat/stream` SSE 流式响应。
  - 后台/公开助手设置输出增加 Hermes endpoint 遮罩。
- `apps/admin/src/admin-assistant-panel.tsx`
  - 后台助手改为流式读取，增加新建会话和折叠过程块。
- `apps/web/src/components/CanvasAssistant.tsx`
  - 画布助手改为流式读取，保持非持久化会话，增加新建会话和折叠过程块。
- `apps/admin/src/admin-assistant-settings-panel.tsx`
  - Hermes 服务地址显示为“已配置（服务器内地址已隐藏）”，避免直接暴露内网地址。
- `apps/admin/src/main.tsx`
  - API 设置页启用固定面板主容器类名。
- `apps/admin/src/styles.css`
  - API 设置页改为顶部固定、内部左右滚动。
  - 增加后台统一细滚动条样式。
- `apps/web/src/services/api.ts`
  - 新增助手流式 API 客户端。
- `scripts/verify-admin-assistant-chat.mjs`
- `scripts/verify-canvas-assistant-chat.mjs`
  - 默认验收地址统一为 `http://127.0.0.1:18200`。

验证证据:

- 本地:
  - `npm run build -w @xinghuan/admin -- --emptyOutDir false`
  - `npm run build -w @xinghuan/api`
  - `npm run verify:admin-assistant-ui-contract`
  - `npm run verify:admin-assistant-chat`
  - `npm run verify:canvas-assistant-chat`
- 灰度:
  - `https://canvas-next.hhh2121.xyz/api/status` 返回 `environment=gray`。
  - `xinghuan-canvas-next.service` 与 `xinghuan-canvas-next-worker.service` 均为 `active`。
  - 灰度 `/admin` 加载资源 `index-CbcTwclz.js`、`index-c3cW3cYp.css`。
  - JS 包含 `/api/assistant/chat/stream` 与 endpoint 遮罩文案，不包含 `127.0.0.1:8787`。
  - CSS 包含 `admin-main--fixed-panel`、API 设置页内部滚动与自定义滚动条规则。
- 生产:
  - `https://canvas.hhh2121.xyz/api/status` 返回 `environment=production`。
  - `xinghuan-canvas.service` 与 `xinghuan-canvas-worker.service` 均为 `active`。
  - 生产 `/admin` 加载同一新资源，JS/CSS 特征检查与灰度一致。

发布记录:

- 灰度 release: `/opt/apps/xinghuan-canvas-next/releases/20260609-assistant-stream-gray`
- 生产 release: `/opt/apps/xinghuan-canvas/releases/20260609-assistant-stream-prod`
- 灰度域名: `canvas-next.hhh2121.xyz`
- 生产域名: `canvas.hhh2121.xyz`

说明:

- `canvas-next.hhh2121.xyz` 是灰度/预发布环境，服务端口为 `127.0.0.1:18200`。
- `canvas.hhh2121.xyz` 是正式生产环境，服务端口为 `127.0.0.1:18100`。
- 灰度管理员密码与本地默认密码不同，因此脚本化后台登录验收不能使用本地默认密码；本轮以服务健康、资源特征、公开页面和服务日志完成上线验收。

### 2026-06-09 Release 打包脚本瘦身与标注

目标:

- 避免上线包再次把 `.git`、`node_modules`、本地运行数据、上传素材和历史压缩包打进去。
- 让 release 包自带清晰标注，说明包含了什么、排除了什么。

变更范围:

- `scripts/package-release.mjs`
  - 新增白名单式 release 打包脚本。
  - 打包前检查 API、worker、web、admin、packages 的必要 `dist` 产物。
  - 只复制运行必需文件到临时 staging 目录后再压缩。
  - 自动生成包内 `RELEASE_PACKAGE.md`，标注 included/excluded 清单。
- `package.json`
  - 新增 `npm run package:release -- <release-name>`。
- `.gitignore`
  - 新增 `dist-release/`，避免本地 release 包进入 Git。

默认包含:

- `package.json`、`package-lock.json`
- `scripts/start-single-port.mjs`
- `scripts/db-migrate.mjs`
- `config/` 模板与 `ops/systemd`、`ops/nginx`
- `apps/api/dist`、`apps/api/db`
- `apps/worker/dist`
- `apps/web/dist`
- `apps/admin/dist`
- `packages/*/dist`
- `AGENTS.md`、`MEMORY.md`、`DEVLOG.md`

默认排除:

- `.git`
- `node_modules`
- `apps/api/data`
- `output`
- `logs`
- `development/_archive`
- `dist-release`
- 本地上传素材、运行期生成文件、真实 `.env` 和密钥

验证证据:

- `npm run package:release -- 20260609-release-package-smoke`
- 输出包: `dist-release/20260609-release-package-smoke.tar.gz`
- 包大小: `6.03 MB`

影响:

- 后续上线包从之前误打包时的 GB 级下降到 MB 级。
- 服务器运行数据继续留在 VPS 的 shared 目录，不随 release 覆盖。

### 2026-06-09 Hermes Profile 隔离与灰度复验

目标:

- 将无限画布 AI 助手从个人 Hermes Profile 中隔离出来。
- 让后台助手和画布助手都显式使用独立 Profile。
- 保持画布侧非持久化记忆，避免普通工作流上下文写入 Hermes 长期记忆。

变更范围:

- Hermes 服务器:
  - 新建 Profile ID `canvas-assistant`。
  - 展示身份记录为 `无限画布AI助手`。
  - Profile 路径为 `/home/ubuntu/.hermes/profiles/canvas-assistant`。
  - Profile 配置使用 `deepseek-v4-flash`，并关闭 Hermes memory 写入。
- 灰度服务器:
  - `/opt/apps/xinghuan-canvas-next/shared/canvas-next.env` 已配置 `XINGHUAN_HERMES_PROFILE=canvas-assistant`。
  - 灰度 release 已更新为 `/opt/apps/xinghuan-canvas-next/releases/20260609-hermes-canvas-assistant-profile-gray`。
- 本机代码:
  - API 和后台默认助手 Profile 统一为 `canvas-assistant`，避免环境变量缺失时退回中文 slug。
  - 验证脚本断言从旧中文 Profile 名更新为 `canvas-assistant`。
  - 画布助手运行时 smoke 使用普通登录接口，后台助手 smoke 使用管理员登录接口。
  - 打包脚本保留 staging 目录给人工清理，不再自动递归清理临时目录。

验证证据:

- 本机:
  - `npm run verify:admin-assistant-chat`
  - `npm run verify:canvas-assistant-chat`
  - `npm run verify:admin-assistant-settings-save-contract`
  - `npm run type-check`
  - `npm run build:single-port`
  - `npm run package:release -- 20260609-hermes-canvas-assistant-profile-gray`
- 灰度服务器:
  - `npm ci` 通过，`found 0 vulnerabilities`
  - `npm run db:migrate` 返回 `applied=[]`、`skipped=6`
  - `/opt/apps/xinghuan-canvas-next/current` 指向 `20260609-hermes-canvas-assistant-profile-gray`
  - `xinghuan-canvas-next.service` 为 `active`
  - `xinghuan-canvas-next-worker.service` 为 `active`
  - `/api/status` 返回 `environment=gray`
  - 后台助手返回 `mode=hermes`
  - 画布助手返回 `mode=hermes`
- Hermes WebUI:
  - `canvas-assistant` Profile 存在。
  - recent sessions 显示新 release 会话归属 `canvas-assistant`，模型为 `deepseek-v4-flash`。
- 公网:
  - `https://canvas-next.hhh2121.xyz/api/status` 返回 `200`
  - `https://canvas-next.hhh2121.xyz/` 返回 `200`
  - `https://canvas-next.hhh2121.xyz/admin` 返回 `200`

注意:

- Profile ID 必须使用 ASCII slug `canvas-assistant`，不要改回中文。
- 真实 Hermes 密码、Cookie、Provider Key 和数据库连接串不写入文档。
- 本次只更新灰度，不更新生产 `canvas.hhh2121.xyz`。
### 2026-06-09 deadlock / GRSAI / 助手图片输入 / API 站点协助配置补齐

- 修复后台并发进入多面板时可能触发的 PostgreSQL `deadlock detected` 根因。
  - `apps/api/src/server.ts`
    - `readAdminDb()` 在 PostgreSQL 模式下不再因 secret/model/visible text 归一化而执行整库 `writeAdminDbPostgres()`。
    - 新增 `updateProviderProbeResult()` / `updateProviderLastFetchedAt()`，Provider 验证与拉模状态改为单 Provider 定点更新，不再 delete/reinsert 全表。
- 修复 GRSAI 站点在后台仍选 `OpenAI 兼容` 时拉模型返回 `404 page not found` 的问题。
  - `apps/api/src/server.ts`
    - 新增 `isGrsaiProviderDraft()`，按 `protocol`、`id`、`name`、`baseUrl` 双重识别 `grsai_draw`。
    - `probeProviderDraft()` / `fetchProviderModelsDraft()` 对 GRSAI 统一走手动模型目录，默认提供 `gpt-image-2`。
  - `apps/admin/src/admin-api-settings-panel.tsx`
    - Base URL / 名称命中 `grsai` 时自动切换协议为 `grsai_draw`。
- 补齐后台 `AI 协助配置` 对 API 站点的辅助配置能力。
  - `apps/admin/src/admin-api-settings-panel.tsx`
    - 新增 `接入判断` 只读位，展示协议 / 推荐层级 / async 判断。
    - AI 草案应用后会保留管理员确认权，仍需显式点击保存。
  - `apps/api/src/server.ts`
    - fallback 分析增强 GRSAI/异步站点识别，默认补 `manualModelCatalog` 和 `gpt-image-2`。
- 前后台 AI 助手都支持图片上传与传输。
  - `apps/web/src/components/CanvasAssistant.tsx`
    - 新增图片上传入口，走 `/api/files/upload-base64`，作为 `image` 附件挂入会话。
  - `apps/admin/src/admin-assistant-panel.tsx`
    - 后台助手新增图片上传入口，同样上传到本地 `/files/output/...` 后作为附件发送。
  - `apps/api/src/server.ts`
    - `summarizeAssistantAttachment()` 对媒体附件保留安全 URL，不再只留下 host。
- 修复后台 Provider 列表状态图标压缩。
  - `apps/admin/src/styles.css`
    - Provider 列表 grid 列宽和图标/协议徽标的 `flex` 固定尺寸收紧，避免被文本挤压。
- 补充回归脚本。
  - `scripts/verify-admin-api-layout-contract.mjs`
  - `scripts/verify-admin-assistant-chat.mjs`
  - `scripts/verify-canvas-assistant-chat.mjs`
  - `scripts/verify-canvas-assistant-ui-contract.mjs`
  - `scripts/verify-admin-assistant-ui-contract.mjs`
- 本机验证:
  - `npm run verify:admin-api-layout-contract`
  - `npm run verify:admin-assistant-chat`
  - `npm run verify:canvas-assistant-chat`
  - `npm run verify:canvas-assistant-ui-contract`
  - `npm run verify:admin-assistant-ui-contract`
  - `npm run type-check`
  - `npm run build:single-port`

### 2026-06-09 后台 AI 助手全面重构 / Provider 联动 / 图像异步代理补齐

- 后台 AI 助手设置页完成重构，改为工作台式布局。
  - `apps/admin/src/admin-assistant-settings-panel.tsx`
    - 从旧的平铺表单改成 `hero + 保存条 + 多卡片分组` 结构。
    - 保留原有字段协议与保存逻辑，但重组为：
      - `创作侧助手`
      - `后台审计助手`
      - `外部服务接入`
    - 每张卡再细分为基础文案、上下文权限、会话/安全策略等设置段。
  - `apps/admin/src/styles.css`
    - 新增设置页 hero、指标 chip、设置卡片、开关行、静态说明卡等样式。
    - 旧表单栅格不再作为 AI 助手页主布局。

- 后台右侧 AI 助手侧栏完成重构，并与 Provider 配置协助打通双向联动。
  - `apps/admin/src/admin-assistant-panel.tsx`
    - 重构为：
      - 头部身份区
      - 会话状态卡
      - 当前可挂上下文区
      - 已挂附件区
      - 消息区
      - 输入区
    - Quick actions 从简单按钮改成信息卡样式，能更清晰地区分 Provider、模型、任务、审计和页面上下文。
    - 保留图片上传、会话连续性、上下文压缩发送和右侧停靠模式。
  - `apps/admin/src/admin-assistant-events.ts`
    - 新增后台助手上下文分发事件中枢，供后台页面把草稿和上下文直接推到右侧助手。
  - `apps/admin/src/main.tsx`
    - 后台助手新增显式 `onOpenChange`，避免页面推送上下文时误触发“已打开反而被收起”。

- Provider 配置页 AI 协助配置升级为双向联动。
  - `apps/admin/src/admin-api-settings-panel.tsx`
    - 新增 `sendDraftToAssistant()`，可把当前 Provider 草稿、模型摘要、最近拉模结果一键送到右侧助手继续对话分析。
    - 仍保留本页内的 `分析配置 -> 应用到表单 -> 管理员点击保存` 主流程，不会自动落库。
    - 当前实现满足“配置页主工作台 + 右侧助手连续协作”的双向工作流。

- 修复图像节点主链路中的 APIMart 异步任务缺口。
  - `apps/api/src/external-proxy.ts`
    - 补齐 `pollAsyncImageTask()`。
    - `generateOpenAiLikeImage()` 现在会在同步响应没有图像时，自动识别 `task_id` 并轮询 `tasks/{task_id}`。
    - 画布里直接调用 `/api/proxy/external/image` 的主路径已与既有视频异步链路对齐。
  - `apps/worker/src/worker.ts`
    - `executeImageTask()` 在同步结果为空时，也会识别 `task_id` 并进入 APIMart 图像轮询。
    - 后台任务面板与画布直连代理两条图像链路不再能力割裂。

- 契约与验收脚本同步更新。
  - `scripts/verify-admin-assistant-ui-contract.mjs`
    - 兼容新版后台助手布局与设置页设置行结构。

- 本机验收证据：
  - 静态/构建：
    - `npm run verify:admin-assistant-ui-contract`
    - `npm run verify:admin-assistant-workbench`
    - `npm run verify:admin-assistant-settings-save-contract`
    - `npm run verify:provider-response-parser-contract`
    - `npm run type-check`
    - `npm run build:single-port`
  - 运行时：
    - `npm run verify:external-video-proxy` 通过
    - `npm run verify:external-image-proxy` 通过，确认图像异步 `task_id -> /v1/tasks/{task_id}` 代理已生效
    - 手动运行时 smoke：
      - `POST /api/auth/admin-login` 返回 `200`
      - `POST /api/admin/assistant/chat` 返回 `200`
      - 助手返回 `mode=fallback` 且消息非空
      - `/api/admin/audit` 中存在 `assistant.chat`

- 运行时补充复验：
  - `2026-06-09` 当晚再次直接执行 `node scripts/verify-admin-assistant-chat.mjs`，当前工作树已稳定通过，不再复现此前记录过的一次性 `401 AUTH_REQUIRED` 残差。
  - 结合脚本验收与手动 smoke，可确认后台助手登录态、会话上下文和审计落库链路在本机当前版本中处于正常状态。

- 后台 API 设置页与图片/视频链路追加复验：
  - `apps/admin/src/styles.css`
    - 修正 Provider 列表项的固定图标列与协议徽标尺寸，避免后台错误状态/协议图标在窄宽度下被压缩错位。
    - 后台 AI 助手侧栏、API 协助卡片继续保持自适应宽度、自动换列和内容折行。
  - 本机再次通过：
    - `npm run verify:admin-api-layout-contract`
    - `npm run verify:canvas-assistant-ui-contract`
    - `npm run verify:grsai-draw`
    - `npm run verify:grsai-reference-images-contract`
    - `npm run verify:apimart-video-adapter-contract`
    - `npx tsx scripts/verify-video-node-backend-inputs-contract.ts`
    - `npm run verify:generic-node-catalog`
    - `npm run verify:provider-response-parser-contract`
    - `npm run verify:task-payload-api`
    - `npm run build -w @xinghuan/admin`
  - 当前未完成但已确认根因的仅剩本机 Worker 队列运行时验收：
    - `npm run verify:worker-video-adapter`
    - `npm run verify:worker-image-adapter`
    - 两者当前都被本地 `127.0.0.1:18200` 环境中的 `redis.status != connected` / `database.status != connected` 卡住，不属于本轮代码回归。

- `2026-06-10` 灰度 Hermes 助手回归已完成根因修复与实机复验。
  - 根因 1：
    - Hermes WebUI 当前 `/api/session/new` 返回结构已变为顶层 `session.session_id`。
    - 无限画布桥接此前只兼容 `data.session.session_id` / `data.session_id`，导致明明创建成功的 session 被误判为“未返回 session_id”。
  - 根因 2：
    - 无限画布助手聊天此前调用的是 Hermes WebUI `POST /api/chat` 同步兜底接口。
    - Hermes WebUI 源码已明确该接口“Not used by frontend”，灰度实测会长时间挂起；真实前端主链路已切到 `POST /api/chat/start + GET /api/chat/stream`。
  - 代码修复：
    - `apps/api/src/server.ts`
      - 新增 `extractHermesSessionId()`，兼容顶层 `session.session_id` / `session.id` 返回结构。
      - 助手聊天桥接改为：
        - `POST /api/auth/login`
        - `POST /api/session/new`
        - `POST /api/chat/start`
        - `GET /api/chat/stream?stream_id=...`
      - 新增 `readHermesAssistantStream()` 和 `parseServerSentEvents()`，从 Hermes SSE 主链路提取 `token` / `done` 文本。
      - `rawHttpRequest()` 支持自定义超时，Hermes SSE 读取窗口提升到 `180000ms`。
    - `scripts/verify-admin-assistant-chat.mjs`
      - 新增静态契约：后台助手桥接必须包含 `/api/chat/start`、`readHermesAssistantStream`、`extractHermesSessionId`。
    - `scripts/verify-canvas-assistant-chat.mjs`
      - 新增静态契约：画布助手桥接必须包含 `/api/chat/start`、`readHermesAssistantStream`、`extractHermesSessionId`。
  - 本机验证：
    - `npm run type-check`
    - `npm run build -w @xinghuan/api`
    - `npm run build:single-port`
    - 本机 admin smoke 仍返回 `mode=fallback`，已确认是本地轻量环境未加载 Hermes 配置，不属于回归。
  - 新灰度 release：
    - 本机包：`dist-release/20260610-hermes-webui-stream-fix-gray-r2.tar.gz`
    - 服务器目录：`/opt/apps/xinghuan-canvas-next/releases/20260610-hermes-webui-stream-fix-gray-r2`
  - 灰度服务器验证：
    - `npm ci`
    - `npm run db:migrate`
      - `applied=[]`
      - `skipped=6`
    - `systemctl is-active xinghuan-canvas-next.service`
      - `active`
    - `systemctl is-active xinghuan-canvas-next-worker.service`
      - `active`
    - `curl -fsS http://127.0.0.1:18200/api/status`
      - `environment=gray`
  - 灰度真实助手验收：
    - 画布助手：
      - `mode=hermes`
      - 连续两轮同一 `conversationId` 对话中，第二轮成功返回第一轮记住的短语 `星轨草图`
    - 后台助手：
      - `mode=hermes`
      - 连续两轮同一 `conversationId` 对话中，第二轮成功返回第一轮记住的暗号 `海蓝节点`
  - 结论：
    - Hermes 灰度回归已修复。
    - 会话连续性已恢复，当前灰度 assistant 不再退回 fallback，也不再卡死在同步 `/api/chat`。

- `2026-06-10` 图像 / 视频生成节点链路追加完成一轮灰度实链验收与验收入口补齐。
  - 目标：
    - 确认图像与视频生成节点不是只在本机契约层看起来可用，而是在灰度完整 Redis/DB/Worker 环境中真实闭环。
    - 补齐当前缺失的一键验收入口，避免“脚本文件存在但 package script 缺口导致无法统一复验”。
  - 代码补充：
    - `package.json`
      - 新增 `verify:video-node-backend-inputs-contract`
      - 统一把前端视频节点后端输入分配契约纳入标准验收入口
  - 本机验证：
    - `npm run verify:video-node-backend-inputs-contract`
    - `npm run verify:task-payload-api`
    - `npm run verify:provider-response-parser-contract`
    - `npm run type-check`
  - 灰度真实验收：
    - `worker image runtime`
      - 通过
      - `adapter=openai-image`
    - `worker video runtime`
      - 通过
      - `adapter=openai-video`
      - 本地落盘视频示例：
        - `/files/output/task_output_task-1781023220940-e5h0ys_1.mp4`
    - `external image proxy`
      - 同步链路通过
      - 异步 `task_id -> /v1/tasks/{task_id}` 图像链路通过
    - `external video proxy`
      - 同步链路通过
      - APIMart 异步视频链路通过
      - 本地落盘视频示例：
        - `/files/output/external_video_1781023339765_zxj79o.mp4`
        - `/files/output/external_video_1781023340309_3tdoq1.mp4`
  - 关键结论：
    - 当前灰度上的图像 / 视频节点主链路已经覆盖：
      - 前端视频输入结构分配
      - 任务 payload API
      - provider response parser
      - external proxy 图像 / 视频
      - worker image / worker video
      - 本地 `files/output` 落盘
    - 本轮未发现新的图像 / 视频业务回归。
  - 排查过程中确认的非业务噪音：
    - 本机 `verify:worker-image-adapter` / `verify:worker-video-adapter` 失败仍然是因为本机轻量环境未连接 Redis / DB，不是链路故障。
    - 灰度执行临时 verifier 时遇到的 `\r` / here-doc 问题是脚本传输包装问题，不是图像 / 视频生成链路问题。

- `2026-06-10` 本地最终收尾验收补记。
  - 目标：
    - 复核 AI 助手前后台 UI 契约、共享运行态卡片入口和当前本地验收入口是否一致，避免“脚本可跑但入口断档”或“把无效本地端口误判为页面故障”。
  - 本机验证：
    - `npm run verify:admin-assistant-ui-contract`
    - `npm run verify:canvas-assistant-ui-contract`
    - `npm run verify:admin-assistant-workbench`
    - `npm run verify:admin-assistant-settings-save-contract`
    - `npm run verify:admin-assistant-chat`
    - `npm run verify:canvas-assistant-chat`
    - `npm run verify:node-runtime-card-contract`
  - 代码补充：
    - `package.json`
      - 新增 `verify:node-runtime-card-contract`
      - 统一把共享运行态卡片纳入标准 script 入口，避免脚本文件存在但无法通过 `npm run` 复验。
  - 本地页面状态确认：
    - 当前有效单端口入口仍是 `http://127.0.0.1:18200/`
    - 用户当时看到的 `http://localhost:8200/` 无法访问，原因是该端口本机没有监听进程，不属于本轮 AI 助手 UI 回归。
    - `http://127.0.0.1:18200/admin` 本机可正常进入后台登录页，浏览器控制台未复现新的 `error` / `warn`。
  - 结论：
    - 当前 AI 助手前后台 UI 契约、后台协助配置工作台、共享运行态卡片脚本入口都已补齐。
    - 本轮未在本地可用入口复现新的 AI 助手可见报错；`localhost:8200` 需视为无效调试入口，而不是页面渲染异常。
  - 额外修复：
    - 发现本地认证层对同一用户只保留单个 session，导致前后台或并行验收脚本重新登录时会互相挤掉登录态，表现为助手接口偶发 `AUTH_REQUIRED`。
    - `apps/api/src/server.ts`
      - `loginUser()` 改为保留该用户已有未过期 session，不再在新登录时按 `userId` 清空旧 session。
    - 新增 `scripts/verify-auth-session-concurrency.mjs`
      - 验证同一账号连续创建两个 session 后，两边 `GET /api/auth/me` 都仍为已登录。
    - `package.json`
      - 新增 `verify:auth-session-concurrency`
  - 修复后串行验证：
    - `npm run build:single-port`
    - `npm run verify:auth-session-concurrency`
    - `npm run verify:admin-assistant-chat`
    - `npm run verify:canvas-assistant-chat`
    - `npm run verify:admin-assistant-ui-contract`
    - `npm run verify:canvas-assistant-ui-contract`
    - `npm run verify:node-runtime-card-contract`
    - `npm run verify:video-node-backend-inputs-contract`
    - `npm run verify:task-payload-api`
    - `npm run verify:provider-response-parser-contract`

- `2026-06-10` 灰度发布 `20260610-assistant-media-chain-gray-r3-f295040` 并完成真实入口验收。
  - 发布来源：
    - 本地提交：`f295040`
    - 本机包：`dist-release/20260610-assistant-media-chain-gray-r3-f295040.tar.gz`
  - 灰度部署：
    - 上传到 `/tmp/20260610-assistant-media-chain-gray-r3-f295040.tar.gz`
    - 解压到 `/opt/apps/xinghuan-canvas-next/releases/20260610-assistant-media-chain-gray-r3-f295040`
    - 在新 release 执行 `npm ci`
    - 加载 `/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`
    - 执行 `npm run db:migrate`
      - `applied=[]`
      - `skipped=6`
    - 切换 `/opt/apps/xinghuan-canvas-next/current`
    - 重启：
      - `xinghuan-canvas-next.service`
      - `xinghuan-canvas-next-worker.service`
  - 灰度验证：
    - `realpath /opt/apps/xinghuan-canvas-next/current`
      - 指向 `20260610-assistant-media-chain-gray-r3-f295040`
    - `curl http://127.0.0.1:18200/api/status`
      - `environment=gray`
    - 远端 `apps/api/dist/server.js` 已包含：
      - `sessions: [session, ...db.sessions.filter((item) => item.expiresAt > now && item.id !== session.id)]`
    - 后台助手连续会话：
      - `mode=hermes`
      - 同一 `conversationId` 下成功取回暗号 `海蓝节点R3`
    - 画布助手连续会话：
      - `mode=hermes`
      - 同一 `conversationId` 下成功取回短语 `星轨草图R3`
    - 灰度本机并发会话：
      - 同一管理员连续两次登录后，两张 session 调 `/api/auth/me` 都保持 `authenticated=true`
    - 公网灰度入口：
      - `https://canvas-next.hhh2121.xyz/`
      - `https://canvas-next.hhh2121.xyz/admin`
      - `https://canvas-next.hhh2121.xyz/api/status`
      - 均可正常访问
    - 任务 payload API：
      - 灰度 `POST /api/admin/tasks` 创建 `cancelled` 验证任务成功
      - `GET /api/admin/tasks` 可回读 `payload/result`

- `2026-06-10` 生成类节点 `生成数量` 能力完成并已发布到灰度与生产。
  - 目标：
    - 为所有实际生成节点补齐 `生成数量` 选择，采用与比例等核心参数并排的紧凑布局。
    - 所有类型统一走前端自动拆单，不依赖不同上游的原生多数量能力。
  - 覆盖节点：
    - `apps/web/src/components/nodes/ImageNode.tsx`
    - `apps/web/src/components/nodes/VideoNode.tsx`
    - `apps/web/src/components/nodes/AudioNode.tsx`
    - `apps/web/src/components/nodes/SeedanceNode.tsx`
    - `apps/web/src/components/nodes/PresetImageNode.tsx`
  - 契约与实现：
    - 新增/更新 `scripts/verify-generation-count-contract.mjs`
    - 节点统一支持 `generationCount=1..4`
    - 图像聚合到 `imageUrls`
    - 视频聚合到 `videoUrls`
    - 音频聚合到 `tracks + audioUrls`，兼容 `audioUrl / audioUrl_1`
  - 本机验证：
    - `npm run build:single-port`
    - `npm run verify:generation-count-contract`
    - `npm run verify:single-port`
    - `npm run verify:static-html-cache-contract`
  - 发布来源：
    - 统一 release：`20260610-generation-count-r1-f295040`
    - 本地提交：`f295040`
    - 本机包：`dist-release/20260610-generation-count-r1-f295040.tar.gz`
  - 灰度部署：
    - 上传到 `/tmp/20260610-generation-count-r1-f295040.tar.gz`
    - 解压到 `/opt/apps/xinghuan-canvas-next/releases/20260610-generation-count-r1-f295040`
    - `npm ci`
    - 加载 `/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`
    - `npm run db:migrate`
      - `applied=[]`
      - `skipped=6`
    - 切换 `/opt/apps/xinghuan-canvas-next/current`
    - 重启：
      - `xinghuan-canvas-next.service`
      - `xinghuan-canvas-next-worker.service`
  - 灰度验收：
    - `readlink -f /opt/apps/xinghuan-canvas-next/current`
      - `20260610-generation-count-r1-f295040`
    - `curl http://127.0.0.1:18200/api/status`
      - `environment=gray`
    - 公网：
      - `https://canvas-next.hhh2121.xyz/` -> `200`
      - `https://canvas-next.hhh2121.xyz/admin` -> `200`
      - `https://canvas-next.hhh2121.xyz/api/status` -> `environment=gray`
    - 使用灰度真实引导账号执行：
      - `XINGHUAN_VERIFY_BASE_URL=https://canvas-next.hhh2121.xyz npm run verify:single-port`
      - 全部通过
  - 生产部署：
    - 复用同一份 `/tmp/20260610-generation-count-r1-f295040.tar.gz`
    - 解压到 `/opt/apps/xinghuan-canvas/releases/20260610-generation-count-r1-f295040`
    - `npm ci`
    - 加载 `/opt/apps/xinghuan-canvas/shared/canvas.env`
    - `npm run db:migrate`
      - `applied=[]`
      - `skipped=6`
    - 切换 `/opt/apps/xinghuan-canvas/current`
    - 重启：
      - `xinghuan-canvas.service`
      - `xinghuan-canvas-worker.service`
  - 生产验收：
    - `readlink -f /opt/apps/xinghuan-canvas/current`
      - `20260610-generation-count-r1-f295040`
    - `curl http://127.0.0.1:18100/api/status`
      - `environment=production`
    - 公网：
      - `https://canvas.hhh2121.xyz/` -> `200`
      - `https://canvas.hhh2121.xyz/admin` -> `200`
      - `https://canvas.hhh2121.xyz/api/status` -> `environment=production`
    - 使用生产真实引导账号执行：
      - `XINGHUAN_VERIFY_BASE_URL=https://canvas.hhh2121.xyz npm run verify:single-port`
      - 全部通过
  - 运维记录：
    - `ops/generation-count-release-2026-06-10.md`

- `2026-06-10` 生成节点多产物与终止交互补强。
  - 本轮处理用户反馈：
    - 一次生成多张图片、多个视频或多段音频时，产物应放在同一个输出节点中。
    - 输出节点需随节点拖拽和比例变化自适应排布，但保持素材画面完整，不允许拉伸变形或裁切素材内容。
    - 多数量生成应拆成并发异步子任务，完成一个回写一个，全部返回或 settled 后结束节点任务。
    - 生成类节点需要终止当前任务按钮，入口放在节点头部，避免和底部运行区混杂。
    - 灰度与正式入口的数据关系需要解释清楚。
  - 本机实现：
    - `Canvas.tsx` 自动输出改为按生成节点创建单个 `groupOutputMode: 'collection'` 输出集合节点。
    - `OutputNode.tsx` 为图片/视频集合增加自适应 contain 网格，避免固定比例拉伸。
    - `ImageNode`、`VideoNode`、`SeedanceNode`、`AudioNode` 多数量生成改为并发拆单提交，子任务完成后即时 append 到当前节点数据。
    - 视频、Seedance、音频的轮询定时器改为多 timer 管理，避免并发子任务互相清掉轮询。
    - 生成节点头部增加紧凑终止按钮；底部运行区保留状态条，不再重复出现大号停止按钮。
    - 新增 `/api/proxy/generation/cancel` 与前端 `cancelGenerationTask()`，当前语义为停止本地轮询和运行态；上游取消能力待按服务商协议逐个补齐。
    - 清理新加的前端解释型文案，避免把“自动拆单/聚合”等实现说明暴露在节点 UI 中。
  - 环境结论：
    - 灰度和生产目前是不同入口/端口/release，但共用同一 PostgreSQL 数据底座。
    - 因此灰度任务可在生产画布中出现，后台配置也可能共享；若要求完全隔离，需要拆数据库或 schema，并拆 Redis 队列命名空间。
  - 本机验收入口：
    - `npm run verify:generation-count-contract`
    - `npm run build:single-port`

- `2026-06-10` 修复生成节点状态变化后的连线锚点不同步与输出素材集合黑边过大问题。
  - 问题现象：
    - 生成类节点进入运行态、完成态或展开运行信息后，节点视觉高度变化，但 React Flow 连接锚点未及时跟随，画布连线出现断开/错位感。
    - 输出素材集合节点在窄高比例下，多图和多视频格子被强行撑满节点高度，`object-fit: contain` 虽然不裁切素材，但上下黑边过大，呈现为素材显示区域严重畸变。
  - 修复：
    - 新增 `useSyncNodeInternalsOnResize`，用 `ResizeObserver + 双 requestAnimationFrame` 在节点 DOM 真实尺寸变化后刷新 React Flow 内部测量。
    - 已接入：
      - `OutputNode`
      - `UploadNode`
      - `ImageNode`
      - `VideoNode`
      - `SeedanceNode`
      - `AudioNode`
    - `OutputNode` 多图/多视频网格行高改为基于素材实际宽高比计算，并受节点高度上限约束，不再盲目填满高节点。
  - 新增验收：
    - `npm run verify:node-resize-sync-contract`
    - `npm run verify:output-node-preview-layout`
  - 本机验证：
    - `npm run verify:output-node-preview-layout`
    - `npm run verify:node-resize-sync-contract`
    - `npm run build:single-port`

- `2026-06-10` 后台 AI 助手入口与面板 UI 混杂清理。
  - 本轮处理用户反馈：
    - 后台顶部栏 `AI 助手` 入口不应被通用图标按钮宽高压缩，避免和用户信息、刷新等操作混杂。
    - 右侧 AI 助手面板头部文案不应与关闭按钮、状态标签互相挤压。
    - AI 助手设置页不应出现额外撑开的空白纵向滚动，页面高度需要服从后台主内容容器。
  - 本机修复：
    - 顶部 `AI 助手` 按钮改为独立的自适应 pill 按钮，保留图标但不再套用固定 34px 图标按钮宽度。
    - 移除旧的右侧浮动侧栏开关残留样式，统一由顶部栏按钮打开/关闭 AI 助手。
    - 右侧 AI 助手面板头部改为 `minmax(0, 1fr) + 关闭按钮` 网格，长文本使用安全换行。
    - AI 助手设置页增加主轴起始对齐和高度约束，避免单页撑出其他页面没有的底部空白滚动。
  - 本机验收：
    - `npm run verify:video-upload-connect-admin-assistant-toggle`
    - `npm run build -w @xinghuan/admin`
    - `npm run build:single-port`
    - `npm run verify:static-html-cache-contract`
    - `npm run verify:admin-provider-rail-layout`

- `2026-06-10` 后台 AI 助手输出结构、通用 API 错误原因解析与灰度/正式发布。
  - 本轮处理用户反馈：
    - 后台 AI 助手页面仍存在底部空白滚动与上方信息拥挤。
    - API 配置协助结果需要更清晰，不能只输出大段混杂文本。
    - ToAPIs/APIMart 视频生成失败时，节点不应误显示“完成但没有正确返回”，需要把上游失败原因清楚写出来。
    - 错误分析与 API 接入能力应尽量通用，后续新增 API 平台也能复用。
  - 本机修复：
    - `admin-assistant-panel` 去掉大块状态卡，改为紧凑状态 chips。
    - AI 助手上下文选择器改为默认折叠，减少页面较多时的顶部拥挤。
    - AI 助手设置页使用内部滚动和高度约束，避免后台主页面出现额外底部滚动。
    - API 配置协助结果改为结构化展示：摘要、Provider 草案、模型草案、异步任务配置、风险、检查清单，原始输出折叠保留。
    - APIMart/ToAPIs 适配器新增通用失败原因提取，保留 raw response 兜底，后续新服务商可按同一方式接入。
    - Worker 和 API 代理链路统一透传 `failureReason`，前端视频节点优先展示聚合后的真实失败原因。
    - 多子任务部分失败时保留已成功产物，并在失败区域写出失败子任务原因。
  - 本机验收：
    - `npm run build:single-port`
    - `npm run verify:apimart-video-adapter-contract`
    - `npm run verify:video-upload-connect-admin-assistant-toggle`
    - `npm run verify:admin-provider-rail-layout`
  - 发布：
    - Release: `20260610-ai-assistant-error-ux-r1-f295040`
    - 灰度 current:
      - `/opt/apps/xinghuan-canvas-next/releases/20260610-ai-assistant-error-ux-r1-f295040`
    - 生产 current:
      - `/opt/apps/xinghuan-canvas/releases/20260610-ai-assistant-error-ux-r1-f295040`
  - 灰度验收：
    - `https://canvas-next.hhh2121.xyz/` -> `200`
    - `https://canvas-next.hhh2121.xyz/admin` -> `200`
    - `cache-control: no-store`
    - `https://canvas-next.hhh2121.xyz/api/status` -> `environment=gray`
    - `xinghuan-canvas-next.service` 与 `xinghuan-canvas-next-worker.service` 均为 `active`
    - 后台资源：`/admin/assets/index-Bhvvj8cF.js`、`/admin/assets/index-BjjiwG4_.css`
    - 前台资源：`/assets/index-DNFNUrQ5.js`
  - 生产验收：
    - `https://canvas.hhh2121.xyz/` -> `200`
    - `https://canvas.hhh2121.xyz/admin` -> `200`
    - `cache-control: no-store`
    - `https://canvas.hhh2121.xyz/api/status` -> `environment=production`
    - `xinghuan-canvas.service` 与 `xinghuan-canvas-worker.service` 均为 `active`
    - 后台资源：`/admin/assets/index-Bhvvj8cF.js`、`/admin/assets/index-BjjiwG4_.css`
    - 前台资源：`/assets/index-DNFNUrQ5.js`
  - 后续接入规则：
    - 新增 API Provider 时，优先实现通用 response parser，提取 `message`、`error`、`reason`、`fail_reason`、`data.fail_reason`、`data.status_msg` 等候选字段。
    - 前端节点只展示管理员可行动的失败原因，不展示密钥、完整请求头或无意义 raw JSON。
    - AI 助手配置建议继续输出结构化草案，避免把分析过程直接变成后台可见的大段说明文。

- `2026-06-10` 前台生成库与后台 AI 助手滚动/折叠修复。
  - 本轮处理用户反馈：
    - 前台需要仿照资源库新增 `生成库`，放在资源库旁边。
    - 生成库自动收藏所有生成出来的图片、视频、音频。
    - 生成库素材最多保留 3 天，超过 3 天自动清理。
    - 后台 AI 助手页面右侧出现页面级滚轴和底部空白，需要收敛滚动容器。
    - AI 助手折叠后的上下文区域看起来无法打开，需要明确交互入口。
  - 本机实现：
    - 新增 `GenerationLibraryDrawer`，入口位于前台顶栏 `资源库` 按钮旁边。
    - 新增 `/api/generation-library/items` 列表/新增接口和 `/api/generation-library/items/:id` 删除接口。
    - 生成库使用独立 `generation-library.json` 台账，不混入长期资源库分类。
    - 生成库只登记图片、视频、音频三类，默认 `expiresAt = createdAt + 3 天`。
    - 重复 URL 只去重置顶，不刷新原始过期时间，保证“最多 3 天”是真上限。
    - 过期或手动删除时，只对明确的 `/files/output/<filename>` 单文件路径执行删除，不做批量删除。
    - 画布层自动扫描生成/处理节点产出的 `/files/output/*` 图片、视频、音频 URL，并静默登记到生成库。
    - 后台 `assistant` 页加入固定面板布局，`body/admin-workspace` 不再承载页面级滚动。
    - `assistant-settings-page` 改为固定内容槽内部滚动，消除最右侧页面级滚轴和底部空白。
    - AI 助手上下文折叠入口改为整行可点击区域，并用 `展开/收起` 文案明确状态。
  - 新增验收：
    - `npm run verify:generation-library-admin-assistant-layout`
  - 本机验证：
    - `npm run verify:generation-library-admin-assistant-layout`
    - `npm run verify:video-upload-connect-admin-assistant-toggle`
    - `npm run verify:admin-provider-rail-layout`
    - `npm run build:single-port`
  - 发布与复验：
    - 新 release：`20260610-generation-library-admin-scroll-r2`
    - 灰度 current：
      - `/opt/apps/xinghuan-canvas-next/releases/20260610-generation-library-admin-scroll-r2`
    - 生产 current：
      - `/opt/apps/xinghuan-canvas/releases/20260610-generation-library-admin-scroll-r2`
    - 灰度与生产 `GET /`、`GET /admin` 均返回 `200`
    - 灰度 `GET /api/status` 返回 `environment=gray`
    - 生产 `GET /api/status` 返回 `environment=production`
    - `xinghuan-canvas-next.service`、`xinghuan-canvas-next-worker.service`、`xinghuan-canvas.service`、`xinghuan-canvas-worker.service` 均为 `active`
  - AI 助手链路诊断：
    - 2026-06-10 再次核对灰度 AI 助手时，Hermes 网关与画布 API 进程均正常，不存在 Hermes 服务整体断链。
    - 服务器直连验证通过：`/api/auth/login`、`/api/session/new`、`/api/chat/start`、`/api/chat/stream` 均能成功返回。
    - 服务器直连验证通过：`POST http://127.0.0.1:18200/api/admin/assistant/chat/stream` 返回 `mode=hermes` 且消息内容正常。
    - 因此“AI 助手没响应”不属于 Hermes 后端失联，更像是浏览器当前页状态、旧标签页脚本或前端显示态异常。

- `2026-06-10` 完成 ToAPIs + Agnes 通用异步视频链路验收，并补齐 Agnes 二段结果查询。
  - 本机代码修改：
    - `packages/model-core` 新增异步视频高级配置字段：
      - `finalResultTaskIdPath`
      - `finalResultPathTemplate`
      - `finalResultVideoPath`
    - `apps/api/src/external-proxy.ts` 与 `apps/worker/src/worker.ts` 支持：
      - 先轮询任务状态
      - 若状态响应只返回中间资源 ID，则按 `finalResult*` 再查最终结果
    - `openAiEndpoint`/worker endpoint helper 支持 `../` 相对路径，允许从 `/v1/...` 跳转到站点根路径
    - Agnes fallback 助手草案改为直接输出：
      - `/v1/videos`
      - `/v1/videos/{task_id}`
      - `/agnesapi?video_id={video_id}`
    - `verify:external-video-proxy` 新增 Agnes mock 验收
  - 本机验证：
    - `npm run verify:apimart-video-adapter-contract`
    - `npm run build:single-port`
    - `npm run verify:admin-api-layout-contract`
    - `npm run verify:external-video-proxy`
    - `npm run verify:worker-adapter-contract`
  - 发布：
    - Release: `20260610-video-doc-chain-prod-r4`
    - 生产 current：
      - `/opt/apps/xinghuan-canvas/releases/20260610-video-doc-chain-prod-r4`
  - 生产配置修正：
    - `custom-api-1781079959833-video-agnes-video-v2-0` 增加：
      - `finalResultTaskIdPath = video_id`
      - `finalResultPathTemplate = ../agnesapi?video_id={task_id}`
      - `finalResultVideoPath = remixed_from_video_id`
  - 生产真实验收：
    - ToAPIs：
      - 提交成功，任务 `tsk_vid_01KTRZ83XSNVYKVD0YDQ5DZZE2`
      - 最终状态 `completed`
      - 返回真实 mp4 URL
    - Agnes：
      - 提交成功，任务 `task_hxcT15x0xgnYSzyQkknoa4RZf360amkr`
      - 第一段状态 `in_progress`
      - 第二段 `video_id` 查询状态 `completed`
      - 返回真实 mp4 URL

- `2026-06-10` 扩展后台 AI 助手异步视频模板，并同步 Hermes 协同规范。
  - 代码层：
    - `AssistantAnalysisResult` 新增：
      - `chainTemplate`
      - `chainTemplateVersion`
    - Hermes provider 分析提示词现在要求显式判断模板类型
    - fallback 分析会为 ToAPIs / Agnes / GRSAI 写入明确模板名
    - 后台 API 草案面板新增模板展示和第二段最终查询字段展示
  - 文档层：
    - 新增项目规范：
      - `docs/prd/v0.1.0/provider-async-video-template-spec.md`
    - 扩展总框架文档：
      - `docs/prd/v0.1.0/provider-model-framework.md`
    - 新增 Hermes 协同规范：
      - `D:\codex\服务器\Hermes\docs\specs\2026-06-10-provider-async-video-template-spec.md`
    - 决策补充：
      - `docs/prd/v0.1.0/decisions.md` 增加 D-011
  - 本机验证：
    - `npm run build:single-port`
    - `npm run verify:admin-api-layout-contract`
    - `npm run verify:apimart-video-adapter-contract`
  - 运行态补充修复：
    - 发现后台 AI 助手在未显式传入 `capability` 时，会把 `agnes-video-v2.0` 与 `grok-video-1.5-preview` 误判为图像能力，导致 `chainTemplate` 与二段查询字段为空
    - 已改为基于 `modelId`、Provider 信号和文档线索补充视频能力识别，并引入 `classifyUpstreamModel(modelId)` 兜底
    - 新增校验脚本：
      - `npm run verify:assistant-provider-template-contract`
  - 本机运行态验收：
    - 重启本地 `127.0.0.1:18200` 单端口服务后复测通过
    - Agnes：
      - `chainTemplate = async_task_poll_then_final_lookup`
      - `finalResultTaskIdPath = video_id`
      - `finalResultPathTemplate = ../agnesapi?video_id={task_id}`
      - `finalResultVideoPath = remixed_from_video_id`
    - ToAPIs：
      - `chainTemplate = async_task_poll_result`
      - `pollPathTemplate = videos/generations/{task_id}`
      - `taskIdPath = id`
      - `taskStatusPath = status`
      - `resultVideoPath = result.data.0.url`
  - 云端部署：
    - 灰度 release：
      - `/opt/apps/xinghuan-canvas-next/releases/20260610-provider-template-gray-r6`
      - `current` 已切到该 release
      - `xinghuan-canvas-next.service` 与 `xinghuan-canvas-next-worker.service` 均为 `active`
      - `https://canvas-next.hhh2121.xyz/api/status` 返回 `environment=gray`
      - `https://canvas-next.hhh2121.xyz/admin` 返回 `200`
    - 正式 release：
      - `/opt/apps/xinghuan-canvas/releases/20260610-provider-template-prod-r6`
      - `current` 已切到该 release
      - `xinghuan-canvas.service` 与 `xinghuan-canvas-worker.service` 均为 `active`
      - `https://canvas.hhh2121.xyz/api/status` 返回 `environment=production`
      - `https://canvas.hhh2121.xyz/admin` 返回 `200`
    - 服务器 bundle 在位核验：
      - `async_task_poll_then_final_lookup`
      - `classifyUpstreamModel(modelId)`
      - `../agnesapi?video_id={task_id}`

- `2026-06-11` 完成后台 AI 助手模板字段验收补丁、灰度与正式 r7 发布，并进行前后端完整性排查。
  - 验收发现：
    - 生产 `/api/admin/assistant/analyze-provider` 在 `mode=hermes` 时，Hermes 返回空字符串会覆盖 fallback 的 `chainTemplate`
    - Agnes 二段查询字段正常，但 `chainTemplate` / `chainTemplateVersion` 为空
  - 修复：
    - `apps/api/src/server.ts` 将 Hermes 空字符串视作未提供，回退到 fallback 模板字段
    - `scripts/verify-assistant-provider-template-contract.mjs` 增加该合并规则检查
  - 本地验证：
    - `npm run build:single-port`
    - `npm run verify:assistant-provider-template-contract`
    - `npm run verify:admin-api-layout-contract`
    - `npm run verify:apimart-video-adapter-contract`
    - `npm run verify:external-video-proxy`
    - `npm run verify:static-html-cache-contract`
    - `npm run verify:generation-count-contract`
    - `npm run verify:generation-node-copy-cleanup`
    - `npm run verify:generation-library-admin-assistant-layout`
    - `npm run verify:video-upload-connect-admin-assistant-toggle`
    - `npm run verify:node-resize-sync-contract`
    - `npm run verify:output-node-preview-layout`
    - `npm run verify:task-lifecycle-contract`
    - `npm run verify:output-material-prune`
    - `npm run verify:worker-output-materializer`
    - `npm audit --omit=dev`
  - 灰度发布：
    - `/opt/apps/xinghuan-canvas-next/releases/20260611-provider-template-gray-r7`
    - `xinghuan-canvas-next.service` 与 `xinghuan-canvas-next-worker.service` 均为 `active`
    - 公网 `/api/status` 返回 `environment=gray`
    - 公网 `/admin` 返回 `200`
    - 登录态后台分析接口验收：
      - Agnes：`chainTemplate=async_task_poll_then_final_lookup`
      - ToAPIs：`chainTemplate=async_task_poll_result`
  - 正式发布：
    - `/opt/apps/xinghuan-canvas/releases/20260611-provider-template-prod-r7`
    - `xinghuan-canvas.service` 与 `xinghuan-canvas-worker.service` 均为 `active`
    - 公网 `/api/status` 返回 `environment=production`
    - 公网 `/admin` 返回 `200`
    - 登录态后台分析接口验收：
      - Agnes：`chainTemplate=async_task_poll_then_final_lookup`
      - ToAPIs：`chainTemplate=async_task_poll_result`
    - 后台助手聊天接口验收：
      - `mode=hermes`
      - 返回非空消息
  - 排查结论：
    - 灰度和正式当前仍共用同一 PostgreSQL 与 Redis 实例；队列名已隔离，数据库数据仍会跨环境可见
    - 生成库 API 逻辑 TTL 为 3 天，但输出素材清理脚本和环境模板仍默认 14 天，物理文件删除周期尚未与生成库需求统一
    - 后台助手设置页存在嵌套滚动结构：页面自身 `overflow:auto`，外层后台主区域也负责滚动
    - 后台任务页仍存在“创建测试任务”可见文案
    - 本地 `apps/api/data/auth/auth.json` 与 `apps/api/data/admin/admin.json` 是 Git 已跟踪运行态数据，当前含会话和加密凭据样本；发布包已排除 `apps/api/data`，但提交时需要单独治理

- `2026-06-11` 完成审计问题修复、灰度验收、正式 r8 发布与运行态数据治理。
  - 修复内容：
    - 灰度 PostgreSQL 拆分为独立 `xinghuan_canvas_gray`，避免灰度任务/画布数据进入正式视图。
    - 灰度与正式 `XINGHUAN_OUTPUT_MATERIAL_RETENTION_DAYS` 统一为 `3`。
    - 输出素材清理脚本默认保留期从 14 天改为 3 天。
    - 后台 AI 助手设置页取消内外双滚动，改为外层主区域统一滚动。
    - 后台任务页“创建测试任务”改为“创建任务”。
    - `.gitignore` 改为忽略整个 `apps/api/data/`，并从 Git 索引取消跟踪运行态数据文件；磁盘文件保留。
  - 灰度发布：
    - `/opt/apps/xinghuan-canvas-next/releases/20260611-fix-audit-issues-gray-r8`
    - `xinghuan-canvas-next.service` 与 `xinghuan-canvas-next-worker.service` 均为 `active`
    - `https://canvas-next.hhh2121.xyz/api/status` 返回 `environment=gray`
    - `https://canvas-next.hhh2121.xyz/admin` 返回 `200`
  - 正式发布：
    - `/opt/apps/xinghuan-canvas/releases/20260611-fix-audit-issues-prod-r8`
    - `xinghuan-canvas.service` 与 `xinghuan-canvas-worker.service` 均为 `active`
    - `https://canvas.hhh2121.xyz/api/status` 返回 `environment=production`
    - `https://canvas.hhh2121.xyz/admin` 返回 `200`
  - 验收：
    - 环境隔离：`db_same=no`，灰度/正式数据库 URL 哈希不同
    - 保留期：灰度/正式均为 `3`
    - 正式 bundle 中“创建测试任务”计数为 `0`，“创建任务”计数为 `1`
    - 正式后台 AI 助手 Provider 分析：
      - Agnes：`mode=hermes`，`chainTemplate=async_task_poll_then_final_lookup`，`hasFinalLookup=true`
      - ToAPIs：`mode=hermes`，`chainTemplate=async_task_poll_result`
    - 本地验证通过：
      - `npm run build:single-port`
      - `npm run verify:generation-library-admin-assistant-layout`
      - `npm run verify:admin-task-panel-contract`
      - `npm run verify:output-material-prune`
      - `npm run verify:assistant-provider-template-contract`
      - `npm run verify:node-resize-sync-contract`
      - `npm run verify:video-upload-connect-admin-assistant-toggle`
      - `npm run verify:external-video-proxy`

- `2026-06-11` 落地多模态模型标签、后台模型测试入口与 MiMo 音频 Provider 基础链路。
  - 模型与导入：
    - `@xinghuan/model-core` 扩展 `audio` capability、能力标签、模型测试状态、音频参数 schema。
    - Provider 模型拉取解析新增 `audioModels` 和 `modelTags`。
    - Qwen3-VL 导入后自动带视觉理解与视频理解标签，避免视频/图片输入被当作普通文本模型处理。
  - 后台：
    - API 服务商模型管理支持手动编辑能力标签。
    - 新增 `/api/admin/models/:id/test`，支持文本、图像理解、视频理解、音频生成、音色克隆等测试入口。
    - PostgreSQL 新增 `capability_tags`、`test_state`，并回填现有模型标签。
  - 画布与代理：
    - 新增 `/api/proxy/external/audio` 与 `audio-provider-adapter`。
    - 音频节点新增 Provider 语音模式，支持 TTS 与音色克隆；旧 Suno 保留为 Legacy 模式。
    - 前端模型目录新增 `audioModels`，音频节点读取后台发布模型。
  - 验证：
    - `npm run build -w @xinghuan/model-core`
    - `npm run build -w @xinghuan/api`
    - `npm run build -w @xinghuan/admin`
    - `npm run build -w @xinghuan/web`
    - `npm run verify:model-capability-tags-contract`
    - `npm run verify:provider-model-tests-contract`
    - `npm run verify:external-audio-proxy`

- `2026-06-11` 继续收口 LLM 多模态守门与旧 Suno 迁移提示。
  - `LLMNode` 新增后台模型能力判断：
    - 读取已发布 `chat` 模型的 `capabilityTags` 与 `inputCapabilities`
    - 不支持图像理解时自动阻止图片发送
    - 不支持视频理解时自动阻止视频发送
    - 如果只有不被支持的媒体而无文本，会直接提示用户切换模型或补充文本
  - 音频节点调整：
    - 侧栏标签改为 `语音生成`
    - 旧模式标题改为 `音频 Suno（旧）`
    - `Legacy Suno` 在当前版本明确提示未接入后端代理，停止伪可用状态
  - 新增验证：
    - `npm run verify:llm-media-capability-contract`
  - 本地验证：
    - `npm run build -w @xinghuan/web`
    - `npm run build -w @xinghuan/admin`
    - `npm run verify:llm-media-capability-contract`
    - `npm run verify:external-audio-proxy`
- 2026-06-11
  - 继续打通后台 AI 协助配置、MiMo 音频模型真实测试与 Hermes 独立 profile 默认模型。
  - 代码变更：
    - `apps/api/src/server.ts`
      - 后台模型测试 `audioGeneration` / `voiceClone` 改为真实调用音频链路。
      - 新增内置最小测试音频样本，供 `voice_clone` 冒烟使用。
    - `apps/admin/src/admin-api-settings-panel.tsx`
      - 新增 `formatAssistantRawOutput()`，修复原始输出出现 `[object Object]`。
      - 明确“先生成草案，再进入真实验证”，以及应用草案后的后续动作提示。
    - `scripts/verify-provider-model-tests-contract.mjs`
      - 新增断言：后台音频模型测试不允许再保留“待启用”占位实现。
    - `scripts/verify-video-upload-connect-and-admin-assistant-toggle.mjs`
      - 新增断言：AI 协助配置原始输出必须经过格式化后再渲染。
  - 验证：
    - `npm run verify:provider-model-tests-contract`
    - `node scripts/verify-video-upload-connect-and-admin-assistant-toggle.mjs`
    - `npm run verify:external-audio-proxy`
  - 继续修复 MiMo 语音克隆模型选择错误、后台音色预设与音频节点 UI 粗糙问题。
  - 根因确认：
    - 画布 `AudioNode` 之前会把同一 Provider 下全部音频模型直接混合展示，`voice_clone` 模式可能选到 `voice_design` 或普通 `tts` 模型，导致上游返回参数不匹配错误。
    - 后台模型编辑器虽然能维护音频 schema，但没有专门的“默认音色 / 预设音色”编辑区，前端也无法消费 `parameterSchema.voice.options`。
  - 代码变更：
    - `apps/web/src/utils/publishedModelSelection.ts`
      - 新增 `filterAudioModelsByMode()` 与 `resolveCompatibleAudioProviderSelection()`，统一处理 `tts / voice_clone` 兼容模型筛选。
    - `apps/web/src/components/nodes/AudioNode.tsx`
      - Provider 语音模式改为模式感知模型列表。
      - 切换用途后会自动纠正到兼容模型，不再保留错误的旧模型选择。
      - 音色字段支持读取后台 `parameterSchema.voice.options/default`，有预设时展示下拉与快捷音色芯片，无预设时仍保留自由输入。
      - 音频格式也改为优先读取模型 schema，而不是固定写死。
      - Provider 语音区 UI 重新整理为更明确的分层卡片和模式切换条。
    - `apps/admin/src/admin-model-editor.tsx`
      - 新增 `syncAudioVoicePresetSchema()`。
      - 后台音频模型新增“默认音色 / 预设音色”编辑区，保存时自动回写到 `parameterSchema.voice` 与 `advancedConfig.voice`。
    - `apps/admin/src/styles.css`
      - 重做模型行、能力标签、音色预设卡片与测试动作区视觉样式，使其更贴近现有后台调性。
    - `apps/api/src/external-proxy.ts`
      - 新增语音克隆防呆：若模型未启用 `voice_clone` 标签，后端直接明确报错，阻止错误模型被当作克隆模型调用。
    - `scripts/verify-audio-provider-model-selection-contract.ts`
      - 新增契约验证，锁定音频模式筛选、后台音色预设输出和前端消费逻辑。
    - `package.json`
      - 新增 `verify:audio-provider-model-selection-contract` 脚本入口。
  - 验证：
    - `npx tsx scripts/verify-audio-provider-model-selection-contract.ts`
    - `npx tsx scripts/verify-external-audio-proxy.ts`
    - `npx tsx scripts/verify-model-capability-tags-contract.ts`
    - `node scripts/verify-provider-model-tests-contract.mjs`
    - `npm run type-check -w @xinghuan/web`
    - `npm run type-check -w @xinghuan/admin`
    - `npm run type-check -w @xinghuan/api`
    - `npm run build -w @xinghuan/web`
    - `npm run build -w @xinghuan/admin`
    - `npm run build -w @xinghuan/api`
- 2026-06-11
  - 继续补完后台 `AI 协助配置` 面板的结构化分析能力，目标是支持“贴文档链接 + 请求样例 + 响应样例 + 异步模板提示”后直接生成可应用草案。
  - 代码变更：
    - `apps/admin/src/admin-api-settings-panel.tsx`
      - 新增结构化输入区：
        - 文档链接
        - 请求样例
        - 响应样例
        - 异步模板
        - 补充说明
      - 新增 `buildAssistantAnalysisPayload()`，统一生成面板到后端分析接口的结构化 payload。
      - `发送到右侧助手` 也会带上文档链接、请求/响应样例和异步模板提示，不再只发送纯文本备注。
      - 分析结果区新增“文档抓取结果”展示，能看到每个链接是否抓取成功。
    - `apps/admin/src/admin-types.ts`
      - `AssistantAnalysisRequest` 新增 `docUrls`、`asyncTemplate`。
      - `AssistantAnalysisResult.docFetch` 新增多文档 `items` 结果。
    - `apps/api/src/server.ts`
      - 分析接口支持多文档链接输入。
      - 新增 `normalizeAssistantDocUrls()` 与 `normalizeAssistantAsyncTemplate()`。
      - 文档抓取升级为多链接抓取，并在抓取后做基础 HTML 文本抽取，避免只把整段原始 HTML 直接塞给分析逻辑。
      - 回退分析会把异步模板作为明确提示信号，支持管理员手动约束走同步、单段轮询、二段最终查询或特殊适配模板。
      - Hermes 分析 prompt 也同步带上多文档列表和异步模板提示。
    - `apps/admin/src/styles.css`
      - 新增后台 AI 协助配置区的结构化表单布局与文档链接 chip 样式。
    - `scripts/verify-admin-assistant-structured-analysis-contract.mjs`
      - 新增结构化分析面板契约验证。
    - `package.json`
      - 新增 `verify:admin-assistant-structured-analysis-contract`。
  - 验证：
    - `node scripts/verify-admin-assistant-structured-analysis-contract.mjs`
    - `node scripts/verify-assistant-provider-template-contract.mjs`
    - `node scripts/verify-admin-api-layout-contract.mjs`
    - `npm run type-check -w @xinghuan/admin`
    - `npm run type-check -w @xinghuan/api`
  - 灰度发布：
    - Release: `20260611-admin-assistant-structured-inputs-gray-r1`
    - 当前灰度：`/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260611-admin-assistant-structured-inputs-gray-r1`
    - 服务：
      - `xinghuan-canvas-next.service` => `active`
      - `xinghuan-canvas-next-worker.service` => `active`
    - 验收：
      - `GET http://127.0.0.1:18200/api/status` => `environment=gray`
      - `GET https://canvas-next.hhh2121.xyz/admin` 返回新资源：
        - `index-czJ_Z3QS.js`
        - `index-CsjzixIg.css`
      - `GET https://canvas-next.hhh2121.xyz/api/status` => `environment=gray`
    - 备注：
      - 本轮执行 `npm run db:migrate` 时出现 `PG_DRIVER_NOT_INSTALLED`，但本次未新增 migration 文件，因此未阻断发布；后续需单独核查服务器 release 环境下 `node scripts/db-migrate.mjs` 的 ESM/依赖解析行为。
  - 生产发布：
    - Release: `20260611-admin-assistant-structured-inputs-prod-r1`
    - 当前生产：`/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260611-admin-assistant-structured-inputs-prod-r1`
    - 服务：
      - `xinghuan-canvas.service` => `active`
      - `xinghuan-canvas-worker.service` => `active`
    - 验收：
      - `GET http://127.0.0.1:18100/api/status` => `environment=production`
      - `GET https://canvas.hhh2121.xyz/admin` 返回新资源：
        - `index-czJ_Z3QS.js`
        - `index-CsjzixIg.css`
      - `GET https://canvas.hhh2121.xyz/api/status` => `environment=production`
- 2026-06-11
  - 修复生产后台因 schema 漏迁移导致的全量数据断开，并补强 release 环境下的迁移脚本兼容。
  - 故障根因：
    - 新代码已经开始读取 `xh_models.capability_tags` 与 `test_state`。
    - 灰度数据库已执行 `007_model_capability_tags_audio.sql`，生产数据库仍停留在 `001-006`，导致后台页面统一报错：`column "capability_tags" does not exist`。
    - 同时，服务器 release 目录里的 `scripts/db-migrate.mjs` 在该环境下会报 `PG_DRIVER_NOT_INSTALLED`，使正常迁移没有被执行。
  - 处置：
    - 已在生产数据库前向补齐 `007_model_capability_tags_audio.sql`，并登记到 `xh_schema_migrations`。
    - `scripts/db-migrate.mjs` 新增 `createRequire(import.meta.url)` 回退，动态 `import("pg")` 失败时改走 CommonJS `require("pg")`。
    - 已将修好的脚本同步覆盖到：
      - `/opt/apps/xinghuan-canvas/current/scripts/db-migrate.mjs`
      - `/opt/apps/xinghuan-canvas-next/current/scripts/db-migrate.mjs`
  - 验证：
    - 生产 current release 执行迁移：`{"ok":true,"applied":[],"skipped":7}`
    - 灰度 current release 执行迁移：`{"ok":true,"applied":[],"skipped":7}`
    - `GET https://canvas.hhh2121.xyz/api/status` => `environment=production`
    - `systemctl is-active`：
      - `xinghuan-canvas.service` => `active`
      - `xinghuan-canvas-worker.service` => `active`
      - `xinghuan-canvas-next.service` => `active`
      - `xinghuan-canvas-next-worker.service` => `active`
    - `journalctl -u xinghuan-canvas.service --since '2026-06-11 16:00:00'` 未再出现 `capability_tags` 报错
- 2026-06-11
  - 修复画布音频节点无法显示 MiMo 已发布模型的问题，并同步整理音频节点下拉式 UI。
  - 根因：
    - 前端 `AudioNode` 的兼容模型筛选依赖 `capabilityTags`。
    - `/api/models` 的公开目录此前未把 `capabilityTags` 一起下发给前端，导致 MiMo 音频模型在画布里被当作“无标签模型”过滤掉，出现“0 个兼容模型 / 当前模式暂无模型”。
  - 代码变更：
    - `apps/api/src/server.ts`
      - `publicModelCatalog()` 现在会显式返回 `capabilityTags`，供前端节点按用途筛选。
    - `apps/web/src/components/nodes/AudioNode.tsx`
      - 引擎、供应商、模型、音色、格式统一改成胶囊风格的下拉/输入外壳。
      - 音色在后台配置 `parameterSchema.voice.options/default` 后，前端会自动切换成下拉选择并跟随模型变化更新。
    - `scripts/verify-model-capability-tags-contract.ts`
      - 新增公开模型目录必须暴露 `capabilityTags` 的契约校验。
  - 验证：
    - `npm run verify:model-capability-tags-contract`
    - `npm run verify:audio-provider-model-selection-contract`
    - `npm run build -w @xinghuan/web`
    - `npm run build -w @xinghuan/api`
- 2026-06-11
  - 已将音频节点 MiMo 模型展示修复版发布到灰度。
  - 灰度 release：
    - `20260611-audio-node-mimo-gray-r2-b9ee3bd`
    - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260611-audio-node-mimo-gray-r2-b9ee3bd`
  - 服务器动作：
    - 上传 release 包到服务器临时目录
    - 解压到灰度 release 目录
    - 在 release 目录执行 `npm ci`
    - 加载 `/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`
    - 执行 `node scripts/db-migrate.mjs`
    - 重启 `xinghuan-canvas-next.service`
    - 重启 `xinghuan-canvas-next-worker.service`
  - 验收：
    - `node scripts/db-migrate.mjs` => `{"ok":true,"applied":[],"skipped":7}`
    - `systemctl is-active xinghuan-canvas-next.service` => `active`
    - `systemctl is-active xinghuan-canvas-next-worker.service` => `active`
    - `readlink -f /opt/apps/xinghuan-canvas-next/current` => `/opt/apps/xinghuan-canvas-next/releases/20260611-audio-node-mimo-gray-r2-b9ee3bd`
    - `GET http://127.0.0.1:18200/api/status` => `environment=gray`
    - `GET https://canvas-next.hhh2121.xyz/api/status` => `environment=gray`
- 2026-06-11
  - 已继续发布 MiMo 音色克隆与音色定制结构修复到灰度。
  - 修复内容：
    - `voice_clone` 恢复为向上游发送完整 `DataURL`，不再错误剥离为纯 base64。
    - `AudioNode` 新增第三个同级模式 `音色定制`。
    - `克隆音色` 页面移除预设音色/音色选择控件，只保留参考音频链路。
    - `生成语音` 页面继续保留后台预设音色下拉与芯片。
    - `tts / voice_clone / voice_design` 三类模型现在按标签严格分流，不再混用。
  - 本地验证：
    - `npm run verify:external-audio-proxy`
    - `npm run verify:audio-provider-model-selection-contract`
    - `npm run build -w @xinghuan/web`
    - `npm run build -w @xinghuan/api`
  - 灰度 release：
    - `20260611-audio-modes-voicedesign-gray-r4-b9ee3bd`
    - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260611-audio-modes-voicedesign-gray-r4-b9ee3bd`
  - 灰度验收：
    - `node scripts/db-migrate.mjs` => `{"ok":true,"applied":[],"skipped":7}`
    - `systemctl is-active xinghuan-canvas-next.service` => `active`
    - `systemctl is-active xinghuan-canvas-next-worker.service` => `active`
    - `GET http://127.0.0.1:18200/api/status` => `environment=gray`
    - `GET https://canvas-next.hhh2121.xyz/api/status` => `environment=gray`
- 2026-06-12
  - 已补齐前端生成服务的非 JSON 响应兜底，重点覆盖视频链路。
  - 修复内容：
    - `apps/web/src/services/generation.ts` 新增统一 `readJsonResponse`，在响应为 HTML 或其他非 JSON 内容时抛出明确错误，而不再直接报 `Unexpected token '<'`。
    - 补齐 `generateExternalVideo`、`submitVideo`、`queryVideo`、`queryVideoFal` 等视频入口残留的 `r.json()` 直接解析点。
    - 一并统一 Seedance、音频、RunningHub、MJ、上传等相关接口的响应解析与错误标签，避免错误提示串线。
  - 已验证：
    - `npm run build -w @xinghuan/web`
  - 当前判断：
    - 线上 `canvas.hhh2121.xyz` 源站日志可见视频请求已命中 `/api/proxy/external/video`，说明报错并非固定由前端静态路由吞掉。
    - 旧版前端会把任何 HTML 错页直接当 JSON 解析，因此真实失败原因会被掩盖；新版将把问题暴露为“哪个接口返回了 HTML 页面”。
  - 已新增 `scripts/verify-generation-json-response-contract.mjs`，固化“生成服务不能再残留直接 `r.json()`”的前端契约。
  - 本机验收：
    - `npm run verify:generation-json-response-contract`
    - `npm run verify:external-video-proxy`
    - `npm run verify:single-port`
    - `npm run build:single-port`
  - 验收说明：
    - 首次把 `verify:external-video-proxy` 与 `verify:single-port` 并行执行时，本机 file-based admin 数据发生测试互相覆盖，出现过一次 `Provider 不存在`。
    - 改为串行后，视频代理验收已完整通过，确认该残差属于本机测试写入冲突，不属于本次修复本身。
  - 已发布灰度 release：
    - `20260612-generation-json-guard-gray-r1`
    - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260612-generation-json-guard-gray-r1`
  - 灰度验收：
    - `systemctl is-active xinghuan-canvas-next.service` => `active`
    - `systemctl is-active xinghuan-canvas-next-worker.service` => `active`
    - `curl http://127.0.0.1:18200/api/status` => `environment=gray`
    - `curl https://canvas-next.hhh2121.xyz/api/status` => `environment=gray`
    - `POST https://canvas-next.hhh2121.xyz/api/proxy/external/video`（未登录）=> `401 AUTH_REQUIRED` 且 `Content-Type=application/json`
    - 灰度前端资产 `Canvas-hDGbekGz.js` 已确认包含“返回了 HTML 页面，请检查登录状态、网关代理或上游配置”提示文案
- 2026-06-12
  - 已定位并修复橙云代理下后台视频生成长请求被截断的问题。
  - 根因：
    - Agnes / TOAPIs / APIMart 等后台视频模型已经配置为异步任务，但旧画布路径仍通过 `/api/proxy/external/video` 在一个 HTTP 请求内提交并持续轮询。
    - 切换 Cloudflare 橙云后，长时间 HTTP 请求会在约 100 秒级别被代理/客户端断开；Nginx 日志中对应请求表现为 `POST /api/proxy/external/video` `499`。
    - 前端拿到的是代理层 HTML 错页，因此显示“扩展视频生成接口返回了 HTML 页面”，而后台供应商侧任务仍可能实际成功。
  - 修复：
    - 新增画布登录态接口 `POST /api/proxy/external/video/task`，用于提交后台 Provider 视频任务并立即返回 `taskId`。
    - 新增 `GET /api/proxy/external/video/task/:taskId`，用于读取当前用户任务状态、素材化后的视频 URL 和失败原因。
    - `VideoNode` 的后台发布模型分支已改成“短提交 + 轮询任务表”，不再通过浏览器长请求等待上游视频完成。
    - 任务 payload 会继承模型 `advancedConfig`，并继续把本地素材转换为 Provider 文件签名 URL，供 Worker 调用上游。
  - 本机验收：
    - `npm run build -w @xinghuan/api`
    - `npm run build -w @xinghuan/web`
    - `npm run build -w @xinghuan/worker`
    - `npm run build:single-port`
    - `npm run verify:apimart-video-adapter-contract`
    - `npm run verify:generation-json-response-contract`
  - 注意：
    - 本机 `verify:worker-video-adapter` 因本机未连接 Redis 报 `redis is not connected`，不是本轮代码编译问题；灰度 Redis 已验证 `PONG`。
    - 未自动发起真实 Agnes 视频生成验收，避免消耗上游额度；需要由管理员在灰度画布手动发起一次低成本任务确认最终素材展示。
  - 已发布灰度 release：
    - `20260612-external-video-task-gray-r1`
    - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260612-external-video-task-gray-r1`
  - 灰度验收：
    - `db:migrate` => `{"ok":true,"applied":[],"skipped":7}`
    - `systemctl is-active xinghuan-canvas-next.service` => `active`
    - `systemctl is-active xinghuan-canvas-next-worker.service` => `active`
    - `https://canvas-next.hhh2121.xyz/api/status` => `environment=gray`
    - 未登录 `POST https://canvas-next.hhh2121.xyz/api/proxy/external/video/task` => `401 AUTH_REQUIRED` 且 `Content-Type=application/json`
    - 登录态本机 `POST http://127.0.0.1:18200/api/proxy/external/video/task` 空请求 => JSON 错误 `缺少 prompt`
    - 灰度 Redis => `PONG`，队列深度 `0`
    - 登录态 `/api/models` => Agnes 视频模型 `advancedConfig.mode=async_video_task`
- `2026-06-13` Phase A 第二批多用户止血已完成本地验收：
  - 检查回退点：
    - git commit: `9f2e134` `chore: create rollback checkpoint before phase-a hardening`
    - git tag: `phase-a-start-checkpoint-2026-06-13`
  - 本轮收口内容：
    - `apps/api/src/server.ts`
      - 资源库 `categories/items` 的 Postgres 热路径已改为定向写入，不再走整库 `writeResourceDb(...)` 覆写。
      - 后台 `providers/models` 的新增、更新、删除、导入模型热路径已改为定向 Postgres 写入，不再在 Postgres 模式下走整库 `writeAdminDb(...)` 覆写。
      - 资源库 Postgres upsert 新增 `RESOURCE_OWNERSHIP_MISMATCH` 防护，避免跨用户同 ID 冲突时静默失败但前端误判成功。
      - 文件到 Postgres 的资源导入保留 `pruneMissing: true`，仅用于冷迁移，不再把“整库替换”当作常态写路径。
      - `writeAuthDb(...)` 与 `writeAdminDb(...)` 在 Postgres 模式下默认禁止 full-replace，除非显式传入白名单选项，避免未来回归到整库覆写。
    - `scripts/verify-phase-a-hardening-contract.mjs`
      - 新增资源库热路径、跨用户资源冲突保护、Provider/Model 热路径和模型导入定向写入的契约验证。
  - 本机验收：
    - `npm run verify:phase-a-hardening-contract`
    - `npm run type-check -w @xinghuan/api`
    - `npm run verify:postgres-canvas-resource-contract`
    - `npm run verify:auth-session-concurrency`
    - `npm run build:single-port`
  - 当前结论：
    - Phase A 第一批和第二批的“高频整库覆写止血”已在本地通过。
  - 灰度发布：
    - git commit: `01f6e5f` `fix: harden postgres multi-user hot paths`
    - release: `20260613-phase-a-hardening-gray-r1-01f6e5f`
    - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260613-phase-a-hardening-gray-r1-01f6e5f`
    - `db:migrate` => `{"ok":true,"applied":[],"skipped":8}`
    - `systemctl is-active xinghuan-canvas-next.service` => `active`
    - `systemctl is-active xinghuan-canvas-next-worker.service` => `active`
    - `GET http://127.0.0.1:18200/api/status` => `environment=gray`
    - `GET https://canvas-next.hhh2121.xyz/` => `200 text/html`
    - `GET https://canvas-next.hhh2121.xyz/admin` => `200 text/html`
    - `GET https://canvas-next.hhh2121.xyz/api/status` => `200 application/json`
    - `current_database()` => `xinghuan_canvas_gray`
    - 运行中 dist 已确认包含 `RESOURCE_OWNERSHIP_MISMATCH`
    - 灰度数据计数：
      - `xh_users = 6`
      - `xh_canvases = 13`
      - `xh_assets = 6`
      - `xh_tasks = 99`
    - 当前灰度画布 owner 分布示例：
      - `usr-admin = 13`
  - 额外发现：
    - 使用 `HEAD` 探测灰度 `/` 与 `/admin` 会返回 `404`，但 `GET` 正常返回 `200`；后续运维 smoke 应以 `GET` 为准，避免误报。
  - 后续追加加固：
    - git commit: `fe57a76` `fix: harden postgres cold bootstrap paths`
    - release: `20260613-phase-a-hardening-gray-r2-fe57a76`
    - 收口点：
      - `readAdminDbPostgres()` 的空库 seed 不再走 destructive `writeAdminDbPostgres(...)`
      - 改为 `bootstrapDefaultAdminDbPostgres(...)` 基于 `insert ... on conflict do nothing` 的安全初始化
      - `writeAdminDbPostgres(...)` / `writeAuthDbPostgres(...)` 自身也要求显式 `allowFullReplace`
    - 灰度验收：
      - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260613-phase-a-hardening-gray-r2-fe57a76`
      - `db:migrate` => `{"ok":true,"applied":[],"skipped":8}`
      - `systemctl is-active xinghuan-canvas-next.service` => `active`
      - `systemctl is-active xinghuan-canvas-next-worker.service` => `active`
      - 运行中 dist 已确认：
        - `bootstrapDefaultAdminDbPostgres`
        - `writeAdminDbPostgres full replace requires explicit allowFullReplace`
        - `writeAuthDbPostgres full replace requires explicit allowFullReplace`
    - git commit: `6293798` `fix: prevent postgres file fallback resurrection`
    - release: `20260613-phase-a-hardening-gray-r3-6293798`
    - 收口点：
      - 为每个用户新增画布/资源库的 Postgres 迁移完成标记
      - 一旦某用户已进入 Postgres 主路径，后续数据库为空时不再回退导入旧文件
      - 避免“用户已在库中删空，但旧本地文件再次把画布/素材复活”
    - 灰度验收：
      - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260613-phase-a-hardening-gray-r3-6293798`
      - `db:migrate` => `{"ok":true,"applied":[],"skipped":8}`
      - `GET https://canvas-next.hhh2121.xyz/` => `200 text/html`
      - `GET https://canvas-next.hhh2121.xyz/admin` => `200 text/html`
      - `GET https://canvas-next.hhh2121.xyz/api/status` => `200 application/json`
      - `current_database()` => `xinghuan_canvas_gray`
      - 数据计数保持不变：
        - `xh_users = 6`
        - `xh_canvases = 13`
        - `xh_assets = 6`
        - `xh_tasks = 99`
      - 运行中 dist 已确认：
        - `canvasPostgresMigrationMarkerPath`
        - `resourcePostgresMigrationMarkerPath`
        - `hasRepositoryMigrationMarker`
  - 下一阶段再继续推进：
    - 剩余冷路径整库写入边界梳理
    - 生产数据持久化/回滚/验收流程补强
    - 真实灰度多用户并发验收
- `2026-06-13` Phase A 灰度多用户隔离真实验收与标准脚本已补齐：
  - 新增标准脚本：
    - `scripts/verify-multi-user-isolation.mjs`
    - `package.json` 新增 `verify:multi-user-isolation`
  - 覆盖项：
    - 管理员与成员双登录
    - 双方各自创建画布并校验列表隔离
    - 成员跨用户读取 / `PUT /api/canvas/:id` / `POST /api/canvas/:id/auto-save` 均被 `403 CANVAS_OWNERSHIP_MISMATCH` 拒绝
    - 双方各自创建资源并校验资源列表隔离
    - 成员访问后台 Provider 列表被拒绝
    - 临时验收画布与资源清理完成
  - 真实公网灰度验收：
    - `XINGHUAN_VERIFY_BASE_URL=https://canvas-next.hhh2121.xyz node scripts/verify-multi-user-isolation.mjs`
    - 返回 `ok: true`
    - 验收前后计数一致：
      - admin canvas `13 -> 13`
      - member canvas `0 -> 0`
      - admin image resources `6 -> 6`
      - member image resources `0 -> 0`
  - 灰度运行态复核：
    - `GET https://canvas-next.hhh2121.xyz/api/status` => `environment=gray`
    - `current -> /opt/apps/xinghuan-canvas-next/releases/20260613-phase-a-hardening-gray-r3-6293798`
    - 数据库计数：
      - `xh_users = 6`
      - `xh_canvases = 13`
      - `xh_assets = 6`
      - `xh_tasks = 99`
    - 迁移标记：
      - `usr-admin` / `usr-member` 的 `canvases` 与 `resources` 都已存在 `.postgres-migration-complete`
  - 结论：
    - Phase A 当前已经不只是本机契约通过，真实公网灰度下的画布隔离、资源隔离、跨用户拒绝和数据清理也都已通过。
  - 下一环节：
    - 推进“生产数据备份 / 回滚 / 放行前快照流程”的标准化
    - 再补“同账号双标签 / 双设备”的版本冲突验收，为 Phase B 做入口
- `2026-06-13` 发布前快照与回滚基线 Runbook 已落档并通过灰度实跑：
  - 新增：
    - `scripts/capture-release-preflight.mjs`
    - `package.json` 新增 `verify:release-preflight`
    - `ops/release-preflight-snapshot-runbook-2026-06-13.md`
  - 灰度服务器实跑结果：
    - `baseUrl = https://canvas-next.hhh2121.xyz`
    - `currentReleaseTarget = /opt/apps/xinghuan-canvas-next/releases/20260613-phase-a-hardening-gray-r3-6293798`
    - `current_database() = xinghuan_canvas_gray`
    - 计数快照：
      - `xh_users = 6`
      - `xh_canvases = 13`
      - `xh_assets = 6`
      - `xh_tasks = 99`
      - `xh_sessions = 57`
    - 服务状态：
      - `xinghuan-canvas-next.service = active`
      - `xinghuan-canvas-next-worker.service = active`
  - 结论：
    - 灰度发版前的数据库目标、release 指针、核心数据量和服务状态，已经有统一脚本可以直接采集，不需要再靠临时命令拼接。
  - 下一步：
    - 把这份快照作为灰度放行和正式放行的固定前置动作
    - 再继续推进 Phase B 的同账号双标签版本冲突验收
- `2026-06-13` Phase B 第一批画布 revision 冲突防护已完成灰度发布与真实验收：
  - 新增：
    - `apps/api/db/009_canvas_revision.sql`
    - `scripts/verify-canvas-revision-conflict.mjs`
    - `ops/phase-b-canvas-revision-gray-2026-06-13.md`
  - 后端收口：
    - `xh_canvases` 新增 `revision`
    - `GET /api/canvas/:id` 返回 revision
    - `PUT /api/canvas/:id` 保存成功后递增 revision
    - stale revision 保存返回 `409 CANVAS_REVISION_CONFLICT`
    - `PATCH /api/canvas/:id/name` 同步递增 revision
    - Postgres 模式下 `/api/canvas/:id/auto-save` 改为只落本地快照，不再重复写库
    - 同时补回 `/auto-save` 的 owner 校验，避免跨用户绕过
  - 前端收口：
    - 画布主保存链路跟踪当前 revision
    - revision 冲突后阻断继续自动保存，并提示刷新后再编辑
    - 发送节点/素材到目标画布时也带上目标 revision
  - 灰度发布：
    - `r1 = 20260613-phase-b-canvas-revision-gray-r1`
      - `009_canvas_revision.sql` 已成功应用
      - revision 验收通过
      - 发现回归：跨用户 `/auto-save` 丢失 owner 校验
    - `r2 = 20260613-phase-b-canvas-revision-gray-r2`
      - 补回 `/auto-save` owner 校验
      - `current -> /opt/apps/xinghuan-canvas-next/releases/20260613-phase-b-canvas-revision-gray-r2`
  - 真实公网灰度验收：
    - `npm run verify:canvas-revision-conflict`
      - `initialRevision = 1`
      - `savedRevision = 2`
      - `postAutoSaveRevision = 2`
      - stale write => `409 CANVAS_REVISION_CONFLICT`
    - `npm run verify:multi-user-isolation`
      - `ok = true`
      - 画布隔离 / 资源隔离 / 跨用户 `GET/PUT/auto-save` 拒绝 / 临时数据清理 全部通过
    - `verify:release-preflight`
      - `currentReleaseTarget = /opt/apps/xinghuan-canvas-next/releases/20260613-phase-b-canvas-revision-gray-r2`
      - `database = xinghuan_canvas_gray`
      - `counts = users:6 / canvases:13 / assets:6 / tasks:99 / sessions:63`
  - 结论：
    - Phase B 第一批已经在灰度实链上证明：同一画布的旧 revision 不会再静默覆盖新保存。
    - 同时确认 Phase A 的多用户隔离没有被这一轮破坏。
  - 下一步：
    - 继续把 revision 机制推广到资源库和后台关键配置
    - 再补“同账号双标签/双设备”的可视化并发验收
- `2026-06-13` Phase B 第二批资源库 revision 冲突防护已完成本地与灰度验收：
  - 新增：
    - `apps/api/db/010_resource_revision.sql`
    - `scripts/verify-resource-revision-conflict.mjs`
    - `ops/phase-b-resource-revision-gray-2026-06-13.md`
  - 后端收口：
    - `xh_resource_categories` / `xh_assets` 新增 `revision`
    - 资源分类重命名、删除支持 `expectedRevision`
    - 资源条目更新、删除支持 `expectedRevision`
    - stale resource/category 写入统一返回 `409 RESOURCE_REVISION_CONFLICT`
    - 分类删除时，同步给受影响资源清空 `categoryId` 并递增资源 `revision`
  - 前端收口：
    - 资源库分类/条目操作都随请求携带当前 `revision`
    - 遇到 `RESOURCE_REVISION_CONFLICT` 时自动刷新资源库，并提示用户基于最新状态重试
    - `touch` 类操作也统一走 revision 链路，避免静默覆盖 `favorite/tags/category`
  - 本地验收：
    - `npm run type-check -w @xinghuan/api`
    - `npm run type-check -w @xinghuan/web`
    - `npm run build:single-port`
    - `npm run verify:resource-revision-conflict`
    - `npm run verify:canvas-revision-conflict`
  - 本地 file-mode 补正：
    - `/api/canvas/:id/auto-save` 在 file-mode 下改为只写快照文件，不再误走主保存链路
    - 快照写入时继承当前画布 revision，保证 `postAutoSaveRevision` 不被旧 payload 回写成 `1`
    - 当前 `verify:multi-user-isolation` 在 file-mode 仍不代表真实多用户边界，正式判定以 Postgres 灰度验收为准
  - 灰度发布：
    - release: `20260613-phase-b-resource-revision-gray-r1`
    - `current -> /opt/apps/xinghuan-canvas-next/releases/20260613-phase-b-resource-revision-gray-r1`
    - `db:migrate` 应用：`010_resource_revision.sql`
  - 真实公网灰度验收：
    - `verify-resource-revision-conflict`
      - 分类与资源初始 `revision = 1`
      - 首次写入后 `revision = 2`
      - stale update/delete 全部返回 `409 RESOURCE_REVISION_CONFLICT`
    - `verify-canvas-revision-conflict`
      - `postAutoSaveRevision = 2`
      - stale save => `409 CANVAS_REVISION_CONFLICT`
    - `verify-multi-user-isolation`
      - `ok = true`
      - 管理员/成员双登录、画布隔离、资源隔离、跨用户拒绝全部通过
  - 结论：
    - 资源库已经具备和画布同级别的 revision 并发防护
    - 本地 file-mode 的 auto-save 行为已与 Postgres 模式对齐，不会再把旧 revision 写回画布快照
- `2026-06-13` Phase B 第三批后台关键设置 revision 冲突防护已完成灰度验收：
  - 新增：
    - `apps/api/db/011_admin_settings_revision.sql`
    - `scripts/verify-admin-settings-revision-conflict.mjs`
    - `ops/phase-b-admin-settings-revision-gray-2026-06-13.md`
  - 后端收口：
    - `/api/admin/assistant/settings` PATCH 支持 `revision`
    - `/api/admin/system` GET 返回 `taskQueueSettingsRevision` / `taskQueueSettingsUpdatedAt`
    - `/api/admin/system` PATCH 支持 `revision`
    - stale 配置写入统一返回 `409 ADMIN_SETTINGS_REVISION_CONFLICT`
  - 后台收口：
    - AI 助手配置保存附带 `revision`
    - 系统并发配置保存附带 `revision`
    - 冲突时自动刷新最新配置，并提示管理员基于最新版本重试
  - 本地验收：
    - `npm run type-check -w @xinghuan/api`
    - `npm run type-check -w @xinghuan/admin`
    - `npm run build:single-port`
    - `npm run verify:admin-assistant-settings-save-contract`
    - `npm run verify:admin-api-client-contract`
    - `npm run verify:admin-readonly-panels-contract`
  - 灰度发布：
    - release: `20260613-phase-b-admin-settings-revision-gray-r1`
    - `current -> /opt/apps/xinghuan-canvas-next/releases/20260613-phase-b-admin-settings-revision-gray-r1`
    - `db:migrate` 应用：`011_admin_settings_revision.sql`
  - 真实公网灰度验收：
    - `verify:admin-settings-revision-conflict`
      - `ok = true`
      - AI 助手配置 stale save => `409 ADMIN_SETTINGS_REVISION_CONFLICT`
      - 任务并发配置 stale save => `409 ADMIN_SETTINGS_REVISION_CONFLICT`
    - `verify:resource-revision-conflict`
      - `ok = true`
    - `verify:canvas-revision-conflict`
      - `ok = true`
    - `verify:multi-user-isolation`
      - `ok = true`
  - 结论：
    - Phase B 的后台关键设置版本化保存已经完成实链收口
    - 当前 Phase B 已覆盖画布、资源库、AI 助手配置、任务并发配置四类核心并发写入
- `2026-06-15` Phase C 第一批会话治理已完成灰度与生产发布：
  - 新增：
    - `apps/api/db/012_session_governance.sql`
    - `scripts/verify-admin-session-governance.mjs`
    - `ops/phase-c-session-governance-release-2026-06-15.md`
  - 后端收口：
    - `xh_sessions` 增加 `last_seen_at` / `ip` / `user_agent` / `revoked_at`
    - 登录时写入会话来源信息
    - 鉴权请求按节流刷新 `lastSeenAt`
    - `/api/admin/sessions` 返回后台会话列表
    - `/api/admin/sessions/:id/revoke` 支持强制下线
  - 后台收口：
    - 用户页新增“活跃会话”表
    - 可查看账号、角色、最近活跃、IP、客户端、状态
    - 可对非当前会话执行“强制下线”
  - 本地验收：
    - `npm run type-check -w @xinghuan/api`
    - `npm run type-check -w @xinghuan/admin`
    - `npm run verify:admin-users-panel-contract`
    - `npm run build:single-port`
  - 灰度发布：
    - release: `20260615-phase-c-session-governance-gray-r1`
    - `db:migrate` 应用：`012_session_governance.sql`
    - `verify:admin-session-governance = ok`
    - `verify:multi-user-isolation = ok`
  - 生产发布：
    - release: `20260615-phase-c-session-governance-prod-r1`
    - `db:migrate` 应用：`012_session_governance.sql`
    - `verify:admin-session-governance = ok`
    - `verify:multi-user-isolation = ok`
  - 结论：
    - Phase C 已完成第一批“会话治理”落地
    - 但 Phase C 尚未完成，CSRF 与登录限流仍是后续必须继续推进的项
- `2026-06-15` Phase C 第二批 CSRF 同源防护已完成灰度与生产发布：
  - 新增：
    - `scripts/verify-csrf-origin-guard.mjs`
    - `ops/phase-c-csrf-origin-release-2026-06-15.md`
  - 后端收口：
    - 所有 `/api/*` 下危险写请求统一进入同源来源校验
    - 优先校验 `Origin`，回退 `Referer`，再回退 `Sec-Fetch-Site`
    - 登录、登出、后台写操作、画布写入、资源写入、生成代理提交链路全部纳入
  - 验收脚本收口：
    - 常用验收脚本补上 `Origin` 头，适配 Node fetch 环境
  - 本地验收：
    - `npm run type-check -w @xinghuan/api`
    - `npm run build:single-port`
  - 灰度发布：
    - release: `20260615-phase-c-csrf-origin-gray-r1`
    - `db:migrate`: `applied=[] skipped=12`
    - `verify:csrf-origin-guard = ok`
    - `verify:admin-session-governance = ok`
    - `verify:multi-user-isolation = ok`
  - 生产发布：
    - release: `20260615-phase-c-csrf-origin-prod-r1`
    - `db:migrate`: `applied=[] skipped=12`
    - 公网 `verify:csrf-origin-guard = ok`
    - 公网 `verify:multi-user-isolation = ok`
    - 会话治理公网复验遇到 TLS `ECONNRESET` 边缘抖动，随后用服务器本机 `127.0.0.1:18100` 做等价校验，结果 `ok = true`
  - 结论：
    - Phase C 目前只剩“登录限流与失败计数”尚未落地
- `2026-06-15` Phase C 第三批登录限流与失败计数已完成本地实现与验收：
  - 新增：
    - `apps/api/db/013_login_rate_limit.sql`
    - `scripts/verify-login-rate-limit.mjs`
    - `ops/phase-c-login-rate-limit-local-validation-2026-06-15.md`
  - 后端收口：
    - `AuthDb` 新增 `loginAttempts` 结构，file-mode 与 PostgreSQL 同步支持失败计数
    - 登录接口按 `账号 + IP + scope(member/admin)` 维度计数
    - 连续失败窗口：`10 分钟`
    - 连续失败阈值：`5 次`
    - 封禁时长：`15 分钟`
    - 成功登录后自动清除对应失败计数
    - PostgreSQL 新增 `xh_login_attempts` 表与索引
  - 前端收口：
    - 后台登录页补充 `LOGIN_RATE_LIMITED` 明确提示
    - 画布登录页补充限流错误提示
  - 本地验收：
    - `npm run type-check -w @xinghuan/api`
    - `npm run type-check -w @xinghuan/admin`
    - `npm run type-check -w @xinghuan/web`
    - `npm run build:single-port`
    - `node scripts/verify-login-rate-limit.mjs`
    - `node scripts/verify-csrf-origin-guard.mjs`
    - `node scripts/verify-admin-session-governance.mjs`
  - 边界说明：
    - 生产尚未发布
- `2026-06-15` Phase C 第三批登录限流与失败计数已完成灰度发布与实链验收：
  - 灰度发布：
    - release: `20260615-phase-c-login-rate-limit-gray-r1`
    - `current -> /opt/apps/xinghuan-canvas-next/releases/20260615-phase-c-login-rate-limit-gray-r1`
    - `db:migrate` 应用：`013_login_rate_limit.sql`
    - `xinghuan-canvas-next.service = active`
    - `xinghuan-canvas-next-worker.service = active`
  - 灰度本机验收：
    - `CSRF = ok`
    - `member login rate limit = ok`
    - `admin login rate limit = ok`
    - `session revoke chain = ok`
  - 结论：
    - Phase C 三项能力目前已在灰度收口：
      - 会话治理
      - CSRF 同源防护
      - 登录限流与失败计数
- `2026-06-15` Phase C 第三批登录限流与失败计数已完成生产发布与本机实链验收：
  - 生产发布：
    - release: `20260615-phase-c-login-rate-limit-prod-r1`
    - `current -> /opt/apps/xinghuan-canvas/releases/20260615-phase-c-login-rate-limit-prod-r1`
    - `db:migrate` 应用：`013_login_rate_limit.sql`
    - `xinghuan-canvas.service = active`
    - `xinghuan-canvas-worker.service = active`
  - 生产本机验收：
    - `CSRF = ok`
    - `member login rate limit = ok`
    - `admin login rate limit = ok`
    - `session revoke chain = ok`
  - 结论：
    - Phase C 已完整上线：
      - 会话治理
      - CSRF 同源防护
      - 登录限流与失败计数
    - 多用户正式化方案可进入 Phase D
- `2026-06-16` 生成库素材访问与本地验收链已完成收口：
  - 生成功能收口：
    - 后端新增生成库素材访问层，统一返回 `filename / previewUrl / downloadUrl / openUrl / canDownload / isExpired`
    - 新增生成库内容路由：
      - `GET /api/materials/generation-library/:id/content?disposition=inline`
      - `GET /api/materials/generation-library/:id/content?disposition=attachment`
    - 前端生成库抽屉补齐：
      - 图片/视频预览大图
      - 下载按钮
      - 预览优先使用 `previewUrl`
      - 下载走 `downloadUrl`
  - 契约验证新增：
    - `node scripts/verify-generation-library-material-access-contract.mjs`
    - `node scripts/verify-generation-library-preview-contract.mjs`
    - `node scripts/verify-generation-library-and-admin-assistant-layout.mjs`
  - 本地浏览器实测：
    - gray 本地入口 `http://127.0.0.1:18200/`
    - 管理员登录正常
    - 图片预览正常
    - 视频预览正常
    - 图片下载正常
    - 视频下载正常
  - 验收链收口：
    - `npm run verify:single-port = ok`
    - `npm run verify:node-acceptance-matrix = ok`
    - `npm run verify:canvas-node-render-smoke = ok`
    - `npm run verify:local-acceptance-chain = ok`
  - 验收脚本治理：
    - 一批旧脚本补齐 same-origin `Origin / Referer`，适配 Phase C 之后的 CSRF 规则
    - `verify-task-payload-api` 已对齐当前 `/api/admin/tasks` 分页结构
    - `verify-runninghub-workflow-contract` 已对齐当前后台组件拆分后的真实入口
  - 结论：
    - 生成库素材查看/下载链路已具备稳定验收闭环
    - 本地单端口验收链当前已重新恢复全绿
## 2026-06-18

### 多任务生成状态、产物追加、GRSAI 超时统一与图像处理节点素材输入修复

目标:

- 修复图像/视频节点在“生成数量 > 1”时只能稳定看到单一任务状态、单一产物的问题。
- 修复 GRSAI 图像任务超时不跟随任务配置、仍被局部内置超时截断的问题。
- 修复部分图像处理节点已连接上游素材但运行时报 `NOT_FOUND` / 输入丢失的问题。

变更:

- 前端节点运行态：
  - `apps/web/src/components/nodes/ImageNode.tsx`
  - `apps/web/src/components/nodes/VideoNode.tsx`
  - 新增 `taskRuns` 子任务运行态
  - 多任务并发提交时按 `batchIndex` 跟踪每个子任务的：
    - `taskId`
    - `status`
    - `progress`
    - `outputCount`
    - `error`
    - `startedAt / finishedAt`
- 前端产物聚合：
  - 图像/视频节点成功子任务会把产物增量追加进 `imageUrls / videoUrls`
  - 不再因后续子任务失败而清空已成功产物
- 前端运行卡片：
  - `apps/web/src/components/nodes/NodeRuntimeCard.tsx`
  - 运行卡片新增子任务列表展示
- 图像处理节点输入链路：
  - `apps/web/src/components/nodes/ImageOpFrame.tsx`
  - 改为使用统一 `useUpstreamMaterials` 聚合上游图像
  - 统一解析首张可用上游图片，避免处理节点自己手搓采集逻辑造成漏图
- Worker 超时统一：
  - `apps/worker/src/worker.ts`
  - GRSAI 图像 adapter 现在会读取：
    - `task.payload.timeoutMs`
    - `task.payload.maxPollMs`
    - `task.payload.pollTimeoutMs`
    - `task.payload.pollIntervalMs`
  - 不再固定落到默认 `120000ms`
- 新增本轮契约脚本：
  - `scripts/verify-image-node-multi-task-contract.mjs`
  - `scripts/verify-video-node-multi-task-contract.mjs`
  - `scripts/verify-node-runtime-card-task-runs-contract.mjs`
  - `scripts/verify-generation-timeout-unification.mjs`
  - `scripts/verify-image-op-upstream-material-contract.mjs`

验证:

- `node scripts/verify-image-node-multi-task-contract.mjs = ok`
- `node scripts/verify-video-node-multi-task-contract.mjs = ok`
- `node scripts/verify-node-runtime-card-task-runs-contract.mjs = ok`
- `node scripts/verify-generation-timeout-unification.mjs = ok`
- `node scripts/verify-image-op-upstream-material-contract.mjs = ok`
- `npm run build -w @xinghuan/web = ok`
- `npm run build -w @xinghuan/api = ok`

影响:

- 图像/视频节点现在具备多任务子状态展示基础，后续灰度可直接核对每个子任务的进行态与结束态。
- 多任务成功返回的产物会以追加方式进入节点产物数组，为输出素材节点继续向下游聚合打通基础。
- GRSAI 图像生成不会再优先被 worker 里的固定 120 秒超时截断。
- 图像处理节点不再依赖自己单独扫描上游节点字段，素材输入链路与全局聚合 hook 对齐。

风险:

- 本轮当前完成的是本地实现与构建验证，还未完成灰度实链验收。
- 子任务列表 UI 当前是轻量展示，若后续要做更强的视觉层级或批量取消能力，需要再补一轮交互设计。
- 其他协议虽然已开始按统一规则审查，但灰度仍需重点复验视频类和 async image 类是否仍有遗漏硬编码 timeout。

下一步:

- 将本批改动提交，执行 `codegraph sync`，恢复干净工作树。
- 推送灰度并做真实验收：
  - 图像生成数量 > 1
  - 视频生成数量 > 1
  - GRSAI timeout 跟随配置
  - 上传图像 -> 尺寸调整链路正常

### 后台账号分组、备注治理、账号删除与任务发起人可见性已完成本地收口

目标:

- 为后台账号体系补齐“分组、备注、安全删除、任务归属可见性”这一批基础治理能力。
- 让环境同步后的账号数据不再丢失分组与备注信息。
- 将本轮实现与验收结果落入正式台账，避免只停留在临时对话和未提交工作树。

变更:

- 新增数据库与鉴权域基础结构：
  - `apps/api/db/015_user_groups_and_user_notes.sql`
  - 新增 `xh_user_groups` 表
  - 为 `xh_users` 增加 `group_id` 与 `remark` 字段
- 后端管理接口扩展：
  - `GET/POST/PATCH/DELETE /api/admin/user-groups`
  - `POST/PATCH/DELETE /api/admin/users` 支持分组、备注与账号删除
  - `/api/admin/tasks` 返回发起账号的备注、名称、邮箱、分组与删除态
- 原子约束补强：
  - 删除账号时在事务内校验最后一个管理员约束
  - 删除用户组时在事务内阻止删除仍被用户引用的分组
- 环境同步链路补强：
  - `upsertEnvironmentSyncUser()` 保留 `groupId` / `remark`，避免跨环境同步后丢字段
- 后台 UI 收口：
  - 用户页新增“用户组管理”面板
  - 支持新建/编辑/删除分组
  - 支持为账号设置分组、编辑备注、删除账号
  - 任务页新增“发起账号”列，展示备注优先、名称/邮箱回退、分组辅助信息
- 新增/更新契约脚本：
  - `scripts/verify-admin-user-groups-contract.mjs`
  - `scripts/verify-admin-users-panel-contract.mjs`
  - `scripts/verify-admin-task-panel-contract.mjs`

验证:

- `node scripts/verify-admin-user-groups-contract.mjs = ok`
- `node scripts/verify-admin-users-panel-contract.mjs = ok`
- `node scripts/verify-admin-task-panel-contract.mjs = ok`
- `npm run build -w @xinghuan/api = ok`
- `npm run build -w @xinghuan/admin = ok`
- `codegraph sync = ok`
- `node scripts/db-migrate.mjs` 本地未执行成功，原因是当前 shell 缺少数据库配置：`DATABASE_NOT_CONFIGURED`

影响:

- 后台账号现在具备基础组织治理能力，可以按项目组做分组和备注管理。
- 任务列表能够直接看到是谁发起了任务，便于排障、追责和运营沟通。
- gray / production 之间做账号同步时，分组与备注不会再被同步链路静默丢弃。

风险:

- 当前账号删除仍沿用既有 schema 的外键语义：任务与审计保留为 `SET NULL`，部分用户拥有的数据仍按既有所有权关系级联清理。后续若要做“账号停用替代删除”或“软删除保留历史归属”，需要单独补设计。
- 本地无法直接跑数据库迁移脚本，数据库层最终行为仍需在带环境变量的 gray / production 或联调环境复核。

下一步:

- 将本批改动提交入库，并在后续 gray 发布时补真实联调与放行记录。
- 如需继续推进环境同步页面体验，可把“账号分组”和“任务归属筛选”继续纳入后台运营能力设计。

## 2026-06-17
