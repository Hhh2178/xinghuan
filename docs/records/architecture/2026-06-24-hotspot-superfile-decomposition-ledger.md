# Hotspot Superfile Decomposition Ledger - 2026-06-24

## 目的

这份台账用于记录当前仓库四个热点超级文件的职责、已拆分结果、下一步拆分方向与对应护栏，避免后续协作只看到“预算不能再涨”，却不知道应该把逻辑往哪里拆。

从 `2026-06-24` 起，这份台账继续承担 `1200+` watchlist 的入册职责；但后续真正的拆分顺序，不再只按行数排序，而按 `docs/governance/hotspot-risk-scorecard.md` 的多维评分排序。

## 热点文件总表

### `apps/api/src/server.ts`

- 当前职责：
  - HTTP 入口与路由装配
  - 部分 RunningHub / task / system handler
  - 请求解析、响应输出与部分运行态编排
- 已有下沉：
  - provider generation task service
  - 部分 sanitizer / session / lifecycle helper
  - `admin-runninghub-routes.ts`
  - `admin-system-settings-routes.ts`
  - `admin-queue-settings-routes.ts`
  - `admin-provider-routes.ts`
  - `api-response-adapters.ts`
- 下一步优先拆分：
  - provider key-pool / import-models residue
  - 其他稳定 admin 资源路由族
- 目标形态：
  - `server.ts` 只保留入口装配与高层编排
- 当前护栏：
  - `scripts/verify-file-hotspot-budgets.mjs`
  - `scripts/verify-api-admin-runninghub-route-split-contract.mjs`
  - `scripts/verify-api-system-settings-route-split-contract.mjs`
  - `scripts/verify-api-queue-settings-route-split-contract.mjs`
- 当前风险：
  - 新协议接入容易继续把解析、校验、运行态拼接堆回入口文件
- 当前进度：
  - `2026-06-24` 已将后台 RunningHub 条目管理路由分发层下沉到 `admin-runninghub-routes.ts`
  - 主文件继续保留入口装配、权限分流和底层 catalog/service 业务函数
  - `2026-06-24` 已将 `/api/admin/system` 的 system status / task queue settings handler 下沉到：
    - `apps/api/src/admin-system-routes.ts`
    - `apps/api/src/admin-system-response-adapter.ts`
  - 已补齐 contract：`scripts/verify-api-admin-system-route-split-contract.mjs`
  - 主文件继续保留入口装配、权限分流和系统能力依赖注入，不再直接承载 `/api/admin/system` 的请求体读取与响应拼装
  - `2026-06-24` 已继续把 system / queue settings 再下沉一层到：
    - `apps/api/src/admin-system-settings-routes.ts`
    - `apps/api/src/admin-queue-settings-routes.ts`
    - `apps/api/src/api-response-adapters.ts`
  - 已补齐 contract：
    - `scripts/verify-api-system-settings-route-split-contract.mjs`
    - `scripts/verify-api-queue-settings-route-split-contract.mjs`
  - `2026-06-24` 已继续把 admin system 兼容层压薄为装配壳，并把稳定 settings/config handler 再下沉到：
    - `apps/api/src/admin-system-routes.ts`
    - `apps/api/src/admin-assistant-settings-routes.ts`
  - 已补齐 contract：
    - `scripts/verify-api-admin-system-route-split-contract.mjs`
    - `scripts/verify-api-admin-assistant-settings-route-split-contract.mjs`
  - 主文件继续保留入口装配和高层依赖注入；`admin-system-routes.ts` 现在只负责 admin system 子路由分发
  - `2026-06-24` 已继续把稳定 provider CRUD / probe / fetch-models 路由下沉到：
    - `apps/api/src/admin-provider-routes.ts`
  - 已补齐 contract：
    - `scripts/verify-api-admin-provider-route-split-contract.mjs`
  - 主文件继续保留入口装配、高层依赖注入，以及 provider key-pool / import-models 等剩余内联分支
  - `2026-07-23` Phase 5 只在主文件增加 Canvas Run workflow 总览与监督设置 handler 的四项依赖注入；路由解析留在 `canvas-run-routes.ts`，解析/持久化编排留在 `canvas-run-service.ts` 与 repository，未把设置业务逻辑堆回 `server.ts`
  - 主文件当前仍只承担 Canvas Run handler 装配；下一步拆分优先级继续保持 provider key-pool / import-models residue

