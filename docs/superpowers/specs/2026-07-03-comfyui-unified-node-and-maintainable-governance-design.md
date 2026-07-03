# ComfyUI Unified Node And Maintainable Governance Design

## Goal

把当前 ComfyUI 能力从“前台三个节点 + 后台草稿式工作流管理”重构为：

- 后台负责上传、解析、治理、发布 ComfyUI 工作流
- 前台画布只保留一个统一的 `ComfyUI` 节点
- 运行时只消费后台已经治理好的共享工作流 schema
- 参数治理能力必须是结构化、可维护、可扩展的，不能继续靠补丁式加字段

这轮的本质不是只修一个运行错误，也不是只改外观，而是把 ComfyUI 拉齐到和 RunningHub 相同的产品分层：

- 后台治理
- 前台消费
- 统一运行契约
- 可持续扩展

## Confirmed Direction

用户已确认本轮目标为：

- 前台只保留一个统一 ComfyUI 节点
- 旧的 `comfyui-app`、`comfyui-store`、`comfyui-app-maker` 节点直接去除，不再保留为可添加节点
- 后台治理改造必须避免反复打补丁，要做成后期易维护、方便修改、方便接入的形式

## Current Problems

### 1. 运行时存在 `COMFYUI_WORKFLOW_NOT_FOUND`

当前灰度里，ComfyUI 节点运行时出现：

- `COMFYUI_WORKFLOW_NOT_FOUND`

从现有代码链路看，问题高度可疑地出在前后端对“工作流运行 id”的使用不一致：

- 前台 `ComfyUIApplicationNode` 同时混用了：
  - `workflow.id`
  - `workflow.sharedWorkflowId`
  - `app.id`
- 其中 `app.id` 来自 `buildComfyAppFromCatalogWorkflow()`，会经过 `cleanId()` 再归一化
- 后端 `/api/comfyui/apps/:workflowId/run` 只按共享注册表中的真实：
  - `item.id`
  - `item.sharedWorkflowId`
  做精确匹配

这意味着只要前台保存和运行时使用的 id 与注册表真实 id 漂移，就会出现“列表里能看到，运行时却找不到”的假缺失。

### 2. 前台 ComfyUI 仍是三套节点模型

当前前台仍存在三套 ComfyUI 相关节点：

- `comfyui-app`
- `comfyui-store`
- `comfyui-app-maker`

这带来的问题是：

- 用户心智不统一
- 前台承担了本该由后台承担的治理职责
- 运行路径分裂成“共享工作流消费”和“前台本地 manifest 应用”两套
- 视觉层级明显弱于 RH 节点

### 3. 后台治理能力还不够“结构化”

虽然当前后台已经有了：

- `analysis`
- `inputSchema`
- `outputSchema`

但如果后续继续按“每个工作流发现一个特殊字段，再补一个 if/补一个字段映射”的方式前进，仍然会走回补丁式治理。

风险包括：

- 参数语义继续散落在不同文件
- 接新工作流时需要反复改后端逻辑
- 前后端口径难以长期保持一致
- 维护者无法快速判断“某个字段应该暴露在哪里、由谁负责”

### 4. ComfyUI 节点视觉与结构明显弱于 RH

和 RH 节点相比，当前 ComfyUI 节点存在这些问题：

- 头部信息密度低，工作流摘要不足
- 缺少“后台条目选择 -> 通用输入 -> 参数 -> 输出”的结构节奏
- 参数区直接变成长表单，视觉负担过重
- 没有把“哪些参数暴露、哪些来自上游、哪些被隐藏”转化成用户可理解的结构

### 5. 旧节点继续保留会拖累后续维护

如果旧三个节点继续留下兼容逻辑，就会长期存在：

- registry 里多种节点类型
- Canvas 初始化和迁移分支更多
- Sidebar、快捷添加、旧画布恢复逻辑持续复杂化
- 后台治理能力无法真正收口到“单一消费模型”

因此这轮不建议“先隐藏，后面再清”；应直接收口为统一节点体系。

## Design Principles

### 1. 后台负责治理，前台只负责消费

ComfyUI 的职责边界必须改成：

- 后台：
  - 上传 JSON
  - 自动解析输入输出
  - 管理参数暴露规则
  - 管理输出发布规则
  - 保存共享工作流
- 前台：
  - 选择后台已发布共享工作流
  - 消费治理后的 schema
  - 显示通用输入、参数区、输出区
  - 负责运行和结果展示

前台不能再继续承载工作流制作器和本地应用超市逻辑。

