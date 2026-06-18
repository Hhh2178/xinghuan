# 多任务生成状态、素材追加与超时统一设计

## 背景

当前图像/视频节点在“生成数量 > 1”时，已经采用“多任务异步提交”策略，而不是单任务一次返回多份产物。这条策略本身符合当前 Worker 任务链路和后台任务中心的结构，也更方便后续定位单个子任务的失败原因。

但当前实现已经暴露出四类实际问题：

1. 多任务生成时，节点只展示一个总状态，无法看到每个子任务各自的排队、运行、成功、失败过程。
2. 多任务成功返回多张图或多段视频时，节点与输出素材链路没有把“多个成功子任务的全部产物”稳定追加展示，经常表现为只保留第一张或最后一张。
3. 不同协议的超时控制存在不一致：
   - 通用 async image/video adapter 已支持从任务 payload 读取 `timeoutMs` / `pollTimeoutMs`
   - GRSAI 单独 adapter 仍使用内置默认超时，导致用户在后台配置更长轮询时间时并未真正生效
   - 需要进一步检查其他协议是否也残留类似硬编码超时
4. 部分节点在上游已经传入素材时，运行侧仍然报 `NOT_FOUND` 或表现为“明明接了图，但执行时没有收到素材”。

本轮要在保留“多任务异步提交”策略的前提下，把这四个问题一起收口，随后推送灰度验证。

## 目标

本轮目标：

1. 保持图像/视频节点的多任务异步提交策略不变。
2. 为图像/视频节点增加可视化的“子任务状态”展示，覆盖进行中和结束态。
3. 让多个成功子任务返回的全部图像/视频都能稳定追加到节点产物与输出素材链路，而不是互相覆盖。
4. 统一后台生成链路的超时来源，优先使用任务 / 模型配置，不再被局部硬编码超时覆盖。
5. 修复部分节点的素材传入丢失问题，保证上游素材能被下游处理节点稳定读取。

## 非目标

- 不改成“单任务一次返回多图 / 多视频”的新提交模式。
- 不改动服务商后台自身的展示逻辑。
- 不在本轮改造后台任务中心为父子任务树。
- 不引入新的任务编排服务或新的数据库表。

## 方案对比

### 方案 A：继续保留当前总状态，只修追加产物和超时

优点：

- 改动最小
- UI 改动少

缺点：

- 多任务时用户仍然看不到哪个子任务失败
- 后续灰度排障依旧要去后台任务中心逐个对照
- 不能真正支撑“多任务异步提交”这一策略的可观察性

结论：

- 不采用

### 方案 B：节点内增加轻量子任务运行态，继续复用现有后台任务表

做法：

- 前端图像/视频节点增加 `taskRuns` 或等价字段，记录每个子任务：
  - `taskId`
  - `batchIndex`
  - `status`
  - `progress`
  - `error`
  - `outputCount`
  - `startedAt/finishedAt`
- 子任务成功后立刻把该任务产物追加到节点 `imageUrls/videoUrls`
- 输出素材节点继续从上游统一聚合，不单独持久化额外副本
- Worker / API 层统一超时透传规则

优点：

- 不推翻现有任务架构
- 节点内就能看见每个子任务的过程与结果
- 与当前后台任务中心一一对应，方便排查
- 多图/多视频聚合逻辑可以直接和节点运行态结合

缺点：

- 需要调整节点数据结构
- 需要补前端聚合和运行卡片 UI

结论：

- 采用

### 方案 C：引入父任务 + 子任务建模

优点：

- 理论上更完整

缺点：

- 需要改数据库、API、后台任务中心、前端节点状态模型
- 本轮问题不需要上升到这个复杂度

结论：

- 不采用

## 最终设计

### 1. 多任务状态模型

图像节点和视频节点都增加统一的子任务运行态字段，建议结构：

- `taskRuns: Array<{`
  - `taskId: string`
  - `batchIndex: number`
  - `kind: "image" | "video"`
  - `status: "queued" | "submitting" | "polling" | "running" | "success" | "error" | "cancelled"`
  - `progress: string`
  - `error?: string`
  - `outputCount: number`
  - `startedAt?: number`
  - `finishedAt?: number`
`}>`

行为规则：

- 点击生成时，按 `generationCount` 初始化子任务列表。
- 每个子任务提交后写入对应 `taskId`。
- 每轮轮询更新时，仅更新对应 `taskId` 的子任务状态，不再只覆盖节点级单个 `taskId/progress`。
- 结束时：
  - 成功写 `status=success`
  - 失败写 `status=error`
  - 用户取消写 `status=cancelled`

节点级总状态仍保留，但只作为摘要：

- 全部成功 => `success`
- 全部失败 => `error`
- 部分成功部分失败 => `success`，同时显示“部分失败”
- 任一子任务进行中 => `polling` 或 `generating`

### 2. 多任务产物追加策略

当前多任务成功产物要改为“逐任务追加”，而不是最终批量覆盖：

- 每个子任务一旦成功，就把返回的全部 `imageUrls/videoUrls` 追加进节点自己的聚合数组
- 聚合规则：
  - 保留已有成功产物
  - 同 URL 去重
  - 不因后续子任务失败而清空已成功内容
- 节点对外暴露字段继续沿用现有兼容结构：
  - 图像：`imageUrl`, `imageUrls`
  - 视频：`videoUrl`, `videoUrls`

这样输出素材节点、上传素材中转节点、其他消费 `useUpstreamMaterials` 的节点都能继续从统一字段读取，而不需要单独认识 `taskRuns`。

### 3. 输出素材节点联动

输出素材节点不额外存自己的多任务副本，继续从上游聚合，但要满足：

