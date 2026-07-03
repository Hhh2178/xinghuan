# ComfyUI RH-Style Unified Node And Machine Selection Design

## Goal

把当前 ComfyUI 能力从“能跑但体验散、治理散、机器维度缺失”的状态，升级成一条清晰稳定的产品链路：

- 后台负责上传本地 JSON、自动解析工作流、治理输入输出 schema、管理机器专属工作流与共享发布。
- 前台画布只保留一个统一的 `comfyui` 节点，视觉与交互层级对齐 RunningHub。
- 前台节点不仅能选择共享工作流，还能选择执行机器，正式进入多机算力管理模型。
- 节点对外只保留一个统一输出口，但内部仍保留结构化命名输出，便于后续节点和输出节点消费。

这轮的重点不是只修一个运行问题，也不是只做一轮视觉重画，而是把 ComfyUI 拉齐到和 RunningHub 类似的成熟产品分层：

- 后台治理
- 前台消费
- 多机选择
- 统一运行契约
- 可持续维护

## Confirmed Decisions

以下方向已确认：

- 前台最终只保留一个可见节点，名称固定为 `comfyui`。
- 旧的多个 ComfyUI 节点不再作为未来主模型保留。
- 节点结构要向 RH 的信息层级、交互顺序和视觉质量对齐。
- 不使用“返回列表”这类额外模式切换；工作流切换改为 RH 风格的顶部下拉选择。
- 节点外部只保留一个统一输出口。
- 节点内部不做大面积结果墙，详细结果交给下游输出节点或结果节点查看。
- 参数区默认只显示核心参数，次级参数放入“更多参数”。
- 后台治理必须以 schema-first 为主，不能继续用补丁式字段特判。
- 只有管理员可以上传、治理、发布共享工作流。
- 前台节点必须补入 ComfyUI 机器选择能力。

## Current Problems

### 1. 前台 ComfyUI 结构仍弱于 RH

当前 ComfyUI 节点虽然已经开始统一，但整体仍更像“可运行表单”，而不是和 RH 同层级的工作台节点：

- 头部摘要弱
- 选择工作流的入口不稳定
- 参数区直接变成长表单
- 输入、运行、输出没有形成明确 section
- 图标、文字、说明、操作按钮的视觉基线未完全统一

### 2. 工作流治理和节点消费的认知模型仍不完整

虽然后端已经具备：

- `analysis`
- `inputSchema`
- `outputSchema`
- `defaultValues`

但前台节点和后台管理仍没有完全把这些正式 schema 转化成稳定的产品模型，导致后续容易继续回到“发现一个字段，再补一个判断”的状态。

### 3. 机器维度尚未真正进入前台消费模型

当前模型更多只是“选择一个共享工作流并运行”，但没有把：

- 哪些机器支持该工作流
- 用户这次选择哪台机器执行
- 机器当前健康状态如何
- 默认机器是谁

这些信息正式纳入节点消费结构。

这会阻碍后续的多机算力管理、共享工作流跨机器复用和机器池调度。

### 4. 输出模型仍容易退回“结果预览墙”

如果没有明确规定“统一输出口 + 结构化结果包 + 轻量输出摘要”的方向，ComfyUI 节点很容易继续退回到“节点里堆图片和视频缩略图”的设计，这会和 RH 的主工作台风格持续背离。

## Design Principles

### 1. 后台治理，前台消费

职责边界固定为：

- 后台：
  - 上传本地工作流 JSON
  - 自动解析输入输出候选
  - 编辑输入映射、输出映射、默认值、机器兼容关系
  - 保存机器专属工作流
  - 推送到共享区
- 前台：
  - 选择共享工作流
  - 选择执行机器
  - 调整输入素材和暴露参数
  - 运行并消费结构化结果

### 2. schema-first，禁止继续补丁式治理

系统可以自动识别工作流候选输入输出，但最终可执行契约只认正式 schema：

- `analysis.detectedInputs`
- `analysis.detectedOutputs`
- `analysis.warnings`
- `inputSchema`
- `outputSchema`
- `defaultValues`

接入新工作流时，优先通过 schema 配置完成，而不是继续新增散落的业务代码特判。

### 3. ComfyUI 节点向 RH 的产品结构靠齐

对齐的是：

