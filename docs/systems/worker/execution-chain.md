# Worker 执行链

## 标准链路

1. 从队列消费任务
2. 判断任务类型
3. 进入普通 Provider 或 RunningHub 分支
4. 提交上游任务
5. 轮询或查询结果
6. 回写任务状态和输出
7. 产出可供前端消费的结果

当 Provider 已返回成功但内容接口在回源或下载阶段失败时，Worker 不会丢弃上游成功证据：任务进入 failed，但保留远程产物和物化恢复上下文。后台“恢复产物”的目标语义是只执行下载/登记，“重新生成”仍是独立操作；但 `0.8.2` 存在 API 写 `result.outputRecoveryMode`、Worker 读 `payload.outputRecoveryMode` 的已确认契约缺陷，修复完成前不得宣称恢复入口一定不会重提 Provider。

任务状态写入 `xh_tasks` 后，由数据库费用触发器统一捕获新任务价格快照并结算终态；Worker 不自行计算金额，避免与 API 同步任务或取消路径产生双账。

## 当前重点分支

- 普通 Provider 图像/视频/音频
- RunningHub Workflow
- RunningHub AI App

## Canvas Run Coordinator

- Generation 与 quality 两类领取各自持有一个 PostgreSQL `xh_canvas_run_dispatch_cursors` cursor。每个短事务先锁定 cursor、按 owner ID 环状选择下一位拥有 ready work 的用户、领取一个 Step 后推进 cursor；因此同一用户的大批量 Run 不会持续压过其他 ready owner。
- `apps/worker/src/canvas-run-coordinator.ts` 只在 `XINGHUAN_CANVAS_RUN_WORKER_ENABLED=true` 时启动；Gray/Production 还必须通过数据库 `canvas_runs_enabled` 开关。
- Coordinator 从 PostgreSQL 按 owner/run/step 状态领取 `native_server` 步骤，使用 `FOR UPDATE SKIP LOCKED`、过期 lease 和 durable dispatch acknowledgement 支持多实例接管。
- Run Plan 只包含 allowlist 执行参数；Worker 在创建任务前重新校验启用 Provider、启用模型和 capability，不读取节点中的密钥。`runninghub` 额外重新读取启用 Provider、目录条目、目标和字段 contract，并只从目录声明的媒体字段绑定上游输入。
- 任务继续进入现有 image/video/audio/chat 能力队列，复用用户窗口、Provider 窗口、费用账本、取消和产物落库。Chat 的 OpenAI-compatible 分支覆盖 `openai`、`apimart`、`modelscope`、`custom` 和 `aicopy`；Gemini 仍使用其原生媒体 Adapter。
- Image、Video 与 Audio Run Plan 将节点的 `generationCount` 冻结为 `1..4`。Worker 在同一个持久 Generation Task 内通过共享 runner 执行最多四路有界并发，每个请求拥有稳定 `batchIndex`、独立状态、上游 task ID、脱敏错误和产物 ID。取消保留已经完成的子项并忽略迟到结果；最终仍由单一 output materializer 生成稳定 Artifact ID，部分失败不会把后续成功产物错绑到失败子项。
- 运行中的批次快照写入任务结果；Canvas Run Coordinator 只把脱敏、有序的子状态写入 Run Event。owner-scoped Run 详情投影 `runtimeSteps`，列表/概览保持轻量，不附带产物明细。
- 多子任务批次仍在运行时，`worker-generation-progress-materializer.ts` 会串行处理并发进度回调，并在成功 child 数增加时提前把已完成媒体物料化为平台文件。稳定 Artifact ID 按 `batchIndex` 回填，安全 `/files/...` URL 和 child 状态一起写入任务结果；后续部分失败或取消会继续保留这些产物。全部成功仍走普通终态物料化入口，托管与手动任务保持同一终态合同。
- 需要同源授权下载的媒体只在 Worker 内存对象上携带非枚举 fetch context。共享 batch runner 及 image/video/audio 映射会继承该上下文用于中间与终态物料化，但 JSON 序列化、任务结果和 Run Event 均不会包含下载请求头。
- 成功批次把实际 `providerRequestCount` 写回任务结果；费用触发器按该值结算 `per_request` 数量，未提供该字段的既有任务继续按 `1` 次结算。Run Step/Task/Attempt 的既有幂等键和重试边界保持不变。
- 成功后回填 Step output binding 并解锁拓扑下游；失败按预算做同配置重试，再使用 Plan 中预授权备选，需确认的备选进入 Approval ledger。
- 当前原生生成步骤为 image/video/audio/llm/runninghub；当前原生确定性步骤为 text/text-split/upload/material-set/pick-from-set/relay/output，以及受 owner 文件隔离约束的 resize。确定性步骤在 Step 领取事务中直接生成 output binding、解锁下游并写入 Run Event；resize 只读取当前 owner 的 `/files/input/` 或 `/files/output/`，在同一 owner 输出目录写入 PNG，不创建 Generation Task，也不消耗 Provider 或 Redis 队列槽位。`text-split` 使用 Shared 纯算法并只消费 Run Plan 快照的可执行配置、上游文本或手工 segments override。其他 `legacy_browser` 节点会明确失败为 unsupported，不伪装为后台已托管。
- RunningHub Worker 在提交前使用 `worker-runninghub-media-adapter.ts` 将当前 owner 的 `/files/input/`、`/input/`、`/files/output/` 或 `/output/` 产物流式上传为 RunningHub 文件名；远程 URL、其他路径、嵌套路径和目录穿越均在请求前拒绝。Canvas Run 任务必须通过 API `start` 时的现有目录执行权限检查，并在 Coordinator 中重新验证 PostgreSQL Provider/目录/目标/字段 contract 后才创建任务。
- 自动视频质量评估先按已发布 LLM 路由快照选择原生完整视频候选。Gemini 直连通过独立 adapter 上传 owner-scoped Artifact Binary；原生候选耗尽后只允许使用 Artifact 已有的时间戳帧，不在 Worker 内抽帧或调用 FFmpeg。
- 质量输入模式、路由候选、Agent Action、Evaluation sample snapshot 和 Run Event 均持久化；原生与帧降级使用不同幂等键，避免技术回退与重复投递碰撞。
- Generation/Quality Task 被取消后，Worker 在成功或异常回写前再次读取取消状态并丢弃迟到结果；取消不会被迟到的 Provider 响应改写为 succeeded 或 failed。
- Gemini `chat` 任务额外启动取消监控器；它会中止 Files API 上传、处理轮询或 `generateContent` 请求。Provider File 的 best-effort DELETE 保持独立 timeout，取消时仍会尝试清理。
- 若质量路由候选处于 `half_open`，Coordinator 在创建 chat task 前取得 route-entry probe lease，并将 lease owner 写入 `quality_context`；成功或失败结算后删除同 owner lease，避免多 Worker 并发试探同一熔断 entry。
- Redis 队列允许 at-least-once 投递。Worker 通过 `xh_tasks.status='queued'` 的单条 compare-and-set 领取任务；只有得到 `claimed` 的实例可以调用 Provider，重复消息得到 `already_claimed` 后释放窗口并退出。
- SSE 运行事件以 PostgreSQL sequence 为游标并输出标准 `id`；浏览器重连使用 `Last-Event-ID` 续读，不从 0 重放完整账本。

