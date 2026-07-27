# Worker 输出物料化

## 目标

把上游返回结果转成前端、生成库和任务记录都能稳定消费的本地输出结构。

## 当前内容

- 图片、视频、音频结果需要保留类型化输出数组
- 文本结果需要保留文本内容
- 结果不应因为能力分支判断错误而丢失
- 图片、视频、音频文件物料化后，Worker 使用稳定 `gen-<task>-<kind>-<index>` ID 幂等写入 `xh_generation_artifacts`。
- index 在每种媒体类型内独立计算；重试时其他媒体类型数量变化不会改变既有 Artifact ID。
- Worker 不再把每个任务输出自动写成长期 `xh_assets`；长期素材只能通过 Promotion 创建。
- task result 新增 `generationArtifactIds`；`resourceItemIds` 暂时保留兼容投影，后续调用方完成迁移后移除。
- file 模式写入 `generation-library.json` 时使用每文件串行队列和原子 rename。
- 远程视频内容下载支持有限指数退避，并对 `429/502/503/504`、授权拒绝和响应流中断分别分类；支持在已经收到部分字节后用 HTTP Range 继续读取，避免把 Provider 内容回源异常误报成普通 `terminated`。
- Provider 已成功但本地物料化失败时，任务结果会保留 `remoteVideoUrls` / `remoteImageUrls` / `remoteAudioUrls`、`upstreamTaskId`、`providerState`、`materializationStatus`、`materializationAttempts` 和 `outputRecoveryAvailable`。
- `POST /api/admin/tasks/:id/recover-output` 的产品意图是只重新入队物料化、不重新提交 Provider、不重复计费。0.8.3-r1 同时把 `outputRecoveryMode=output_only` 写入 `payload` 和 `result`；Worker 的独立操作分流同时兼容旧版仅写入 `result` 的任务，并在命中任一标记时跳过 Provider 执行。静态契约门禁保护该边界；在 Gray 的同任务 ID、零 Provider 提交、成本计数不变和产物可读验收完成之前，Production 不得将该入口视为已完成的端到端保证。

## 关键文件

- `apps/worker/src/output-materials.ts`
- `apps/worker/src/worker.ts`
- `packages/shared/src/generation-artifact.ts`
- `apps/api/db/024_generation_artifacts.sql`

## 当前边界

- 输出 schema 与节点展示仍要依赖后台条目定义保持一致。
- 数据库迁移必须先于新 Worker 启动；否则 Worker 会因缺表安全失败，不降级写入长期资源表。
- 远程视频具备有限重试与 Range 续传；图片和音频仍是一次性内存下载。三类媒体尚未统一到临时文件、完整性校验和原子 promotion 的下载器。
