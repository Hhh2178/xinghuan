# 后台健康页视觉精修与公共资源拆域 Production v0.7.17 验证

## 发布前

- Release Harness、工作树清洁检查、67 个测试文件 / 230 项测试和全 workspace build 通过。
- Production v0.7.13 API、Worker、输出清理 timer 均 active，数据库目标匹配。
- 部署与严格 runtime 验证 dry-run 通过；切换前数据库备份成功。

## Production 运行态

- current：`/opt/apps/xinghuan-canvas/releases/20260721-admin-health-visual-resource-domain-prod-r1-v0717`
- API / Worker / timer：`active / active / active`
- 内网与公网状态：`0.7.17 / production / enforced`
- 权限 readiness：142 subjects、124 published、12 restricted、6 retired、2820 rules、11 principals、0 failures。
- 数据库：`xinghuan_canvas_next`，目标匹配；`025_task_cost_ledger.sql` 已登记。
- 发布后 API / Worker error 级 journal：无记录。
- Nginx 配置检查通过，请求 ID 响应头保持完整。

## 路由与观测

- `/`、`/admin`、`/admin/system/health`、`/admin/resources`、`/admin/content/public-resources` 内网均返回 200。
- 公网首页、系统健康、公共资源和旧兼容路径均返回 200。
- `verify:request-chain-observability` 与 `verify:system-observability` 通过，最近 24 小时 requestId 覆盖率为 100%。
- 已登录态最终视觉验收仍由管理员在 Production 页面完成；本记录不伪造未执行的浏览器登录态截图。

## 运行关注项

- 系统健康真实报告最近 24 小时 455 个已结束任务中 83 个失败，失败率 18.24%。
- 最近 24 小时 revision conflict 为 56 次，系统状态为 critical；这两项不影响本次部署成功判定，但需要后续专项治理。
- `npm ci` 依赖审计报告 1 个 high、1 个 low，未在生产部署窗口执行无审查的自动修复。
