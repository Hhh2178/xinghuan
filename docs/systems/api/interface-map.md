# API 接口地图

## 后台类接口

- `/api/admin/system`
- `/api/admin/runninghub/*`
- `/api/admin/tasks`
- `/api/admin/providers`
- `/api/admin/models`
- `/api/admin/audit`
- `/api/admin/audit/usage-summary`
- `/api/admin/group-permission-policies`
- `/api/admin/group-permission-policies/:groupId`
- `/api/admin/permission-catalog`

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

- 参数保存了但前端没变：先看 `/api/admin/runninghub/*`
- 配置保存了但运行态没跟上：先看 `/api/admin/system` 返回的 `effectiveConcurrency`
- 审计页成功用量和真实任务不一致：先看 `xh_tasks` 是否存在成功行，再看 `/api/admin/audit/usage-summary`
