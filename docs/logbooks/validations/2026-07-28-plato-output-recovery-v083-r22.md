# Plato 结果恢复与并发回传验证（0.8.3-r22）

## 结论

- Gray r22 的真实 Aifork Grok 首帧链路为 `5/5` 成功：上游完成、Worker 拉取、本地 MP4 原子落盘和客户端 Range 读取全部通过。
- 本轮 Plato `5/5` 在上游创建任务前返回 `no available platform`，均没有 `upstreamTaskId`。因此后台服务商没有生成记录是预期结果；这类 400 来自上游分发/容量层，不是画布拉取失败。
- 生产历史审计已确认真实存在过 `1/50` 的“上游成功、本地失败”错配；r22 针对该失效模式增加同上游任务号续接、慢物料化心跳与条件化 stale reaper。
- Production 保持 `v0.7.17` 只读冻结，本轮只变更并验证旧服务器 Gray。

## 真实 Provider 验证

### 柏拉图

- 模型：`grok-1.5-video-6s`
- 输入：用户提供的单张 9:16 参考图，6 秒、720p。
- 显式 `first_frame` 在提交前被模型能力门禁以“当前模型未开启首帧能力”拒绝，未创建任务、未计入五次 Provider 提交。
- 随后按该模型实际公布的单图参考能力提交 5 次；5 次均由上游网关返回 `no available platform found for model`，本地分类为 `upstream_poll_gateway_failed`，没有上游任务号和远程产物。

### Aifork

- 模型：`grok-imagine-video-1.5-preview`
- 输入：同一参考图，显式首帧模式，6 秒、9:16、720p。
- 结果：`5/5 succeeded`，全部经历 `queued → in_progress → completed → materializing → succeeded`。
- 本地文件大小依次为 8,143,682、8,089,421、9,375,121、7,480,469、7,571,936 字节；总计 40,660,629 字节。
- 五个文件均返回 `video/mp4`，Range 请求返回 206，未出现并发回传、带宽争用或原子落盘失败。

## 恢复与弱带宽证据

- `canvas-generation-delivery` 契约通过；Canvas 提交、可读产物、成功投影和不重复计费的恢复边界均受门禁保护。
- Worker 定向故障注入测试 `17/17` 通过，覆盖：视频流中断后的 Range offset 续传、低速物料化心跳、停滞任务条件化接管、同 `upstreamTaskId` 续接和重复物料化幂等。
- Gray 近 30 天 APIMart 失败任务复查：2 个带上游任务号的任务当前仍为上游失败，错配数 0；没有可安全复用的新 Gray 成功错配样本。

## 发布后运行态

- current release：`20260728-plato-output-recovery-v083-r22`
- API service：`active`
- Worker service：`active`
- internal/public：`version=0.8.3`、`environment=gray`
- permission：`enforced / ready`
- database：`xinghuan_canvas_gray`
- readiness：132 subjects、125 published、3 restricted、4 retired、932 rules、5 principals、0 failures。