### 2. 参数治理必须是“结构化 schema”，不能是补丁式字段特判

后端这轮必须明确采用“schema-first + registry-driven”的治理方式，而不是：

- 新来一个工作流，就手加一个字段白名单
- 新来一种模型，就补一个 `if classType.includes(...)`
- 前台缺少显示时，再临时补个映射

必须把维护能力放在正式的数据结构上，而不是散落在临时规则里。

核心要求：

- 自动解析结果是候选，不是最终契约
- 最终契约必须由 `inputSchema / outputSchema` 承载
- 每个字段暴露规则必须可序列化、可编辑、可复用
- 新工作流接入时，优先通过 schema 配置完成，而不是再改业务代码

### 3. 统一节点必须向 RH 的产品模型靠齐

ComfyUI 统一节点应当复用 RH 已经证明有效的产品结构：

- 后台条目选择
- 通用输入聚合
- 参数面板只显示需要暴露的字段
- 输出结果按正式 schema 命名
- 前台不暴露后台治理细节

不是复制 RH 的业务协议，而是复制它的：

- 信息层级
- 交互顺序
- 节点结构节奏
- 单节点消费模型

### 4. 旧节点直接下线，但必须做明确迁移

“旧节点直接去除”不等于粗暴删除。

本轮必须同时做：

- 新画布入口只保留统一 ComfyUI 节点
- 旧节点从 node registry 和 Sidebar 中移除
- 旧画布加载时执行一次结构迁移
- 无法自动迁移的旧节点必须进入可见降级态，而不是静默坏掉

### 5. 先修真实链路，再做视觉统一

本轮优先级固定为：

1. 统一运行 id 和共享工作流运行链路
2. 后台 schema 治理模型收口
3. 前台统一节点消费模型
4. 旧节点迁移与移除
5. 视觉对齐 RH

不能只先改视觉再回头补链路。

## Options Considered

### Option A: 只修 `COMFYUI_WORKFLOW_NOT_FOUND`，不改节点结构

优点：

- 开发最快
- 风险最小

问题：

- 前台仍是三套 ComfyUI 节点
- 用户体验和心智问题不解决
- 后台治理与前台消费继续分裂
- 后续仍会反复打补丁

结论：

- 不采用

### Option B: 统一成一个主节点，但旧节点隐藏保留兼容

优点：

- 风险低于直接清理
- 回退简单

问题：

- 代码中仍会长期保留三套实现
- 后续维护成本依旧高
- 节点模型不真正收口

结论：

- 不采用

### Option C: 后台治理收口 + 前台只保留一个统一节点 + 旧节点迁移后移除

优点：

- 产品模型最清晰
- 与 RH 一致
- 后端治理可以真正转向 schema-first
- 后续接新工作流时维护成本最低

问题：

- 本轮改动面最大
- 需要补迁移与兼容脚本

结论：

- 采用本方案

## Scope

### In Scope

- 修复共享工作流运行 id 对齐问题
- 把 ComfyUI 前台消费收口为一个统一节点
- 移除旧的 `comfyui-store` 和 `comfyui-app-maker` 模型
- 后台工作流治理页继续升级为结构化 schema 编辑入口
- 明确哪些字段属于：
  - 暴露参数
  - 上游输入
  - 隐藏输入
- 明确输出项的启用、名称、顺序和类型
- 旧画布中的旧节点迁移到统一节点
- 视觉与信息层级向 RH 节点靠齐

### Out Of Scope

- 不做工作流图形拓扑预览器
- 不做工作流在线拖拽编辑器
- 不做工作流版本 diff viewer
- 不做复杂执行日志中心
- 不做多类 ComfyUI 节点并存

## Target Product Model

### 1. 后台：工作流治理中心

后台实例详情页中的“工作流治理”继续保留，但其职责要更明确：

- 创建实例级工作流草稿
- 自动解析 workflow JSON
- 展示解析摘要与告警
- 配置输入映射
- 配置输出映射
- 推送到共享区

这里必须成为唯一正式治理入口。

### 输入项治理规则

每个输入项至少要支持以下治理属性：

- `key`
- `nodeId`
- `fieldName`
- `label`
- `kind`
- `mode`
  - `param`
  - `upstream`
  - `hidden`
- `required`
- `defaultValue`
- `upstreamSlot`
- `order`

### 输出项治理规则

每个输出项至少要支持以下治理属性：

- `key`
- `label`
- `kind`
- `enabled`
- `sourceNodeId`
- `sourceFieldName`
- `order`

