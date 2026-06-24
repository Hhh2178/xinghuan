# Hotspot Superfile Decomposition Ledger - 2026-06-24

## 目的

这份台账用于记录当前仓库四个热点超级文件的职责、已拆分结果、下一步拆分方向与对应护栏，避免后续协作只看到“预算不能再涨”，却不知道应该把逻辑往哪里拆。

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
- 下一步优先拆分：
  - system settings / queue settings 相关 handler
  - 更细的 request-response adapter
- 目标形态：
  - `server.ts` 只保留入口装配与高层编排
- 当前护栏：
  - `scripts/verify-file-hotspot-budgets.mjs`
  - `scripts/verify-api-admin-runninghub-route-split-contract.mjs`
- 当前风险：
  - 新协议接入容易继续把解析、校验、运行态拼接堆回入口文件
- 当前进度：
  - `2026-06-24` 已将后台 RunningHub 条目管理路由分发层下沉到 `admin-runninghub-routes.ts`
  - 主文件继续保留入口装配、权限分流和底层 catalog/service 业务函数

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
- 下一步优先拆分：
  - cancel-sync helper
  - unified diagnostics / failure normalization helper
- 目标形态：
  - `worker.ts` 只保留任务编排 glue
- 当前护栏：
  - `scripts/verify-file-hotspot-budgets.mjs`
  - `scripts/verify-worker-runninghub-runtime-second-stage-contract.mjs`
  - `scripts/verify-worker-runninghub-dispatch-split-contract.mjs`
- 当前风险：
  - 新 provider 适配和异常口径很容易再次把协议细节堆回 worker 主文件
- 当前进度：
  - `2026-06-24` 已将 RunningHub key 优先级排序、实时可执行探测、redis 占位与释放逻辑下沉到 `worker-runninghub-dispatch.ts`
  - 主文件继续保留任务领取、执行、状态回写与 deferred/requeue 编排
  - `2026-06-24` 已将任务读取、状态写回、heartbeat/runtime patch、取消态探测下沉到 `worker-task-store.ts`
  - 已补齐 contract：`scripts/verify-worker-task-store-split-contract.mjs`
  - 主文件继续保留 worker 主循环、provider 执行编排与结果归一化 glue

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
  - 下一步：拆 `canvas runtime hooks / interaction sections / overlay panels`
- `apps/web/src/components/nodes/PoseMasterNode.tsx`
  - 状态：超大节点组件
  - 下一步：拆 `field schema / preview sections / runtime actions`
- `apps/web/src/components/nodes/ToolboxParamNode.tsx`
  - 状态：参数型节点壳与表单耦合过重
  - 下一步：拆 `param sections / material bindings / preview helpers`
- `apps/web/src/components/nodes/ImageEditModal.tsx`
  - 状态：模态 UI、编辑状态和动作耦合
  - 下一步：拆 `tool sections / modal state hooks / action services`
- `apps/web/src/components/ApiSettings.tsx`
  - 状态：系统设置页职责堆叠
  - 下一步：拆 `provider sections / settings forms / save helpers`
  - 当前进度：
    - `2026-06-24` 已将 key 常量、导入导出备份 helper、云上传摘要与 JSON 解析下沉到 `apiSettingsHelpers.ts`
    - `2026-06-24` 已将通用/分类 API Key 字段卡片与外链按钮下沉到 `ApiSettingsKeyField.tsx`
    - `2026-06-24` 已将通用 Key + 分类 Key 区、路径配置区、导入导出底部动作区下沉到：
      - `ApiSettingsKeySections.tsx`
      - `ApiSettingsLocalPathsSection.tsx`
      - `ApiSettingsFooterActions.tsx`
    - `2026-06-24` 已将高级平台区与云上传区的外层 section 壳继续下沉到：
      - `ApiSettingsAdvancedProvidersSection.tsx`
      - `ApiSettingsCloudUploadSection.tsx`
    - `2026-06-24` 已将云上传 detail panel 继续下沉到：
      - `ApiSettingsCloudTargetDetailPanel.tsx`
      - `ApiSettingsFormBlock.tsx`
    - 已补齐 contract：`scripts/verify-api-settings-detail-panel-split-contract.mjs`
    - `2026-06-24` 已将 advanced provider detail panel 继续下沉到：
      - `ApiSettingsAdvancedProviderDetailPanel.tsx`
      - `ApiSettingsComfyWorkflowPanel.tsx`
      - `ApiSettingsModelscopeLoraPanel.tsx`
    - 已补齐 contract：`scripts/verify-api-settings-advanced-provider-panel-split-contract.mjs`
    - 主文件继续保留：
      - `renderAdvancedProviderForm` / `renderCloudTargetForm` 包装层
      - 保存 / 导入 / 明文拉取等核心编排
    - 已补齐新的 section split contract：`scripts/verify-api-settings-section-split-contract.mjs`
    - 主文件行数已从约 `2435` 降到 `1736 -> 1440 -> 590`
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

### 最近已退出 watchlist

- `apps/admin/src/admin-api-settings-panel.tsx`
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

### 已在硬预算中的 1200+ 文件

- `apps/api/src/server.ts`
- `apps/worker/src/worker.ts`
- `apps/web/src/components/nodes/RunningHubNode.tsx`

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
