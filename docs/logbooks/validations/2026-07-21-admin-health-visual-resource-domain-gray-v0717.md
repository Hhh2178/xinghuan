# 后台健康页视觉精修与公共资源拆域 Gray v0.7.17 验证

## 自动化与构建

- 全量测试：`67 files / 230 tests` 通过。
- `verify:quick`、全 workspace type-check、全量 build、Admin build 通过。
- Admin view model、Starlight shell、系统健康可视化、公共资源和设计文档契约通过。
- pre-push CI 再次完整通过。

## Gray 运行态

- current：`/opt/apps/xinghuan-canvas-next/releases/20260721-admin-health-visual-resource-domain-gray-r1-v0717`
- App / Worker：`active / active`
- 内网与公网状态：`0.7.17 / gray / enforced`
- 权限 readiness：128 subjects、122 published、3 restricted、3 retired、932 rules、5 principals、0 failures。
- 发布后 App/Worker error 级 journal：无记录。

## 页面与路由验证

- `/admin/system/health` 返回 200 并加载本轮 Admin entry。
- `/admin/resources` 返回 200 并加载本轮 Admin entry。
- 兼容路径 `/admin/content/public-resources` 返回 200，前端路由契约解析到 `resources` 工作域。
- 健康页组件契约确认五域、告警、固定拓扑、趋势、容量、事件与 Inspector 均存在；failed/cancelled 保持分离。
- 视觉最终验收由已登录的 Gray 管理员页面完成；本记录不伪造未执行的登录态截图结论。

## Production 边界

- 本轮没有执行 Production deploy、restart、migration 或配置写入。
- Production canonical state 保持 `v0.7.13 / 20260720-media-node-runtime-resume-prod-r1-v0713`。
- 远端复核：Production current 未变化，服务 active，启动时间仍为 `2026-07-20 22:59:22 CST`，状态返回 `0.7.13 / production / enforced`。

## Retention

- Gray retention 先 dry-run，再通过受控脚本删除旧 `20260721-canvas-node-cost-badge-gray-r1-v0717` release（308,350,976 bytes）。
- 最终保留当前 release、`20260721-admin-system-health-gray-r1-v0717` 回滚锚点和 `20260721-node-cost-badge-placement-gray-r2-v0717`，共 3 个。
- 删除仅作用于服务器历史 release 目录，不涉及 shared 数据、数据库、备份或用户素材；旧代码仍可由 Git 与历史制品重新构建。