### 2. 前台：统一 ComfyUI 节点

前台最终只保留一个 `ComfyUI` 节点。

它的内部结构应当改成：

### A. 头部摘要区

- 节点名称：`ComfyUI`
- 已选共享工作流名称
- 当前实例名称
- 工作流输入/输出摘要
- 返回列表按钮

### B. 工作流选择区

未选工作流时显示：

- 搜索框
- 后台共享工作流列表
- 每个条目的实例、健康状态、参数数、摘要信息

### C. 通用输入区

和 RH 一样，左侧只保留一个总输入口。

所有上游：

- 文本
- 图片
- 视频
- 音频

统一进入节点后，再按后台 `inputSchema` 中 `mode = upstream` 的定义分配。

### D. 参数区

只显示 `mode = param` 的字段。

显示逻辑：

- label
- 类型控件
- 默认值
- 占位提示
- 必填约束

不允许再把隐藏字段或上游字段混入参数面板。

### E. 运行区

- 运行按钮
- 状态文本
- 错误提示
- 刷新共享目录

### F. 输出区

按后台 `outputSchema` 展示命名输出，不再只堆：

- `imageUrls`
- `videoUrls`
- `audioUrls`
- `text`

而是优先消费：

- `outputs: [{ key, label, kind, value }]`

### 3. 旧节点处理策略

本轮统一策略如下：

- `comfyui-app`
  - 升级为新的统一 `ComfyUI` 节点实现
- `comfyui-store`
  - 移除
- `comfyui-app-maker`
  - 移除

同时需要补迁移逻辑：

- 旧 `comfyui-app`
  - 迁移字段结构，保留已选工作流和参数值
- 旧 `comfyui-store`
  - 无法完全等价迁移到共享工作流时，进入明确错误态，提示先去后台发布共享工作流
- 旧 `comfyui-app-maker`
  - 不迁移为运行节点；如历史画布存在，改成可见废弃态并提示该能力已转移到后台

## Maintainability Architecture

### 1. Shared schema 是唯一正式契约

ComfyUI 工作流治理相关的正式契约必须只认：

- `analysis`
- `inputSchema`
- `outputSchema`
- `defaultValues`

禁止再长期依赖这些旧中间结构作为主契约：

- `exposedFields`
- `hiddenFields`
- 零散的前台 manifest 参数定义

旧字段只允许作为过渡兼容读逻辑存在。

### 2. 后端用“解析器 + 规范化器 + registry”三层模型

后端建议固定成三层：

#### A. parser

负责：

- 从 workflow JSON 自动识别输入候选
- 识别输出候选
- 给出 warnings

#### B. normalizer

负责：

- 把历史旧字段迁移到正式 schema
- 填默认值
- 修复顺序、类型、缺省规则

#### C. registry

负责：

- 实例级草稿读写
- 共享工作流发布读写
- revision / updatedAt 管理

新工作流接入时，优先只需要更新 parser 和 schema，而不是改运行页面和节点页面的特判逻辑。

### 3. 前台节点只消费 schema，不再维护第二套 ComfyUI 应用模型

当前前台 `comfyuiApps.ts`、`comfyuiAppManifest.ts`、`ComfyUIStoreNode`、`ComfyUIAppMakerNode` 这一整套“本地应用商店”模型，后续不应继续作为主线。

统一后的前台规则应当是：

- 节点不再自己生产 ComfyUI app manifest
- 节点不再自己定义哪些字段要暴露
- 节点只消费后台共享目录返回的工作流 schema

这条规则是后续可维护性的关键。

### 4. 新增工作流不应要求改代码

理想状态下，新接一个工作流时流程应为：

1. 后台上传 JSON
2. 系统自动解析
3. 管理员调整暴露方式和默认值
4. 推送共享区
5. 前台统一节点直接消费

而不是：

1. 上传 JSON
2. 发现某个字段展示不对
3. 改后端代码
4. 改前端代码
5. 再发版

如果一个新工作流还需要经常改业务代码，说明这次治理模型没有真正收口。

## Data Model

### Input Schema Item

```ts
interface ComfyuiWorkflowInputSchemaItem {
  key: string;
  nodeId: string;
  fieldName: string;
  source: string;
  label: string;
  mode: "hidden" | "param" | "upstream";
  kind: "text" | "textarea" | "number" | "boolean" | "select" | "image" | "video" | "audio";
  required: boolean;
  defaultValue?: unknown;
  upstreamSlot?: string;
  order: number;
}
```

### Output Schema Item

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

### Runtime Result

