# 生成物料化稳定性验证（0.8.3-r3，进行中）

## 范围

该批次只优化 Worker 从已返回的远程媒体 URL 到本地输出文件和 Generation Artifact 登记的边界。它不发起真实 Provider 请求、不迁移数据库、不改变任务、计费或 output-only 恢复的身份语义。

## 已确认基线

- 图片和音频此前各自一次 fetch、整块读入并直接写最终文件。
- 视频已有有限退避与 Range 续传，但同样直接写最终文件。
- 任何最终文件在写入或下载中断时都可能被后续 `stat()` 观察到，因而不能作为 Artifact 已可读的可靠证明。

## 当前实现与回归矩阵

| 场景 | 预期 | 状态 |
| --- | --- | --- |
| 图片 `503` 后成功 | 有限重试，唯一 `.part` 原子提升 | 通过（mock） |
| 音频 `503` 后成功 | 有限重试，唯一 `.part` 原子提升 | 通过（mock） |
| 视频流中断 | 分类为 `provider_content_stream_terminated` | 通过（mock） |
| 视频已有 partial 后续传 | 下一请求携带已收字节 Range | 通过（mock） |
| 图片流持续中断 | 不提升最终文件名 | 通过（mock） |
| 音频 `403` | 不重试，保留 `provider_content_forbidden` 分类 | 通过（mock） |

## 当前验证结果

- `npm test -- apps/worker/src/output-materials.test.ts`：11 passed。
- `npm run type-check -w @xinghuan/worker`：passed。
- `npm run verify:canvas-generation-delivery-contract`：passed。
- `apps/worker/src/worker-materialization-stages.ts` now records sanitized `task_materializing` and `task_artifact_ready` events; failure remains owned by the existing lifecycle `task_failed` event. The Canvas generation-delivery fixture and Worker observability contract both pass.
- `npm run verify:file-hotspot-budgets`：passed at the existing `worker.ts` budget of 1765 lines after extracting the stage seam.
- 尚未构建 release archive、部署 Gray 或 Production；因此本记录不构成线上放行证据。

## 未包含的后续风险

- 响应体仍在内存中聚合；流式落盘、长度/ETag/Content-Range 验证和 checksum 属于后续容量与完整性批次。
- Provider attempt fencing、提交后崩溃调和、签名 URL 刷新和阶段级持久化事件不在本窄批次内。
- 没有付费 Provider canary；任何此类探针须另行获得明确授权。
