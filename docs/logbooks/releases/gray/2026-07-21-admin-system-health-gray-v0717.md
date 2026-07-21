# 后台系统健康可视化 Gray v0.7.17

- release：`20260721-admin-system-health-gray-r1-v0717`
- source commit：`d8aff9d`
- archive：`20260721-admin-system-health-gray-r1-v0717.tar.gz`（1.81 MiB）
- 回滚：`20260721-node-cost-badge-placement-gray-r2-v0717`

## 变更

- 按用户要求版本继续保持 `v0.7.17`，仅建立新的 Gray release。
- 建立根级 `DESIGN.md`、后台设计规范入口与系统健康可视化标准。
- Worker runtime key 增加 environment namespace；API 使用 scan 并按 exact queue 汇总，修复 Gray/Production 槽位混算和 RunningHub 并发异常显示的根因。
- 任务健康改为失败率、7d/30d 同粒度基线和最小样本量；failed/cancelled 分离，缺少数据返回 unknown。
- `/api/admin/system` 增加范围、新鲜度、有界趋势桶与 DB/Redis queue consistency。
- 系统健康页重构为告警、五域卡、固定拓扑、SVG 趋势、队列容量、事件时间线与 Inspector；支持范围切换、可见时轮询和旧请求取消。

## 环境边界

- 本轮只部署 Gray。
- Production 保持 `v0.7.13 / 20260720-media-node-runtime-resume-prod-r1-v0713`，未部署、未重启、未改配置。
- Gray retention 保留本 release、上一费用角标补修 release 与费用角标首发回滚 release。