### `apps/worker/src/worker.ts`

- 当前职责：
  - 任务消费主循环
  - provider 执行编排
  - 部分 dispatch / cancel / failure normalization glue
- 已有下沉：
  - `worker-grsai-image-client.ts`
  - `worker-runninghub-client.ts`
  - `worker-runninghub-dispatch.ts`
  - `worker-task-store.ts`
  - `worker-cancel-sync.ts`
  - `worker-failure-glue.ts`
  - `worker-deferred-requeue.ts`
- 下一步优先拆分：
  - 其他零散运行态 glue
  - provider capability entry seam
- 目标形态：
  - `worker.ts` 只保留任务编排 glue
- 当前护栏：
  - `scripts/verify-file-hotspot-budgets.mjs`
  - `scripts/verify-worker-runninghub-runtime-second-stage-contract.mjs`
  - `scripts/verify-worker-runninghub-dispatch-split-contract.mjs`
  - `scripts/verify-worker-task-lifecycle-split-contract.mjs`
  - `scripts/verify-worker-cancel-sync-split-contract.mjs`
  - `scripts/verify-worker-failure-glue-split-contract.mjs`
  - `scripts/verify-worker-deferred-requeue-split-contract.mjs`
- 当前风险：
  - 新 provider 适配和异常口径很容易再次把协议细节堆回 worker 主文件
- 当前进度：
  - `2026-06-24` 已将 RunningHub key 优先级排序、实时可执行探测、redis 占位与释放逻辑下沉到 `worker-runninghub-dispatch.ts`
  - 主文件继续保留任务领取、执行、状态回写与 deferred/requeue 编排
  - `2026-06-24` 已将任务读取、状态写回、heartbeat/runtime patch、取消态探测下沉到 `worker-task-store.ts`
  - 已补齐 contract：`scripts/verify-worker-task-store-split-contract.mjs`
  - `2026-06-24` 已将取消后结果/错误丢弃、保留取消态与 failed writeback glue 下沉到 `worker-task-lifecycle.ts`
  - 已补齐 contract：`scripts/verify-worker-task-lifecycle-split-contract.mjs`
  - `2026-06-24` 已继续把取消同步与失败归一化再下沉一层到：
    - `apps/worker/src/worker-cancel-sync.ts`
    - `apps/worker/src/worker-failure-glue.ts`
  - 已补齐 contract：
    - `scripts/verify-worker-cancel-sync-split-contract.mjs`
    - `scripts/verify-worker-failure-glue-split-contract.mjs`
  - `2026-06-24` 已继续把 deferred / requeue glue 下沉到：
    - `apps/worker/src/worker-deferred-requeue.ts`
  - 已补齐 contract：
    - `scripts/verify-worker-deferred-requeue-split-contract.mjs`
  - 主文件继续保留 worker 主循环、provider 执行编排与高层 orchestration
  - `2026-06-24` 已继续把异步媒体轮询细节下沉到：
    - `apps/worker/src/worker-media-polling.ts`
  - 已补齐 contract：
    - `scripts/verify-worker-media-polling-split-contract.mjs`
  - 主文件继续保留 worker 主循环、provider / capability entry 与高层 orchestration
    - `worker.ts` 当前行数：`1505 -> 1476 -> 1248`

### `apps/web/src/components/nodes/RunningHubNode.tsx`

- 当前职责：
  - RH 节点 UI 组合
  - 参数区、进度、结果、错误文案
  - 节点运行态相关交互
