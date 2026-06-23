# PRD 版本索引

## 当前版本

- `v0.4.8`｜🟡 Phase 3 持续收口 + 文档治理正式规范已固化并随 gray release 落盘｜2026-06-23｜当前活跃版本
  - 摘要：无限画布 2.0 当前产品能力基线仍延续 RunningHub、后台治理、队列并发、环境同步与多用户正式化治理的既有收口结果；本轮新增的是文档治理层的正式规范化：治理规则从旧兼容长文切到 `docs/governance/` 目录，`MEMORY.md`、`DEVLOG.md`、`ops/README.md` 固化为摘要与跳转入口，`ops/current/` 与 `ops/archive/` 的边界进一步明确，同时发布包开始显式携带 `docs/INDEX.md` 与 `docs/governance/`，确保 gray release 目录也能看到当前正式规范。当前生产 release 仍为 `20260619-runninghub-slot-sync-prod-r1-v040-local`，当前灰度已推进到 `20260623-documentation-governance-standard-gray-r1-v048`。下一步重点仍是继续沿新规范维护入口一致性，并在后续真实功能发布中避免再次出现主入口与系统知识脱节。
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
