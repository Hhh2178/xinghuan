# Worker 执行链导航页

这份文档用于帮助协作者快速理解：

- Worker 怎么启动
- 队列怎么拆
- 单个任务如何从 Redis 走到输出素材
- 失败、取消和 stale task 怎么收口

当前主要实现入口：

- `apps/worker/src/worker.ts`

关键辅助模块：

- `apps/api/src/provider-generation-task-service.ts`
- `apps/api/src/task-cancellation-service.ts`
- `apps/worker/src/output-materials.js`
- `apps/worker/src/worker-provider-utils.js`
- `apps/worker/src/worker-apimart-video-adapter.js`
- `apps/worker/src/worker-audio-provider-adapter.js`

## 1. Worker 启动阶段

### 环境依赖

启动前必须有：

- `XINGHUAN_DATABASE_URL`
- `XINGHUAN_REDIS_URL`
- 可选：
  - `XINGHUAN_EXPECTED_DATABASE_NAME`
  - `XINGHUAN_TASK_QUEUE`
  - `XINGHUAN_WORKER_POLL_TIMEOUT_SECONDS`
  - `XINGHUAN_WORKER_STALE_RUNNING_MS`
  - `XINGHUAN_WORKER_REAPER_INTERVAL_MS`

### 启动顺序

1. 校验数据库配置存在
2. 校验 Redis 配置存在
3. 连接 Postgres
4. 如设置了 `XINGHUAN_EXPECTED_DATABASE_NAME`，先做数据库目标校验
5. 连接 Redis
6. 读取任务并发设置
7. 按 capability 构造队列描述
8. 启动多条消费 loop
9. 启动 stale task reaper

## 2. 队列拆分模型

当前不是单总队列单线程，而是按 capability 分类：

- image
- audio
- video

此外还有一层执行窗口治理：

- 普通 Provider：按 `capability + ownerId` 做用户级并发窗口
- RunningHub：按 RH 平台共享窗口做并发治理

队列名由：

- `taskQueueNameForCapability(queueName, capability)`

推导得到。

并发值来自：

- `xh_system_settings.task_queue_settings`

如果没有数据库配置，则回退默认值。

RunningHub 平台窗口当前同样来自系统设置；窗口占满时，任务不会失败，而是保持 queued 并等待自动递进。

## 3. 单任务执行链

### A. 任务进入系统

入口通常来自：

- `/api/proxy/external/image/task`
- `/api/proxy/external/video/task`
- `/api/proxy/external/audio/task`

API 侧通过：

- `createProviderGenerationTaskService`

负责：

- 校验用户
- 读取 Provider / 模型
- 规范化 payload
- 写入任务记录
- 推送 Redis 队列

### B. Worker 收到任务

Worker loop 从 Redis `brPop` 读取 task id。

随后：

1. `processTask(taskId)`
2. 读取任务记录
3. 联查 Provider / Model
4. 进入运行态推进

### C. 上游调用

根据模型能力和协议，Worker 可能走：

- 通用 OpenAI 风格调用
- GRSAI 图像适配
- APIMart 视频适配
- 音频 provider 适配
- RunningHub workflow 提交 / 查询适配

这里最关键的判断维度是：

- protocol
- execution mode
- capability
- advanced config
- owner 级并发窗口
- RH 平台并发窗口

### D. 输出落库

如果上游成功：

1. 解析图片 / 视频 / 音频 / 文本输出
2. 调用 `materializeTaskOutputs`
3. 写入 `/files/output/...`
4. 更新任务结果
5. 让生成库与素材访问层能回读这些输出

## 4. 取消、失败与重试

### 取消

API 侧通过：

- `createTaskCancellationService`

区分：

- `local_only`
- `upstream_confirmed`
- `upstream_attempt_failed`

Worker 侧需要识别任务是否已被取消，并避免继续推进错误状态。

### 失败

失败来源通常分为：

- 队列与运行时问题
- Provider / 模型配置问题
- 上游返回 HTML / 非 JSON / 失败状态
- 输出素材落库失败

RunningHub 特别补记：

- RH 的实际结果可能是图像 URL，即使 capability 被标记在视频链路中
- 读取任务状态时必须统一保留 `imageUrls / videoUrls / audioUrls`，不能只按单一 capability 分支暴露结果
- RH queued task 不应把 workflow/page id 写入普通 `model_id` 外键

### 重试

任务支持重试，但重试不是“简单重新排队”：

- 需要保留任务关系和状态语义
- 需要避免把旧失败和新执行混成同一条不透明记录

## 5. stale task reaper

Worker 还会周期性检查长时间处于 running 的任务：

- `XINGHUAN_WORKER_STALE_RUNNING_MS`
- `XINGHUAN_WORKER_REAPER_INTERVAL_MS`

用途：

- 防止异常退出后任务永久卡在 running
- 补 heartbeat 与僵尸任务回收

## 6. 排障第一跳

### 症状：任务提交后一直没动静

先查：

1. API 是否真的写入了任务
2. Redis 队列是否有深度
3. Worker 是否 active

### 症状：任务 running 很久没结果

先查：

1. 上游是否异步轮询未完成
2. Worker 日志是否在重复失败
3. 是否已经落入 stale task reaper 范围
4. 是否其实仍在等待用户窗口或 RH 平台窗口，而不是已经真正执行

### 症状：后台显示成功，但没有素材

先查：

1. 上游是真成功还是占位成功
2. `materializeTaskOutputs` 是否执行
3. 输出文件是否写入 `/files/output/...`
4. RH/异步任务结果是否被错误丢在未暴露的 `imageUrls` 或 `videoUrls` 分支里

### 症状：取消没生效

先查：

1. 任务是否已进入不可取消状态
2. 是本地取消还是需要上游确认
3. Worker 是否还在推进旧任务

## 7. 与其他文档的关系

- 接口入口：`docs/project-atlas/api-navigation.md`
- 数据模型：`docs/project-atlas/data-model-navigation.md`
- 排障总入口：`docs/project-atlas/debugging-playbook.md`
- 运行环境：`docs/project-atlas/runtime-and-env.md`

## 8. 什么时候必须同步更新本文

如果发生以下任一变化，就不能只改代码：

- 新增任务 capability
- 队列命名规则变化
- 任务状态机变化
- 输出落库方式变化
- 取消 / stale reaper 语义变化
- 新增新的上游 adapter 分支
