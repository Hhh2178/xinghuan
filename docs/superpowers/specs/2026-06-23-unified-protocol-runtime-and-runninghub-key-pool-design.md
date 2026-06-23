# Unified Protocol Runtime And RunningHub Key Pool Design

## 目标

本次设计用于同时收口两类已经在灰度与正式环境中暴露出来的真实问题：

- 各协议任务执行链路的失败诊断、轮询容错、运行状态和取消同步口径不一致，导致画布、后台和 Worker 看到的是不同版本的“任务现实”。
- RunningHub 当前虽然已经具备多 Key 配置能力，但任务调度仍然存在“默认 Key 满了直接排队，没有自动切换其他可用 Key”的问题。

本轮目标不是推翻现有协议实现，而是在保持现有协议链路完整的前提下，增加一层统一执行运行时，并把 RunningHub 的 Key 池调度从“静态绑定”改为“默认优先、实时回退”。

## 本轮要解决的问题

### 1. 各协议失败语义不统一

当前不同协议的执行错误主要以零散字符串形式落库，例如：

- `generate image failed`
- `fetch failed`
- `apikey error`
- `model not found`
- `user not found`
- `cost apikey credits failed`

这会带来三个直接问题：

- 前端和后台无法稳定区分“上游真实业务失败”与“轮询接口抖动”。
- Worker 当前通常只把 `error.message` 写入 `failureReason`，缺少结构化诊断上下文。
- 后续接入更多平台时，每个协议都会继续复制一套自己的失败命名方式。

### 2. 轮询抖动会被过早判死

以 GRSAI 为代表，正式环境已经确认存在：

- 上游结果接口偶发 `502 Bad Gateway`
- `fetch failed`
- 网关类瞬时异常

但现有链路里，这类错误经常会直接结束任务，而不是先进入统一的短退避重试。

### 3. 取消状态没有双向同步

目前用户已经明确反馈两类问题：

- 画布点击取消后，后台任务页仍然显示任务继续运行。
- 后台任务页如果取消了任务，画布节点并不会稳定同步为已取消。

这说明当前任务取消没有统一真相源，画布和后台各自保留了自己的局部状态判断。

### 4. RunningHub Key 池调度仍然带有“静态绑定”问题

现有 RunningHub 设计目标已经明确：

- 多个 Key 可组成同一号池
- 默认 Key 优先
- 某个 Key 并发满了以后，应继续使用其他可用 Key
- 只有所有 Key 都满了，任务才应该排队

但用户当前实际观察到的是：

- 默认 Key 占满后，多余任务直接排队
- 企业并发补充 Key 没有被自动拿来执行任务

根因高度疑似是：

- 任务在 API 入队阶段就被僵硬绑定到了默认 Key
- Worker 执行前没有基于实时占用重新选择可用 Key

### 5. 当前设计仍残留“个人会员 / 企业 API”语义干扰

用户已经明确要求：

- RunningHub 任务调度不能按“个人 / 企业”做分支逻辑
- 必须统一抽象为“多个 Key 中默认 Key 优先，满了自动切其他 Key”

因此本轮要把调度描述和实现入口都收口为 Key 池模型，而不是会员类型模型。

## 设计原则

### 1. 兼容式改造，不推翻现有协议链路

本轮不替换各协议已有的提交、轮询与结果提取实现，而是在其外增加统一运行时壳层。这样可以保留：

- RunningHub 的 Workflow / App 差异处理
- GRSAI 的图像协议适配
- APIMart / ModelScope / OpenAI-like 的现有参数与结果模型

同时把状态、诊断、取消、重试逻辑统一起来。

### 2. 任务表是运行状态唯一真相源

画布、后台任务页、Worker、查询接口都只认同一套任务状态，不允许某一端继续根据局部字段自行猜测“是否已取消”“是否已失败”“是否只是轮询抖动”。

### 3. 错误需要分类，而不是继续堆字符串

统一运行时必须把“认证错误”“额度错误”“配置错误”“轮询网关错误”“上游明确失败”“本地主动取消”区分开，后续前端和后台才能做稳定提示与统计。

### 4. RunningHub 调度只看 Key 池，不看会员语义

