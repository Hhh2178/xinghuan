# Worker 系统

## 这个系统负责什么

Worker 负责消费任务、执行 Provider 或 RunningHub 调用、处理排队与并发、查询结果并将输出物料化。

## 建议阅读顺序

1. `execution-chain.md`
2. `queue-and-concurrency.md`
3. `output-materialization.md`

## 关键代码入口

- 主循环：`apps/worker/src/worker.ts`
- 任务运行态存取：`apps/worker/src/worker-task-store.ts`
- RunningHub 协议 client：`apps/worker/src/worker-runninghub-client.ts`
- 统一运行态诊断：`apps/worker/src/worker-runtime-diagnostics.ts`
- RunningHub poll 响应归一化：`apps/worker/src/worker-runninghub-response.ts`
- 输出落库：`apps/worker/src/output-materials.ts`
- Provider 请求体：`apps/worker/src/worker-provider-request-body.ts`
- Provider 工具：`apps/worker/src/worker-provider-utils.ts`

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
- 后续收口目标是继续把 RunningHub Key 池调度与取消同步拆出，避免 `worker.ts` 继续堆积 provider 细节
- 当前下一步收口重点已更新为：
  - `cancel-sync helper`
  - `unified diagnostics / failure normalization glue`

## 工程治理要求

- `worker.ts` 这类 orchestration 入口文件，不再允许继续直接吸收新的 provider 协议细节。
- 新增协议或新平台时，优先新增 `client / dispatch / diagnostics / cancel-sync` 模块，而不是把新逻辑塞回主循环。
- 当单文件同时承载 orchestration、协议解析、状态归一化、输出映射三类以上职责时，本轮任务必须同步拆分，不允许只追加代码。

## 兼容正文来源

- `docs/project-atlas/worker-execution-chain.md`

## 更新规则

- 新的 Worker 正文优先写当前系统目录
- atlas 文件只保留兼容层导航正文
