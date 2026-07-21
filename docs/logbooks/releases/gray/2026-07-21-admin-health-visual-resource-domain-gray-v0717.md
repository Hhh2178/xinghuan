# 后台健康页视觉精修与公共资源拆域 Gray v0.7.17

- release：`20260721-admin-health-visual-resource-domain-gray-r1-v0717`
- source commit：`daaee45`
- archive：`20260721-admin-health-visual-resource-domain-gray-r1-v0717.tar.gz`（1.82 MiB）
- 回滚：`20260721-admin-system-health-gray-r1-v0717`

## 变更

- 按用户要求继续保持 `v0.7.17`，仅建立新的 Gray release。
- 系统健康首屏从五张同权重大卡改为一体化运行态势、活动告警和五域摘要条。
- 服务链路改为固定执行拓扑；任务趋势补齐范围摘要、Y 轴刻度、网格、时间标签、单位和聚合来源。
- 队列容量改为带配置上限、安全阈值、实际槽位、深度和 Worker 数的 bullet bar。
- 健康状态统一为中文业务文案，背景、描边、按钮和信息密度与 Provider 页面统一。
- 公共资源从“内容与资源”剥离为独立一级工作域，入口为 `/admin/resources`；公告收敛到“内容发布”，旧深链继续兼容。

## 环境边界

- 本轮只部署 Gray。
- Production 保持 `v0.7.13 / 20260720-media-node-runtime-resume-prod-r1-v0713`，未部署、未重启、未改配置。