1. 上游节点每追加一条新产物，输出素材节点能够感知到 `imageUrls/videoUrls` 变化并新增展示。
2. 不允许“后完成的子任务”把先完成的子任务结果顶掉。
3. 同一上游节点返回多张图时，输出素材节点要完整显示全部项。

这部分主要依赖：

- 上游图像/视频节点稳定维护 `imageUrls/videoUrls`
- `useUpstreamMaterials` 正确识别数组字段
- 输出素材节点自身不要再做错误的覆盖式归并

### 4. 超时统一规则

统一原则：

- 前端显示层 timeout 只负责“本地等待轮询接口多久算超时”
- 后端 API / Worker 执行层 timeout 负责“实际向上游轮询多久算失败”
- 任何协议都必须优先读取任务 payload / 模型 advancedConfig 中的 timeout 配置，再回退默认值

统一优先级：

1. `task.payload.timeoutMs`
2. `task.payload.maxPollMs`
3. `task.payload.pollTimeoutMs`
4. 模型 advancedConfig 中已展开的等价字段
5. 协议默认值

本轮必须检查并统一的链路：

- Worker:
  - GRSAI image adapter
  - 通用 async image adapter
  - 通用 async video adapter
  - ModelScope / APIMart 特化轮询链
- API:
  - external proxy 中的同步/异步图像与视频轮询适配
- 前端:
  - 图像节点后台任务轮询
  - 视频节点后台任务轮询

重点修正：

- GRSAI 目前仍内置 `120000ms`，必须改成透传任务配置。
- 排查是否还有其他协议的 `120000 / 180000 / 360000` 被直接写死但未允许覆盖。

### 5. 素材传入丢失修复

本轮要沿这条链路排查并修复：

- `useUpstreamMaterials`
- `ImageOpFrame`
- `ResizeNode`
- 其他使用统一上游聚合 hook 的处理节点

优先判断三类问题：

1. 上游字段存在，但下游只读了单值字段，没读数组字段
2. 上游是本地 `/files/output/...` 或任务输出素材 URL，下游运行接口没有正确传入
3. 某些节点运行时只取首张图，或在空数组与 `undefined` 间判断错误，导致报 `NOT_FOUND`

以截图中的 `ResizeNode` 为例，本轮验收要求是：

- 上游上传图像连接到尺寸调整节点后，运行时必须拿到图像输入
- 不允许再出现“画布中可见已连图，但运行时报 `NOT_FOUND`”

## 数据流

### 多图像任务

1. 图像节点按 `generationCount` 创建 N 个子任务运行态
2. 每个子任务独立提交后台任务
3. 每个后台任务独立轮询
4. 任一子任务成功：
   - 更新对应子任务状态
   - 将该任务返回的全部图片追加到节点 `imageUrls`
   - 更新 `imageUrl = imageUrls[0]`
5. 下游输出素材 / 处理节点通过 `useUpstreamMaterials` 读取更新后的数组字段

### 多视频任务

与图像节点同理，只是字段换为 `videoUrl/videoUrls`

### 超时

1. 节点提交后台任务时把模型/协议相关 timeout 参数带入 payload
2. API/Worker 统一按优先级读取 timeout
3. 子任务失败时把明确错误写回节点运行态与后台任务结果

## 错误处理

- 单个子任务失败：
  - 不清空其他成功产物
  - 子任务卡片展示失败原因
  - 节点总状态在“已有成功产物”的情况下保持成功，但附带部分失败提示
- 全部子任务失败：
  - 节点总状态为失败
  - 错误信息聚合显示
- 输入素材缺失：
  - 明确区分“没有连接任何上游素材”和“已连接但解析失败”
  - 不允许继续给出模糊 `NOT_FOUND` 而没有上下文

## 测试策略

本轮至少覆盖以下验证：

1. 图像节点多任务时：
   - 多个任务成功会累计到 `imageUrls`
   - 一个成功一个失败时，成功产物保留
   - `taskRuns` 正确反映每个子任务状态
2. 视频节点多任务时：
   - 多个任务成功会累计到 `videoUrls`
   - `taskRuns` 正确反映状态
3. GRSAI timeout：
   - 配置的超时时间能真正透传到 Worker adapter
4. 其他协议 timeout：
   - 关键 adapter 不再忽略 payload timeout
5. 素材传入：
   - `ResizeNode` 能稳定消费上游上传图像
   - 统一上游聚合 hook 不会漏掉数组型图像/视频字段

## 影响范围

- `apps/web/src/components/nodes/ImageNode.tsx`
- `apps/web/src/components/nodes/VideoNode.tsx`
- `apps/web/src/components/nodes/NodeRuntimeCard.tsx`
- `apps/web/src/components/nodes/ImageOpFrame.tsx`
- `apps/web/src/components/nodes/ResizeNode.tsx`
- `apps/web/src/components/nodes/useUpstreamMaterials.ts`
- `apps/web/src/services/generation.ts`
- `apps/worker/src/worker.ts`
- `apps/api/src/external-proxy.ts`
- 相关验证脚本 `scripts/verify-*.mjs|ts`

## 验收标准

灰度通过以下场景才算本轮完成：

1. 图像节点选择生成数量 `2` 或以上时：
   - 节点内能看到多个子任务状态
   - 成功返回的每张图都进入节点与输出素材展示
   - 一个子任务失败不会覆盖掉另一个已成功子任务的产物
2. 视频节点多任务时具备同样行为
3. GRSAI 与其他已接入 async 协议都按配置 timeout 行为执行，不再出现局部硬编码抢先生效
4. 上传图像 -> 尺寸调整 等处理链路运行正常，不再报输入素材 `NOT_FOUND`
