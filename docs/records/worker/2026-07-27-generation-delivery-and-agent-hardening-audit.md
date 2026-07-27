# 生成回传链路与 Agent Runtime 加固审计（2026-07-27）

## 结论摘要

本次审计覆盖请求创建、队列投递、Provider 提交与轮询、远程产物下载、本地物料化、产物登记、API 投影、前端接收，以及 Agent Runtime 的初始化、发布、路由和环境开关。

当前 `0.8.2` 已缓解视频内容接口瞬时失败和响应流中断，但尚未形成端到端的“Provider 成功后必达”闭环。生产七日样本中 2,172 个任务成功、801 个失败、96 个取消；其中 364 个为上游业务失败、111 个为轮询网关失败、37 个为轮询超时、37 个为额度问题、9 个为模型配置问题，另有 237 个仍为 `unknown`。已识别到 1 个 Provider 成功但本地失败的任务，但旧任务没有新版恢复投影，因此 `outputRecoveryAvailable=true` 为 0。

最重要的确认缺陷是：Admin `recover-output` 将 `outputRecoveryMode="output_only"` 写入任务 `result`，Worker 却只读取 `payload.outputRecoveryMode`。因此当前按钮不能证明只执行下载与登记，存在再次提交 Provider 和重复计费风险。在 Gray 修复并完成 API -> PostgreSQL -> Redis -> Worker 的真实链路测试前，Production 不应使用该按钮。

Agent Runtime 的生产故障不是模型本身不可用，而是环境 bootstrap 与发布完整性缺口：治理表存在，但基线 Agent/route 数据缺失；运行控制记录缺失后按安全默认值关闭；首次发布的 route capability snapshot 又缺少 `text_chat`。补齐定义、发布、路由和 `observe` 运行控制后，前后台助手真实请求均返回 `mode=agent`。

## 审计边界与证据

- 代码基线：`0.8.2`，release `20260727-provider-output-recovery-v082-r1`。
- 生产范围：旧服务器 Production；新服务器未操作。
- 运行证据：Production 内外状态、API/Worker、权限 readiness、前后台助手真实请求。
- 数据证据：Production 最近七日任务聚合；只使用分类与计数，不记录 Provider 密钥、签名 URL 或用户内容。
- 本报告是实现审计与整改优先级，不代表未落地项已经上线。

## 端到端链路

| 阶段 | 当前权威状态/数据 | 已有保护 | 主要失效模式 |
| --- | --- | --- | --- |
| 1. 请求与任务创建 | API 鉴权后写 `xh_tasks`，冻结 owner、Provider/model 和 payload | owner 校验、参数/能力校验、价格与执行身份快照 | 配置错误、权限拒绝、payload 与后续控制字段契约漂移 |
| 2. 队列投递 | PostgreSQL 保存任务，Redis 承担投递 | Redis at-least-once；任务以 `queued -> running` CAS 领取，重复消息不重复执行 | DB 已 queued 但 Redis 无消息；入队超时；缺少统一 outbox/reconciler |
| 3. Provider 提交 | Worker 调用具体 Adapter | 用户/Provider 并发窗口；批次子项有稳定 index；部分协议写入 `upstreamTaskId` | 提交成功后 Worker 崩溃，Provider 已计费但本地未持久化足够恢复状态 |
| 4. Provider 轮询 | Worker 按协议轮询并写 heartbeat | 瞬时轮询重试、截止时间、结构化失败、取消后丢弃迟到结果 | 本地截止时间早于 Provider 完成；Worker 重启后不能从 upstream ID 恢复；reaper 直接失败 |
| 5. 输出发现 | Adapter 解析图片/视频/音频 URL | 类型化 URL 数组；批次保留已成功子项 | URL 提取契约错误；签名 URL 过期；空数组遮蔽兼容字段 |
| 6. 下载与物料化 | Worker 将远程内容写入 owner 输出目录 | 视频 4 次退避、部分 Range 续传、内容类型检查；同源授权头只在内存携带 | 图片/音频一次性下载；Range 未校验；全量内存缓冲；直接写最终文件；URL 过期 |
| 7. 产物登记 | 写 `xh_generation_artifacts` 并回填 task result | 稳定 Artifact ID；PostgreSQL 事务；长期资源只经 Promotion | 文件成功但 DB 失败、DB 成功但文件不可用；本地磁盘为单点 |
| 8. 任务终态 | Worker 写 succeeded/failed/cancelled | 取消态保护；失败分类和运行事件 | reaper 与活跃 Worker 竞态；没有 attempt/lease fencing token；`unknown` 占比高 |
| 9. API 与前端接收 | API 投影任务/Run/Artifact，前端读取安全 `/files/...` URL | owner-scoped 查询、稳定 Artifact 引用、SSE sequence | 任务终态与产物可用性被压成一个状态；缺少“Provider 成功/正在回传/回传失败”清晰阶段 |

### 建议的目标状态机

```text
accepted -> queued -> claimed -> submitted -> polling
  -> provider_succeeded -> materializing -> artifact_ready -> delivered
                             |                  |
                             v                  v
                    materialization_retry   delivery_failed

submitted/polling -> reconciliation_pending -> polling/provider_succeeded
```

