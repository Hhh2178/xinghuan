# Announcement Center And RunningHub Queue Check Design

## 背景

当前项目已经形成稳定的 gray / production 发布、版本治理与前后台协作链路，但还缺两块关键能力：

1. 缺少一个产品内公告系统，无法把版本更新内容与管理员通知直接同步触达到前台用户。
2. RunningHub 当前仍存在队列与轮询异常：
   - 任务容易出现“轮询超时”
   - RH 并发看起来仍然只跑到默认小窗口，没有正确利用默认 Key + 其他 Key 的总窗口能力

本轮目标是先把这两块能力统一设计清楚，避免后续“公告系统”和“RH 队列热修”各自长歪。

## 目标

### A. 公告系统

- 后台新增“公告”管理板块
- 前台右上角新增“公告中心”入口
- 管理员可发布普通公告、系统公告、版本更新公告
- 支持“强提醒”模式：
  - 在线用户无需刷新页面
  - 即使没有点开公告中心
  - 也会自动弹出公告提示
- 本轮强提醒策略采用“半阻断”：
  - 用户必须手动关闭
  - 但不强锁页面流程
- 强提醒公告一旦被用户手动关闭，直接记为已读

### B. RunningHub 队列专项检查

- 全面复核 RH Worker 的队列分配与 Key 池调度
- 检查当前 RH 轮询超时是否来自不合理的独立 timeout 设计
- 检查“默认 Key 先跑，其它 Key 兜底”是否真正生效
- 检查 RH 平台并发是否真实利用了：
  - 默认窗口 `2`
  - 其他 Key 窗口 `100`
  - 最终应形成类似 `2 + 100 + ...` 的总可用窗口，而不是长期停在 `2`

## 范围

### 本轮纳入

- 前台公告中心
- 后台公告管理
- 公告实时推送
- 强提醒交互
- RH 队列 / 调度 / 轮询专项排查与修复计划

### 本轮不纳入

- 不做用户组级精细公告定向
- 不先做浏览器原生系统通知
- 不先做 WebSocket 全站实时基建
- 不直接在本轮强制接入 release 自动发布公告，先保留手动或半自动草稿能力

## 一、公告系统设计

### 1. 信息架构

#### 后台入口

后台左侧导航新增：

- `公告`

放在当前 `环境同步` 下方、你标红的空位，与：

- `用户`
- `任务`
- `审计`
- `系统`
- `环境同步`

同级。

#### 前台入口

前台右上角顶部操作区新增：

- `公告`

与当前：

- `资源库`
- `生成库`
- `设置`

处于同一组操作区。

### 2. 公告统一模型

公告与版本更新统一用一个模型，不拆两套系统。

建议主实体：

#### `announcements`

- `id`
- `title`
- `summary`
- `content`
- `type`
- `priority`
- `status`
- `scope`
- `pinned`
- `strongReminder`
- `popupEnabled`
- `versionTag`
- `publishedAt`
- `expireAt`
- `createdBy`
- `updatedAt`

字段口径：

- `type`
  - `manual`
  - `release-note`
  - `system`
- `priority`
  - `normal`
  - `important`
  - `strong-reminder`
- `status`
  - `draft`
  - `published`
  - `archived`
- `scope`
  - 第一阶段只支持：
    - `all-users`
    - `admins-only`

#### `announcement_reads`

- `announcementId`
- `userId`
- `readAt`

这里不再单独设计 `dismissedAt`。

原因：

- 你已明确要求：强提醒公告关闭后，直接算已读
- 因此“关闭提醒”和“已读”在第一阶段可以收敛为同一状态

### 3. 前台交互

#### 公告按钮

右上角 `公告` 按钮支持：

- 无未读时普通展示
- 有未读时显示角标
- 刚收到强提醒时可短暂高亮一次，但不做持续抖动

#### 公告中心

点击后打开右侧抽屉，不新开页面。

结构：

