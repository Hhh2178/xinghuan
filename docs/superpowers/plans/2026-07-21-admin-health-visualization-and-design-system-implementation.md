# Admin 统一设计与系统健康可视化实施计划

状态：已完成并发布 Gray
日期：2026-07-21
目标环境：Local → Gray
禁止环境：Production

## 目标

把后台统一设计规范从文档约束落实为可复用实现，并将系统健康页改造成异常优先、数据可信、可解释、可下钻的桌面可视化页面。

## 权威设计输入

- `DESIGN.md`
- `docs/systems/admin/frontend-design/README.md`
- `docs/systems/admin/frontend-design/system-health-visualization-standard.md`
- `docs/systems/admin/frontend-design/design-tokens.md`
- `docs/systems/admin/frontend-design/visual-component-registry.md`
- `docs/systems/admin/frontend-design/functional-component-registry.md`

## 实施阶段

1. **契约与失败测试**：固定环境隔离、健康计算、stale/unknown、失败与取消分离。
2. **后端正确性**：修复 runtime slot 跨环境统计和 Redis `KEYS`；建立有边界的健康聚合 DTO。
3. **可视化 primitives**：实现健康摘要、领域卡、拓扑、趋势、容量、热力图、事件线和 Inspector。
4. **页面重构**：按“告警 → 当前健康 → 拓扑 → 趋势 → 对比 → 事件”重建系统健康页。
5. **统一视觉接入**：把页头、状态、面板、图表和 Inspector 收敛到 common/observability 层。
6. **本地门禁**：单测、类型、构建、契约、浏览器桌面验收、查询与 bundle 评估。
7. **Gray 验证**：按 PATCH release runbook 发布 Gray，验证服务、API、图表、下钻、控制台和日志。

## 后端交付物

- 环境/queue 精确隔离的 Worker runtime summary。
- 不使用 Redis `KEYS` 的 runtime slot 读取。
- 基于失败率、基线、样本量和持续窗口的健康 evaluator。
- 带 environment/range/generatedAt/freshness/reason/threshold/sampleSize 的 DTO。
- 服务端聚合的趋势、失败构成、队列容量与一致性指标。
- 定向单测和 route/repository contract tests。

## 前端交付物

- `apps/admin/src/components/observability/` 组件族。
- 新系统健康页面和右侧观测 Inspector。
- 1h/24h/7d/30d 范围与分层刷新。
- loading/empty/error/stale/unknown/insufficient 状态。
- 任务、Provider、模型、发布与审计下钻。
- 桌面 1366×768、1440×900、1920×1080 验收截图。

## 数据与性能约束

- 图表只消费聚合桶，单图默认不超过 500 点。
- 首屏摘要 API P95 目标小于 500ms，不同步探测第三方 Provider。
- 页面不可见时暂停刷新，切换范围/环境取消旧请求。
- 不使用 `readAdminDbPostgres()` 的全量 task payload/result/logs 作为图表数据源。
- queued DB/Redis mismatch 在 GET 中只观测不隐式修复。

## 验证命令

最终按实际实现补齐并运行：

```text
npm run verify:visual-design-docs-contract
npm run verify:design-token-docs-contract
npm run verify:component-registry-docs-contract
npm run type-check -w @xinghuan/admin
npm run type-check -w @xinghuan/api
npm run build -w @xinghuan/admin
npm run build -w @xinghuan/api
npm run verify:quick
```

新增的 system-health/observability contract 命令必须进入本清单和适用 Harness。

## Gray 放行条件

- 定向与通用门禁全部通过。
- 三个桌面宽度无横向溢出、双滚动条或遮挡。
- Gray 页面显示的 Worker/queue 指标不包含 Production。
- 告警原因、阈值、窗口、样本量和更新时间可见。
- 图表下钻保留环境、时间范围和筛选条件。
- Gray 服务、API、Worker、console、journal 无新增异常。
- Production 当前 release、版本和服务启动时间保持不变。

## 发布边界

- 只允许 Gray 发布。
- 不执行 Production deploy、restart、migration、config write。
- Gray 验收失败时回滚 Gray，不以 Production 验证代替 Gray 修复。

## 执行跟踪

实时 Phase 状态、错误和验证证据记录在：

- `.planning/2026-07-21-admin-health-visualization-and-design-system/task_plan.md`
- `.planning/2026-07-21-admin-health-visualization-and-design-system/findings.md`
- `.planning/2026-07-21-admin-health-visualization-and-design-system/progress.md`