关键原则是拆开三个事实：Provider 是否接受并完成、Artifact Binary 是否完整落地、Generation Artifact 是否已登记并可访问。任何一个终态都必须携带 attempt ID、阶段、时间和可恢复动作，不能再用单一 `failed` 覆盖整条链路。

## 已确认缺陷

### P0：恢复模式跨层字段不一致

- Admin 在 `apps/api/src/admin-task-list-routes.ts` 的 `result.outputRecoveryMode` 写入 `output_only`。
- Worker 在 `apps/worker/src/worker.ts` 只判断 `task.payload.outputRecoveryMode`。
- 现有 API 测试只断言写库和入队，没有让真实 Worker 消费该任务，因此没有捕获协议断裂。
- 影响：当前恢复按钮可能重新进入 Provider Adapter；与“不重新生成、不重复计费”的 UI、日志和文档承诺不一致。
- 处置：Production 暂停使用恢复按钮；以 `0.8.3` 做 Gray-first 修复。恢复命令应使用独立、不可变的 task operation/attempt 类型，不能继续靠散落在 payload/result 的自由字段判断。

### P1：Provider 成功证据不足以支持崩溃恢复

- Worker 在 Provider 提交成功后若崩溃，任务可能停留在 running；reaper 只把超时任务改为 failed。
- 即使已有 `upstreamTaskId`，也没有通用 reconciler 恢复轮询或查询迟到成功结果。
- 本地轮询超时可能早于 Provider 真正完成，导致“服务商成功、平台失败”。
- 处置：在提交响应后立即事务化保存 Provider attempt；增加 `reconciliation_pending` 和按 Provider Adapter 恢复 poll/final-result 的后台调和器。

### P1：下载完整性与原子性不足

- 视频续传没有验证 `Content-Range` 起点/总长、ETag/Last-Modified、206 语义或最终 checksum。
- 图片和音频仍是单次 `arrayBuffer()` 下载，没有视频同等级重试、授权上下文和中断恢复。
- 三类媒体最终都在内存中聚合，再直接写最终文件名；大文件会放大 Worker 内存，进程中断可能留下被 `stat()` 误认为完整的文件。
- 处置：统一流式下载器，写 `.part`，校验长度/MIME/可选 checksum 后原子 rename；Range 必须绑定 validator，服务端忽略 Range 时从 0 安全重启。

### P1：恢复依赖易过期的远程 URL

- 当前恢复只重用 task result 中的远程 URL；签名 URL 过期后无法通过 `upstreamTaskId` 获取新 URL。
- `remoteXUrls || xUrls` 在 `remoteXUrls=[]` 时会遮蔽有效兼容 URL。
- 远程签名 URL 持久化在 result 中，也可能把 credential-like query 暴露给不必要的读取面。
- 处置：优先保存 Provider artifact locator，而不是长期保存完整签名 URL；恢复时通过 Provider Adapter 刷新短期 URL。持久化前对 query 凭据脱敏或加密，并限制 Admin/API 投影。

### P1：终态写入缺少执行 fencing

- `queued -> running` CAS 能防重复领取，但任务被 reaper 标记失败后，旧 Worker 仍可能继续完成写回。
- `updateTask` 没有验证 attempt ID/lease generation，reaper 与迟到 Worker 可能互相覆盖。
- 处置：每次领取生成 `attempt_id` 和递增 `lease_generation`；heartbeat、reaper、完成和失败写入都必须带 fencing 条件。

### P2：可观测性不能回答“卡在哪一跳”

- 当前下载失败缺少 DNS、connect、TLS、TTFB、吞吐、已收字节、Range 结果、CDN host 等结构化指标。
- `unknown=237`，占七日失败的 29.6%，说明分类仍不足以指导自动恢复和告警。
- 处置：为 submit/poll/final-result/download/register/deliver 建立阶段事件与直方图；按 Provider、模型、协议、媒体类型和环境聚合，不记录完整 URL 或密钥。

### P2：本地文件系统仍是单点

- 数据库保存产物元数据，本地磁盘保存二进制；跨服务器迁移、磁盘故障或 release/挂载错误都会导致引用存在但文件不可用。
- 处置：引入对象存储作为 Artifact Binary 权威，采用临时 key -> 完整性校验 -> 原子 promotion；本地目录只做缓存。

## Agent Runtime 发现

### 生产故障原因

1. 数据库迁移创建了治理表，但没有建立生产环境可用的 Agent definition/configuration 和 LLM route pool 基线。
2. 环境运行控制记录缺失，resolver 按安全默认值返回 `agentEnabled=false`。
3. 第一版 route 虽已发布，但 capability snapshot 为空；planner 要求 `text_chat`，最终报 `LLM_ROUTE_UNAVAILABLE:planner:assistant-chat`。

### 已完成的生产修复