无论某个 Key 在 RunningHub 平台上属于什么账号类别，在本系统中都只体现为：

- 一个启用或停用的 Key
- 一个默认优先级
- 一个可配置的最大并发
- 一个备注

任务调度不再出现“个人会员优先”或“企业 API 补位”这类协议外语义。

### 5. 默认 Key 优先，但不能导致资源浪费

默认 Key 是调度优先级，不是唯一可用 Key。只要默认 Key 已满而其他启用 Key 仍有并发余量，任务就必须直接切换到其他 Key 执行，不能提前排队。

## 方案比较

### 方案 A：只修 RunningHub Key 选择，不动全协议执行层

优点：

- 针对当前 RH 并发问题见效最快

缺点：

- GRSAI / APIMart / ModelScope 等协议的失败诊断与取消不同步问题仍然存在
- 正式环境里已出现的混合型失败不会被统一收口
- 后续新协议接入仍然会复制不一致的错误与状态模型

### 方案 B：引入统一执行层，但保持 RH 静态 Key 绑定

优点：

- 可以先统一错误和取消状态

缺点：

- 无法解决当前 RH “默认 Key 满了直接排队”的核心问题
- 会出现“统一运行时改善了诊断，但 RH 实际调度仍不对”的半完成状态

### 方案 C：统一执行层 + RH Key 池实时回退调度

特点：

- 协议侧增加统一运行时
- RunningHub 调度从静态绑定改为执行前实时择优
- 取消与失败分类全部共用统一状态机

优点：

- 能同时解决当前生产故障暴露的两条主线问题
- 对后续协议接入最友好
- 保持现有链路基本不拆重建

缺点：

- 涉及 `apps/api`、`apps/worker`、`packages/shared`、部分后台与前端状态消费层

### 结论

本轮采用 **方案 C**。

## 范围与非目标

### 范围内

- 为协议执行引入统一运行时壳层
- 为协议适配器定义统一接口
- 增加统一失败分类与结构化诊断字段
- 增加统一轮询网关错误重试策略
- 增加统一取消协调状态机
- 修正 RunningHub Key 池调度为“默认优先 + 满并发自动切其他 Key + 全部满才排队”
- 让 RH Key 池同时覆盖 Workflow 与 AI App
- 文档与实现中去除“个人/企业”调度分支语义

### 非目标

- 本轮不重做数据库主表结构
- 本轮不新增复杂的 Key 健康评分、熔断或自动迁移重试
- 本轮不强制所有协议都支持远端取消；不支持时允许落到 `cancelled_local_only`
- 本轮不把画布视觉验收责任转交给 Agent

## 当前现状与代码落点

本轮主要落点：

- API 主服务：
  - `apps/api/src/server.ts`
- Worker 执行：
  - `apps/worker/src/worker.ts`
- GRSAI 适配：
  - `apps/api/src/grsai-image-adapter.ts`
- 任务结果聚合：
  - `apps/api/src/provider-generation-task-service.ts`
- RunningHub 后台工作台：
  - `apps/admin/src/admin-runninghub-workspace.tsx`
- 共享类型：
  - `packages/shared/src/`

已确认的风险线索：

- Worker 失败分支当前通常只写入 `failureReason`
- GRSAI 正式环境同时存在：
  - 上游明确业务失败
  - 结果轮询网关异常
- RunningHub 当前高度疑似在入队阶段就过早绑定默认 Key

## 详细设计

### 一、统一执行运行时 `TaskExecutionRuntime`

#### 1. 作用

统一执行运行时不负责理解每个协议的业务细节，而是负责统一处理：

- 任务生命周期
- 重试与退避
- 失败分类
- 结构化诊断
- 取消协调

协议差异继续由各自 adapter 负责。

#### 2. 建议接口

每个协议实现统一接口：

```ts
interface ProtocolTaskAdapter {
  submit(context: SubmitContext): Promise<SubmitResult>;
  poll(context: PollContext): Promise<PollResult>;
  cancel?(context: CancelContext): Promise<CancelResult>;
  extractSuccessResult(context: SuccessContext): Promise<NormalizedTaskOutput>;
  normalizeFailure(error: unknown, context: FailureContext): NormalizedFailure;
}
```

