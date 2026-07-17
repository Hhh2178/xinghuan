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

## 关键文件

- `apps/worker/src/output-materials.ts`
- `apps/worker/src/worker.ts`
- `packages/shared/src/generation-artifact.ts`
- `apps/api/db/024_generation_artifacts.sql`

## 当前边界

- 输出 schema 与节点展示仍要依赖后台条目定义保持一致。
- 数据库迁移必须先于新 Worker 启动；否则 Worker 会因缺表安全失败，不降级写入长期资源表。