- 已有下沉：
  - `apps/web/src/components/nodes/runninghubNodeHelpers.ts`
  - 部分 shared node helper
  - 节点相关 contract 脚本
- 下一步优先拆分：
  - 参数表单 section
  - progress / runtime display helper
  - output / error display helper
- 目标形态：
  - 节点组件保留页面壳和组合层
- 当前护栏：
  - `scripts/verify-file-hotspot-budgets.mjs`
  - `scripts/verify-runninghub-node-helper-split-contract.mjs`
  - `scripts/verify-runninghub-node-progress-contract.mjs`
  - `scripts/verify-runninghub-worker-and-label-contract.mjs`
- 当前风险：
  - 新的 RH 交互需求继续叠加时，UI、状态、请求辅助逻辑会再次粘成单块
- 当前进度：
  - `2026-06-24` 已将字段类型推断、options/defaultValue/displayLabel 提取、输出状态归一化、schema 计数、preset merge 与 remote nodeInfoList normalize 从主文件下沉到 `runninghubNodeHelpers.ts`
  - `2026-06-24` 已将条目/配置区与参数区继续下沉到：
    - `apps/web/src/components/nodes/RunningHubNodeConfigSection.tsx`
    - `apps/web/src/components/nodes/RunningHubNodeParamSection.tsx`
  - 已补齐 contract：`scripts/verify-runninghub-node-section-split-contract.mjs`
  - 主文件行数已降到 `1282 -> 1008`

### `apps/admin/src/admin-runninghub-workspace.tsx`

- 当前职责：
  - RH 工作台主布局
  - 协议编辑、key 管理、分析面板、表单汇总
  - 部分保存/校验交互
- 已有下沉：
  - `apps/admin/src/admin-runninghub-workspace-helpers.tsx`
  - 部分 contract 脚本
  - 工作台的部分 section 化整理
- 下一步优先拆分：
  - key 管理卡片区
  - 协议编辑区
  - 分析区与摘要区
  - service / save helper
- 目标形态：
  - 工作台文件保留布局、数据装配与 section 组合
- 当前护栏：
  - `scripts/verify-file-hotspot-budgets.mjs`
  - `scripts/verify-admin-runninghub-workspace-helper-split-contract.mjs`
  - `scripts/verify-runninghub-admin-empty-input-contract.mjs`
  - `scripts/verify-runninghub-key-pool-contract.mjs`
- 当前风险：
  - 后台功能继续扩展时，工作台会重新变回“所有 RH 能力都堆在一个页面文件里”
- 当前进度：
  - `2026-06-24` 已将草案 payload merge、key 池摘要/默认逻辑、分析预览与 drift summary 从主文件下沉到 `admin-runninghub-workspace-helpers.tsx`
  - 主文件行数已降到 `647`

## 1200+ source 文件 watchlist

这份 watchlist 用于覆盖“还没进入硬预算，但已经明显过大”的 source 文件。只要文件位于 `apps/`、`packages/`、`scripts/`，且达到 `1200+` 行，就必须出现在这里。

### 当前 watchlist

