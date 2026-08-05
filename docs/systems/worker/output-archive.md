# 输出归档 Worker

RunningHub 成功任务的自动下载归档由 Worker 异步完成。API 只负责按 owner 校验任务并创建归档作业，Worker 从服务端已物料化的 `/files/output/*` 文件生成 ZIP。

## 执行约束

- 全站同时最多运行一个归档作业，使用 `xh_output_archive_dispatch_slots` durable lease。
- 归档作业按 owner round-robin 轮转，避免单一用户长期占用队列。
- 视频、音频等媒体使用 ZIP store 模式，不做重复压缩；源文件通过 stream 读取，不进入完整内存缓冲。
- 文件写入 `<archive>.part`，完成后原子 rename 为 `<archive>.zip`。
- Worker heartbeat 续租；进程故障后过期 running lease 会回到 queued，临时文件不会被作为成品暴露。
- 取消、TTL 到期和下载后清理均由 Worker 负责；ZIP 内包含 `manifest.json`，记录缺失文件和实际源文件字节数。

## 前端交付行为

- RH 节点把 `archiveJobId`、`archiveStatus`、`archiveFilename` 和 `autoDownloadedJobId` 持久化到节点数据；页面刷新后会恢复未完成的归档轮询，已自动下载的同一作业不会再次触发浏览器下载。
- 用户点击“重试”会清理旧作业标记并创建新的归档作业，继续沿用服务端队列和单并发约束。
- 输出素材节点提供左上角“下载当前节点全部输出素材”入口，按去重后的图片、视频和音频 URL 逐项触发浏览器下载；文本内容仍保留在节点中展示和透传。

## 配置

默认值为 `OUTPUT_ARCHIVE_MAX_PENDING_PER_OWNER=2`、`OUTPUT_ARCHIVE_TTL_MINUTES=120`、源文件总量 8 GiB、预留磁盘 10 GiB。Worker 可通过 `OUTPUT_ARCHIVE_WORKER_ENABLED=false` 暂停归档循环；全局并发由数据库 durable slot 固定为 1。
