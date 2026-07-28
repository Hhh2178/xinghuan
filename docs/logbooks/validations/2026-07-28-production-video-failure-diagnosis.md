# Production 视频失败归因（2026-07-28）

## 运行前提

- 目标：旧服务器 `ubuntu@101.33.75.38:728` 的 Production。
- 当前 release：`20260721-admin-health-visual-resource-domain-prod-r1-v0717`（v0.7.17）。
- 诊断期间未修改 Production、未重启服务、未部署新 release。

## 结论

截图中的 `400` 不能一概归因于本地回传失败，至少分为两类：

1. 柏拉图 `grok-1.5-video-15s` 返回的 `fail_to_fetch_task` 明确写着 `no available platform found ... and no fallbacks configured`，并附带 Nexus Trace ID。该响应来自上游网关，平台选择失败发生在创建上游任务之前，所以供应商任务列表没有对应记录；这是供应商容量/路由配置问题，不是本地下载或轮询丢回调。
2. AiFork `grok-imagine-video-1.5-preview` 的 400 是“请求参数有误”，同样没有 `upstreamTaskId`，说明请求在上游同步校验阶段被拒绝。Production 近期所有该模型的 15 秒任务均失败，而 6 秒任务有成功样本，表明本地模型参数 schema 允许了上游当前不接受的 15 秒组合，属于请求契约/模型能力漂移，需要在模型目录或请求前校验修正。

## 交叉证据

- 柏拉图同一模型在相同 Production worker 上有 6 个 succeeded，但同时有 19 个 failed；失败消息集中为无可用平台，说明失败不是统一的本地回传故障。
- AiFork preview 近期统计为 1 succeeded、13 failed、2 cancelled；成功任务为 6 秒并成功落盘为本地 MP4，失败 15 秒任务在供应商 task id 生成前即返回 400。
- AiFork fast 与 sd2 任务的 `503 No available channel` 也没有 upstream task id，属于上游渠道/分组容量不可用。
- 当前代码会把部分上游 400 归类为 `unknown`，导致后台只显示“失败”，掩盖了“上游无平台”和“参数契约不匹配”的差异；这属于后续应在 Gray 先修的可观测性问题。

## 后续建议（不在本次 Production 直接执行）

- 在 Gray 增加上游错误分类：`fail_to_fetch_task/no available platform` → provider/channel unavailable；参数校验 400 → model_config/parameter。
- 对 Aifork preview 按已验证的 6 秒能力收紧 Production/Gray 模型目录，或在提交前拒绝未被该供应商确认的 10/15 秒选项。
- 保留上游 HTTP 状态、Nexus/request id、submit payload 摘要和是否生成 upstreamTaskId，避免将供应商网关拒绝误判为本地回传失败。
- 柏拉图需要供应商侧恢复 `grok-1.5-video-15s`/`6s` 可用平台或配置 fallback 后，再做成功率验收。

## 柏拉图失败任务反查（追加）

- 使用只读审计脚本按已保存的 `upstreamTaskId` 复查最近 7 天 50 条本地 failed 的 APIMart 视频任务；脚本只输出脱敏状态、失败原因计数和视频数量，不输出 Provider Key、请求头或媒体签名 URL。
- 49 条上游当前也是失败；其中主要包括“流处理结束但未收到完成或错误事件”、上游凭据/缓存异常、频率限制和内容拒绝。
- 1 条出现真实状态错位：本地 `task-1785147300674-kw8mp8` 为 failed，但上游当前为 `success` 且存在 1 个视频。
- 该任务本地日志只有“领取任务”与 stale reaper 回收；结果已记录 `upstreamStatus=success`、`progress=100%`，最后 heartbeat 后约 30 分钟被写成 `worker_stalled_or_upstream_timeout`。这证明当前链路会在 Provider 已成功、结果拉取/物料化未完成或 Worker 边界失联时永久丢失成功结果。
- Production 仍冻结在 v0.7.17，未对该任务做恢复写入。修复先进入 Gray：物料化持续 heartbeat、stale 条件更新防终态覆盖、按原上游任务号有限自动恢复、后台手工恢复入口，以及错误分类细化。
