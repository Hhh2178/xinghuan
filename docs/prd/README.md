# PRD 版本索引

## 当前版本

- `v0.4.13`｜🟡 Phase 3 持续收口 + GRSAI worker 收口与 RunningHub 动态 Key 池已进入 gray / production｜2026-06-23｜当前活跃版本
  - 摘要：无限画布 2.0 当前产品能力基线继续沿 RunningHub、后台治理、队列并发、环境同步与多用户正式化治理推进。本轮继续在 `v0.4.12` 的 RH 恢复轮询基础上，补齐 GRSAI worker 真实执行路径的独立 client 与直测护栏，并将 RunningHub 调度修正为“默认 Key 优先、worker 执行前实时选可用 Key、全部 Key 满载才排队”。当前 gray 与 production 已同时推进到 `v0.4.13`；下一步重点转为用户对真实业务链路的验收，以及 `worker.ts` 第二阶段收口。
  - 文档：[`prd.md`](./v0.1.0/prd.md) / [`spec.md`](./v0.1.0/spec.md) / [`design.md`](./v0.1.0/design.md) / [`entry-ui-google-brief.md`](./v0.1.0/entry-ui-google-brief.md) / [`plan.md`](./v0.1.0/plan.md) / [`provider-model-framework.md`](./v0.1.0/provider-model-framework.md) / [`assistant-hermes-plan.md`](./v0.1.0/assistant-hermes-plan.md) / [`assistant-hermes-implementation-plan.md`](./v0.1.0/assistant-hermes-implementation-plan.md) / [`progress.md`](./v0.1.0/progress.md) / [`decisions.md`](./v0.1.0/decisions.md) / [`release.md`](./v0.1.0/release.md) / [`changelog.md`](./v0.1.0/changelog.md)

## 推荐阅读顺序

如果是恢复当前 2.0 产品上下文，优先顺序：

1. `prd.md`
2. `spec.md`
3. `design.md`
4. `provider-model-framework.md`
5. `provider-async-video-template-spec.md`
6. `progress.md`
7. `release.md`
8. `changelog.md`

## 归档版本

- 暂无。
