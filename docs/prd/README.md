# PRD 版本索引

## 当前版本

- `v0.1.0`｜🔄 Phase 3 持续收口 + 正式化治理推进中｜2026-06-17｜当前活跃版本
  - 摘要：无限画布 2.0 已完成 T8 成熟画板迁入、单端口服务、灰度/生产入口、认证、统一后台、PostgreSQL repository、Redis/worker 任务队列、后台 Provider/模型治理、GRSAI 同步/异步链路、输出素材落库、素材空间联动、取消/重试、供应商短链、Provider 任务化标准链路、全节点验收矩阵与公网灰度/生产核心验收。按产品路线口径，当前仍属于 `v0.1.0` 的 `Phase 3` 持续收口；按多用户正式化治理口径，`Phase A-E` 已完成灰度/生产收口、rollback 样本补齐，以及长期观测治理第三批上线。当前灰度 release 为 `20260617-environment-sync-gray-r1-f881c28-dirty`，当前生产 release 为 `20260617-environment-sync-prod-r1-f881c28-dirty`。当前生成库已补齐图片/视频预览与下载，本地 `verify:local-acceptance-chain` 已恢复全绿；`2026-06-17` 已把柏拉图 `grok-1.5-video-6s/10s/15s` multipart 视频接入、后台结构化接入方案输出、后台环境同步能力，以及 atlas / 文档治理 / CodeGraph / release gate 收束一并推入 gray / production，下一步主要剩余项仍集中在外部通知闭环，以及沿真实高频链路继续提升 requestId 覆盖率。
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
