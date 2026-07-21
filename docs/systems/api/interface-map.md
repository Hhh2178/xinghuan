# API 接口地图

## 后台类接口

- `/api/admin/system`
- `/api/admin/runninghub/*`
- `/api/admin/comfyui/instances`
- `/api/admin/tasks`
- `/api/admin/providers`
- `/api/admin/models`
- `/api/admin/audit`
- `/api/admin/audit/usage-summary`
- `/api/admin/model-pricing`
- `/api/admin/model-pricing/:modelId`
- `/api/admin/analytics/cost-summary`
- `/api/admin/group-permission-policies`
- `/api/admin/group-permission-policies/:groupId`
- `/api/admin/permission-catalog`

## ComfyUI 接口

- `GET /api/admin/comfyui/instances`
  - 读取 ComfyUI 实例列表、共享工作流摘要、工作流总数。
- `POST /api/admin/comfyui/instances`
  - 新建或覆盖一个 ComfyUI 实例记录。
- `PATCH /api/admin/comfyui/instances/:instanceId`
  - 修改实例基础信息。
- `POST /api/admin/comfyui/instances/:instanceId/heartbeat`
  - 后台人工或调试用心跳刷新。
- `GET /api/admin/comfyui/instances/:instanceId/workflows`
  - 读取实例专属工作流。
- `POST /api/admin/comfyui/instances/:instanceId/workflows`
  - 创建实例工作流草稿。
- `PATCH /api/admin/comfyui/instances/:instanceId/workflows/:workflowId`
  - 更新标题、暴露参数、默认值、输出定义。
- `POST /api/admin/comfyui/instances/:instanceId/workflows/:workflowId/push-to-shared`
  - 将实例草稿发布到共享区。
- `GET /api/comfyui/apps`
  - 画布公共消费目录，只返回已发布共享工作流与关联实例摘要。
- `POST /api/comfyui/apps/:workflowId/run`
  - 画布执行共享工作流的专用入口。
  - 后端会选择实例、注入暴露参数、提交 ComfyUI prompt、轮询 history，并将输出转存到本地素材输出目录。
  - 当前会按 `图片上传 / prompt 提交 / history 拉取 / 结果保存` 四个阶段翻译错误，并返回机器名与 workflow 名，避免前台只收到裸 `fetch failed`。

## ComfyUI Connector 内部接口

- `POST /api/internal/comfyui/connectors/register`
  - 机器侧 connector 注册实例。
  - Header: `x-comfyui-connector-token`
- `POST /api/internal/comfyui/connectors/heartbeat`
  - 机器侧 connector 周期性上报 `health / capabilities / lastSeenAt`。
  - Header: `x-comfyui-connector-token`
- 机器侧 harness 约定：
  - 环境变量模板：`apps/comfyui-connector/.env.example`
  - 进程模板：`ops/systemd/xinghuan-comfyui-connector.service.example`
  - 本机契约校验：`npm run verify:comfyui-connector-harness`

## 组权限治理接口

- `GET /api/admin/group-permission-policies`
  - 返回所有可配置分组（含 `ungrouped / 未分组`）的当前 deny 策略摘要。
- `GET /api/admin/group-permission-policies/:groupId`
  - 返回指定分组的 deny 策略详情与成员数。
- `PUT /api/admin/group-permission-policies/:groupId`
  - 保存指定分组的 deny 策略。
  - 当前覆盖：
    - 公共资源分类
    - 公共资源条目
    - RunningHub AI App
    - RunningHub Workflow
    - 节点能力
- `GET /api/admin/permission-catalog`
  - 聚合返回分组、公共资源目录、RunningHub 目录和节点能力目录，供后台权限面板复用。
- `GET /api/me/permissions`
  - 返回当前登录用户的有效组权限快照。

## 审计与成功用量统计

- `GET /api/admin/audit`
  - 返回后台审计日志最近样本。
- `GET /api/admin/audit/usage-summary`
  - 基于 `xh_tasks` 成功任务聚合，不读取原始 audit log 作为生成用量来源。
  - 仅统计 `status = succeeded`。
  - 当前可按组、账号、能力、Provider、模型、RH 条目筛选。
  - 图片 / 视频 / LLM 会下钻到模型显示名与模型 ID。
  - RunningHub 会下钻到后台 catalog 条目标题、catalogId 和 runTargetId。
  - 历史 RH 任务优先使用 `rhCatalogId / rhCatalogTitle / rhCatalogKind` 快照；缺失时回退 `providerId + kind + runTargetId` 匹配。

## 模型价格与费用统计

- `GET /api/admin/model-pricing`：读取各模型最新价格版本。
- `PUT /api/admin/model-pricing/:modelId`：创建新价格版本；默认 CNY，支持按次/按秒。
- `GET /api/admin/analytics/cost-summary`：从费用台账按日期、组、账号、Provider、模型和币种聚合。
- 金额字段为六位小数字符串，不在 API 层换算币种。

## 画布与任务类接口

- 节点提交任务相关接口
- 任务列表和任务详情接口
- 结果读取与素材访问接口

## LLM 与任务化记录

- `/api/proxy/external/llm`
  - 当前仍是同步返回内容给前端。
  - 同时会补写一条 `xh_tasks` 成功任务记录，能力标记为 `chat`，用于后台成功用量统计。

## RunningHub 关键接口

- 条目列表与编辑：`/api/admin/runninghub/*`
- 分析草案：`/api/admin/runninghub/analyze`
- 测试与 catalog 透出：由 `server.ts` 与 `runninghub-catalog.ts` 协同处理
- 公共目录透出：
  - `GET /api/runninghub/catalog`
  - `GET /api/runninghub/catalog/:catalogId`
  - 当前会按用户组 deny 策略过滤，前台无权限条目直接不显示
- RH 队列任务入库：
  - 新任务会补写 `payload/result.rhCatalogId`
  - 新任务会补写 `payload/result.rhCatalogTitle`
  - 新任务会补写 `payload/result.rhCatalogKind`
- RH 提交兜底：
  - `POST /api/proxy/runninghub/submit`
  - 即使旧画布里残留了现在已被禁用的条目，后端仍会做最终权限校验

## 观测类接口

- `/api/status`
- `/api/admin/system`

## 排障第一跳

- ComfyUI 实例在线但画布目录为空：先看 `/api/admin/comfyui/instances` 与 `GET /api/comfyui/apps`
- ComfyUI 机器注册不上来：先看 `/api/internal/comfyui/connectors/register` 的 token 与 `XINGHUAN_COMFYUI_CONNECTOR_TOKEN`
- 参数保存了但前端没变：先看 `/api/admin/runninghub/*`
- 配置保存了但运行态没跟上：先看 `/api/admin/system` 返回的 `effectiveConcurrency`
- 审计页成功用量和真实任务不一致：先看 `xh_tasks` 是否存在成功行，再看 `/api/admin/audit/usage-summary`
