# Provider / Model 渠道健康度

## 目的与边界

渠道健康度展示各 Provider 下模型最近三天的已结束请求成功率、成功数、失败数，以及匿名聚合的赞踩次数。它是运行状态观测，不控制路由、任务重试或 Provider 启停。

统计只读取 `xh_tasks` 中 `succeeded` 和 `failed` 的记录。`queued`、`running` 与 `cancelled` 不进入分子、分母或桶是否存在的判断。计费归属采用任务的 `provider_cost` 快照，避免当前目录重配改写历史归属。

## 聚合与状态

- 窗口为当前北京时间双数小时桶及此前 35 个桶，共 36 个、每桶两小时。
- 未发起已结束请求的桶保持空白，不显示为 `0%`。
- 当前状态只看最近六小时：少于 3 次已结束请求为样本不足；成功率 `>=95%` 为畅通；`80%-94.9%` 为轻微波动；低于 `80%` 为异常；没有请求为暂无近期请求。
- Provider 状态由其模型状态汇总，异常优先于轻微波动、畅通和样本不足。

## 反馈

反馈表为 `xh_channel_feedback`。一个 owner 对同一 Provider / 模型仅保留一票，可原子改赞或踩；资格要求该 owner 在此前 24 小时对该精确通道有至少一个已结束任务。

通道在最近 24 小时有已结束使用时，展示最近 24 小时的赞踩次数；否则回溯到最多 72 小时。超过 72 小时的反馈不展示，接口不会返回投票身份或用户列表。

## 接口与界面

- Member：`GET /api/channel-health`，`POST /api/channel-health/feedback`。
- Admin：`GET /api/admin/analytics/model-success-rates`，支持 `capability`、`providerId`、`modelId` 筛选。
- Web：Canvas 工具栏的渠道状态入口打开独立子页面，可投票；首次载入、整点且可见时刷新、手动刷新有十秒冷却。
- Admin：`/admin/analytics/reliability` 只读展示，可手动刷新；五分钟自动刷新默认关闭且页面隐藏时暂停。

两类 GET 都使用私有 ETag 重验证。聚合报告的服务端缓存时长为 30 秒，viewer vote 在读取时单独覆盖，不能与其他用户投票状态混合。

反馈写入错误码为：缺少 Provider、模型或 vote 时分别为 `CHANNEL_FEEDBACK_PROVIDER_REQUIRED`、`CHANNEL_FEEDBACK_MODEL_REQUIRED`、`CHANNEL_FEEDBACK_VOTE_INVALID`；通道不存在为 `CHANNEL_NOT_FOUND`；没有近期精确通道使用资格为 `CHANNEL_FEEDBACK_INELIGIBLE`。Admin 使用无效能力筛选时返回 `CHANNEL_HEALTH_CAPABILITY_INVALID`。

## 排障

1. 先确认任务终态、`provider_cost` 快照及 `created_at` 是否落在当前 72 小时窗口；运行中、取消的任务不是数据缺失。
2. 为空桶或暂无近期请求时，确认该精确 Provider / 模型是否确实没有已结束任务，而非将状态读作零成功率。
3. 投票被拒绝时，确认 owner 在最近 24 小时是否有同一 Provider / 模型的成功或失败任务。
4. 数据更新不及时时，先使用手动刷新；再检查请求 ETag/304 和服务端 30 秒聚合缓存。不要通过重启服务或删除反馈记录“刷新”状态。
5. 聚合查询计划应以 Migration 042 的局部 settled-task 索引和反馈窗口索引为起点。查询计划异常时，在隔离数据库中对仓库的时间窗口查询执行 `EXPLAIN (ANALYZE, BUFFERS)`，确认 `status in ('succeeded', 'failed')`、时间范围与 `provider_cost` 快照连接都没有退化为无界全表读取。