#### 3. 生命周期状态

统一状态建议固定为：

- `queued`
- `claimed`
- `submitting`
- `polling`
- `succeeded`
- `failed`
- `cancel_requested`
- `cancelled`

兼容要求：

- 第一阶段不强制前端一次性切换所有老字段
- 允许继续保留旧的 `status/failureReason/progress` 消费路径
- 但任务表与 Worker 内部要先以这套状态机为基础

### 二、统一失败分类与结构化诊断

#### 1. 失败分类字段

在保留兼容 `failureReason` 的同时，新增：

- `failureCategory`
- `providerDiagnostic`
- `upstreamHttpStatus`
- `upstreamResponseSnippet`
- `submitDiagnostic`
- `pollDiagnostic`

#### 2. 分类口径

统一分类建议为：

- `auth`
- `quota_or_credits`
- `model_config`
- `upstream_business_failed`
- `upstream_poll_gateway_failed`
- `upstream_poll_timeout`
- `local_cancelled`
- `remote_cancel_failed`
- `unknown`

#### 3. 分类规则

- `apikey error`、认证失败、签名失败
  - `auth`
- `credits failed`、额度不足、扣费失败
  - `quota_or_credits`
- `model not found`、参数不合法、目标不存在
  - `model_config`
- 上游接口明确返回 `status=failed`
  - `upstream_business_failed`
- `502/503/504/fetch failed/Bad Gateway`
  - `upstream_poll_gateway_failed`
- 超过统一轮询时限
  - `upstream_poll_timeout`
- 用户或后台发起取消
  - `local_cancelled`
- 尝试上游取消但失败
  - `remote_cancel_failed`

#### 4. 前后端消费口径

- `failureReason` 保留为用户可读摘要
- 结构化诊断主要服务于：
  - 后台任务详情
  - Worker 排障
  - 统计与观察面板

### 三、统一轮询与重试策略

#### 1. 网关抖动不立刻判死

以下情况不应直接终止任务：

- `502`
- `503`
- `504`
- `fetch failed`
- 明确可识别为瞬时网络抖动的错误

应进入统一的短退避重试。

#### 2. 业务失败直接终止

以下情况应直接判定最终失败：

- 认证错误
- 额度或扣费错误
- 模型或目标配置错误
- 上游明确返回业务失败状态

#### 3. 轮询超时

当任务超过统一可配置轮询时限后：

- 标记为 `failed`
- `failureCategory = upstream_poll_timeout`
- 保留最后一次轮询的关键诊断

### 四、双向取消同步 `CancellationCoordinator`

#### 1. 统一原则

无论取消来自画布还是后台任务页，都走同一条状态转换：

- `cancel_requested`
- Worker 停止继续提交或轮询
- 如果协议支持，则尝试调用上游取消
- 最终收口为取消终态

#### 2. 终态建议

统一增加 `cancelState`，可取：

- `cancelled`
- `cancelled_local_only`
- `cancel_failed_remote_but_closed_local`

#### 3. 双向同步行为

画布取消：

- 写任务表为 `cancel_requested`
- 画布本地只显示“取消请求已提交”，不直接假设远端已停
- Worker 读取到该状态后停止继续执行并尝试远端取消

后台取消：

- 同样写任务表为 `cancel_requested`
- 画布轮询任务表后同步结束节点运行态

#### 4. 不支持远端取消的协议

如果某协议不支持远端取消：

- 本地任务仍要尽快关闭，避免画布和后台永久挂起
- 任务记录标记 `cancelled_local_only`
- 不把这类情况误报为普通执行失败

### 五、RunningHub Key 池统一调度

#### 1. 统一模型

RunningHub 的调度只依赖 Key 池，不依赖会员类型语义。每个 Key 只保留：

- `enabled`
- `isDefault`
- `maxConcurrency`
- `remark`

同一套 Key 池同时覆盖：

- RH Workflow
- RH AI App

#### 2. 调度规则

固定规则如下：

1. 先尝试默认 Key
2. 默认 Key 满了后，按稳定顺序尝试其他启用 Key
3. 只要还有任意 Key 有空余并发，任务就直接执行
4. 只有全部启用 Key 都占满，任务才进入本地排队态

