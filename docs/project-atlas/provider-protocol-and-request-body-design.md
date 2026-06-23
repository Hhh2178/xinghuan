# Provider 协议与请求体设计

> 兼容说明：本页继续保留为旧正文，新的主入口优先看 `docs/systems/providers/protocol-layering.md` 与 `docs/systems/providers/request-body-and-file-strategy.md`。

这份文档用于说明无限画布 2.0 当前是如何处理不同 Provider 的协议差异、请求体差异和文件上传差异的。

目标不是记录某一个平台的临时适配技巧，而是沉淀一套后续接入新平台时可以复用的系统层设计。

## 为什么需要这层设计

外部 AIGC 平台并不只是在模型名上不同，常见差异至少包括：

- 提交端点不同
- 同一 Provider 下不同模型走不同端点
- 有的平台使用 JSON body
- 有的平台使用 `multipart/form-data`
- 有的平台参考图传 URL
- 有的平台必须传真实文件
- 某些派生字段要由比例、分辨率、时长等参数组合生成

如果这些差异都直接散落在节点前端、后台表单或单个 adapter 的硬编码分支里，后续每接一个平台，复杂度都会继续外溢。

因此当前项目把这部分拆成三层。

## 三层设计

### 1. 默认结构层

适合绝大多数接近 OpenAI 风格的平台：

- 标准 `baseUrl`
- 标准能力分类：`chat / image / video / audio`
- 常规 JSON body
- 常规参考图 URL

这层的目标是让常规平台不需要额外 adapter 也能接通。

### 2. 可控高级配置层

当平台仍属于“同一条主链”，但请求体细节不同，就放在模型高级配置中控制，而不是立刻新增专用节点。

当前已沉淀的核心字段：

- `requestBodyMode`
  - 说明请求体组装模式，例如 `json`、`multipart`
- `requestContentType`
  - 显式声明提交时的内容类型
- `requestFileFields`
  - 声明哪些字段需要按文件方式注入
- `requestValueTemplates`
  - 为派生字段提供模板，例如由 `ratio + resolution` 派生 `size`

这层的目标是把“请求体差异”收口成数据，而不是继续分散到页面逻辑里。

### 3. 协议 / adapter 层

当差异已经不只是字段名不同，而是：

- 提交与轮询协议不同
- 结果提取路径不同
- 上游状态机不同
- 文件访问链路不同

这时才进入协议 / adapter 层。

当前实现入口主要包括：

- `apps/api/src/external-proxy.ts`
- `apps/api/src/provider-request-body.ts`
- `apps/api/src/provider-response-parser.js`
- `apps/worker/src/worker-provider-request-body.ts`

## 当前系统级能力边界

当前推荐的判断顺序：

1. 先判断是否能用默认结构层接入
2. 如果只是请求体差异，优先落到高级配置层
3. 只有出现真正协议差异时，才新增 adapter 逻辑

不要一开始就为某个平台单独造节点，也不要直接把模型特殊逻辑写死到前端。

## 柏拉图接入作为样本

`2026-06-17` 的柏拉图视频接入证明了这套边界的必要性。

同一 Provider 下当前已确认存在两类模型：

- `grok-1.5-video-6s/10s/15s`
  - 走 `/v1/videos`
  - 走 `multipart/form-data`
  - 参考图字段为 `input_reference`
- `grok-imagine-video-1.5-preview`
  - 继续走 `/v2/videos/generations`
  - 继续使用 JSON body

这说明“一个 Provider 对应一个固定协议”本身就是不成立的，系统必须允许模型级别的请求体和端点分流。

## 后台 AI 助手为什么也要理解这层设计

后台的 API 接入助手和右侧后台 AI 助手，不应继续只输出“猜测性的协议建议”。

当前它们的目标输出应是结构化接入方案，至少明确：

- 推荐协议层
- 端点模式
- 请求体模式
- 文件字段
- 派生字段模板
- 结果提取路径
- 是否需要额外 adapter

这也是为什么助手输出现在要改成结构化 blocks / cards，而不是长段散文。

## 后续新增平台的建议流程

1. 先确认平台能力域：
   - `chat / image / video / audio`
2. 再确认请求体模式：
   - JSON 还是 multipart
3. 再确认参考素材模式：
   - URL 还是文件
4. 再确认是否存在模型级分流：
   - 同一 Provider 下是否不同模型走不同端点
5. 最后再决定：
   - 默认层
   - 高级配置层
   - adapter 层

## 相关入口

- `docs/project-atlas/interfaces-and-dataflow.md`
- `docs/project-atlas/api-navigation.md`
- `docs/project-atlas/worker-execution-chain.md`
- `apps/api/src/external-proxy.ts`
- `apps/api/src/server.ts`
- `apps/worker/src/worker.ts`

## 维护触发条件

出现以下变化时，必须同步更新本文：

- 新增新的请求体模式
- 新增新的文件字段注入规则
- 同一 Provider 下新增模型级端点分流
- 协议 / adapter 边界调整
- 后台助手结构化接入方案字段发生变化