- 修复前创建 PostgreSQL 备份；备份路径记录在 Production validation，不写入密钥或连接串。
- 通过审计 Admin API 初始化 8 个 Agent definition/configuration 和 3 个 route pool。
- 发布 `assistant-planner`、`admin-assistant-planner`、`supervision-planner` 的 Production Agent v1。
- 发布 3 个包含 `text_chat` capability snapshot 的 route v2；主路由 Grok 4.5，fallback 为 GPT-5.6 Terra。
- Production 运行控制设为 `observe`：Agent 与 Canvas Run 开启，自动恢复和质量评估关闭。
- 前台助手与后台助手真实请求均返回 `mode=agent`，不是本地 fallback。

### Agent 加固项

| 优先级 | 加固项 | 验收标准 |
| --- | --- | --- |
| P0 | 幂等环境 bootstrap manifest | 空数据库执行一次得到完整基线；重复执行无漂移；不包含 secret |
| P0 | 发布前 readiness gate | 每个 surface 校验 definition、approved version、environment publication、route publication、`text_chat` candidate 和 runtime control |
| P0 | 真实请求 canary | 前台助手、后台助手和 supervision planner 各发 1 次受控请求；必须为 `mode=agent`，fallback 视为失败 |
| P1 | route capability contract | route publish 时从模型目录快照能力并拒绝空/不匹配 capability；新增迁移与回归测试 |
| P1 | 环境控制显式化 | Gray/Production 必须有数据库记录；缺失仍 fail closed，但 Admin 直接展示缺失原因和修复动作 |
| P1 | publication drift 检测 | 定期比较期望 manifest、已发布版本和运行时 resolver 输出，漂移触发告警 |
| P2 | Agent SLO 与审计关联 | 按 surface 观测 agent/fallback 比例、route exhaustion、模型延迟、熔断和 audit correlation ID |

## 分阶段整改计划

### P0：下一个 Gray 补丁（建议 `0.8.3`）

1. 修复恢复任务的 operation contract，禁止恢复路径进入 Provider submit。
2. 增加 API -> DB -> Redis -> Worker 端到端测试，并以 Provider submit spy 断言调用次数为 0。
3. 禁止 Production 恢复按钮，直到同一制品完成 Gray 真实产物恢复验收。
4. 把 Agent bootstrap/readiness/canary 纳入 release gate。

### P1：可靠交付里程碑

1. 新增 Provider Attempt、Artifact Materialization Attempt 与独立状态机。
2. 建立 late-completion reconciler 和基于 upstream ID 的 URL 刷新。
3. 统一三类媒体的流式、原子、可校验下载器。
4. 引入 attempt/lease fencing，阻止 reaper 与迟到 Worker 竞态。
5. 将物料化重试做成持久队列，使用有上限退避、jitter、`Retry-After` 和人工死信处置。

### P2：容量与可观测性

1. 建立阶段级 SLI：Provider 接受率、Provider 成功率、物料化成功率、端到端交付率、P95/P99 延迟。
2. 把 `unknown` 失败占比降至 5% 以下，并对 Provider 成功/本地失败建立独立告警。
3. 迁移 Artifact Binary 到对象存储，增加定期引用完整性抽检。

## 必须新增的回归矩阵

- 恢复任务消费时 Provider submit 调用数为 0，计费项不增加。
- Worker 在 submit 后、poll 中、Provider success 后、下载中、文件 rename 前后和 DB commit 前后崩溃，均能重放且不重复计费。
- Provider 在本地 timeout 后完成，reconciler 能转入物料化，不要求用户重新生成。
- Range 返回错误 offset、200 全量、ETag 改变、长度不符和 416 时，不拼接损坏文件。
- 图片、视频、音频分别覆盖 429/408/5xx、`Retry-After`、流中断、授权上下文和签名 URL 刷新。
- reaper 与旧 Worker 并发完成时，只有当前 lease generation 可以写终态。
- Agent 在空库、缺 runtime control、route capability 缺失、主模型熔断和 fallback 成功/失败时均有确定的 readiness 与审计结果。

## 放行标准

- Gray 连续完成至少 5 次同 Provider/模型的生成到可下载交付；测试必须真正进入下载与物料化阶段，不能把上游 503 当作链路成功。
- 至少 1 次注入式下载中断后自动恢复成功，且最终文件通过长度或 checksum 校验。
- 至少 1 次模拟本地 poll timeout 后通过 reconciler 找回 Provider 迟到成功。
- 恢复按钮完成真实旧任务恢复，Provider submit=0、费用增量=0、Artifact 可访问。
- 前后台助手与 supervision planner canary 全部 `mode=agent`，并验证 route 主备切换。
- 所有敏感 URL、请求头、密钥只允许存在于受控运行内存或加密存储，不进入文档、日志和普通 API 投影。

## 相关入口

- Worker 执行链：`../../systems/worker/execution-chain.md`
- Worker 输出物料化：`../../systems/worker/output-materialization.md`
- API 请求链：`../../systems/api/request-response-flow.md`
- Agent Runtime：`../../systems/agent-runtime/README.md`
- Production 验证：`../../logbooks/validations/2026-07-27-provider-output-recovery-production-v082-r1.md`
- Gray 验证：`../../logbooks/validations/2026-07-27-provider-output-recovery-v082-r1.md`
