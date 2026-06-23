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
- 下一步优先拆分：
  - RunningHub 相关 handler
  - system settings / queue settings 相关 handler
  - 更细的 request-response adapter
- 目标形态：
  - `server.ts` 只保留入口装配与高层编排
- 当前护栏：
  - `scripts/verify-file-hotspot-budgets.mjs`
- 当前风险：
  - 新协议接入容易继续把解析、校验、运行态拼接堆回入口文件

### `apps/worker/src/worker.ts`

- 当前职责：
  - 任务消费主循环
  - provider 执行编排
  - 部分 dispatch / cancel / failure normalization glue
- 已有下沉：
  - `worker-grsai-image-client.ts`
  - `worker-runninghub-client.ts`
- 下一步优先拆分：
  - RunningHub dispatch / key selection glue
  - cancel-sync helper
  - unified diagnostics / failure normalization helper
- 目标形态：
  - `worker.ts` 只保留任务编排 glue
- 当前护栏：
  - `scripts/verify-file-hotspot-budgets.mjs`
  - `scripts/verify-worker-runninghub-runtime-second-stage-contract.mjs`
- 当前风险：
  - 新 provider 适配和异常口径很容易再次把协议细节堆回 worker 主文件

### `apps/web/src/components/nodes/RunningHubNode.tsx`

- 当前职责：
  - RH 节点 UI 组合
  - 参数区、进度、结果、错误文案
  - 节点运行态相关交互
- 已有下沉：
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
  - `scripts/verify-runninghub-node-progress-contract.mjs`
  - `scripts/verify-runninghub-worker-and-label-contract.mjs`
- 当前风险：
  - 新的 RH 交互需求继续叠加时，UI、状态、请求辅助逻辑会再次粘成单块

### `apps/admin/src/admin-runninghub-workspace.tsx`

- 当前职责：
  - RH 工作台主布局
  - 协议编辑、key 管理、分析面板、表单汇总
  - 部分保存/校验交互
- 已有下沉：
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
  - `scripts/verify-runninghub-admin-empty-input-contract.mjs`
  - `scripts/verify-runninghub-key-pool-contract.mjs`
- 当前风险：
  - 后台功能继续扩展时，工作台会重新变回“所有 RH 能力都堆在一个页面文件里”

## 使用规则

- 当热点预算发生变化时，必须同步更新这份台账。
- 当某次改动继续触碰上述热点文件时，发布记录或 daily 台账里必须说明：
  - 这次新增逻辑落到了哪里
  - 哪些职责仍留在主文件
  - 下一步拆分目标是什么
- 不允许长期只抬预算、不推进拆分。
