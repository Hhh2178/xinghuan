# Provider and Model Framework

## 背景

当前统一后台已经具备 Provider 和模型目录的雏形，但能力仍停留在“手工填一行 Provider、手工填一行模型”的粗粒度阶段。下一步需要把它升级为后台统一模型服务商框架，让画布前端只消费后台发布后的模型能力，不再在画布工作台暴露服务商 Key、Base URL 或 Provider 设置入口。

参考实现：`D:\AI canvas\Infinite-Canvas`。其中 `main.py` 的 `/api/providers/test-connection`、`/api/providers/fetch-models`、`parse_upstream_models`，以及 `static/js/api-settings.js` 的模型选择器，提供了可借鉴的交互和接口模式。

## 产品原则

- 画布前端不再管理服务商。画布只展示可用的通用节点和后台发布的模型选项。
- Provider、Key、Base URL、协议探测、模型拉取、模型导入和模型分类全部在统一后台完成。
- 模型按能力分为三类：`chat`、`image`、`video`。
- 上游拉取结果不能自动全量导入。必须进入候选选择器，由管理员选择性加入模型目录。
- 管理员必须能手动新增、编辑、停用、删除或调整模型分类。
- Worker 执行任务时只读取后台模型目录和 Provider 配置，不读取浏览器本地 Key。

## 后台信息架构

后台保留两个一级模块：

- `Provider 管理`：管理服务商身份、请求地址、协议、Key、连通性和模型拉取。
- `模型目录`：管理已发布给画布节点使用的模型，按 `语言 / 图像 / 视频` 三类维护。

建议后台 Provider 页面采用左右布局：

- 左侧：服务商列表，展示名称、Base URL、协议、启用状态、Key 是否已保存。
- 右侧：服务商编辑器，包含基本信息、API Key、安全状态、验证地址、拉取模型、选择导入、模型分类预览。

模型目录页面按能力分区：

- `语言模型`：供通用 LLM/文本节点和后续 Vision/Agent 节点使用。
- `图像模型`：供通用图像生成、图像编辑、多参考图节点使用。
- `视频模型`：供通用视频生成、首尾帧视频、图生视频节点使用。

## Provider 数据模型

建议 `Provider` 字段：

- `id`：稳定唯一 ID，不随名称变化。
- `name`：后台显示名称。
- `baseUrl`：请求根地址。
- `protocol`：`openai`、`gemini`、`runninghub`、`volcengine`、`custom` 等。
- `enabled`：是否启用。
- `apiKeyCipher`：加密后的 Key，仅服务端可解密。
- `apiKeyPreview`：脱敏预览。
- `lastProbeStatus`：最近验证结果。
- `lastProbeMessage`：最近验证说明。
- `lastFetchedAt`：最近拉取模型时间。
- `note`：管理员备注。
- `createdAt`、`updatedAt`。

后续可扩展字段：

- `requestHeadersSchema`：特殊请求头配置。
- `modelProtocols`：单个模型覆盖 Provider 默认协议。
- `rateLimitProfile`：并发、限速和重试策略。
- `billingProfile`：成本和计费维度。

## 模型数据模型

建议 `Model` 字段：

- `id`：后台模型记录 ID。
- `providerId`：所属 Provider。
- `modelId`：上游真实模型 ID。
- `displayName`：后台和画布显示名。
- `capability`：`chat`、`image`、`video`。
- `enabled`：是否发布给画布。
- `inputProfile`：输入形态，如 `prompt`、`image-prompt`、`first-last-frame`。
- `parameterSchema`：节点参数 schema。
- `protocolOverride`：可选，单模型覆盖 Provider 协议。
- `sortOrder`：后台排序和画布默认排序。
- `createdAt`、`updatedAt`。

建议新增临时候选结构 `FetchedModelCandidate`，用于“拉取后选择导入”：

- `providerId`
- `modelId`
- `suggestedCapability`
- `selected`
- `source`
- `raw`

候选可以只存在于接口响应和后台前端状态中，也可以落库为最近一次拉取快照，供管理员稍后继续选择。

## 后端接口设计

Provider CRUD：

- `GET /api/admin/providers`
- `POST /api/admin/providers`
- `PATCH /api/admin/providers/:id`
- `DELETE /api/admin/providers/:id`

Key 与安全：

