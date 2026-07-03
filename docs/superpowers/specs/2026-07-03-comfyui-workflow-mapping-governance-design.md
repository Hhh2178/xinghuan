# ComfyUI Workflow Mapping Governance Design

## Goal

把当前 ComfyUI 实例级工作流管理从“上传 JSON + 手改草稿”升级成真正可治理的工作流映射系统：

- 上传工作流后自动解析输入候选、输出候选、风险告警。
- 管理员可以明确控制哪些输入暴露给画布节点、哪些输入改为上游素材口、哪些输出发布到画布。
- 后台保存的 schema 成为共享工作流、运行接口、画布节点三端统一契约。

这轮不是单纯美化 UI，而是补齐“工作流解析 -> 映射编辑 -> 共享发布 -> 画布消费”的产品主链路。

## Current Problems

### 1. 后台“工作流管理”还停留在草稿文本编辑

当前后台详情页支持：

- 粘贴 workflow JSON
- 上传本地 JSON 文件
- 创建草稿
- 手工编辑 `exposedFields`
- 手工编辑 `defaultValues`
- 手工编辑 `hiddenFields`
- 手工编辑 `outputSchema`

但这些编辑动作都以原始文本框为中心，不是面向管理员的映射治理界面。

实际结果是：

- 管理员无法直观看到系统识别了哪些输入和输出。
- 无法快速判断某个字段应该是“画布参数”还是“上游素材输入”。
- 输出定义没有可视化来源信息，也无法形成稳定的画布输出口协议。

### 2. 解析逻辑分裂在后台和前台两套实现里

当前已有两套 ComfyUI workflow 解析逻辑：

- 后台 / API 侧：
  - `apps/api/src/comfyui-workflow-registry.ts`
  - 自动检测 `exposedFields` 与 `outputSchema`
- 前台节点工具侧：
  - `apps/web/src/utils/comfyuiWorkflow.ts`
  - `apps/web/src/utils/comfyuiApps.ts`
  - 用于本地“ComfyUI应用制作工具”

两套逻辑各自维护：

- Prompt / negative 识别
- 图片 / 视频 / 音频输入识别
- 输出节点识别
- warning 生成

这会导致后台、共享目录、画布节点的口径漂移。

### 3. 输出 schema 没有真正打通运行时返回协议

当前 public run 接口返回：

- `imageUrls`
- `videoUrls`
- `audioUrls`
- `text`

它没有按照后台定义的 `outputSchema.key` 返回命名结果，也没有把“输出定义”变成正式运行契约。

这意味着后台虽然能保存输出草稿，但画布侧并不能真正消费“命名输出口”。

### 4. 画布节点还不是按 schema 动态生成端口

当前 `ComfyUI应用` 节点：

- 只有固定的左输入 Handle 和右输出 Handle
- 参数区会根据 `exposedFields` 生成
- 输入素材只是节点内部消费，不是正式输入口模型

这和目标状态不一致。目标应该是：

- 共享工作流定义哪些上游输入口需要暴露
- 定义哪些参数在节点面板编辑
- 定义哪些输出口对下游暴露

### 5. 当前后台 UI 结构不支持复杂工作流治理

当前页面把：

- 实例配置
- 工作流草稿创建
- 工作流字段编辑
- 输出定义
- 执行日志

都堆在一个细长页面结构里，信息层级不清晰，标签、说明、动作按钮、JSON 文本区没有形成明确阅读和操作顺序。

## Design Principles

### 1. 先立统一 schema，再做 UI 美化

本轮优先级：

1. 统一解析与 schema
2. 后台映射治理 UI
3. 运行时返回契约
4. 画布节点动态消费
5. 视觉精修

不允许继续反过来，只做外观重画而不补真实数据契约。

### 2. 后台是治理主入口，画布是消费入口

后台负责：

- 上传和解析 workflow
- 编辑输入映射
- 编辑输出映射
- 保存实例级草稿
- 推送共享区

画布负责：

- 消费共享区中已经治理好的 schema
- 动态生成参数区与输入输出口
- 提交运行并接收结构化结果

### 3. 自动检测只是起点，不是最终真相

系统必须自动识别候选输入输出，但管理员必须能覆盖和修正。

自动检测结果应被视为：

- `detectedInputs`
- `detectedOutputs`
- `parserWarnings`

最终用于运行与画布消费的是管理员保存后的：

- `inputSchema`
- `outputSchema`

### 4. 输入映射要区分“参数输入”和“上游素材输入”

当前 `exposedFields` 把不同语义混在一起，这会在后续继续恶化。

新的输入 schema 必须显式区分：

- `mode = param`
  - 画布节点参数面板可编辑
