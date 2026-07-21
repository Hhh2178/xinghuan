# 后台健康页视觉精修与公共资源拆域 Production v0.7.17

- release：`20260721-admin-health-visual-resource-domain-prod-r1-v0717`
- source artifact：Gray 已验收 `20260721-admin-health-visual-resource-domain-gray-r1-v0717.tar.gz`
- source commit：`daaee45`
- 部署时间：`2026-07-21`
- 回滚：`20260720-media-node-runtime-resume-prod-r1-v0713`

## 晋级内容

- 系统健康页统一为 Provider 页面视觉语言，并补齐运行态势、固定拓扑、趋势与容量表达。
- 公共资源从内容发布中剥离为独立一级工作域 `/admin/resources`，旧深链保持兼容。
- 晋级 Gray 已验收的模型费用版本、任务费用快照、审计统计及画布生成节点费用提示能力。
- 版本保持 `v0.7.17`，Production 复用 Gray 同一制品，不重新构建或递增版本。

## 数据与回滚

- 切换前备份：`20260721-before-admin-health-visual-resource-domain-v0717-r1.dump`，75,408,526 bytes。
- 数据库迁移：`025_task_cost_ledger.sql` 已应用。
- Production 数据库仍为 `xinghuan_canvas_next`，与预期目标一致。
- 回滚时将 `current` 指回 v0.7.13 release，并重启 API 与 Worker；数据库备份保留。

## 发布关注项

- `npm ci` 报告 1 个 high 与 1 个 low 依赖审计项，本轮不在生产现场直接升级依赖，后续独立排查和修复。
- 系统观测显示近 24 小时任务失败率 18.24%、revision conflict 56 次，属于发布前已存在的运行趋势，继续专项观察。
