# PRD 版本索引

## 当前版本

- `v0.4.3`｜🟡 Phase 3 持续收口 + RH worker 路由与字段显示名适配已完成 gray 发布｜2026-06-22｜当前活跃版本
  - 摘要：无限画布 2.0 已完成 T8 成熟画板迁入、单端口服务、灰度/生产入口、认证、统一后台、PostgreSQL repository、Redis/worker 任务队列、后台 Provider/模型治理、GRSAI 同步/异步链路、输出素材落库、素材空间联动、取消/重试、环境同步，以及 RunningHub 工作台、RH 运行时治理和 RH 条目真实输入槽同步发布。按产品路线口径，当前仍属于 `Phase 3` 持续收口；按多用户正式化治理口径，`Phase A-E` 已完成灰度/生产收口、rollback 样本补齐，以及长期观测治理第三批上线。当前生产 release 为 `20260619-runninghub-slot-sync-prod-r1-v040-local`，当前灰度已切到 `20260622-runninghub-worker-routing-gray-r1-v043-d253c57`，并通过 gray gate 与页面级复查。`2026-06-22` 已继续完成 RH 分析面板 `requestExample / responseExample` 补齐、后端从 `requestExample.nodeInfoList` 生成字段、`responseExample` 推断输出定义与执行规则、`runTargetId` 校验修复、`instanceType` 默认值治理，以及 RH worker 路由修复、字段显示名透传和输出类型自定义值保留。下一步主要剩余项继续集中在用户对 gray 的真实条目与任务实链验证、外部通知闭环、更稳定的 release 迁移依赖链，以及 RH 节点后续能力扩展。
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