#### 3. 关键修正点

不能继续在 API 入队阶段把任务永久绑定到默认 Key。

正确做法：

- 入队时最多只记录“默认偏好 Key”
- Worker 真正执行前，按实时占用重新选择最终可用 Key
- 最终把实际使用的 `assignedRhKeyId` 落库

这样才能解决“默认 Key 满了但其他 Key 还有余量，任务却直接排队”的问题。

#### 4. 排队条件

只有在以下情况才允许进入 RH 本地排队：

- 没有任何启用 Key
- 所有启用 Key 都已达到 `maxConcurrency`

其中：

- 没有任何启用 Key
  - 应优先视为配置错误，而不是正常排队
- 全部 Key 满载
  - 才是合法的 `queued`

#### 5. 任务落库补充

RH 任务建议补充：

- `assignedRhKeyId`
- `assignedRhKeyRemarkSnapshot`
- `rhQueueReason`

其中 `rhQueueReason` 至少区分：

- `no_enabled_key`
- `all_keys_busy`

### 六、兼容与迁移策略

#### 1. 不破坏现有任务主链路

本轮尽量通过新增字段与统一协调层完成收口，不强制重写：

- 现有任务提交入口
- 现有协议 adapter 主体实现
- 现有前端主要状态消费字段

#### 2. 旧字段兼容

以下旧字段短期继续保留：

- `failureReason`
- 旧 `status`
- 旧 `progress`

但其值来源应尽量从统一运行时派生。

#### 3. RH 旧单 Key 兼容

如果仍存在旧单 `apiKey` 配置：

- 可以继续作为兼容读取路径
- 但新调度逻辑优先读取 `rhKeyPool`
- 文案与后续设计统一使用“Key 池”口径

### 七、测试与验证

#### Agent 已验证范围

本轮实现后至少应覆盖：

- 默认 Key 有余量时优先被分配
- 默认 Key 满载时自动切到其他启用 Key
- 所有 Key 满载时才进入 `queued`
- RH Workflow 与 AI App 共用同一套 Key 池调度
- GRSAI 轮询 `502/503/504/fetch failed` 进入重试而非立刻失败
- 上游明确业务失败被正确分类
- 画布取消后任务表进入 `cancel_requested`
- 后台取消后画布能同步看到取消终态
- Worker 失败落库新增结构化诊断字段

#### 待用户验收

按当前仓库协作规则，以下仍由用户负责最终体验验收：

- 画布节点上的视觉反馈是否符合实际操作预期
- 后台取消与画布取消的交互观感
- RH 多 Key 调度在真实账号资源下的业务体验

## 影响范围

- `apps/api/src/server.ts`
- `apps/api/src/provider-generation-task-service.ts`
- `apps/api/src/grsai-image-adapter.ts`
- `apps/worker/src/worker.ts`
- `apps/admin/src/admin-runninghub-workspace.tsx`
- `packages/shared/src/`
- `docs/systems/runninghub/`
- `docs/systems/api/`
- `docs/systems/worker/`

## 实施顺序建议

1. 先补共享类型与运行时状态字段
2. 收口 Worker 的统一失败分类与取消协调
3. 为 GRSAI 等轮询协议补网关类短退避重试
4. 修正 RunningHub Key 池调度时机，改为执行前实时择优
5. 同步 API / 后台 / 前端所需状态与诊断字段
6. 补契约脚本、运行态验证与系统文档更新

## 决策总结

本轮最终决策如下：

- 各协议保持各自实现，但统一挂接到 `TaskExecutionRuntime`
- 任务状态统一为 `queued / claimed / submitting / polling / succeeded / failed / cancel_requested / cancelled`
- 失败从单字符串升级为“摘要 + 分类 + 诊断上下文”
- 网关类轮询错误进入短退避重试，不再立刻判死
- 取消必须双向同步，任务表作为唯一真相源
- RunningHub 调度不再按个人/企业区分，只按多 Key 池调度
- RH 任务始终默认 Key 优先，但满并发后必须自动切其他可用 Key
- 只有所有启用 Key 都满了，任务才允许排队
