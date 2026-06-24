# Worker 系统

## 这个系统负责什么

Worker 负责消费任务、执行 Provider 或 RunningHub 调用、处理排队与并发、查询结果并将输出物料化。

## 建议阅读顺序

1. `execution-chain.md`
2. `queue-and-concurrency.md`
3. `output-materialization.md`

## 关键代码入口

- 主循环：`apps/worker/src/worker.ts`
- 取消同步 glue：`apps/worker/src/worker-cancel-sync.ts`
- 失败写回 glue：`apps/worker/src/worker-failure-glue.ts`
- deferred / requeue glue：`apps/worker/src/worker-deferred-requeue.ts`
- 任务运行态存取：`apps/worker/src/worker-task-store.ts`
- 任务生命周期 glue：`apps/worker/src/worker-task-lifecycle.ts`
- RunningHub 协议 client：`apps/worker/src/worker-runninghub-client.ts`
- 统一运行态诊断：`apps/worker/src/worker-runtime-diagnostics.ts`
- RunningHub poll 响应归一化：`apps/worker/src/worker-runninghub-response.ts`
- 输出落库：`apps/worker/src/output-materials.ts`
- Provider 请求体：`apps/worker/src/worker-provider-request-body.ts`
- Provider 工具：`apps/worker/src/worker-provider-utils.ts`
- 媒体异步轮询：`apps/worker/src/worker-media-polling.ts`

## 当前重点

- 普通 Provider 与 RunningHub 任务必须分开处理
- 配置并发与实际生效并发必须能对齐
- 输出不能只停留在外链，要进入本地结果体系
- `worker.ts` 当前仍是编排 glue + 历史聚合热点，但 RunningHub 第二阶段已经先抽出：
  - 协议 submit / poll / 输出提取：`worker-runninghub-client.ts`
  - poll 非 JSON 护栏：`worker-runninghub-response.ts`
  - 统一失败归一化：`worker-runtime-diagnostics.ts`
  - RunningHub key 调度：`worker-runninghub-dispatch.ts`
  - 任务读取 / 状态写回 / heartbeat patch：`worker-task-store.ts`
- `2026-06-24` 已再下沉一层：
  - 取消后丢弃结果/错误与保留取消态：`worker-task-lifecycle.ts`
  - 统一 failed writeback glue 与上游业务失败 patch：`worker-task-lifecycle.ts`
- `2026-06-24` 已继续再下沉一层：
  - claim/result/error/retry/completion 的取消态 glue：`worker-cancel-sync.ts`
  - failed writeback patch 拼装与失败归一化：`worker-failure-glue.ts`
- `2026-06-24` 已继续把 deferred / requeue glue 下沉到：
  - 等待 user / RunningHub 执行窗口后的 queued runtime patch + 延迟回推：`worker-deferred-requeue.ts`
  - RunningHub queue-limit 回退到 queued、释放后再回推队列、chat -> video 队列映射：`worker-deferred-requeue.ts`
- `2026-06-24` 已继续把普通 Provider 的异步媒体轮询细节下沉到：
  - APIMart 视频轮询 / 最终结果查询：`worker-media-polling.ts`
  - APIMart 图像轮询：`worker-media-polling.ts`
  - ModelScope 图像轮询与 task 状态提取：`worker-media-polling.ts`
- 本轮后 `worker.ts` 继续保留：
  - worker 主循环
  - provider / RunningHub 执行编排
  - 高层 orchestration：领取、释放窗口、成功/失败分支与最终收口
- 后续收口目标是继续把剩余零散运行态 glue 从主文件剥离，避免 `worker.ts` 继续堆积 provider 细节
- 当前下一步收口重点已更新为：
  - `remaining runtime glue`
  - `provider capability entry seam`

## 工程治理要求

- `worker.ts` 这类 orchestration 入口文件，不再允许继续直接吸收新的 provider 协议细节。
- 新增协议或新平台时，优先新增 `client / dispatch / diagnostics / cancel-sync / deferred-requeue` 模块，而不是把新逻辑塞回主循环。
- 当单文件同时承载 orchestration、协议解析、状态归一化、输出映射三类以上职责时，本轮任务必须同步拆分，不允许只追加代码。

## 兼容正文来源

- `docs/project-atlas/worker-execution-chain.md`

## 更新规则

- 新的 Worker 正文优先写当前系统目录
- atlas 文件只保留兼容层导航正文