- `apps/web/src/components/Canvas.tsx`
  - 状态：超大组合层
  - 下一步：拆 `connect picker / context-menu view shell / remaining edit interactions`
  - 当前进度：
    - `2026-06-24` 已将画布加载/自动保存/发送后聚焦恢复下沉到 `apps/web/src/components/canvas/useCanvasPersistence.ts`
    - `2026-06-24` 已将连线平移模式快捷键与指针交互下沉到 `apps/web/src/components/canvas/useCanvasConnectionPanMode.ts`
    - `2026-06-24` 已将 controls / minimap / guides overlay 壳下沉到 `apps/web/src/components/canvas/CanvasFlowOverlays.tsx`
    - 已补齐 contract：`scripts/verify-canvas-section-split-contract.mjs`
    - `2026-06-24` 已将批量运行 glue、viewport hotkeys 与 cut overlay 壳继续下沉到：
      - `apps/web/src/components/canvas/useCanvasRuntime.ts`
      - `apps/web/src/components/canvas/useCanvasViewportHotkeys.ts`
      - `apps/web/src/components/canvas/CanvasOverlayLayer.tsx`
    - 已补齐 contract：
      - `scripts/verify-canvas-runtime-split-contract.mjs`
      - `scripts/verify-canvas-overlay-split-contract.mjs`
    - `2026-06-24` 已将 selection / context-menu / bulk reconnect 继续下沉到：
      - `apps/web/src/components/canvas/useCanvasSelectionMenus.ts`
      - `apps/web/src/components/canvas/useCanvasBulkReconnect.ts`
    - 已补齐 contract：
      - `scripts/verify-canvas-interaction-seam-contract.mjs`
    - `2026-06-24` 已将 send flow 业务层继续下沉到：
      - `apps/web/src/components/canvas/useCanvasSendFlow.ts`
    - 已补齐 contract：
      - `scripts/verify-canvas-send-flow-split-contract.mjs`
    - 主文件行数已降到 `3952`
- `apps/web/src/components/nodes/PoseMasterNode.tsx`
  - 状态：超大节点组件
  - 下一步：拆 `field schema / preview sections / runtime actions`
- `apps/web/src/components/nodes/ToolboxParamNode.tsx`
  - 状态：参数型节点壳与表单耦合过重
  - 下一步：拆 `param sections / material bindings / preview helpers`
- `apps/web/src/components/nodes/ImageEditModal.tsx`
  - 状态：模态 UI、编辑状态和动作耦合
  - 下一步：拆 `tool sections / modal state hooks / action services`
- `apps/web/src/components/nodes/DrawingBoardNode.tsx`
  - 状态：绘制节点内部状态与渲染堆叠
  - 下一步：拆 `board interactions / toolbar sections / persistence helpers`
- `apps/web/src/components/nodes/ImageNode.tsx`
  - 状态：图片节点预览、上传、编辑入口混合
  - 下一步：拆 `upload section / preview section / action helpers`
- `apps/web/src/components/nodes/PortraitMasterNode.tsx`
  - 状态：节点 UI 与配置逻辑过重
  - 下一步：拆 `preset sections / form helpers / output display`
- `apps/web/src/components/nodes/VideoNode.tsx`
  - 状态：视频节点运行态、预览与参数逻辑混合
  - 下一步：拆 `runtime panel / param sections / output helpers`
- `apps/web/src/components/nodes/LLMNode.tsx`
  - 状态：文本节点交互与运行态耦合
  - 下一步：拆 `prompt sections / runtime card / output display`
- `apps/web/src/components/nodes/OutputNode.tsx`
  - 状态：输出聚合、预览、导出逻辑集中
  - 下一步：拆 `preview sections / export helpers / runtime summary`
- `apps/web/src/data/portraitMasterOptions.ts`
  - 状态：超大静态数据文件
  - 下一步：按主题或能力拆分成多个 options registry 文件
- `apps/web/src/components/nodes/AudioNode.tsx`
  - 状态：音频参数、参考素材、Provider/Suno 运行态与结果预览混合；本轮因逐批任务恢复超过 1200 行
  - 当前行数：`1267`
  - 本轮下沉：`generationTaskResume.ts` 负责恢复描述符筛选、任务 ID 与结果去重
  - 下一步：拆 `provider config / reference material section / submit-poll runner / output preview`

### 最近已退出 watchlist

- `apps/admin/src/admin-api-settings-panel.tsx`

## 2026-07-28 Worker dispatch evidence

- `apps/worker/src/worker-operation-dispatch.ts` now owns the pure operation selection seam for Provider execution, output recovery and deterministic Canvas operations.
- `worker-task-operation.ts` delegates to the table without changing the existing `output_only` contract; `canvas-run-coordinator.ts` uses the same classifier for deterministic nodes and `resize`.
- Focused Worker and Canvas Run tests cover operation selection, cancellation signal passthrough and handler exclusivity; Worker type-check and hotspot governance pass.

