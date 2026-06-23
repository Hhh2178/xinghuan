# PRD 版本索引

## 当前版本

- `v0.4.15`｜🟡 Phase 3 持续收口 + RunningHub worker second-stage 第一批已进入 gray 准备发布｜2026-06-23｜当前活跃版本
  - 摘要：无限画布 2.0 当前产品能力基线继续沿 RunningHub、后台治理、队列并发、环境同步与多用户正式化治理推进。本轮在 `v0.4.14` 的 runtime guardrails 基础上，继续完成 RunningHub worker second-stage 第一批收口，将 submit / poll / 输出提取从 `worker.ts` 下沉到独立 client，并同步把“避免继续制造超级文件”和“发布前主动收紧工作树”的工程规则固化到仓库治理中。当前目标是将这些结构边界收口与工程规则以 `v0.4.15` 推进到 gray，再交由用户执行真实业务体验验收。
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