- 信息层级
- 交互顺序
- section 节奏
- 字段式选择方式
- 节点作为“可执行工作台”的定位

不对齐的是具体协议或字段细节，ComfyUI 仍保留自身的工作流治理和机器执行能力。

### 4. 一个节点，一根输入主链，一根输出主链

前台只保留一个 `comfyui` 节点，外部模型固定为：

- 左侧：统一输入入口
- 右侧：统一输出入口

内部可以继续区分多种输入与多种结果，但外部交互模型保持稳定简洁。

### 5. 工作流与机器分层

共享工作流是逻辑模板，机器是执行载体：

- 工作流定义参数暴露、输入输出 schema、默认规则
- 机器定义当前能否运行、健康状态、能力标签和默认选择

前台必须同时支持这两个维度。

## Target Product Model

### 1. 工作流层级

工作流管理层级固定为：

1. ComfyUI 机器实例
2. 机器实例下的专属工作流
3. 共享工作流区

规则如下：

- 所有工作流先在机器实例下建立专属条目。
- 机器专属工作流允许完整编辑和治理。
- 管理员可以将专属工作流推送到共享区。
- 共享区只作为正式发布区，不作为原始创建入口。
- 共享区中的工作流仍保留来源机器与同步关系，便于追踪和回滚。

### 2. 后台工作流治理流程

上传本地 JSON 后，后台固定走以下流程：

1. 读取工作流 JSON
2. 自动分析结构
3. 识别输入候选、输出候选、风险告警
4. 生成默认 `inputSchema` 与 `outputSchema`
5. 管理员逐项调整暴露规则
6. 保存机器专属工作流
7. 可选推送到共享区

后台治理的核心不是手工改原始 JSON，而是管理正式 schema。

## Backend Governance Model

### 1. 工作流草稿结构

正式治理模型至少应包含：

```ts
type WorkflowDraft = {
  workflowJson: Record<string, unknown>;
  analysis: {
    detectedInputs: DetectedInput[];
    detectedOutputs: DetectedOutput[];
    warnings: ParserWarning[];
  };
  inputSchema: InputSchemaItem[];
  outputSchema: OutputSchemaItem[];
  defaultValues: Record<string, unknown>;
};
```

职责如下：

- `workflowJson`
  - 原始 ComfyUI 工作流
- `analysis`
  - 自动识别结果，只作为候选
- `inputSchema`
  - 管理员确认后的正式输入规则
- `outputSchema`
  - 管理员确认后的正式输出规则
- `defaultValues`
  - 运行时默认值和隐藏值来源

### 2. 自动解析结果

系统自动识别三类信息：

#### A. 输入候选

- 文本类输入
- number / boolean / select 等参数输入
- 图像输入
- 视频输入
- 音频输入
- 可能的隐藏常量输入
- 无法确定语义的可疑字段

#### B. 输出候选

- image 输出
- video 输出
- audio 输出
- text 输出
- 可能的多输出结果

#### C. 风险告警

例如：

- 同类输入过多，无法自动识别主输入
- 输出节点来源不明确
- 字段类型不稳定
- 工作流依赖特定模型或插件
- 当前机器可能缺少关键依赖

自动识别结果是候选，不直接等于最终发布契约。

### 3. 输入 schema 模型

每个输入项至少需要以下字段：

```ts
type InputSchemaItem = {
  key: string;
  nodeId: string;
  fieldName: string;
  label: string;
  kind: "text" | "textarea" | "number" | "boolean" | "select" | "image" | "video" | "audio";
  mode: "param" | "upstream" | "hidden";
  displayTier?: "primary" | "secondary" | "advanced";
  required?: boolean;
  defaultValue?: unknown;
  order?: number;
  upstreamSlot?: string;
  slotLabel?: string;
  multiple?: boolean;
  note?: string;
};
```

其中最关键的是 `mode`：

- `param`
  - 前台节点参数区可编辑
- `upstream`
  - 由画布上游素材输入驱动
- `hidden`
  - 前台不显示，运行时走固定值或默认值

### 4. 参数展示层级

为了避免前台节点参数爆炸，`mode = param` 的字段还要继续分展示层级：

- `primary`
  - 默认直接显示在节点中
- `secondary`
  - 放入“更多参数”