## 2026-07-28 incremental evidence

- `2026-07-28` 已将 DrawingBoard 的持久化边界抽到 `apps/web/src/components/nodes/drawing-board-persistence.ts`。
  - 纯函数保证 `boardLayers` 与 legacy `boardElements` 始终从同一份可编辑图层快照生成，并在恢复到 group-only 数据时创建可编辑 fallback layer。
  - focused tests 覆盖图层顺序、group 排除和 group-only 恢复；节点视图仍保留交互与渲染职责，未改变既有字段名。
- `2026-07-28` 已将 API provider model import 的 merge/default normalization 从 `apps/api/src/server.ts` 下沉到 `apps/api/src/provider-model-import.ts`。
  - 新模块负责模型能力、能力标签、协议覆盖、slug、旧记录保留字段与新模型默认输入能力的归一化，并以 focused tests 固化“更新保留稳定字段、新增按 capability 提供默认值”的行为。
  - `server.ts` 现在只负责鉴权、请求解析、依赖注入、Postgres/文件持久化、审计与 HTTP 响应；provider model import 不再在主文件内维护逐条 merge 循环。
  - 下一步仍保持为 provider execution / remaining runtime glue 的独立 seam，避免把外部协议细节重新堆回入口文件。

- `apps/web/src/components/nodes/ToolboxParamNode.tsx` extracted its persisted parameter schema and multi-angle normalization into `apps/web/src/components/nodes/toolbox-param/toolbox-param-schema.ts`.
- The extraction preserves language, prompt-mode and batch-mode IDs, ordering, favorite patch shapes and custom-angle normalization; `toolbox-param-schema.test.ts` locks those boundaries.
- The component remains the composition shell for parameter sections, material bindings and preview helpers. Those seams remain separate follow-up work; no broad UI rewrite or renderer behavior change is implied.
- Hotspot budget and Web type-check passed after the extraction; the next safe seam is the parameter section, followed by material binding and preview helper extraction.

- `ToolboxParamNode.tsx` now delegates the multi-angle adjustment, angle-preset and output-setting controls to `toolbox-param/ToolboxMultiAngleParameterSection.tsx`; the component remains the composition shell for text supplements, favorites and runtime actions.
- The extracted section has a server-rendered focused test for the visible control contract; persisted patch keys continue to flow through the existing `updateMultiAngle` callback.
- Upstream image material binding is now isolated in `toolbox-param/toolbox-material-binding.ts`; direct, collection and first/last-frame inputs are covered, while non-image upload URLs are rejected.
- The multi-angle preview/drag surface is now isolated in `toolbox-param/ToolboxMultiAngleStage.tsx`; server-rendered coverage locks the accessible preview label, angle labels and clip gradient identity. Runtime action methods remain in the parent until their own seam is reviewed.
  - `2026-06-24` 已将 provider draft / assistant plan / input capability 等纯 helper 下沉到 `admin-api-settings-panel-helpers.ts`
  - 主文件行数：`1289 -> 1103`
  - 当前已退出 `1200+` watchlist，但后续仍建议继续拆 `provider groups / sections / save helpers`
- `apps/web/src/components/nodes/RHToolsNode.tsx`
  - `2026-06-24` 已按 `helpers -> sections -> view shells` 三层继续下沉到：
    - `rhToolsNodeHelpers.ts`
    - `RHToolsNodeParamSection.tsx`
    - `RHToolsNodeRuntimeSection.tsx`
    - `RHToolsNodeRunnerView.tsx`
    - `RHToolsNodeLauncherView.tsx`
  - 已补齐 contract：
    - `scripts/verify-rhtools-node-helper-split-contract.mjs`
    - `scripts/verify-rhtools-node-section-split-contract.mjs`
    - `scripts/verify-rhtools-node-view-split-contract.mjs`
  - 主文件行数：`1547 -> 1456 -> 1236 -> 870`
  - 当前已退出 `1200+` watchlist，下一步建议继续拆 `submit/poll service` 与 `launcher interaction hooks`
