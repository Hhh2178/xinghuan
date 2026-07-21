# 后台费用计费与模块恢复 Gray v0.7.15 发布

- release：`20260721-admin-cost-accounting-gray-r1-v0715`
- source commit：`2396f80`
- archive：`20260721-admin-cost-accounting-gray-r1-v0715.tar.gz`
- 回滚：`20260721-upload-node-zoom-sizing-gray-r1-v0714`

## 变更

- 为模型新增不可变价格版本，默认人民币，可按次或按整数秒计费；新任务创建时固定服务商、模型、账号、用户组和价格快照。
- 成功任务计费；用户取消但上游未确认取消（包括未配置取消端口）仍计费，上游确认取消成功不计费；失败任务不计费。
- 数据分析与审计新增费用分析，按服务商、模型、用户组、账号和日期展示 CNY 费用及柱状趋势；不做汇率换算。
- 上线前历史任务不回算，独立计入“未定价”。
- Admin 动态模块增加 15 秒加载超时、单次自动刷新防循环和真实页面刷新恢复，避免子页面永久停留在加载态。

## 验证

- 本地 `58 files / 207 tests`、9 个 workspace type-check、全量 build、CI、project/workspace harness 和 release gates 通过。
- Gray API/Worker active，公网/内网返回 `0.7.15 / gray / enforced`；权限 readiness 为 128 subjects、932 rules、5 principals、0 failures。
- 数据库迁移 025 已应用，价格版本表、费用台账表及 `trg_xh_task_cost_ledger` 存在；未自动回填历史价格或费用。
- 真实管理员只读会话验证模型价格与 CNY 费用汇总 API 均返回 200。
- 真实 Gray UI 验证模型目录可加载并可展开模型高级窗口；费用分析页显示 CNY、四维费用区、每日柱状趋势及 360 条历史未定价任务，无模块加载失败。

本轮只部署 Gray；Production 保持 `v0.7.13`，未执行 Production 部署。