- `advanced`
  - 默认更深层折叠，主要供治理层控制默认值

这使前台节点可以自然形成：

- 核心参数
- 更多参数

而不是把所有字段摊平成大表单。

### 5. 上游输入槽位模型

为了让前台节点稳定消费上游输入，`mode = upstream` 的字段不能只记录“它是个 image 字段”，还要带上槽位语义：

- `kind`
  - `text | image | video | audio`
- `upstreamSlot`
  - 例如 `image1`、`image2`、`text1`
- `slotLabel`
  - 例如“主参考图”“蒙版图”“主提示词”
- `multiple`
  - 是否允许多项
- `required`
  - 是否必填

这样前台可以据此判断：

- 这个工作流需要哪些输入
- 哪些输入要重点提示
- 是否允许多素材进入

### 6. 输出 schema 模型

每个输出项至少需要以下字段：

```ts
type OutputSchemaItem = {
  key: string;
  label: string;
  kind: "image" | "video" | "audio" | "text";
  enabled: boolean;
  isPrimary?: boolean;
  order?: number;
  nodeId?: string;
  note?: string;
};
```

其中：

- `enabled`
  - 是否正式发布
- `isPrimary`
  - 该输出是否作为主结果

即使前台只保留一个外部输出口，后台仍然保留完整输出治理能力。

### 7. 机器兼容关系

共享工作流需要显式保存可运行机器列表：

```ts
type SharedWorkflowInstanceBinding = {
  instanceId: string;
  enabled: boolean;
  isDefault?: boolean;
  health?: "online" | "busy" | "offline";
  capabilityTags?: string[];
  executionMode?: "fixed" | "selectable" | "pool";
};
```

说明如下：

- `fixed`
  - 固定机器，前台不可切换
- `selectable`
  - 前台可在兼容机器中切换
- `pool`
  - 预留给后续自动调度或机器池能力

本轮默认以 `selectable` 为主。

## Admin UI Design

后台工作流详情页固定分为五块：

### 1. 基础信息区

- 工作流标题
- 所属机器
- 来源文件
- 共享状态
- 最近更新时间

### 2. 解析摘要区

- 检测到多少输入候选
- 检测到多少输出候选
- 当前有哪些 warnings
- 哪些字段需要人工确认

### 3. 输入治理区

每行输入项至少包含：

- 节点标题 / `nodeId` / `fieldName`
- 自动识别类型
- 暴露模式 `param / upstream / hidden`
- 前台显示名
- 显示层级 `primary / secondary / advanced`
- 默认值
- 是否必填
- 槽位映射
- 顺序

### 4. 输出治理区

每行输出项至少包含：

- 来源节点
- 自动识别输出类型
- 是否发布
- 是否主输出
- 输出 key
- 显示名称
- 输出顺序

### 5. 发布区

- 保存机器专属工作流
- 推送到共享区
- 查看共享版本状态
- 下架或撤回共享工作流

## Canvas Node Design

### 1. 节点总原则

前台只保留一个可见节点，名称固定为 `comfyui`。

节点定位是“工作流执行工作台”，不是“工作流市场”或“结果画廊”。

### 2. 节点整体结构

节点整体按 RH 风格组织为：

1. 标题区
2. 选择区
3. 输入素材区
4. 核心参数区
5. 更多参数区
6. 运行状态区
7. 输出摘要区

### 3. 标题区

标题区显示：

- ComfyUI 图标
- `comfyui`
- 当前工作流和机器状态摘要

这里的视觉要求：

- 图标与标题文字垂直基线统一
- 标题和副标题左对齐
- 操作标签、状态文案、下拉字段边距统一
- 整体气质接近 RH 的稳态工作台，而不是漂浮的小工具面板

### 4. 选择区

选择区放在标题区正下方，固定使用字段式结构，而不是列表页切换：

- `工作流`
- `机器`

#### A. 工作流选择

- 使用 RH 风格下拉框
- 未选择时显示“请选择共享工作流”
- 已选择时直接显示当前工作流名称
- 切换工作流时不进入新模式，不出现“返回列表”
- 工作流较多时，下拉面板支持搜索或快速过滤

#### B. 机器选择

