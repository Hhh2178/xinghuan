# PRD 版本索引

## 当前版本

- `v0.4.9`｜🟡 Phase 3 持续收口 + RunningHub 空白草稿创建与输出重置灰度热修完成｜2026-06-23｜当前活跃版本
  - 摘要：无限画布 2.0 当前产品能力基线继续沿 RunningHub、后台治理、队列并发、环境同步与多用户正式化治理推进。本轮灰度把 RunningHub 工作台和画布节点的一组高频问题收口：后台新建空白 `AI 应用 / 工作流` 改为默认停用，不再因为缺少输入槽而在新建时直接报错；RH 工作台条目摘要的备注区增强视觉强调；画布 RH / RH Tools 节点在再次执行前会先清空旧输出，再按本次结果整组覆盖，避免历史输出残留污染后续输出素材节点；字段显示也开始优先使用后台 `displayLabel`。当前生产 release 仍为 `20260619-runninghub-slot-sync-prod-r1-v040-local`，当前灰度已推进到 `20260623-runninghub-draft-output-reset-gray-r1-v049`。下一步重点是继续做灰度真人联调，确认 RH 画布实跑侧的显示与输出链路完全符合预期。
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
