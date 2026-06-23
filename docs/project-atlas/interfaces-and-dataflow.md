# 核心接口与数据流

> 兼容说明：本页继续保留为旧正文，新的主入口优先看 `docs/systems/api/interface-map.md`、`docs/systems/api/request-response-flow.md`、`docs/systems/runninghub/`。

## 主要接口分组

### 认证与会话

- `/api/auth/login`
- `/api/auth/admin-login`
- `/api/auth/me`
- `/api/auth/logout`
- `/api/admin/sessions`

用途：

- 前台/后台登录
- 当前会话识别
- 会话撤销与治理

### 画布与项目

- `/api/canvas/*`
- `/api/projects/*`

用途：

- 画布读取、保存、auto-save、revision 冲突保护

### 资源与素材

- `/api/resources/*`
- `/api/materials/generation-library/*`
- `/files/*`

用途：

- 资源库、生成库、输入输出素材访问
- 当前生成库内容访问统一走素材访问层，不再让前端各自拼 URL

### 后台治理

- `/api/admin/providers/*`
- `/api/admin/models/*`
- `/api/admin/tasks`
- `/api/admin/system`
- `/api/admin/users/*`
- `/api/admin/environment-sync/*`
- `/api/admin/runninghub/items`

用途：

- Provider / 模型发布
- 任务分页、筛选、取消、状态观察
- 系统观测与 release gate
- gray / production 的用户与服务商（含关联模型）差异预览、逐项勾选同步、冲突裁决
- RunningHub 工作台条目维护、结构化输入槽管理、预览校验

### RunningHub

- `/api/runninghub/catalog`
- `/api/runninghub/catalog/:id`
- `/api/proxy/runninghub/upload-asset`
- `/api/proxy/runninghub/submit`
- `/api/proxy/runninghub/query`

用途：

- RH catalog 公开读取
- 单一 RH 节点按结构化 schema 消费条目
- RH 素材上传、任务提交与轮询

补充边界：

- RH page/workflow 展示 id 与真实运行时 `workflowId` 分离：
  - page/sku id 用于后台录入与人工识别
  - 真实提交走 `/openapi/v2/run/workflow/{workflowId}`
  - 真实查询走 `/openapi/v2/query`
- RH task 入库时不再强行复用普通模型外键；`xh_tasks.model_id` 保持空字符串，避免把 RH page id 误写成模型 id

### 生成代理

- `/api/proxy/external/image`
- `/api/proxy/external/image/task`
- `/api/proxy/external/video`
- `/api/proxy/external/video/task`
- `/api/proxy/external/chat`

用途：

- 同步与异步生成代理
- 通用节点面向后台目录消费，不面向单 Provider 硬编码

补充边界：

- Provider 协议、请求体模式、文件字段注入和模型级端点分流，当前统一按系统层设计处理
- 相关长期规则见：
  - `provider-protocol-and-request-body-design.md`

## 关键数据流

### 图像 / 视频生成

1. 前端提交生成请求
2. API 读取用户会话、模型目录、Provider 配置
3. API 直接同步执行，或写入任务表并送入 Redis
4. Worker 消费任务、调用上游、轮询结果
5. 输出素材写入 `/files/output/...`
6. 结果回写任务表与生成库

### Provider 请求体构建

1. 前端或后台只提交能力、模型和业务参数
2. API 根据 Provider / 模型目录与高级配置判断：
   - 默认 JSON
   - `multipart/form-data`
   - 文件字段注入
   - 模板派生字段
3. 如存在异步任务协议，Worker 按对应 adapter 提交与轮询
4. 结果提取后统一回写任务和素材层

### 后台观测

1. 后台读取 `/api/admin/system`
2. API 汇总数据库、任务、审计、conflict 统计
3. 页面展示 health / trend / coverage 状态

### 灰度 / 正式环境同步