- `apps/web/src/components/ApiSettings.tsx`
  - `2026-06-24` 已按 `key sections -> outer sections -> cloud detail panel -> advanced provider detail panel` 四层继续下沉到：
    - `ApiSettingsAdvancedProviderDetailPanel.tsx`
    - `ApiSettingsComfyWorkflowPanel.tsx`
    - `ApiSettingsModelscopeLoraPanel.tsx`
  - 已补齐 contract：
    - `scripts/verify-api-settings-detail-panel-split-contract.mjs`
    - `scripts/verify-api-settings-advanced-provider-panel-split-contract.mjs`
  - 主文件行数：`2435 -> 1736 -> 1440 -> 590`
  - 当前已退出 `1200+` watchlist，下一步建议继续拆 `save helpers / backup actions / revealed key flow`
- `apps/web/src/components/nodes/RunningHubNode.tsx`
  - `2026-06-24` 已按 `helpers -> config section -> param section` 三层继续下沉到：
    - `runninghubNodeHelpers.ts`
    - `RunningHubNodeConfigSection.tsx`
    - `RunningHubNodeParamSection.tsx`
  - 已补齐 contract：
    - `scripts/verify-runninghub-node-helper-split-contract.mjs`
    - `scripts/verify-runninghub-node-section-split-contract.mjs`
    - `scripts/verify-runninghub-node-progress-contract.mjs`
  - 主文件行数：`1526 -> 1282 -> 1008`
  - 当前已退出 `1200+` watchlist，下一步建议继续拆 `runtime display / submit-poll service glue`

### 已在硬预算治理中的文件

- `apps/api/src/server.ts`
- `apps/worker/src/worker.ts`

说明：

- 这些文件已经在上方“热点文件总表”中单独治理，所以这里不重复写完整正文。
- 如果后续新的 `1200+` source 文件出现，本轮必须同步把它补进 watchlist；否则 `npm run verify:hotspot-watchlist-contract` 会失败。

## 使用规则

- 当热点预算发生变化时，必须同步更新这份台账。
- 当某次改动继续触碰上述热点文件时，发布记录或 daily 台账里必须说明：
  - 这次新增逻辑落到了哪里
  - 哪些职责仍留在主文件
  - 下一步拆分目标是什么
- 不允许长期只抬预算、不推进拆分。

## 剩余热点优先级评分卡

评分维度：

- 职责密度
- 变更耦合度
- 运行态风险
- 性能与渲染敏感度
- 可拆分成熟度

分值范围：`1-5`

### 当前剩余热点排序

1. `apps/worker/src/worker.ts`
   - 分类：编排入口型
   - 评分：
     - 职责密度 `5`
     - 变更耦合度 `5`
     - 运行态风险 `5`
     - 性能与渲染敏感度 `2`
     - 可拆分成熟度 `5`
   - 总分：`22`
- 下一步：`remaining runtime glue / provider capability entry seam`

2. `apps/api/src/server.ts`
   - 分类：编排入口型
   - 评分：
     - 职责密度 `5`
     - 变更耦合度 `5`
     - 运行态风险 `5`
     - 性能与渲染敏感度 `1`
     - 可拆分成熟度 `5`
   - 总分：`21`
   - 下一步：`provider key-pool / import-models residue`

3. `apps/web/src/components/Canvas.tsx`
   - 分类：交互画布型
   - 评分：
     - 职责密度 `5`
     - 变更耦合度 `4`
     - 运行态风险 `4`
     - 性能与渲染敏感度 `5`
     - 可拆分成熟度 `3`
   - 总分：`21`
   - 下一步：`connect picker / context-menu view shell / remaining edit interactions`

4. `apps/web/src/components/nodes/PoseMasterNode.tsx`
   - 分类：运行态节点型
   - 评分：
     - 职责密度 `5`
     - 变更耦合度 `4`
     - 运行态风险 `3`
     - 性能与渲染敏感度 `4`
     - 可拆分成熟度 `4`
   - 总分：`20`
   - 下一步：`field schema / preview sections / runtime actions`

