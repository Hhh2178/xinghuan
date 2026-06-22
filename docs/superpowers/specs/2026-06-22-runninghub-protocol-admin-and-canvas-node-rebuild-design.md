# RunningHub Protocol Admin And Canvas Node Rebuild Design

## Background

2026-06-19 的 RunningHub 工作台已经打通了目录条目、运行目标同步和画布节点自动展开参数区，但真实维护与灰度验证暴露出 5 个断点：

1. RH 分析工作台缺少 `requestExample` / `responseExample` 输入，管理员只能靠备注猜字段。
2. 后端草案生成没有消费 `requestExample.nodeInfoList`，导致输入槽仍常常停留在空白草稿态。
3. RH 任务链路仍把 `instanceType` 默认写成 `plus`，会把“未指定实例规格”和“明确要求 plus”混在一起。
4. AI App 与 Workflow 的识别规则混乱，`call-api/api-detail/...?...`、纯数字 ID、`workflow-xxxx` 风格 ID 会被错误归类或混合保存。
5. 当前目录、编辑器、画布节点、worker 同时混用了 RunningHub 新旧两套协议，容易生成 `kind=workflow` 但 `runTargetId/pageId` 实际更像 AI App 的混合态条目。

## Evidence Summary

已确认的外部协议证据：

- RunningHub 官方 AI App 文档页 `call-api/api-detail/1978404642654670849?apiType=4` 对应的提交方式是：
  - `POST /openapi/v2/run/ai-app/{id}`
  - `Authorization: Bearer <API_KEY>`
  - body 里主要提交 `nodeInfoList`
- 该文档不是 Workflow 文档，因此这类链接必须优先识别为 `app`。
- RunningHub 旧文档索引页仍可见旧接口：
  - `POST /task/openapi/ai-app/run`
  - `POST /task/openapi/outputs`
- 当前代码中的 AI App 分支仍主要走旧接口；Workflow 分支已在走 `openapi/v2` 风格。这说明系统当前确实处于新旧协议混用状态。

已确认的内部根因证据：

- `parseRunningHubRef()` 仅能可靠识别 `/run/ai-app/{id}` 与 `/run/workflow/{id}`，对 `call-api/api-detail/...?...` 无法识别。
- 纯数字 ID 当前会被默认归为 `workflow`，这是错误源之一。
- 分析工作台当前直接把用户所在 tab 当成最终 `kind` 提交分析，如果用户在错误区域粘贴了另一类文档，就会生成错误类型草案。
- 画布节点和目录条目中已出现 `pageId/webappId/workflowId/presetCatalogId` 同时指向不同体系的混合态样本，证明当前仅靠文案提醒不足以防错。

## This Round Goal

把 RH 条目分析、目录治理、画布节点和 worker 提交流程重新对齐为“可识别、可解释、可自动纠偏”的协议链路：

- 分析面板允许直接提交请求示例和响应示例。
- 后端优先从 `requestExample` 自动提取 `runTargetId` 与 `nodeInfoList` 草案。
- `runTargetId` 出现表单值与示例值不一致时，给出明确预警。
- RH 任务提交不再默认落成 `instanceType=plus`。
- AI App 与 Workflow 必须在前后端都能明确区分，不允许继续生成混合态目录。
- 如果用户把 AI App 错填进 Workflow 区域，或反过来填错，系统应自动切换到正确分类，并给出明确反馈。

## Non-Goals

- 不在这一轮引入新的 RunningHub Provider 类型。
- 不在这一轮重做整个画布节点的视觉设计，只修正与 RH 类型、字段与协议相关的行为。
- 不在没有证据的前提下删除旧接口代码；旧接口只允许作为兼容兜底，不能继续作为主协议。

## Scope

### 1. Admin Workspace Analyze Panel

- 文件：`apps/admin/src/admin-runninghub-workspace.tsx`
- 新增分析输入：
  - `requestExample`
  - `responseExample`
