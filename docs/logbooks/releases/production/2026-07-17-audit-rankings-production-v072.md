# v0.7.2 审计账号与分组排行榜 Production 发布

## 发布信息

- release：`20260717-audit-rankings-prod-r1-v072`
- 来源 Gray：`20260717-audit-rankings-gray-r2-v072`
- source commit：`ec47e189af9c93a345d458f652af4182b9537cd9`
- 发布包与 Gray 相同，SHA-256：`8418c98d9e48abc8fedbf4bae5ce1775bb9134576c7332c715663a87ceb9a986`
- 回滚：`20260717-group-retry-catalog-order-prod-r1-v070`

## 数据保护

- 发布前全库 custom dump：`/opt/apps/xinghuan-canvas/shared/backups/20260717-audit-rankings-prod-pre-v072.dump`。
- 备份大小 `19,972,418` bytes，`pg_restore --list` 通过。
- 发布前数据库为 `xinghuan_canvas_next`，用户 27、画布 38、素材 151、任务 7069、会话 52。
- 本批次无新增迁移，`db:migrate` 为 `applied: [] / skipped: 23`；部署窗口内业务数据继续正常新增。

## 部署内容

- 账号排行榜显示完整账号目录和历史归属行，包含零用量账号。
- 分组能量条显示全部当前分组和适用的未分组历史行，包含零用量分组。
- 两个面板保持既有尺寸，列表从顶部紧凑排列，数量超出时使用内部纵向滚动。
- 账号模型/RH 下钻、全局模型和 RH 调用统计保持原有口径。

## 结果

- API、Worker、output prune timer active；Nginx 配置通过。
- 内外网 `/api/status` 均为 `v0.7.2 / production / enforced`。
- readiness：134 Subjects、120 published、10 restricted、4 retired、466 rules、11 principals、0 failures。
- request-id 覆盖率 100%，数据库目标匹配，发布后 API/Worker error 级日志无条目。
- 正式后台审计页显示 27 个账号和 10 个分组；排序、贴顶和内部溢出策略均通过，控制台 0 errors。

## 已知观察

- 24 小时任务失败与 canvas revision conflict 告警延续发布前既有趋势，不是本批次新增错误。
- npm audit 仍有 1 个 low severity dependency issue；Vite 主 chunk 仍有既有体积 warning。