- `PATCH /api/admin/providers/:id/key`
- `DELETE /api/admin/providers/:id/key`

连通性与模型拉取：

- `POST /api/admin/providers/probe`
  - 用未保存的草稿 `baseUrl`、`apiKey`、`protocol` 尝试验证。
- `POST /api/admin/providers/:id/probe`
  - 使用已保存 Provider 和已保存 Key 验证。
- `POST /api/admin/providers/fetch-models`
  - 用未保存草稿拉取上游模型。
- `POST /api/admin/providers/:id/fetch-models`
  - 用已保存 Provider 拉取上游模型。

模型目录：

- `GET /api/admin/models`
- `POST /api/admin/models`
- `PATCH /api/admin/models/:id`
- `DELETE /api/admin/models/:id`
- `POST /api/admin/providers/:id/import-models`
  - 请求体包含管理员选择后的模型列表，不接受全量自动导入。

画布消费接口：

- `GET /api/models`
  - 返回当前用户可用模型，按 `chatModels`、`imageModels`、`videoModels` 分组。
- `GET /api/providers/public`
  - 如画布确需显示 Provider 名称，只返回非敏感公开字段。

## 上游模型拉取策略

不同协议的模型列表地址：

- `openai`：`{baseUrl}/v1/models`，如果 `baseUrl` 已以 `/v1` 结尾则使用 `{baseUrl}/models`。
- `gemini`：`{baseUrl}/v1beta/models`，如果已以 `/v1beta` 结尾则使用 `{baseUrl}/models`。
- `volcengine`：优先 `{baseUrl}/api/v3/models`，若列表不可用但任务协议可达，可提示使用默认视频模型或手工填写 `ep-...` 接入点。
- `runninghub`：`{baseUrl}/openapi/v2/models`，但 RH 工作流/API 应用不应直接混入通用三类模型，需要后续单独映射。

模型分类启发：

- 命中 `veo`、`sora`、`wan`、`kling`、`hailuo`、`video`、`t2v`、`i2v` 等关键词归为 `video`。
- 命中 `image`、`dall-e`、`imagen`、`flux`、`sdxl`、`seedream`、`qwen-image` 等关键词归为 `image`。
- 其他默认归为 `chat`。

启发分类只是建议，管理员在选择导入时可以覆盖分类。

## 后台交互验收

- 管理员可以新增 Provider，填写名称、Base URL、协议和 Key。
- Key 保存后页面只显示脱敏预览，不回显明文。
- 管理员可以点击“验证地址”，看到成功/失败、HTTP 状态和简短错误原因。
- 管理员可以点击“拉取模型”，后台返回 `chat/image/video/all`。
- 拉取后不会自动导入模型目录。
- 管理员可以在选择器里搜索、按分类过滤、勾选模型，并修改模型分类。
- 导入后模型进入对应的语言、图像、视频分区。
- 管理员可以手动新增模型、改模型所属 Provider、改能力分类、停用或删除模型。
- 画布端 API 设置入口不可见。
- 画布端通用节点只能使用后台已启用模型。

## 视觉验收

- 后台 Provider 和模型页面统一采用星幻科技风，不能回到默认白底粗糙表单。
- 信息密度要接近管理台，而不是营销页：左侧列表、右侧表单、分区表格、固定操作按钮。
- Key 输入、Base URL、协议选择、验证、拉取模型和导入模型的主次关系清晰。
- 模型选择器必须清楚显示：总数、已选数、语言/图像/视频分类数和未选择数。
- 小屏幕下 Provider 列表和编辑器允许上下堆叠，按钮文字不能溢出。

## 实施顺序

1. 移除画布前端 API 设置入口，保留迁移期兼容加载。
2. 扩展 Provider schema：加入 `protocol`、探测状态和拉取时间。
3. 新增 Provider probe/fetch-models API。
4. 新增后台 Provider 编辑器和模型选择器。
5. 扩展模型目录 CRUD，支持三类分区和手工调整。
6. 新增画布模型消费接口，将通用节点模型来源切到后台。
7. Worker 按 `capability + provider.protocol` 分发到真实 Provider Adapter。
8. 输出素材落库和资源库联动。

## 暂不做

- 暂不重做 T8 画板主体 UI。
- 暂不处理 RH 专用节点分组。
- 暂不把所有上游模型自动发布给用户。
- 暂不在文档或日志中记录真实 Key。
