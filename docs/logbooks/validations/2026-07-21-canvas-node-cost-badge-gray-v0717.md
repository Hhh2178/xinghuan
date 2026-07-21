# 画布生成节点费用提示 Gray v0.7.17 验证

## 已通过

- Release current：`/opt/apps/xinghuan-canvas-next/releases/20260721-canvas-node-cost-badge-gray-r1-v0717`
- App / Worker：`active / active`
- Nginx：配置语法通过。
- 内网状态：`0.7.17 / gray / enforced`
- 权限 readiness：128 subjects、122 published、3 restricted、3 retired、932 rules、5 principals、0 failures。
- 远端后台分页与环境同步 no-op smoke 通过。
- 本地自动化：63 个测试文件 / 221 项测试，全量 API/Web build、CI、project/workspace/release harness 与发布门禁通过。
- 发布后复查：Gray 公网 `0.7.17 / gray / enforced`，Production 公网仍为 `0.7.13 / production / enforced`；App/Worker 继续 active，最近 10 分钟无 error 级 systemd 日志。
- Gray retention：保留 `v0.7.17`、`v0.7.15`、`v0.7.14`，受控删除旧 Gray `20260720-media-node-runtime-resume-gray-r2-v0713`（约 294 MiB）。

## 费用展示契约

- 模型目录接口只在存在当前且启用的价格版本时返回 `pricing`；因此未定价模型在节点上完全隐藏费用窗口及金币图标。
- 当前 Gray 数据库生效价格版本数为 0，活体接口返回的模型均不带 `pricing`，符合“后台未设置计费则不显示”的要求。
- 模型/服务商切换后即时重算、按次/按秒预估、任务快照匹配与多币种提示由 `nodeCostDisplay`、模型目录和费用摘要测试覆盖。
- 未写入演示价格，避免用虚构金额污染不可变价格历史；待运营配置真实价格后再进行带金额的业务验收。

## 环境边界

- Production 状态仍为 `v0.7.13 / production / enforced`。
- Production release 仍为 `20260720-media-node-runtime-resume-prod-r1-v0713`；本轮未部署 Production。
