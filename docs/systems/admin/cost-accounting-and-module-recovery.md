# 费用配置、费用分析与后台模块恢复

## 模型费用配置

- 模型展开窗口的第一块卡片为“计费与费用统计”。
- 默认币种 CNY；支持 `per_request` 和 `per_second`。
- 保存动作创建价格版本，不覆盖旧版本。
- 页面会明确展示成功计费、上游确认取消免费、未确认取消计费的规则。

## 费用分析

- 稳定路径：`/admin/analytics/costs`。
- 数据源：`xh_task_cost_items`，不使用当前模型价格实时重算。
- 可按时间、组、账号、Provider、模型筛选。
- KPI 包含金额、计费任务、按次数量、整数秒和未定价任务。
- 服务商、模型、组、账号排名与每日趋势均使用柱状图。
- 当前只展示 CNY，不做汇率换算；数据模型保留三位币种代码。

## 动态模块恢复

- 所有顶层 Admin lazy import 通过 `admin-lazy-import-recovery.ts` 包装。
- chunk fetch failure 或 15 秒未完成会按模块 session key 自动 reload 一次。
- 自动恢复仍失败时，ErrorBoundary 显示错误并提供真实页面 reload。
- 成功加载会清理对应模块的恢复标记，路由错误边界仍按 route key 隔离。