- 调用 `/api/admin/runninghub/analyze` 时把两段示例一起提交。
- 面板文案明确“请求示例/响应示例/备注线索”共同参与结构化草案生成。
- 分析结果新增“识别结果”区块：
  - `detectedKind`
  - `detectedTargetId`
  - `reason`
  - `autoSwitched`
- 如果当前 tab 与识别结果不一致：
  - 自动切换到正确 tab
  - 保留用户原有输入内容
  - 显示明确提示，如“检测到这是 AI App，已自动切换到 AI 应用区域”

### 2. Shared RunningHub Target Detection

- 文件：
  - `apps/api/src/server.ts`
  - `apps/api/src/runninghub-catalog.ts`
  - 如有必要补充一个独立 helper 文件，供 admin analyze、catalog normalize、editor save 复用
- 新增统一识别逻辑，输入可包含：
  - `docUrl`
  - `sourceUrl`
  - `runTargetId`
  - `pageId`
  - `requestExample`
- 识别规则至少覆盖：
  - `call-api/api-detail/{id}?apiType=4` => `app`
  - `/openapi/v2/run/ai-app/{id}` => `app`
  - `/run/ai-app/{id}` => `app`
  - `/openapi/v2/run/workflow/{id}` => `workflow`
  - `/run/workflow/{id}` => `workflow`
  - `workflow-xxxx` 风格 ID => `workflow`
  - 纯数字 ID => 不再直接默认归类；如缺少其他线索则标记为“仅识别出 targetId，类型待确认”
- 输出统一结构：
  - `kind`
  - `targetId`
  - `confidence`
  - `reason`
  - `shouldSwitch`

### 3. Backend Analyze Draft

- 文件：`apps/api/src/server.ts`
- 新增示例解析辅助逻辑：
  - 解析 JSON 对象
  - 从 `requestExample` 提取 `runTargetId / webappId / workflowId / pageId`
  - 从 `requestExample.nodeInfoList` 生成 `fields`
  - 根据字段草案补一份基础 `parameterSchema`
- 分析阶段不再盲信传入的 `kind`，而是要结合识别结果决定：
  - 最终条目类型
  - 最终 `runTargetId`
  - 是否建议或执行自动切换
- 当表单输入的 `runTargetId` 与 `requestExample` 内提取到的目标不一致时，向 `warnings` 写入人工确认提示。
- 若示例 JSON 非法或没有 `nodeInfoList`，也要明确告警，而不是静默回退。
- 若用户当前区域与识别结果不一致，分析结果中要携带可供前端展示的自动切换说明。

### 4. Editor Save / Apply / Enable Validation

- 文件：
  - `apps/api/src/server.ts`
  - `apps/admin/src/admin-runninghub-item-editor.tsx`
  - `apps/admin/src/admin-runninghub-workspace.tsx`
- 保存条目、应用分析草案、启用条目时，都要做同一套强校验：
  - `kind=app`
    - 必须是 app 风格 target
    - 禁止残留 `workflowId`
    - `runTargetId` 归一到 app 的真实提交目标
  - `kind=workflow`
    - 必须是 workflow 风格 target
    - 禁止混入 app 风格 target
- 前端若能明确识别为另一类型，应先自动切换；后端仍需再做一次硬校验兜底。
- 如果仍然出现类型不一致，后端返回可读错误，不允许落库。
- 原来的 warning 机制升级为：
  - 能自动纠偏的，直接切换并提示
  - 不能确定的，警告并要求人工确认
  - 明确冲突的，阻止保存/启用

### 5. Catalog Normalization And Display

- 文件：
  - `apps/api/src/runninghub-catalog.ts`
  - `apps/api/src/runninghub-execution-descriptor.ts`
  - `apps/web/src/services/runninghubCatalog.ts`
