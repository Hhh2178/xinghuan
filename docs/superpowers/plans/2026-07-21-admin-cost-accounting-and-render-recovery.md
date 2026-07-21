# 后台费用计费与动态模块恢复实施计划

状态：执行中  
日期：2026-07-21  
目标版本：Gray PATCH（Production 不变）

## 1. 交付范围

本批次一次性交付两个后台能力：

1. 模型费用配置、不可变价格快照、任务费用台账、服务商/模型/组/账号费用统计和柱状趋势。
2. 后台路由动态模块偶发永久 loading / 渲染失败的自动恢复与可重试错误态。

不包含历史费用回算、币种换算、预算告警、对账导入和 Production 晋级。

## 2. 已锁定规则

- 默认币种 `CNY`，金额使用数据库 `numeric` 和字符串 API 表达，禁止 JS 浮点作为账务权威。
- 默认计费触发器为成功终态。
- 用户取消：上游取消确认成功不计费；没有取消端口、缺少可取消任务 ID/Key，或上游取消失败，均继续计费。
- `per_request` 数量固定为 1；`per_second` 使用上游 billed seconds → 输出时长 → 请求时长，并对正数向上取整为整数秒。
- 价格版本在任务创建时锁定；owner/group/provider/model 名称同时快照。
- 上线前任务不回填费用行；统计页单独显示“历史未定价”说明和新任务未定价数量。
- 不同币种分别汇总，暂不换算。

## 3. 数据模型

### `xh_model_pricing_versions`

- `id/model_id/provider_id`
- `billing_unit`: `per_request | per_second`
- `unit_price/currency`
- `effective_from/effective_to`
- `created_by/created_at/note`

每次保存创建新版本，并关闭旧版本的生效区间，不覆盖旧价格。

### `xh_task_cost_items`

- 任务、价格版本和 `provider_cost` 类型唯一约束，保证幂等。
- 快照 owner/group/provider/model 身份。
- 记录 billing unit、整数 quantity、unit price、currency、amount。
- 状态：`pending | charged | not_charged | unpriced`。
- 记录 quantity source、charge reason、requested/output/upstream billed seconds。

任务插入触发器创建快照；任务到达终态触发器结算。已存在任务不执行回填。

## 4. API

- `GET /api/admin/model-pricing`：返回所有模型当前价格配置。
- `PUT /api/admin/model-pricing/:modelId`：校验并创建新价格版本，写审计日志。
- `GET /api/admin/analytics/cost-summary`：按日期、组、账号、Provider、模型、币种筛选并返回 KPI、排行、日柱状趋势。

所有接口仅管理员可访问；费用统计读取台账快照，不 join 当前用户组重写历史。

## 5. Admin UI

- 模型展开窗口第一块卡片为“计费与费用统计”，位于协议说明和其他高级配置之前。
- 显示启用状态、按次/按秒、人民币、单价、生效时间和取消计费说明；保存单独提交，避免与大模型表单草稿耦合。
- 数据分析与审计新增 `/admin/analytics/costs`。
- KPI 后按服务商、模型、用户组、账号展示横向柱状排名；按日趋势展示纵向柱状图；所有金额带币种。
- 未定价数量单独告警，历史数据明确说明不回算。

## 6. 动态模块恢复

- 抽取 Admin 专用 lazy importer：识别 chunk 错误、一次受控 reload、超时 reject。
- 路由错误边界在包装器超时/reject 后显示错误；自动恢复或按钮执行真实 reload，不复用已 pending/rejected 的 React.lazy promise。
- 加载超过阈值进入可恢复错误态，不能永久停在 spinner。
- 路由切换清理旧超时，错误边界随 route key 重置。

## 7. TDD 与验证顺序

1. 计费纯规则失败测试 → 实现。
2. 价格 repository/summary 聚合失败测试 → 实现。
3. migration 契约与幂等/取消 SQL 行为检查。
4. Admin lazy 超时/reload/retry 失败测试 → 实现。
5. UI 类型、路由、柱状图和模型上侧卡片契约测试。
6. 全量 tests、type-check、build、CI、release harness。
7. PATCH 制品部署 Gray；迁移、服务、权限 readiness 和真实 UI/接口验收。
8. 更新 canonical Gray state；再次确认 Production 版本未变。

## 8. 回滚

- 应用回滚到 Gray 上一制品；新增表和历史价格/费用行保留，不做破坏性 down migration。
- 触发器随应用迁移存在但只处理新任务；如需紧急停用，可在受控修复迁移中禁用触发器，禁止手工删表。
- Production 不部署，因此本批次不产生 Production 回滚动作。
