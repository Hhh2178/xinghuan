# 后台费用计费与模块恢复 Gray v0.7.15 验证

## 已通过

- Release current：`/opt/apps/xinghuan-canvas-next/releases/20260721-admin-cost-accounting-gray-r1-v0715`
- App service / Worker service：`active / active`
- 公网与内网状态：`0.7.15 / gray / enforced`
- 权限 readiness：128 subjects、122 published、3 restricted、3 retired、932 rules、5 principals、0 failures
- PostgreSQL：`xinghuan_canvas_gray`；`xh_model_pricing_versions`、`xh_task_cost_items`、`trg_xh_task_cost_ledger` 存在
- Gray 管理员只读冒烟：`GET /api/admin/model-pricing` 与 `GET /api/admin/analytics/cost-summary?currency=CNY` 均为 200，响应契约完整
- 真实 UI：模型目录路由加载成功并可展开模型高级窗口；费用分析页完整显示筛选、CNY KPI、服务商/模型/用户组/账号费用区、每日柱状趋势和历史未定价说明
- 自动化：8 项费用/恢复定向测试；全量 58 个测试文件 / 207 项测试；9 个 workspace type-check；全量 build、CI、project/workspace harness、release gates
- Gray retention 已执行：仅保留当前 v0.7.15、回滚锚点 v0.7.14 和上一稳定 v0.7.13；超额旧 Gray release 已按受控脚本清理。

## 计费规则证据

- 默认币种 CNY，不换算；按次或按秒，秒数向上取整为整数。
- 任务成功计费；本地取消或上游取消失败计费；上游确认取消成功不计费；失败任务不计费。
- 价格、模型、服务商、账号和用户组按任务创建时快照，终态台账只结算一次，后续改价不追溯。
- 上线前历史任务无台账回填，费用页统一标记为“未定价”。

## 环境边界

- Production 公网状态仍为 `0.7.13 / production / enforced`。
- Production release 仍为 `20260720-media-node-runtime-resume-prod-r1-v0713`；本轮未执行任何 Production 部署。