- 未选工作流时禁用
- 已选工作流后，只展示支持该工作流的机器
- 默认优先：
  - 用户上次选择
  - 工作流默认机器
  - 第一台在线机器
  - 第一台可用机器
- 每个机器选项展示：
  - 机器名
  - `online / busy / offline`
  - 能力标签，例如 `4090 / FLUX / Video`

### 5. 输入素材区

输入素材区统一展示来自左侧输入口的上游素材：

- 文本
- 图片
- 视频
- 音频

支持：

- 统一预览
- 拖拽排序
- 排除单个上游素材
- 恢复已排除素材

这一区域对齐 RH 的通用输入模型，而不是为不同工作流再造一套输入壳。

### 6. 参数区

参数区分两层：

- 核心参数
- 更多参数

规则如下：

- `displayTier = primary` 的参数默认展示
- `displayTier = secondary` 的参数放入“更多参数”
- `displayTier = advanced` 默认更深层折叠，避免打断主工作流

前台不直接显示 hidden 字段。

### 7. 运行状态区

运行区负责：

- 运行按钮
- 当前状态
- 当前执行机器
- 队列或执行进度摘要
- 错误提示

错误态要尽量结构化区分，例如：

- 机器离线
- 工作流未同步到该机器
- 机器缺少模型或插件
- ComfyUI 服务不可达
- 执行超时

### 8. 输出摘要区

输出区不做大面积结果墙，只保留轻量摘要：

- 是否成功
- 主输出类型
- 输出数量
- 最近一次完成状态

如有需要，可显示一张主结果缩略图或一条主结果摘要，但不扩展成图像/视频画廊。

## Output Contract

### 1. 统一外部输出口

前台节点外部只保留一个右侧输出口。

不再为 `image / video / audio / text` 暴露多个外部输出口。

### 2. 内部结构化结果包

虽然外部只保留一个输出口，但运行结果仍应是结构化结果包：

```ts
type ComfyuiNodeOutputBundle = {
  primary: {
    key: string;
    kind: "image" | "video" | "audio" | "text";
    value: unknown;
  };
  outputs: Array<{
    key: string;
    label: string;
    kind: "image" | "video" | "audio" | "text";
    value: unknown;
  }>;
};
```

这样可以同时满足：

- 前台体验像 RH，一根输出
- 后台能完整治理多个输出
- 下游节点或输出节点仍可读取主结果与附加结果

### 3. 主输出规则

- 默认取 `outputSchema` 中 `isPrimary = true` 的项作为主结果
- 若没有显式主输出，则取第一个启用输出
- 节点摘要区优先显示主输出信息

## Permissions

只有管理员可以：

- 上传本地工作流 JSON
- 创建机器专属工作流
- 编辑输入映射
- 编辑输出映射
- 修改默认值
- 配置机器兼容关系
- 推送到共享区
- 下架共享工作流

普通用户只能：

- 在画布中选择已发布共享工作流
- 在节点中选择允许的执行机器
- 编辑前台允许暴露的参数
- 发起运行并查看结果

## Error Handling

需要明确覆盖这些典型错误：

- 工作流不存在或已下架
- 当前共享工作流在所选机器上不可运行
- 所选机器离线
- 机器健康状态异常
- 工作流缺少必填输入
- 机器缺少依赖模型或插件
- ComfyUI 接口不可达
- 执行超时

错误提示应尽量告诉用户是“工作流问题”“机器问题”还是“输入问题”。

## Out Of Scope

本轮明确不做：

- ComfyUI 工作流拓扑图预览器
- 工作流在线拖拽编辑器
- 工作流版本 diff viewer
- 节点内部大型结果画廊
- 多个 ComfyUI 节点并存模型
- 复杂机器池自动调度策略的完整实现

## Success Criteria

完成后，应达到以下状态：

- 画布里只需要一个 `comfyui` 节点即可完成共享工作流消费。
- 节点视觉和信息层级明显向 RH 对齐。
- 节点顶部可以同时选择工作流和机器。
- 后台可在机器实例下管理专属工作流，并可推送到共享区。
- 管理员可以清晰决定哪些参数暴露、哪些输入走上游、哪些输出正式发布。
- 节点外部统一只保留一个输出口，但内部仍能保留结构化多输出。
- 后续新增工作流主要通过 schema 调整接入，而不是继续补业务代码分支。