- `mode = upstream`
  - 画布节点暴露正式输入口
- `mode = hidden`
  - 不暴露，运行时使用固定值 / 默认值

### 5. 输出映射要变成正式的命名输出契约

输出不能再只靠“跑完后看看返回了几张图”。

每个输出必须有：

- 稳定 key
- 展示名
- 输出类型
- 来源节点
- 是否发布到共享工作流

## Options Considered

### Option A: 保持当前后台草稿页，只补一点样式和提示

优点：

- 改动小
- 风险低

问题：

- 没有真正解决工作流映射治理问题
- 仍然要求管理员直接改 JSON
- 无法支撑后续共享工作流规模化管理

结论：

- 不采用

### Option B: 以后端 schema 为中心，重做后台工作流治理页

做法：

- 抽共享 parser
- 保存 detected schema 和 normalized schema
- 后台展示解析结果与映射编辑器
- public run 与画布节点都消费统一 schema

优点：

- 能闭合从后台到画布的完整链路
- 结构清晰，可持续扩展
- 后续可继续加实例日志、执行统计、版本对比

结论：

- 采用本方案

### Option C: 沿用前台 ComfyUI 应用制作工具，后台只做共享发布

优点：

- 复用已有前台分析工具

问题：

- 核心治理仍然留在画布侧，不符合管理员后台主导的产品方向
- 实例级工作流和共享发布链路会继续分裂

结论：

- 不采用

## Scope

### In Scope

- 提炼统一 ComfyUI workflow parser 与 shared types
- 后台工作流上传后的解析结果展示
- 后台输入映射编辑器
- 后台输出映射编辑器
- 保存实例级 workflow schema
- 推送共享区时保留治理后的 schema
- public run 返回结构化命名结果
- 画布 `ComfyUI应用` 节点消费 schema，动态生成参数和输入输出行为

### Out of Scope

- 不做 workflow 拓扑图可视化
- 不做 workflow 版本 diff viewer
- 不做 workflow 在线 JSON 图形编辑
- 不做执行日志全量治理，只保留后续预留位
- 不做多租户工作流审批流

## Target Architecture

### 1. Shared Parser Layer

新增一层共享模块，负责：

- 解析 API workflow JSON
- 识别输入候选
- 识别输出候选
- 产出 warning
- 规范化输入 / 输出 schema

建议放在：

- `packages/shared/src/comfyui-workflow.ts`

它输出的核心类型至少包括：

- `ComfyuiDetectedInput`
- `ComfyuiDetectedOutput`
- `ComfyuiParserWarning`
- `ComfyuiWorkflowInputSchemaItem`
- `ComfyuiWorkflowOutputSchemaItem`
- `ComfyuiWorkflowAnalysisResult`

### 2. Registry Schema Layer

实例级 workflow draft 不再只存：

- `exposedFields`
- `defaultValues`
- `hiddenFields`
- `outputSchema`

而是演进为：

- `workflowJson`
- `analysis`
  - `detectedInputs`
  - `detectedOutputs`
  - `warnings`
- `inputSchema`
- `defaultValues`
- `outputSchema`

兼容策略：

- 历史 `exposedFields` / `hiddenFields` 在读入时迁移为 `inputSchema`
- 暂时保留旧字段读兼容，但新的写入路径全部写新 schema

### 3. Admin Workflow Governance UI

后台“工作流管理”改成三段：

#### A. 草稿创建区

- 上传 JSON / 粘贴 JSON
- 创建后立即展示解析摘要

#### B. 解析摘要区

- 检测到多少输入候选
- 检测到多少输出候选
- 检测到哪些 warnings
- 哪些候选系统无法确定，需要人工确认

#### C. 映射治理区

输入映射按行展示，每行至少包含：

- 节点标题 / 节点 id / 字段名
- 自动识别来源
- 暴露模式：
  - 隐藏
  - 参数
  - 上游输入口
- 类型：
  - text / textarea / number / boolean / image / video / audio
- 显示名称
- 默认值
- 必填
- 顺序

输出映射按行展示，每行至少包含：

- 来源节点标题 / 节点 id
- 自动识别输出类型
- 是否发布
- 输出 key
- 显示名称
- 输出类型

### 4. Runtime Contract Layer

public run 不再只返回聚合数组。

新增结果结构：

- `outputs: Array<{ key, label, kind, value }>`

其中：

- image => `value` 为 URL 或 URL 数组
- video => `value` 为 URL 或 URL 数组
- audio => `value` 为 URL 或 URL 数组
- text => `value` 为 string

兼容期内可继续保留：

- `imageUrls`
- `videoUrls`
- `audioUrls`
- `text`

