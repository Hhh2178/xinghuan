# 费用角标框外贴边 Gray v0.7.17 验证

## 已通过

- Release current：`/opt/apps/xinghuan-canvas-next/releases/20260721-node-cost-badge-placement-gray-r2-v0717`
- App / Worker：`active / active`
- 公网与内网状态：`0.7.17 / gray / enforced`
- 权限 readiness：128 subjects、122 published、3 restricted、3 retired、932 rules、5 principals、0 failures。
- 自动化：63 个测试文件 / 221 项测试，全量 build、CI、project/workspace/release harness 与发布门禁通过。
- 定位契约：`bottom: 100%`、`left: 0`、`transform: none`。

## 真实页面几何验收

- Gray 当前画布存在可见费用角标 `预计 ¥7.2`。
- 角标左边缘与所属节点左边缘差值：`0px`。
- 角标底边与所属节点顶边间隙：`0px`。
- 角标位于节点框外，未覆盖视频节点标题和服务商/模型摘要。
- 页面检查期间没有 error 或 warning 级控制台日志。
- 发布后十分钟内 App/Worker 持续 active，systemd 无 error 级日志。
- Gray retention 保留当前补修 release、上一 v0.7.17 release 和 v0.7.15；受控删除旧 `20260721-upload-node-zoom-sizing-gray-r1-v0714`（约 294 MiB）。

## 环境边界

- Production 仍为 `v0.7.13 / production / enforced`，本轮未部署生产。
