# 无限画布 2.0 SPEC

## 1. 系统边界

系统由五个核心面组成：

- Web 工作台：无限画布、节点编辑、素材空间、任务面板。
- Admin 后台：用户、Provider、模型、任务、日志、素材、系统状态。
- API 服务：认证、项目、画布、工作流、素材、任务、模型目录。
- Worker 服务：任务队列消费、Provider Adapter、轮询、结果落库。
- 存储层：数据库、对象存储或本地对象目录、日志文件、缓存队列。

## 2. 推荐模块

### 2.1 节点注册系统

每个节点至少包含：

- `type`：稳定内部类型。
- `title`：用户可见名称。
- `category`：输入、生成、处理、控制、输出、素材、Agent。
- `inputs`：输入端口定义。
- `outputs`：输出端口定义。
- `parameters`：参数 schema。
- `renderer`：前端渲染组件。
- `executor`：后端或前端执行器标识。
- `capabilities`：支持批量、多图、视频、音频等能力。

### 2.2 类型系统

基础类型：

- `image`
- `video`
- `text`
- `audio`
- `mask`
- `bbox`
- `json`
- `array`
- `assetRef`
- `modelRef`
- `control`

连接规则必须由统一函数校验，节点内部不能自行放宽为 `any`。

### 2.3 Provider 模型目录

Provider 字段：

- `id`
- `name`
- `protocol`
- `baseUrl`
- `encryptedApiKey`
- `enabled`
- `healthStatus`
- `createdBy`

Model 字段：

- `id`
- `providerId`
- `modelKey`
- `displayName`
- `modality`
- `capabilities`
- `parameterSchema`
- `defaultValues`
- `inputProfile`
- `outputProfile`
- `costProfile`
- `enabled`

### 2.4 通用图像生成节点

输入：

- `prompt: text`
- `referenceImages: image[]`，数量由模型 input profile 控制。
- 可选：`mask: mask`、`styleRef: image`、`control: control`。

输出：

- `image`
- `assetRef`
- `metadata: json`

参数：

- 从模型 `parameterSchema` 渲染，如尺寸、比例、质量、seed、风格、数量。

### 2.5 通用视频生成节点

输入：

- `prompt: text`
- `firstFrame: image`
- `lastFrame: image`
- `referenceImages: image[]`
- `referenceVideo: video`

输出：

- `video`
- `assetRef`
- `metadata: json`

参数：

- 时长、比例、分辨率、镜头运动、帧率、质量、seed。

## 3. API 草案

认证：

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

项目：

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `PATCH /api/projects/:id`

画布与工作流：

- `GET /api/projects/:id/canvases`
- `POST /api/projects/:id/canvases`
- `GET /api/canvases/:id`
- `PUT /api/canvases/:id`
- `POST /api/workflows/:id/runs`

素材：

- `GET /api/projects/:id/assets`
- `POST /api/projects/:id/assets`
- `GET /api/assets/:id`

任务：

- `GET /api/tasks`
- `GET /api/tasks/:id`
- `POST /api/tasks/:id/cancel`
- `POST /api/tasks/:id/retry`

后台：

- `GET /api/admin/system`
- `GET /api/admin/users`
- `GET /api/admin/providers`
- `POST /api/admin/providers`
- `POST /api/admin/providers/:id/discover-models`
- `GET /api/admin/models`
- `POST /api/admin/models`
- `PATCH /api/admin/models/:id/schema`

## 4. 最小 POC 验收链路

1. 管理员登录后台。
2. 创建 GRSAI Provider。
3. 录入或发现 `gpt-image-2` 模型。
4. 编辑模型参数 schema 和 input profile。
5. 普通成员创建项目。
6. 上传图片素材。
7. 添加通用图像生成节点。
8. 选择 GRSAI `gpt-image-2`。
9. 节点自动显示 prompt 和参考图端口。
10. 执行任务，worker 调用外部 API。
11. 输出图片进入项目素材空间。
12. 任务日志和参数快照可查。

## 5. 不做范围

- v0.1.0 不实现本地模型推理。
- v0.1.0 不做公开 SaaS 支付、套餐和计费。
- v0.1.0 不做复杂多人实时协作。
- v0.1.0 不迁移旧项目代码，除非某个模块经评估确实值得复用。