- 目录归一后，条目内部字段约束为：
  - `kind=app`
    - `runTargetId` 为 AI App 的真实运行目标
    - `appId` 可保留为同值或兼容映射
    - `workflowId` 为空
  - `kind=workflow`
    - `runTargetId` 为 workflow 提交目标
    - `workflowId` 为 workflow 提交目标或与其等价的规范值
- `pageId` 继续允许作为后台辅助字段存在，但不再要求画布用户理解或维护它。
- 目录列表和编辑器要清晰展示当前条目已被识别为 `AI 应用` 或 `工作流`，避免再次产生误解。

### 6. Canvas Node Adaptation

- 文件：`apps/web/src/components/nodes/RunningHubNode.tsx`
- 画布节点只消费规范化后的目录结果：
  - `kind`
  - `runTargetId`
  - `executionRules`
  - `fields`
- 画布节点不再依赖混合的 `webappId / workflowId / runTargetId` 猜测类型。
- 若目录条目处于非法混合态，节点加载时应给出清晰错误，而不是继续提交一个高概率失败的任务。

### 7. Worker Submit Protocol

- 文件：
  - `apps/worker/src/worker.ts`
  - `apps/api/src/server.ts`
- 去掉 `instanceType` 的默认 `plus`。
- 只有在用户或目录条目明确提供 `instanceType` 时，才把该字段写入 RH 提交 payload。
- AI App 主协议切换为官方 v2：
  - submit: `POST /openapi/v2/run/ai-app/{id}`
  - query: `POST /openapi/v2/query`
- Workflow 继续按 workflow 协议走 `openapi/v2`。
- 旧接口若保留，只能作为证据明确的兼容兜底，并在代码与日志里区分主协议与 fallback。

## UX Rules

### Auto Switch Rules

- 当输入内容能高置信识别为另一类型时：
  - 自动切换到正确分类
  - 保留输入
  - 展示切换原因
- 当只有 targetId，但缺少足够类型线索时：
  - 不自动切换
  - 提示“已识别目标 ID，但暂时无法确认是 AI App 还是 Workflow”
- 当输入内容彼此冲突时：
  - 例如 `docUrl` 指向 AI App，但手填了 `workflow-xxxx`
  - 不允许直接保存或启用
  - 错误信息需要明确指出冲突来源

### Field Ownership Rules

- `pageId / runTargetId / workflowId / appId` 的最终归一由后台负责。
- 管理员可以查看这些字段，但不应再要求画布节点用户理解或手工维护这组底层标识。
- 画布侧只暴露可执行的业务参数，不暴露协议分支判断负担。

## Expected Outcome

- 管理员可直接把 RunningHub 官方请求样例粘进工作台，得到初始 `fields` 草案。
- RH 条目里的 `runTargetId` 不再因为表单和示例混填而悄悄漂移。
- RH 工作台能把 AI App 与 Workflow 明确区分开，并在错填时自动切换到正确区域。
- 后端不会再保存 `kind` 与 `runTargetId/workflowId/pageId` 互相打架的混合态条目。
- 画布节点只消费规范化后的 RH 条目，不再自己猜测协议。
- 画布和队列链路对 `instanceType` 的语义回归为“显式才发送”。
- AI App 主协议切换到 RunningHub 官方 v2，减少因旧协议混用导致的灰度失败。

## Verification

- `npm run verify:runninghub-analyze-contract`
- `npm run verify:runninghub-workflow-contract`
- `npm run verify:runninghub-queue-governance-contract`
- 新增覆盖以下场景的验证：
  - `call-api/api-detail/...?...` 正确识别为 `app`
  - `/openapi/v2/run/ai-app/{id}` 正确识别为 `app`
  - `workflow-xxxx` 正确识别为 `workflow`
  - 纯数字 ID 在没有额外线索时不会被错误默认成 `workflow`
  - 错填区域时前端自动切换并保留内容
  - 保存/启用时混合态条目被后端阻止