5. `apps/web/src/components/nodes/ToolboxParamNode.tsx`
   - 分类：运行态节点型
   - 评分：
     - 职责密度 `5`
     - 变更耦合度 `4`
     - 运行态风险 `3`
     - 性能与渲染敏感度 `4`
     - 可拆分成熟度 `4`
   - 总分：`20`
   - 下一步：`param sections / material bindings / preview helpers`

6. `apps/web/src/components/nodes/ImageEditModal.tsx`
   - 分类：运行态节点型
   - 总分：`17`
   - 下一步：`tool sections / modal state hooks / action services`

7. `apps/web/src/components/nodes/DrawingBoardNode.tsx`
   - 分类：运行态节点型
   - 总分：`17`
   - 下一步：`board interactions / toolbar sections / persistence helpers`

8. `apps/web/src/components/nodes/ImageNode.tsx`
   - 分类：运行态节点型
   - 总分：`16`
   - 下一步：`upload section / preview section / action helpers`

9. `apps/web/src/components/nodes/PortraitMasterNode.tsx`
   - 分类：运行态节点型
   - 总分：`16`
   - 下一步：`preset sections / form helpers / output display`

10. `apps/web/src/components/nodes/VideoNode.tsx`
    - 分类：运行态节点型
    - 总分：`16`
    - 下一步：`runtime panel / param sections / output helpers`

11. `apps/web/src/components/nodes/LLMNode.tsx`
    - 分类：运行态节点型
    - 总分：`15`
    - 下一步：`prompt sections / runtime card / output display`

12. `apps/web/src/components/nodes/OutputNode.tsx`
    - 分类：运行态节点型
    - 总分：`15`
    - 下一步：`preview sections / export helpers / runtime summary`

13. `apps/web/src/data/portraitMasterOptions.ts`
    - 分类：静态数据型
    - 总分：`11`
    - 下一步：`theme / capability / registry split`

### 当前后续批次顺序

- 第一批：
  - `apps/worker/src/worker.ts`
  - `apps/api/src/server.ts`
- 第二批：
  - `apps/web/src/components/Canvas.tsx`
  - `apps/web/src/components/nodes/PoseMasterNode.tsx`
  - `apps/web/src/components/nodes/ToolboxParamNode.tsx`
- 第三批：
  - `apps/web/src/components/nodes/ImageEditModal.tsx`
  - `apps/web/src/components/nodes/DrawingBoardNode.tsx`
  - `apps/web/src/components/nodes/ImageNode.tsx`
  - `apps/web/src/components/nodes/PortraitMasterNode.tsx`
- 第四批：
  - `apps/web/src/components/nodes/VideoNode.tsx`
  - `apps/web/src/components/nodes/LLMNode.tsx`
  - `apps/web/src/components/nodes/OutputNode.tsx`
  - `apps/web/src/data/portraitMasterOptions.ts`

### 当前最高优先级三项

在时间有限、只能先做最要紧改造时，当前最高优先级固定为：

1. `apps/worker/src/worker.ts`
- 重点：`remaining runtime glue / provider capability entry seam`
2. `apps/api/src/server.ts`
   - 重点：`provider key-pool / import-models residue`
3. `apps/web/src/components/Canvas.tsx`
   - 重点：`connect picker / context-menu view shell / remaining edit interactions`

### 暂不回头大改的已完成热点

以下文件已完成主要收口，当前不因为新评分规则出台而回头做大规模重拆：

- `apps/web/src/components/nodes/RunningHubNode.tsx`
- `apps/web/src/components/nodes/RHToolsNode.tsx`
- `apps/web/src/components/ApiSettings.tsx`
- `apps/admin/src/admin-runninghub-workspace.tsx`
- `apps/admin/src/admin-api-settings-panel.tsx`