1. 管理员在“环境同步”页选择 `sourceEnvironment` 和 `targetEnvironment`
2. 管理端调用 `/api/admin/environment-sync/preview`
3. 当前 API 实例按目标环境决定：
   - 当前环境本地直接读取
   - 对端环境通过 `/api/internal/environment-sync/snapshot` 拉取快照
4. 服务端按：
   - 用户 `email`
   - 服务商 `name`
   - 模型 `provider.name + capability + modelId`
   做差异比较并返回逐项决策建议
5. 管理员勾选项并提交 `/api/admin/environment-sync/apply`
6. 服务端只把 `use_source` 的用户 / 服务商写入目标环境：
   - 本地环境直写
   - 对端环境通过 `/api/internal/environment-sync/apply` 受控写入
   - 勾选服务商时，同时写入该服务商下的全部模型配置
7. 管理端展示逐项结果，API 写入审计日志

### 生成库访问

1. 列表接口返回 `previewUrl` / `downloadUrl` / `openUrl`
2. 前端预览/下载统一通过内容路由访问
3. 素材访问层负责 disposition 和文件名语义

### RunningHub 工作台 -> 单一 RH 节点

1. 管理员在 `RH 工作台` 维护条目基础信息、输入槽、参数 schema、输出定义和执行描述
2. 后台通过 `/api/admin/runninghub/items` 读取目录，通过 `POST /api/admin/runninghub/items` 新建条目，通过 `PATCH /api/admin/runninghub/items/:id` 保存结构化编辑结果，通过 `DELETE /api/admin/runninghub/items/:id` 删除条目
3. RH 工作台还提供 `/api/admin/runninghub/analyze`，输出 `基础信息 / 输入槽 / 参数 Schema / 输出定义 / 执行规则` 五类结构化草案卡片
4. 画布通过 `/api/runninghub/catalog` 拉取公开 catalog，优先消费 `items`，兼容旧 `workflows/apps`
5. `RunningHubNode` 用 `buildRunningHubNodeSchema()` 将 catalog 条目转成节点视图模型
6. 节点保留固定 typed handles：
   - `text-in`
   - `image-in`
   - `video-in`
   - `audio-in`
   - `json-in`
7. 节点内部再根据 `inputSlots` 渲染具体字段与上游素材映射，并以“输入摘要 + 参数区 + 小字状态摘要”呈现
8. 节点界面不再继续暴露 `Webapp ID` 文案，而是由后台目录与执行描述统一掌管底层运行标识
9. 运行时仍通过 `upload-asset -> submit -> query` 完成 RH 任务代理

### 普通 Provider 队列治理

1. API 写入 provider generation task 时保留 capability、ownerId、超时配置和 provider/model 上下文
2. Worker 读取系统并发设置后，先按 capability 进入分类队列
3. 真正执行前再判断用户窗口：
   - 同一 `ownerId + capability` 达到并发上限时，任务保持 queued
   - 写入 `waitReason = waiting_user_window`
4. 当正在执行的同用户任务结束后，等待任务自动推进
5. 跨用户任务不共享同一用户窗口，可并行推进

### RunningHub 平台并发治理

1. RH 任务进入专用执行判断链，读取 RH 平台并发窗口上限
2. 若 RH 在跑任务数已满，则新任务保持 queued
3. 任务写入：
   - `waitReason = waiting_runninghub_window`
   - `waitDetail = RunningHub 平台并发已满 (used/limit)`
4. 有 RH 任务结束后，等待任务自动递进
5. 该窗口只约束 RH，不影响普通 Provider worker 队列

## 当前高频风险点

- CSRF 之后，所有本地脚本写请求必须带 same-origin `Origin`
- file-mode 多脚本并行会互相覆盖本地会话和审计样本
- 某些上游失败会返回 HTML 或非 JSON，必须在代理层做明确报错
- 可写型验证脚本如果不自清理，会在线上残留假 Provider 或假数据
- 环境同步依赖 `XINGHUAN_ENVIRONMENT_SYNC_TOKEN` 和 gray / production 的 API 基地址；缺配置时后台页会失败，不能默默回退成本地假同步