## 隔离 PostgreSQL 验收

- `npm run test:canvas-run-postgres-integration` 只接受 `XINGHUAN_TEST_DATABASE_URL` 指向名称符合 `xinghuan_agent_test_*` 的隔离数据库。运行器先验证数据库名，再执行仓库迁移并运行 `canvas-run-postgres.integration.test.ts`；不得把 Gray 或 Production URL 作为该变量。
- 真实用例使用两个独立 Pool 模拟多 Worker，验证 owner round-robin cursor、过期 lease 接管、Redis 首次投递失败后的 durable recovery，以及 `xh_tasks` 的原子 `queued -> running` 领取。测试只创建带随机前缀的夹具，并在结束时按精确 owner/model/provider 标识清理。
- 没有隔离数据库时，常规 Vitest 将此文件标记为 skipped；这不是集成验收通过。显式命令会以 `XINGHUAN_TEST_DATABASE_URL_REQUIRED` 失败。

## 排障第一跳

- 任务排错分支：`apps/worker/src/worker.ts`
- 图像批次边界：`apps/worker/src/worker-image-generation-batch.ts`
- 共享批次边界：`apps/worker/src/worker-generation-batch.ts`
- 输出落库异常：`apps/worker/src/output-materials.ts`
- Canvas Run 步骤领取与恢复：`apps/worker/src/canvas-run-coordinator.ts`
