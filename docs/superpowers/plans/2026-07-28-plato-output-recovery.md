# 柏拉图视频结果恢复与弱带宽稳定性计划

## 目标

在不重复提交 Provider、不重复计费的前提下，修复柏拉图上游任务已创建或已成功、画布却因轮询/物料化中断而永久失败的问题；所有变化先发布旧服务器 Gray，Production 保持 v0.7.17。

## 已确认故障模型

1. 同步 400 且没有 `upstreamTaskId`：上游无可用平台或请求参数契约不匹配，不能通过结果恢复解决。
2. 已有 `upstreamTaskId` 且上游终态失败：保留可观测诊断，不重复生成。
3. 已有 `upstreamTaskId` 且本地 stale/失败、上游后来成功：按原任务号续轮询并物料化，是本计划主修复路径。
4. Provider 已成功但弱带宽下载超过 stale 窗口：持续 heartbeat、Range 续传、有限重试和原子写盘共同保护。

## 执行顺序

1. 用失败测试锁定错误分类、恢复操作分流、API 入队、stale 原子转移和物料化 heartbeat。
2. 增加 `provider_poll_resume`，复用 APIMart/AICopy 查询配置，只调用查询接口。
3. stale reaper 对有上游视频任务号的任务最多自动恢复三次，并用 `running + updated_at` 条件更新避免覆盖并发终态。
4. 下载和中间/最终物料化期间每 15 秒写 heartbeat；保留既有有限重试、视频 Range 续传和 `.part` 原子 promotion。
5. 发布 Gray 后优先执行柏拉图首帧 5 次，再以 AiFork 5 次作对照；监控 Provider task ID、请求次数、heartbeat、状态、Artifact、本地媒体可读性和费用快照。
6. 执行多任务并发回传与限速/流中断故障注入，确认慢下载不会被 reaper 误杀，恢复不创建新 Provider task。
7. 汇总 Gray 成功率和失败分类；未经用户确认不晋级 Production。