1. 顶部
   - `公告中心`
   - 未读数
   - 筛选：
     - `全部`
     - `公告`
     - `版本更新`
2. 中部列表
   - 置顶优先
   - 每项展示：
     - 标题
     - 类型
     - 发布时间
     - 摘要
     - 已读状态
3. 右侧或抽屉内详情区
   - 展开正文
   - 支持手动标记已读

### 4. 强提醒模式

本轮采用你已确认的模式 `2`：

- 实时弹出
- 半阻断
- 用户必须手动关闭
- 关闭后直接记为已读

#### 触发条件

当公告满足：

- `status = published`
- `strongReminder = true`
- `popupEnabled = true`

并且当前登录用户在 `scope` 范围内时：

- 在线前台页面通过实时事件立即收到
- 自动弹出居中公告层

#### 展示规则

- 居中公告弹层
- 背景轻遮罩
- 不锁死页面整个应用状态
- 用户必须点按钮关闭

按钮：

- `我知道了`
  - 关闭弹层
  - 调 `read`
- `查看详情`
  - 打开公告中心并定位到该公告
  - 同样调 `read`

#### 已读规则

你已确认本轮采用：

- 强提醒弹层被用户手动关闭后，直接记为已读
- 不再继续保留未读数

### 5. 后台公告管理页

采用双栏工作台：

#### 左栏

- 搜索框
- 状态筛选
  - `全部`
  - `草稿`
  - `已发布`
  - `已归档`
- 类型筛选
  - `普通公告`
  - `版本更新`
  - `系统公告`
- 公告列表项
  - 标题
  - 状态
  - 发布时间
  - 是否置顶
  - 是否强提醒

#### 右栏

公告编辑器字段：

- 标题
- 摘要
- 正文
- 类型
- 优先级
- 目标范围
- 是否置顶
- 是否强提醒
- 是否弹出
- 发布时间
- 下线时间
- 版本号（仅 `release-note` 展示）

#### 防误发

如果管理员发布的是强提醒公告，点击发布时必须二次确认：

- 将影响范围
- 是否强提醒
- 是否置顶
- 标题

明确展示后再确认发布。

### 6. API 与实时推送

#### 前台 API

- `GET /api/announcements`
- `GET /api/announcements/unread-count`
- `POST /api/announcements/:id/read`
- `GET /api/announcements/stream`

#### 后台 API

- `GET /api/admin/announcements`
- `POST /api/admin/announcements`
- `PATCH /api/admin/announcements/:id`
- `POST /api/admin/announcements/:id/publish`
- `POST /api/admin/announcements/:id/archive`
- `DELETE /api/admin/announcements/:id`

#### 实时机制

采用 `SSE`，不先做 WebSocket。

原因：

- 当前场景是后台单向广播前台
- `SSE` 足够满足
- 能明显降低接入复杂度

事件类型第一阶段先做：

- `announcement.published`
- `announcement.updated`

### 7. 版本更新公告并轨

版本更新公告不做独立系统，只作为：

- `type = release-note`

第一阶段：

- 后台手动创建版本公告

第二阶段：

- 由 gray / production 发布记录自动生成公告草稿
- 仍需管理员确认发布，不直接自动广播

## 二、RunningHub 队列与轮询专项检查

## 当前问题假设

### 问题 1：容易出现 RH 轮询超时

当前 `apps/worker/src/worker-runninghub-client.ts` 中，RH 轮询使用：

- `pollIntervalMs`
- `timeoutMs`

当前需要重点判断：

1. 这个 timeout 是否是对 RH 任务单独设得过短
2. 它是否误把“RH 仍在平台排队/生成中”的合法长任务判断成失败
3. 当前 RH 的 query 路径是否应该采用更长的容忍窗口，或改为按运行阶段分层超时

本轮设计要求：

- 不先假设“必须继续保留现有 RH 独立轮询 timeout”
- 要重新验证 RH 平台任务是否天然就比普通 provider 更适合长轮询
- 如果现有超时值只是历史兼容遗留，应考虑：
  - 延长
  - 分层
  - 或取消前期过短超时