```ts
interface ComfyuiRunOutput {
  key: string;
  label: string;
  kind: "text" | "image" | "video" | "audio";
  value: string | string[];
}
```

## Runtime Contract

运行接口需要满足：

- 通过真实共享工作流 id 运行
- 前后端都使用同一套 id 语义
- 运行返回优先走命名输出

建议规则：

- 前台节点内部保存：
  - `sharedWorkflowId`
  - `instanceId`
- 运行接口只用共享工作流的稳定 id
- 不再允许 `workflow.id / sharedWorkflowId / cleanId(app.id)` 混用

兼容期可保留：

- `imageUrls`
- `videoUrls`
- `audioUrls`
- `text`

但节点应优先消费：

- `outputs`

## UI Direction

### 1. 结构对齐 RH，而不是复制视觉皮肤

参考 RH 的不是颜色，而是结构：

- 先选择后台条目
- 再看通用输入
- 再看参数区
- 再执行
- 再看输出

这会比现在从上到下堆长表单更清晰。

### 2. 节点顶部要给出足够摘要

头部至少应让用户快速看到：

- 工作流名称
- 实例名称
- 输入需求
- 输出摘要

避免现在这种“看见很多参数，但不知道自己选的是什么工作流”的状态。

### 3. 参数区要有“暴露出来的理由”

参数不是越多越好。

一个字段只有在满足这些条件时才应进入前台：

- 确实需要给画布操作者调整
- 不是固定配置
- 不适合由上游输入驱动
- 不会把节点复杂度推得过高

这意味着后台治理页必须支持管理员主动减少暴露字段，而不是默认全摊开。

## Rollout Strategy

### Phase 1: 修运行 id 与共享工作流链路

- 对齐前后端对共享工作流 id 的使用
- 修复 `COMFYUI_WORKFLOW_NOT_FOUND`

### Phase 2: 后台治理模型收口

- 确认 `inputSchema / outputSchema` 成为唯一正式契约
- 下沉旧字段兼容逻辑
- 补齐 normalizer

### Phase 3: 前台统一节点

- 用统一 `ComfyUI` 节点替换当前前台消费模型
- 节点结构向 RH 靠齐

### Phase 4: 旧节点迁移与移除

- 从 node registry、Canvas、默认数据和入口中移除旧节点
- 补旧画布迁移逻辑

### Phase 5: 视觉收口与验收

- 节点样式和层级对齐 RH
- 浏览器验收真实共享工作流链路

## Risks

### 1. 旧画布迁移风险

历史画布中如果用了 `comfyui-store` 或 `comfyui-app-maker`，可能无法一键无损迁移。

应对策略：

- 明确降级态
- 提示到后台重新发布共享工作流
- 不做静默失败

### 2. schema 兼容风险

历史 registry 里可能同时存在：

- `exposedFields`
- `hiddenFields`
- `inputSchema`

需要保证迁移时不丢已有默认值和输出定义。

### 3. 节点统一后短期改动面较大

本轮会同时影响：

- API
- admin
- web
- Canvas 迁移逻辑
- node registry

因此必须按批次验证，而不是一次性大改后直接发版。

## Verification

至少要验证以下场景：

1. 后台上传一个真实 ComfyUI workflow JSON
   - 自动识别输入项和输出项
   - 产生可读 warnings

2. 后台把部分字段改成：
   - `param`
   - `upstream`
   - `hidden`
   保存后不丢失

3. 前台统一 ComfyUI 节点
   - 只显示 `param` 字段
   - 上游输入仍可正常注入
   - 输出按 `outputSchema` 命名展示

4. 共享工作流真实运行
   - 不再出现 `COMFYUI_WORKFLOW_NOT_FOUND`

5. 新画布中
   - 只能添加一个 ComfyUI 节点

6. 旧画布中
   - 旧 ComfyUI 节点要么自动迁移
   - 要么进入明确降级提示态

## Acceptance Standard

完成后必须满足：

- 前台只剩一个统一的 ComfyUI 节点
- 旧三个 ComfyUI 节点不再作为正式入口存在
- 后台可以明确控制哪些参数暴露、哪些来自上游、哪些隐藏
- 后台参数治理是结构化、可维护、可扩展的，而不是继续补丁式加规则
- 新接一个工作流时，优先通过后台治理完成接入，而不是继续改业务代码
- ComfyUI 节点的视觉和逻辑层级接近 RH 节点
- 共享工作流在灰度真实运行时不再报 `COMFYUI_WORKFLOW_NOT_FOUND`