但画布节点应优先消费 `outputs`。

### 5. Canvas Consumption Layer

`ComfyUI应用` 节点改成按共享 workflow schema 动态消费：

- `mode = param` 的输入显示在参数面板
- `mode = upstream` 的输入形成正式素材需求
- `outputSchema` 驱动节点输出定义与结果展示

本轮不强制实现多 Handle 动态布局到最终形态，但至少要让运行结果和 schema 一致，并为后续动态 Handle 留出数据结构。

如果本轮动态 Handle 风险过高，可先采用分阶段策略：

- 阶段 1：节点内部动态消费多个 upstream input 语义
- 阶段 2：再补视觉上的多输入输出 Handle

## Data Model

### Input Schema Item

建议结构：

```ts
interface ComfyuiWorkflowInputSchemaItem {
  key: string;
  nodeId: string;
  fieldName: string;
  source: string;
  label: string;
  mode: "hidden" | "param" | "upstream";
  kind: "text" | "textarea" | "number" | "boolean" | "image" | "video" | "audio";
  required: boolean;
  defaultValue?: unknown;
  upstreamSlot?: string;
  order: number;
}
```

### Output Schema Item

建议结构：

```ts
interface ComfyuiWorkflowOutputSchemaItem {
  key: string;
  label: string;
  kind: "text" | "image" | "video" | "audio";
  sourceNodeId?: string;
  sourceFieldName?: string;
  enabled: boolean;
  order: number;
}
```

### Analysis Result

```ts
interface ComfyuiWorkflowAnalysisResult {
  detectedInputs: ComfyuiDetectedInput[];
  detectedOutputs: ComfyuiDetectedOutput[];
  warnings: ComfyuiParserWarning[];
}
```

## UI Direction

### Information Hierarchy

当前 detail 页最大的问题不是颜色，而是结构没有节奏。

新的工作流治理页应采用：

- 顶部：实例上下文 + 当前工作流标题 + 状态
- 左侧或上段：workflow 列表
- 主区：当前 workflow 的解析摘要与映射编辑

每个映射表格 / 列表必须保证：

- 标签列对齐
- 输入控件基线一致
- 图标、标题、副文案三层信息稳定
- JSON 只保留在“高级模式”折叠区，不做默认主交互

### Execution Log Tab

当前“执行日志即将上线”的空页不应该继续占据同级主标签权重。

本轮建议：

- 保留但降级为 disabled / beta 标记
- 主精力集中在基本配置与工作流治理

## Rollout Strategy

### Phase 1: Shared Parser + Schema Compatibility

- 抽离 parser
- 后台与前台消费同一套类型
- 兼容历史 workflow draft

### Phase 2: Admin Workflow Governance UI

- 重做工作流管理页面
- 替换 JSON 主编辑模式
- 增加解析摘要和映射编辑

### Phase 3: Runtime Result Contract

- public run 返回 `outputs`
- execution 按 output schema 聚合结果

### Phase 4: Canvas Consumption Upgrade

- 共享 ComfyUI 节点按 schema 显示参数和结果
- 为动态 Handle 和正式输入输出口治理打底

## Verification

至少覆盖以下验收：

1. 上传一个真实 ComfyUI API workflow JSON 后：
   - 能展示 detected inputs / outputs / warnings
2. 管理员把一个输入改成 `upstream` 后：
   - 保存后 schema 不丢失
   - 推送共享区后画布节点能按该模式消费
3. 管理员重命名输出 key / label 后：
   - run 接口结果包含对应 key
4. 历史 workflow draft 升级后：
   - 不报错
   - 原有共享工作流仍可运行
5. 画布共享节点：
   - 仍可运行旧共享工作流
   - 可运行新的治理后 workflow

## Risks

### 1. 历史兼容风险

已有 `sharedWorkflows` 和实例级 `workflows` 里已经存了旧字段，迁移必须保持读兼容。

### 2. 动态 Handle 改动面较大

画布节点的端口模型可能牵涉 `portTypes`、节点 registry、运行触发、下游消费。需要分阶段控制。

### 3. 自动识别不可能 100% 覆盖所有 ComfyUI 工作流

因此 warning 和人工修正界面必须被当作一等能力，而不是异常兜底。

## Acceptance Standard

完成后应满足：

- 后台工作流治理不再要求管理员直接编辑 JSON 才能完成正常配置。
- 上传 workflow 后能看到系统解析出的输入、输出和告警。
- 管理员能明确配置“参数输入 / 上游输入 / 隐藏输入”。
- 管理员能明确配置输出发布规则。
- 共享区工作流的 schema 能被画布节点真实消费。
- 运行结果协议与后台 output schema 一致。
