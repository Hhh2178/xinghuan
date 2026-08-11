# Worker 输出物料化

## 目标

把上游返回结果转成前端、生成库和任务记录都能稳定消费的本地输出结构。

## 当前内容

- Worker 每次领取任务时读取 `materialLifecycle.outputRetentionDays`，并在该任务的输出物料化阶段冻结使用；图片、视频和音频产物统一按该值计算 `expires_at`，未配置时回退产品默认 3 天。

- 图片、视频、音频结果需要保留类型化输出数组
- 文本结果需要保留文本内容
- 结果不应因为能力分支判断错误而丢失
- 图片、视频、音频文件物料化后，Worker 使用稳定 `gen-<task>-<kind>-<index>` ID 幂等写入 `xh_generation_artifacts`。
- index 在每种媒体类型内独立计算；重试时其他媒体类型数量变化不会改变既有 Artifact ID。
- Worker 不再把每个任务输出自动写成长期 `xh_assets`；长期素材只能通过 Promotion 创建。
- task result 新增 `generationArtifactIds`；`resourceItemIds` 暂时保留兼容投影，后续调用方完成迁移后移除。
- file 模式写入 `generation-library.json` 时使用每文件串行队列和原子 rename。
- 远程图片、视频和音频内容下载共用有限指数退避，并对 `429/502/503/504`、授权拒绝和响应流中断分别分类；视频在已经收到部分字节后继续使用 HTTP Range，避免把 Provider 内容回源异常误报成普通 `terminated`。
- 所有新远程媒体输出先写唯一同目录 `.part` 文件，再原子改名为最终文件名；下载或写入失败不会把最终文件名暴露给 Artifact 登记。失败时只尝试移除该次明确生成的临时文件，不触及历史输出或 release。
- Provider 已成功但本地物料化失败时，任务结果会保留 `remoteVideoUrls` / `remoteImageUrls` / `remoteAudioUrls`、`upstreamTaskId`、`providerState`、`materializationStatus`、`materializationAttempts` 和 `outputRecoveryAvailable`。
- `POST /api/admin/tasks/:id/recover-output` 不会重新提交 Provider：已有远程 URL 时使用 `outputRecoveryMode=output_only`；视频没有 URL 但保留 `upstreamTaskId` 时使用 `provider_poll_resume`，按原任务号继续查询并在完成后物料化。API 同时把模式写入 `payload` 和 `result`，Worker 的独立操作分流兼容旧版仅写入 `result` 的任务。
- Provider 查询成功到远程媒体下载、原子写盘和 Artifact 登记期间，每 15 秒刷新任务 heartbeat。弱带宽或大文件下载不会因超过 stale reaper 窗口而被误判为 Worker 挂死。
- stale reaper 使用带 `status='running'` 和原 `updated_at` 上限的单条条件更新，不能覆盖并发完成的 succeeded/cancelled 终态。仍保留上游视频任务号的 stale task 在最多三次预算内自动转为 `provider_poll_resume` 并重新入队；预算耗尽后才写入终态失败。

## 关键文件

- `apps/worker/src/output-materials.ts`
- `apps/worker/src/worker.ts`
- `apps/worker/src/worker-output-recovery.ts`
- `apps/worker/src/worker-provider-output-resume.ts`
- `apps/worker/src/worker-operation-heartbeat.ts`
- `apps/worker/src/worker-stale-task-recovery.ts`
- `apps/worker/src/worker-stale-task-reaper.ts`
- `packages/shared/src/generation-artifact.ts`
- `apps/api/db/024_generation_artifacts.sql`

## 当前边界

- 输出 schema 与节点展示仍要依赖后台条目定义保持一致。
- 数据库迁移必须先于新 Worker 启动；否则 Worker 会因缺表安全失败，不降级写入长期资源表。
- 三类远程媒体现在共享失败分类、有限重试和 `.part` 原子 promotion；视频保留 Range 续传。当前下载完成后仍会在 Worker 内存中聚合响应体，尚未实现流式落盘、Content-Range validator/长度校验或 checksum；这些容量与完整性增强需另行以故障注入验证后发布。
