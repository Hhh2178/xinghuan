# Worker 系统

## 这个系统负责什么

Worker 负责消费任务、执行 Provider 或 RunningHub 调用、处理排队与并发、查询结果并将输出物料化。

## 建议阅读顺序

1. `execution-chain.md`
2. `queue-and-concurrency.md`
3. `output-materialization.md`

## 关键代码入口

- 主循环：`apps/worker/src/worker.ts`
- 输出落库：`apps/worker/src/output-materials.ts`
- Provider 请求体：`apps/worker/src/worker-provider-request-body.ts`
- Provider 工具：`apps/worker/src/worker-provider-utils.ts`

## 当前重点

- 普通 Provider 与 RunningHub 任务必须分开处理
- 配置并发与实际生效并发必须能对齐
- 输出不能只停留在外链，要进入本地结果体系
