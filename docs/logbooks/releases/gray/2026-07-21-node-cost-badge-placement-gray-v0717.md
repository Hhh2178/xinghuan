# 费用角标框外贴边 Gray v0.7.17 补修

- release：`20260721-node-cost-badge-placement-gray-r2-v0717`
- source commit：`e45c4dc`
- archive：`20260721-node-cost-badge-placement-gray-r2-v0717.tar.gz`
- 回滚：`20260721-canvas-node-cost-badge-gray-r1-v0717`

## 变更

- 版本号按要求继续保持 `v0.7.17`。
- 费用角标从节点标题区上方的半覆盖位置移到节点框外左上方。
- 角标左边缘与节点左边缘对齐，角标底边贴住节点顶边。
- 移除角标画布色外圈阴影，避免贴边位置出现视觉缝隙。
- 计费数据、价格切换、无价格隐藏和任务费用结算逻辑均未改变。

## 环境边界

- 本轮仅部署 Gray。
- Production 保持 `v0.7.13 / 20260720-media-node-runtime-resume-prod-r1-v0713`，未执行 Production 部署。
- Gray retention 保留当前补修 release、上一费用角标 release 和 v0.7.15 回滚层；旧 v0.7.14 Gray 目录已由受控脚本清理。