### 问题 2：RH 并发没有真实跑满

当前用户反馈显示：

- 默认 Key 是个人会员窗口 `2`
- 另有企业 Key 可提供 `100`
- 实际运行中依然只跑了 `2`
- 其余任务直接排队

这说明至少有一种风险存在：

1. API 入队阶段就把任务过早静态绑定到了默认 Key
2. Worker 在执行前没有真实尝试 fallback 到其他启用 Key
3. RH 平台窗口汇总显示正确，但真实抢占逻辑没有按“默认 Key -> 其他 Key”顺序逐个试探
4. 任务在还没进入 worker 执行抢占前，就被其他总并发限制挡住
5. `effectiveConcurrency` 与 RH Key 池窗口的关系对不上

## 检查与修复目标

### A. 轮询专项

要完成以下检查：

1. `worker-runninghub-client.ts`
   - RH 提交后到 query 的等待窗口
   - timeout 的默认来源
   - timeout 是否与 RH 平台真实运行时间匹配
2. RH query 心跳更新
   - 是否在任务仍合法进行时持续刷新运行态
3. 是否存在“任务已在 RH 成功，但本地因轮询超时提前失败”的路径

修复方向：

- RH 轮询 timeout 改成更贴近 RH 任务特性的治理
- 避免把平台合法长任务误判成失败

### B. 并发专项

要完成以下检查：

1. API 入队时 `preferredRhKeyId` 写入是否正确
2. 是否仍有路径写死 `assignedRhKeyId`
3. `selectExecutableRunningHubKey` 是否真实按顺序：
   - 首选 `preferredRhKeyId`
   - 再试默认 Key
   - 再试其他启用 Key
4. 当默认 Key 已满时，是否真的继续尝试其他 Key
5. 当所有 Key 未满但任务仍排队时，究竟卡在：
   - worker 消费前队列
   - RH key window
   - user concurrency
   - category concurrency
   - platform queue gate

修复目标：

- 默认 Key 优先
- 默认 Key 满后自动用其他可用 Key
- 只有全部 Key 满了才进入 `all_keys_busy`
- 系统页里“RH 平台窗口”和真实任务执行结果要一致

## 代码落点

重点检查与修复落点：

- `apps/worker/src/worker-runninghub-client.ts`
- `apps/worker/src/worker-runninghub-dispatch.ts`
- `apps/worker/src/worker.ts`
- `apps/api/src/server.ts`
- `apps/admin/src/admin-readonly-panels.tsx`
- `docs/systems/runninghub/`
- `docs/systems/worker/queue-and-concurrency.md`

## 验证要求

### 公告系统

Agent 负责：

- 类型检查
- 前后台接口 contract
- 实时事件链路
- 强提醒弹层关闭即已读

用户负责：

- 公告 UI 观感
- 强提醒打断强度是否合适

### RH 队列专项

Agent 负责：

- 代码级路径排查
- 调度顺序校验
- 轮询 timeout 口径校验
- contract / verify 脚本补齐

用户负责：

- gray 环境真实多 Key 业务体验验证
- 真实 RH 工作流长任务体验

## 推荐实施顺序

1. 公告系统 spec 与接口模型落地
2. RH 队列 / 轮询专项排查与验证脚本先行
3. 公告系统第一阶段开发
4. RH 队列与轮询修复
5. 公告实时强提醒接入
6. 版本公告并轨

## 结论

本轮设计采用：

- 公告系统：
  - 后台左侧新增 `公告`
  - 前台右上角新增 `公告中心`
  - `SSE + 半阻断强提醒`
  - 强提醒关闭即已读
- RH 队列专项：
  - 不再默认接受当前“独立轮询超时”设计
  - 全面检查 Key 池动态调度是否真正跑满总窗口
  - 修复“只跑 2 个、不自动吃掉额外 100 并发”的问题
